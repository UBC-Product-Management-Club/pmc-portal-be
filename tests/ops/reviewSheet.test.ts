jest.mock("../../src/storage/OpsRepository");

import {
  locateColumns,
  MESSAGES_HEADER,
  REVIEW_HEADER,
  syncMessages,
  syncPaymentIssues,
  syncReviewSheet,
  TABS,
} from "../../src/ops/reviewSheet";
import { OpsRepository } from "../../src/storage/OpsRepository";
import { MemorySheet } from "./memorySheet";

const repo = OpsRepository as jest.Mocked<typeof OpsRepository>;
const cols = locateColumns(REVIEW_HEADER);

const applicant = (id: string, overrides: Record<string, unknown> = {}) => ({
  attendee_id: id,
  status: "APPLIED",
  submitted_at: "2026-11-01T18:00:00Z",
  name: `Student ${id}`,
  email: `${id}@example.com`,
  phone: "604-555-0123",
  is_member: true,
  why_event: "=I like products",
  why_pm: "Because",
  experience: "Some",
  resume_path: `attendee/e-1/${id}/resume.pdf`,
  payment_due_at: null,
  reopen_from: null,
  reminder_due: false,
  acceptance_sent_at: null,
  rejection_sent_at: null,
  reminder_sent_at: null,
  ...overrides,
});

beforeEach(() => {
  (repo.signResume as jest.Mock).mockImplementation(async (path: string) => ({
    data: { signedUrl: `https://signed/${path}` },
    error: null,
  }));
});

describe("syncReviewSheet", () => {
  it("starts the Review tab with its header and adds every applicant", async () => {
    (repo.reviewSheetRows as jest.Mock).mockResolvedValueOnce({ data: [applicant("a-1")], error: null });
    const sheet = new MemorySheet();

    await expect(syncReviewSheet(sheet, "e-1")).resolves.toEqual({ applicants: 1, added: 1, cellsRefreshed: 0 });

    const [header, row] = sheet.tabs[TABS.review];
    expect(header).toEqual(REVIEW_HEADER);
    expect(row[cols.attendeeId]).toBe("a-1");
    expect(row[cols.submitted]).toBe("2026-11-01 10:00 PT"); // standard time from Nov 1
    expect(row[cols.whyEvent]).toBe("'=I like products");
    expect(row[cols.resume]).toBe("https://signed/attendee/e-1/a-1/resume.pdf");
    expect(row[cols.decision]).toBe("");
    expect(sheet.tabs[TABS.raw]).toHaveLength(2);
  });

  it("refreshes only the system columns of existing rows, matched by attendee_id", async () => {
    const existing = [...REVIEW_HEADER].map(() => "");
    existing[cols.attendeeId] = "a-1";
    existing[cols.name] = "Name the reviewers fixed";
    existing[cols.status] = "APPLIED";
    existing[cols.decision] = "Accept";
    existing[cols.notes] = "Strong";
    existing[cols.decisionApplied] = "2026-11-02 09:00 PT";
    const sheet = new MemorySheet({ [TABS.review]: [REVIEW_HEADER, existing] });
    (repo.reviewSheetRows as jest.Mock).mockResolvedValueOnce({
      data: [
        applicant("a-1", {
          status: "ACCEPTED",
          name: "A different name",
          payment_due_at: "2026-11-05T17:00:00Z",
          reopen_from: "2026-11-05T18:00:00Z",
          acceptance_sent_at: "2026-11-02T17:30:00Z",
        }),
        applicant("a-2"),
      ],
      error: null,
    });

    const result = await syncReviewSheet(sheet, "e-1");

    const [, row, added] = sheet.tabs[TABS.review];
    expect(row[cols.status]).toBe("ACCEPTED");
    expect(row[cols.payBy]).toBe("2026-11-05 09:00 PT");
    expect(row[cols.reopenFrom]).toBe("2026-11-05 10:00 PT");
    expect(row[cols.acceptanceSent]).toBe("2026-11-02 09:30 PT");
    // Answers and reviewer columns are never pasted over
    expect(row[cols.name]).toBe("Name the reviewers fixed");
    expect(row[cols.decision]).toBe("Accept");
    expect(row[cols.notes]).toBe("Strong");
    expect(row[cols.decisionApplied]).toBe("2026-11-02 09:00 PT");
    expect(added[cols.attendeeId]).toBe("a-2");
    expect(result.added).toBe(1);
  });

  it("finds columns by header, so the sheet's order can change", async () => {
    const reordered = [...REVIEW_HEADER].reverse();
    const sheet = new MemorySheet({ [TABS.review]: [reordered] });
    (repo.reviewSheetRows as jest.Mock).mockResolvedValueOnce({ data: [applicant("a-1")], error: null });

    await syncReviewSheet(sheet, "e-1");

    const moved = locateColumns(reordered);
    expect(sheet.tabs[TABS.review][1][moved.attendeeId]).toBe("a-1");
  });

  it("stops when the Review tab is missing a column", async () => {
    const sheet = new MemorySheet({ [TABS.review]: [REVIEW_HEADER.filter((h) => h !== "Run ID")] });
    (repo.reviewSheetRows as jest.Mock).mockResolvedValueOnce({ data: [], error: null });

    await expect(syncReviewSheet(sheet, "e-1")).rejects.toThrow("missing columns: Run ID");
  });
});

