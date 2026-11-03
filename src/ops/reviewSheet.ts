import { OpsRepository } from "../storage/OpsRepository";
import { pacific, spreadsheetSafe, yesNo } from "./cells";
import { Sheet } from "./sheet";

// The shared review sheet (4.5, Review sheet). Tabs:
//   Raw export       replaced on every sync
//   Review           one row per attendee_id, never pasted over
//   Messages         who is due a message now (manual sending)
//   Payment issues   refunds the events team needs to follow up
export const TABS = {
  raw: "Raw export",
  review: "Review",
  messages: "Messages",
  paymentIssues: "Payment issues",
} as const;

// Review tab columns, found by header so the sheet's order can change. Headers
// only have to start with these (the Re-open header carries its warning).
export const REVIEW = {
  attendeeId: "attendee_id",
  // Answers: written when the row is added, then left alone
  submitted: "Submitted (PT)",
  name: "Name",
  email: "Email",
  phone: "Phone",
  member: "Member",
  whyEvent: "Why this event",
  whyPm: "Why PM",
  experience: "Experience",
  // System: refreshed on every sync
  status: "Status",
  payBy: "Pay by (PT)",
  reopenFrom: "Reopen from (PT)",
  reminderDue: "Reminder due",
  resume: "Resume link",
  acceptanceSent: "Acceptance sent (PT)",
  rejectionSent: "Rejection sent (PT)",
  reminderSent: "Reminder sent (PT)",
  // Reviewers
  decision: "Decision",
  reopen: "Re-open payment window?",
  notes: "Notes",
  // The decision run (protected from reviewers)
  decisionApplied: "Decision applied at",
  reopenApplied: "Re-open applied at",
  runId: "Run ID",
  lastError: "Last error",
} as const;

export type ReviewColumn = keyof typeof REVIEW;

const HEADER_TEXT: Partial<Record<ReviewColumn, string>> = {
  reopen: "Re-open payment window? (gives the student a new reserved seat; only works from Reopen from)",
};

export const REVIEW_HEADER = (Object.keys(REVIEW) as ReviewColumn[]).map((c) => HEADER_TEXT[c] ?? REVIEW[c]);

const SYSTEM_COLUMNS: ReviewColumn[] = [
  "status",
  "payBy",
  "reopenFrom",
  "reminderDue",
  "resume",
  "acceptanceSent",
  "rejectionSent",
  "reminderSent",
];

// Where each column is in this sheet's header row
export const locateColumns = (header: string[]): Record<ReviewColumn, number> => {
  const found = {} as Record<ReviewColumn, number>;
  const missing: string[] = [];
  for (const column of Object.keys(REVIEW) as ReviewColumn[]) {
    const index = header.findIndex((h) => h.trim().startsWith(REVIEW[column]));
    if (index === -1) missing.push(REVIEW[column]);
    found[column] = index;
  }
  if (missing.length) throw new Error(`The Review tab is missing columns: ${missing.join(", ")}`);
  return found;
};

type SheetRow = Awaited<ReturnType<typeof loadRows>>[number];

const loadRows = async (eventId: string) => {
  const { data, error } = await OpsRepository.reviewSheetRows(eventId);
  if (error) throw new Error(`Couldn't load applicants: ${error.message}`);
  // Signed again on every sync, so a link in the sheet is never older than 7 days
  return Promise.all(
    (data ?? []).map(async (row) => {
      let resumeLink = "";
      if (row.resume_path) {
        const signed = await OpsRepository.signResume(row.resume_path);
        if (signed.error) throw new Error(`Couldn't sign the resume for ${row.attendee_id}: ${signed.error.message}`);
        resumeLink = signed.data.signedUrl;
      }
      return { ...row, resumeLink };
    })
  );
};

const valueFor = (row: SheetRow, column: ReviewColumn): string => {
  switch (column) {
    case "attendeeId":
      return row.attendee_id;
    case "submitted":
      return pacific(row.submitted_at);
    case "name":
      return spreadsheetSafe(row.name);
    case "email":
      return spreadsheetSafe(row.email);
    case "phone":
      return spreadsheetSafe(row.phone);
    case "member":
      return yesNo(row.is_member);
    case "whyEvent":
      return spreadsheetSafe(row.why_event);
    case "whyPm":
      return spreadsheetSafe(row.why_pm);
    case "experience":
      return spreadsheetSafe(row.experience);
    case "status":
      return row.status ?? "";
    case "payBy":
      return pacific(row.payment_due_at);
    case "reopenFrom":
      return pacific(row.reopen_from);
    case "reminderDue":
      return row.reminder_due ? "Yes" : "";
    case "resume":
      return row.resumeLink;
    case "acceptanceSent":
      return pacific(row.acceptance_sent_at);
    case "rejectionSent":
      return pacific(row.rejection_sent_at);
    case "reminderSent":
      return pacific(row.reminder_sent_at);
    default:
      // Reviewer and decision-run columns start empty
      return "";
  }
};

const RAW_COLUMNS: ReviewColumn[] = [
  "attendeeId",
  "status",
  "submitted",
  "name",
  "email",
  "phone",
  "member",
  "whyEvent",
  "whyPm",
  "experience",
  "resume",
  "payBy",
  "reopenFrom",
  "reminderDue",
  "acceptanceSent",
  "rejectionSent",
  "reminderSent",
];

