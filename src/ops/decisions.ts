import { randomBytes } from "crypto";
import { logEvent } from "../services/logEvent";
import { OpsRepository } from "../storage/OpsRepository";
import { pacific } from "./cells";
import { locateColumns, TABS } from "./reviewSheet";
import { Sheet } from "./sheet";

// Applies the reviewers' new decisions from the Review tab (4.5, Apply only new
// decisions, once a day / Every run is checked). Only rows whose "applied at"
// stamp is empty are acted on, so leaving Accept in the sheet never re-accepts
// anyone. Changes only go through accept_applicants, reject_applicants and
// reopen_payment_window. Without apply it only reports what it would do.

type Action = "accept" | "reject" | "reopen";
type Item = { row: number; attendeeId: string; action: Action };
type RowNote = { row: number; message: string };

type AttendeeState = {
  attendee_id: string;
  event_id: string;
  status: string | null;
  acceptance_version: number;
  payment_due_at: string | null;
  reviewed_at: string | null;
  Notification_Hook: { type: string; acceptance_version: number }[];
};

export type DecisionPlan = {
  accept: Item[];
  reject: Item[];
  reopen: Item[];
  // Already done in the database (e.g. a run that crashed before stamping): stamp only
  repair: Item[];
  errors: RowNote[];
  waiting: RowNote[];
};

export type RunResult = DecisionPlan & {
  runId: string;
  applied: boolean;
  stamped: Item[];
  conflicts: RowNote[];
};

const GRACE_MS = 60 * 60 * 1000;

export const newRunId = (now = new Date()) =>
  `run-${now.toISOString().replace(/[-:]/g, "").slice(0, 15)}-${randomBytes(2).toString("hex")}`;

const loadStates = async (attendeeIds: string[]) => {
  if (!attendeeIds.length) return new Map<string, AttendeeState>();
  const { data, error } = await OpsRepository.getAttendeeStates(attendeeIds);
  if (error) throw new Error(`Couldn't load attendees: ${error.message}`);
  return new Map((data as unknown as AttendeeState[]).map((a) => [a.attendee_id, a]));
};

const hasHook = (state: AttendeeState, type: string) =>
  state.Notification_Hook.some((h) => h.type === type && h.acceptance_version === state.acceptance_version);