describe("syncPaymentIssues", () => {
  it("lists open issues and counts the unfinished refunds", async () => {
    (repo.paymentIssues as jest.Mock).mockResolvedValueOnce({
      data: [
        { checkout_id: "cs_1", attendee_id: "a-1", name: "A", email: "a@example.com", amount_cents: 1500, payment_id: "pi_1", refund_id: "re_1", attention_reason: "LATE_PAYMENT", handled_at: "2026-11-05T18:00:00Z" },
        { checkout_id: "cs_2", attendee_id: "a-2", name: "B", email: "b@example.com", amount_cents: 900, payment_id: "pi_2", refund_id: null, attention_reason: "REJECTED", handled_at: null },
      ],
      error: null,
    });
    const sheet = new MemorySheet();

    await expect(syncPaymentIssues(sheet, "e-1")).resolves.toEqual({ issues: 2, missingRefunds: 1 });
    expect(sheet.tabs[TABS.paymentIssues][1]).toEqual(["cs_1", "a-1", "A", "a@example.com", "$15.00", "pi_1", "re_1", "LATE_PAYMENT", "2026-11-05 10:00 PT"]);
  });
});

describe("syncMessages", () => {
  const due = { notification_id: "n-1", attendee_id: "a-1", type: "accepted", acceptance_version: 1, name: "A", email: "a@example.com", payment_due_at: "2026-11-05T17:00:00Z", amount_due: "15", eligible_at: "2026-11-02T17:00:00Z" };

  it("rebuilds the tab with a Sent checkbox per message", async () => {
    (repo.messagesDue as jest.Mock).mockResolvedValueOnce({ data: [due], error: null });
    const sheet = new MemorySheet();

    await syncMessages(sheet, "e-1");

    expect(sheet.tabs[TABS.messages]).toEqual([
      MESSAGES_HEADER,
      ["n-1", "Accepted", "A", "a@example.com", "2026-11-05 09:00 PT", "$15.00", "2026-11-02 09:00 PT", "FALSE"],
    ]);
  });

  it("won't rebuild while a ticked message isn't marked sent, so the tick isn't lost", async () => {
    const sheet = new MemorySheet({ [TABS.messages]: [MESSAGES_HEADER, ["n-1", "Accepted", "", "", "", "", "", "TRUE"]] });
    (repo.getNotifications as jest.Mock).mockResolvedValueOnce({ data: [{ notification_id: "n-1", sent_at: null }], error: null });

    await expect(syncMessages(sheet, "e-1")).rejects.toThrow("run mark-sent --from-sheet first");
    expect(repo.messagesDue).not.toHaveBeenCalled();
  });

  it("rebuilds once the ticked messages are marked", async () => {
    const sheet = new MemorySheet({ [TABS.messages]: [MESSAGES_HEADER, ["n-1", "Accepted", "", "", "", "", "", "TRUE"]] });
    (repo.getNotifications as jest.Mock).mockResolvedValueOnce({ data: [{ notification_id: "n-1", sent_at: "2026-11-02T18:00:00Z" }], error: null });
    (repo.messagesDue as jest.Mock).mockResolvedValueOnce({ data: [], error: null });

    await expect(syncMessages(sheet, "e-1")).resolves.toEqual({ due: 0 });
  });
});