// Raw export is replaced. Review gets new applicants appended and only its system
// columns refreshed, looked up by attendee_id; names and emails are never used
// to match rows, and reviewer columns are never written.
export const syncReviewSheet = async (sheet: Sheet, eventId: string) => {
  const rows = await loadRows(eventId);

  await sheet.replace(TABS.raw, [
    RAW_COLUMNS.map((c) => REVIEW[c]),
    ...rows.map((row) => RAW_COLUMNS.map((c) => valueFor(row, c))),
  ]);

  let existing = await sheet.read(TABS.review);
  if (!existing.length) {
    await sheet.replace(TABS.review, [REVIEW_HEADER]);
    existing = [REVIEW_HEADER];
  }
  const cols = locateColumns(existing[0]);
  const rowsById = new Map<string, number[]>();
  existing.slice(1).forEach((r, i) => {
    const id = (r[cols.attendeeId] ?? "").trim();
    if (id) rowsById.set(id, [...(rowsById.get(id) ?? []), i + 1]);
  });

  const cells: { row: number; col: number; value: string }[] = [];
  const added: string[][] = [];
  for (const row of rows) {
    const sheetRows = rowsById.get(row.attendee_id);
    if (!sheetRows) {
      const values = new Array(existing[0].length).fill("");
      for (const column of Object.keys(REVIEW) as ReviewColumn[]) values[cols[column]] = valueFor(row, column);
      added.push(values);
      continue;
    }
    // A duplicated row is refreshed too; the decision run refuses to act on it
    for (const sheetRow of sheetRows) {
      for (const column of SYSTEM_COLUMNS) {
        const value = valueFor(row, column);
        if ((existing[sheetRow][cols[column]] ?? "") !== value) cells.push({ row: sheetRow, col: cols[column], value });
      }
    }
  }
  await sheet.update(TABS.review, cells);
  await sheet.append(TABS.review, added);
  return { applicants: rows.length, added: added.length, cellsRefreshed: cells.length };
};

// Payment issues tab, replaced each sync. A blank refund id means the refund
// didn't finish; retry-refunds fixes those.
export const syncPaymentIssues = async (sheet: Sheet, eventId: string) => {
  const { data, error } = await OpsRepository.paymentIssues(eventId);
  if (error) throw new Error(`Couldn't load payment issues: ${error.message}`);
  const issues = data ?? [];
  await sheet.replace(TABS.paymentIssues, [
    ["checkout_id", "attendee_id", "Name", "Email", "Amount", "Payment id", "Refund id", "Reason", "Handled (PT)"],
    ...issues.map((i) => [
      i.checkout_id,
      i.attendee_id,
      spreadsheetSafe(i.name),
      spreadsheetSafe(i.email),
      i.amount_cents === null ? "" : `$${(i.amount_cents / 100).toFixed(2)}`,
      i.payment_id ?? "",
      i.refund_id ?? "",
      i.attention_reason,
      pacific(i.handled_at),
    ]),
  ]);
  return { issues: issues.length, missingRefunds: issues.filter((i) => !i.refund_id).length };
};

export const MESSAGES_HEADER = ["notification_id", "Type", "Name", "Email", "Pay by (PT)", "Amount due", "Due since (PT)", "Sent"];
const TYPE_LABEL: Record<string, string> = {
  application_received: "Receipt",
  accepted: "Accepted",
  rejected: "Rejected",
  reminder: "Reminder",
};

// The rows in the Messages tab the events team ticked as sent
export const tickedMessages = (rows: string[][]) => {
  const [header, ...body] = rows;
  if (!header) return [];
  const id = header.indexOf("notification_id");
  const sent = header.indexOf("Sent");
  if (id === -1 || sent === -1) throw new Error("The Messages tab is missing its notification_id or Sent column");
  return body.filter((r) => (r[sent] ?? "").toUpperCase() === "TRUE").map((r) => r[id]);
};

// Messages tab, rebuilt right before sending. It refuses to rebuild while rows
// are ticked as sent but not marked yet, so a tick is never lost.
export const syncMessages = async (sheet: Sheet, eventId: string) => {
  const ticked = tickedMessages(await sheet.read(TABS.messages));
  if (ticked.length) {
    const { data, error } = await OpsRepository.getNotifications(ticked);
    if (error) throw new Error(`Couldn't check the ticked messages: ${error.message}`);
    const unmarked = (data ?? []).filter((n) => !n.sent_at).map((n) => n.notification_id);
    if (unmarked.length) {
      throw new Error(`${unmarked.length} ticked messages aren't marked sent yet; run mark-sent --from-sheet first`);
    }
  }

  const { data, error } = await OpsRepository.messagesDue(eventId);
  if (error) throw new Error(`Couldn't load messages due: ${error.message}`);
  const due = data ?? [];
  await sheet.replace(TABS.messages, [
    MESSAGES_HEADER,
    ...due.map((m) => [
      m.notification_id,
      TYPE_LABEL[m.type] ?? m.type,
      spreadsheetSafe(m.name),
      spreadsheetSafe(m.email),
      pacific(m.payment_due_at),
      m.amount_due ? `$${Number(m.amount_due).toFixed(2)}` : "",
      pacific(m.eligible_at),
      "FALSE",
    ]),
  ]);
  return { due: due.length };
};