// Works out what each new decision needs, without changing anything. Rows that
// can't be applied get a reason and wait for a person.
export const planDecisions = async (rows: string[][], eventId: string, now = new Date()): Promise<DecisionPlan> => {
  const cols = locateColumns(rows[0] ?? []);
  const plan: DecisionPlan = { accept: [], reject: [], reopen: [], repair: [], errors: [], waiting: [] };
  const body = rows.slice(1).map((r, i) => ({ row: i + 1, cells: r }));
  const cell = (r: string[], c: number) => (r[c] ?? "").trim();

  const counts = new Map<string, number>();
  for (const { cells } of body) {
    const id = cell(cells, cols.attendeeId);
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  type Pending = { row: number; attendeeId: string; decision?: "accept" | "reject"; reopen: boolean; decisionApplied: boolean };
  const pending: Pending[] = [];
  for (const { row, cells } of body) {
    const attendeeId = cell(cells, cols.attendeeId);
    const decision = cell(cells, cols.decision).toLowerCase();
    const decisionApplied = !!cell(cells, cols.decisionApplied);
    const reopen = cell(cells, cols.reopen).toUpperCase() === "TRUE" && !cell(cells, cols.reopenApplied);
    const newDecision = !!decision && !decisionApplied;
    if (!attendeeId || (!newDecision && !reopen)) continue;

    if ((counts.get(attendeeId) ?? 0) > 1) {
      plan.errors.push({ row, message: "This attendee_id is in the sheet more than once" });
      continue;
    }
    if (newDecision && decision !== "accept" && decision !== "reject") {
      plan.errors.push({ row, message: `Unknown Decision "${cell(cells, cols.decision)}" (use Accept or Reject)` });
      continue;
    }
    pending.push({
      row,
      attendeeId,
      decision: newDecision ? (decision as "accept" | "reject") : undefined,
      reopen,
      decisionApplied,
    });
  }

  const states = await loadStates(pending.map((p) => p.attendeeId));
  for (const p of pending) {
    const state = states.get(p.attendeeId);
    if (!state || state.event_id !== eventId) {
      plan.errors.push({ row: p.row, message: "Not an applicant for this event" });
      continue;
    }
    const status = state.status ?? "no status";

    if (p.decision === "accept") {
      if (status === "APPLIED") plan.accept.push({ row: p.row, attendeeId: p.attendeeId, action: "accept" });
      else if ((status === "ACCEPTED" || status === "REGISTERED") && state.reviewed_at)
        plan.repair.push({ row: p.row, attendeeId: p.attendeeId, action: "accept" });
      else plan.errors.push({ row: p.row, message: `Can't accept: the student is now ${status}` });
    }
    if (p.decision === "reject") {
      if (status === "APPLIED" || status === "ACCEPTED")
        plan.reject.push({ row: p.row, attendeeId: p.attendeeId, action: "reject" });
      else if (status === "REJECTED") plan.repair.push({ row: p.row, attendeeId: p.attendeeId, action: "reject" });
      else plan.errors.push({ row: p.row, message: `Can't reject: the student is now ${status}` });
    }

    if (p.reopen) {
      const reopenFrom = state.payment_due_at ? new Date(state.payment_due_at).getTime() + GRACE_MS : null;
      if (!p.decisionApplied) {
        plan.errors.push({ row: p.row, message: "Re-open needs an applied Accept first" });
      } else if (status !== "ACCEPTED") {
        plan.errors.push({ row: p.row, message: `Can't re-open: the student is now ${status}` });
      } else if (reopenFrom !== null && now.getTime() >= reopenFrom) {
        plan.reopen.push({ row: p.row, attendeeId: p.attendeeId, action: "reopen" });
      } else if (state.acceptance_version >= 2 && hasHook(state, "accepted")) {
        // Only a reopen takes the version past 1, so this one already happened
        plan.repair.push({ row: p.row, attendeeId: p.attendeeId, action: "reopen" });
      } else {
        const until = reopenFrom === null ? "the payment deadline has passed" : pacific(new Date(reopenFrom).toISOString());
        plan.waiting.push({ row: p.row, message: `Re-open waits until ${until}` });
      }
    }
  }
  return plan;
};

// The database shows the change: right status, version and hook
const verified = (item: Item, state: AttendeeState | undefined) => {
  if (!state) return false;
  switch (item.action) {
    case "accept":
      return (state.status === "ACCEPTED" || state.status === "REGISTERED") && hasHook(state, "accepted");
    case "reject":
      return state.status === "REJECTED" && hasHook(state, "rejected");
    case "reopen":
      return state.status === "ACCEPTED" && state.acceptance_version >= 2 && hasHook(state, "accepted");
  }
};

export const runDecisions = async (
  sheet: Sheet,
  eventId: string,
  { reviewer, apply, now = new Date() }: { reviewer: string; apply: boolean; now?: Date }
): Promise<RunResult> => {
  const { data: event, error: eventError } = await OpsRepository.getEvent(eventId);
  if (eventError || !event) throw new Error(`Event ${eventId} not found`);
  if (!event.needs_review) throw new Error(`${event.name} doesn't use review`);

  const rows = await sheet.read(TABS.review);
  const plan = await planDecisions(rows, eventId, now);
  const runId = newRunId(now);
  const result: RunResult = { ...plan, runId, applied: apply, stamped: [], conflicts: [] };
  if (!apply) return result;

  const cols = locateColumns(rows[0]);
  const failed = new Set<number>();
  const calls: [Action, Item[], typeof OpsRepository.acceptApplicants][] = [
    ["accept", plan.accept, OpsRepository.acceptApplicants],
    ["reject", plan.reject, OpsRepository.rejectApplicants],
    ["reopen", plan.reopen, OpsRepository.reopenPaymentWindow],
  ];
  for (const [, items, call] of calls) {
    if (!items.length) continue;
    const { data, error } = await call(eventId, items.map((i) => i.attendeeId), reviewer);
    if (error) {
      // All-or-nothing: nobody in this group changed
      for (const i of items) {
        failed.add(i.row);
        result.conflicts.push({ row: i.row, message: error.message });
      }
    } else if (data !== items.length) {
      // A shortfall is a conflict, never a success; the read-back says which rows
      console.error(`${runId}: asked for ${items.length}, the database changed ${data}`);
    }
  }

  // Read every row back before stamping the sheet
  const toCheck = [...plan.accept, ...plan.reject, ...plan.reopen, ...plan.repair].filter((i) => !failed.has(i.row));
  const after = await loadStates(toCheck.map((i) => i.attendeeId));
  for (const item of toCheck) {
    if (verified(item, after.get(item.attendeeId))) result.stamped.push(item);
    else
      result.conflicts.push({
        row: item.row,
        message: `Not applied: the database shows ${after.get(item.attendeeId)?.status ?? "no attendee"}`,
      });
  }

  const stamp = pacific(now.toISOString());
  const cells: { row: number; col: number; value: string }[] = [];
  for (const item of result.stamped) {
    cells.push({ row: item.row, col: item.action === "reopen" ? cols.reopenApplied : cols.decisionApplied, value: stamp });
    cells.push({ row: item.row, col: cols.runId, value: runId });
    cells.push({ row: item.row, col: cols.lastError, value: "" });
  }
  for (const note of [...plan.errors, ...plan.waiting, ...result.conflicts]) {
    cells.push({ row: note.row, col: cols.runId, value: runId });
    cells.push({ row: note.row, col: cols.lastError, value: note.message });
  }
  await sheet.update(TABS.review, cells);

  // The cap must hold after every run
  const { data: taken } = await OpsRepository.seatsTaken(eventId);
  if (event.max_attendees !== null && typeof taken === "number" && taken > event.max_attendees) {
    logEvent("CAPACITY_INVARIANT_FAILED", { eventId, seatsTaken: taken, maxAttendees: event.max_attendees, runId });
  }
  if (plan.errors.length || result.conflicts.length) {
    logEvent("REVIEW_RUN_FAILED", { eventId, runId, errors: plan.errors.length, conflicts: result.conflicts.length });
  }
  return result;
};
