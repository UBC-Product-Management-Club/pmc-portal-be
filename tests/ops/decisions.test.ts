jest.mock("../../src/storage/OpsRepository");

import { runDecisions } from "../../src/ops/decisions";
import { locateColumns, REVIEW_HEADER, TABS } from "../../src/ops/reviewSheet";
import { OpsRepository } from "../../src/storage/OpsRepository";
import { MemorySheet } from "./memorySheet";

const repo = OpsRepository as jest.Mocked<typeof OpsRepository>;
const cols = locateColumns(REVIEW_HEADER);
const now = new Date("2026-11-10T20:00:00Z");
const hour = 60 * 60 * 1000;

const row = (attendeeId: string, cells: Partial<Record<keyof typeof cols, string>> = {}) => {
  const r = REVIEW_HEADER.map(() => "");
  r[cols.attendeeId] = attendeeId;
  for (const [k, v] of Object.entries(cells)) r[cols[k as keyof typeof cols]] = v!;
  return r;
};
const sheetWith = (...rows: string[][]) => new MemorySheet({ [TABS.review]: [REVIEW_HEADER, ...rows] });
const cell = (sheet: MemorySheet, sheetRow: number, column: keyof typeof cols) => sheet.tabs[TABS.review][sheetRow][column === undefined ? 0 : cols[column]] ?? "";

const state = (id: string, status: string, overrides: Record<string, unknown> = {}) => ({
  attendee_id: id,
  event_id: "e-1",
  status,
  acceptance_version: status === "APPLIED" ? 0 : 1,
  payment_due_at: status === "APPLIED" ? null : new Date(now.getTime() + 48 * hour).toISOString(),
  reviewed_at: status === "APPLIED" ? null : "2026-11-09T20:00:00Z",
  Notification_Hook: [] as { type: string; acceptance_version: number }[],
  ...overrides,
});
const withHook = (s: ReturnType<typeof state>, type: string) => ({
  ...s,
  Notification_Hook: [...s.Notification_Hook, { type, acceptance_version: s.acceptance_version }],
});
// The first lookup is the plan, the second the read-back after applying
const states = (before: object[], after: object[] = []) =>
  (repo.getAttendeeStates as jest.Mock)
    .mockResolvedValueOnce({ data: before, error: null })
    .mockResolvedValueOnce({ data: after, error: null });

beforeEach(() => {
  // Queued values from a test that never read them must not leak into the next
  jest.resetAllMocks();
  (repo.getEvent as jest.Mock).mockResolvedValue({ data: { event_id: "e-1", name: "Product Jackpot", max_attendees: 2, needs_review: true }, error: null });
  (repo.seatsTaken as jest.Mock).mockResolvedValue({ data: 1, error: null });
  jest.spyOn(console, "error").mockImplementation(() => {});
});

const run = (sheet: MemorySheet, apply = true) => runDecisions(sheet, "e-1", { reviewer: "Simoon", apply, now });

describe("runDecisions", () => {
  it("accepts and rejects new decisions, reads them back, then stamps the sheet", async () => {
    const sheet = sheetWith(row("a-1", { decision: "Accept" }), row("a-2", { decision: "reject" }));
    states(
      [state("a-1", "APPLIED"), state("a-2", "APPLIED")],
      [withHook(state("a-1", "ACCEPTED"), "accepted"), withHook(state("a-2", "REJECTED"), "rejected")]
    );
    (repo.acceptApplicants as jest.Mock).mockResolvedValueOnce({ data: 1, error: null });
    (repo.rejectApplicants as jest.Mock).mockResolvedValueOnce({ data: 1, error: null });

    const result = await run(sheet);

    expect(repo.acceptApplicants).toHaveBeenCalledWith("e-1", ["a-1"], "Simoon");
    expect(repo.rejectApplicants).toHaveBeenCalledWith("e-1", ["a-2"], "Simoon");
    expect(result.stamped).toHaveLength(2);
    expect(cell(sheet, 1, "decisionApplied")).toBe("2026-11-10 12:00 PT");
    expect(cell(sheet, 1, "runId")).toBe(result.runId);
    expect(cell(sheet, 2, "decisionApplied")).toBe("2026-11-10 12:00 PT");
    expect(console.error).not.toHaveBeenCalledWith(expect.stringContaining("REVIEW_RUN_FAILED"));
  });

  it("never acts on a row that's already stamped", async () => {
    const sheet = sheetWith(row("a-1", { decision: "Accept", decisionApplied: "2026-11-09 09:00 PT" }));
    states([]);

    const result = await run(sheet);

    expect(repo.acceptApplicants).not.toHaveBeenCalled();
    expect(result.stamped).toEqual([]);
  });

  it("only reports in a dry run", async () => {
    const sheet = sheetWith(row("a-1", { decision: "Accept" }));
    states([state("a-1", "APPLIED")]);

    const result = await run(sheet, false);

    expect(result.accept).toEqual([{ row: 1, attendeeId: "a-1", action: "accept" }]);
    expect(repo.acceptApplicants).not.toHaveBeenCalled();
    expect(sheet.writes).toEqual([]);
  });

  it("stops on duplicate attendee_ids, unknown decisions and rows whose state moved on", async () => {
    const sheet = sheetWith(
      row("a-1", { decision: "Accept" }),
      row("a-1", { decision: "Accept" }),
      row("a-2", { decision: "Maybe" }),
      row("a-3", { decision: "Reject" }),
      row("a-4", { decision: "Accept" })
    );
    states([state("a-3", "REGISTERED"), state("a-4", "REJECTED")]);

    const result = await run(sheet);

    expect(repo.acceptApplicants).not.toHaveBeenCalled();
    expect(repo.rejectApplicants).not.toHaveBeenCalled();
    expect(cell(sheet, 1, "lastError")).toBe("This attendee_id is in the sheet more than once");
    expect(cell(sheet, 3, "lastError")).toBe('Unknown Decision "Maybe" (use Accept or Reject)');
    expect(cell(sheet, 4, "lastError")).toBe("Can't reject: the student is now REGISTERED");
    expect(cell(sheet, 5, "lastError")).toBe("Can't accept: the student is now REJECTED");
    expect(result.errors).toHaveLength(5);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('"event":"REVIEW_RUN_FAILED"'));
  });

  it("refuses an applicant from another event", async () => {
    const sheet = sheetWith(row("a-1", { decision: "Accept" }));
    states([state("a-1", "APPLIED", { event_id: "other" })]);

    await run(sheet);

    expect(cell(sheet, 1, "lastError")).toBe("Not an applicant for this event");
  });

  it("changes nobody when the selection doesn't fit, and says why on each row", async () => {
    const sheet = sheetWith(row("a-1", { decision: "Accept" }), row("a-2", { decision: "Accept" }));
    states([state("a-1", "APPLIED"), state("a-2", "APPLIED")]);
    (repo.acceptApplicants as jest.Mock).mockResolvedValueOnce({ data: null, error: { message: "EVENT_FULL: 1 seats left, 2 selected" } });

    const result = await run(sheet);

    expect(cell(sheet, 1, "lastError")).toBe("EVENT_FULL: 1 seats left, 2 selected");
    expect(cell(sheet, 2, "lastError")).toBe("EVENT_FULL: 1 seats left, 2 selected");
    expect(cell(sheet, 1, "decisionApplied")).toBe("");
    expect(result.stamped).toEqual([]);
  });

  it("treats a shortfall as a conflict and stamps only the rows it can verify", async () => {
    const sheet = sheetWith(row("a-1", { decision: "Accept" }), row("a-2", { decision: "Accept" }));
    states(
      [state("a-1", "APPLIED"), state("a-2", "APPLIED")],
      [withHook(state("a-1", "ACCEPTED"), "accepted"), state("a-2", "REJECTED")]
    );
    (repo.acceptApplicants as jest.Mock).mockResolvedValueOnce({ data: 1, error: null });

    const result = await run(sheet);

    expect(cell(sheet, 1, "decisionApplied")).not.toBe("");
    expect(cell(sheet, 2, "decisionApplied")).toBe("");
    expect(cell(sheet, 2, "lastError")).toBe("Not applied: the database shows REJECTED");
    expect(result.conflicts).toHaveLength(1);
  });

  it("only repairs the sheet when an earlier run committed but didn't stamp", async () => {
    const sheet = sheetWith(row("a-1", { decision: "Accept" }), row("a-2", { decision: "Reject" }));
    const accepted = withHook(state("a-1", "ACCEPTED"), "accepted");
    const rejected = withHook(state("a-2", "REJECTED"), "rejected");
    states([accepted, rejected], [accepted, rejected]);

    const result = await run(sheet);

    expect(repo.acceptApplicants).not.toHaveBeenCalled();
    expect(repo.rejectApplicants).not.toHaveBeenCalled();
    expect(result.repair).toHaveLength(2);
    expect(cell(sheet, 1, "decisionApplied")).toBe("2026-11-10 12:00 PT");
    expect(cell(sheet, 2, "decisionApplied")).toBe("2026-11-10 12:00 PT");
  });

  describe("re-opening a payment window", () => {
    const ticked = (extra = {}) => row("a-1", { decision: "Accept", decisionApplied: "2026-11-06 09:00 PT", reopen: "TRUE", ...extra });

    it("re-opens once the deadline and grace hour have passed", async () => {
      const sheet = sheetWith(ticked());
      const expired = state("a-1", "ACCEPTED", { payment_due_at: new Date(now.getTime() - 2 * hour).toISOString() });
      states([expired], [withHook(state("a-1", "ACCEPTED", { acceptance_version: 2 }), "accepted")]);
      (repo.reopenPaymentWindow as jest.Mock).mockResolvedValueOnce({ data: 1, error: null });

      await run(sheet);

      expect(repo.reopenPaymentWindow).toHaveBeenCalledWith("e-1", ["a-1"], "Simoon");
      expect(cell(sheet, 1, "reopenApplied")).toBe("2026-11-10 12:00 PT");
      expect(cell(sheet, 1, "decisionApplied")).toBe("2026-11-06 09:00 PT");
    });

    it("waits for the next run when ticked inside the grace hour", async () => {
      const sheet = sheetWith(ticked());
      states([state("a-1", "ACCEPTED", { payment_due_at: new Date(now.getTime() - 30 * 60 * 1000).toISOString() })]);

      const result = await run(sheet);

      expect(repo.reopenPaymentWindow).not.toHaveBeenCalled();
      expect(cell(sheet, 1, "lastError")).toBe("Re-open waits until 2026-11-10 12:30 PT");
      expect(result.waiting).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });

    it("stamps a re-open that already happened", async () => {
      const sheet = sheetWith(ticked());
      const reopened = withHook(state("a-1", "ACCEPTED", { acceptance_version: 2 }), "accepted");
      states([reopened], [reopened]);

      await run(sheet);

      expect(repo.reopenPaymentWindow).not.toHaveBeenCalled();
      expect(cell(sheet, 1, "reopenApplied")).toBe("2026-11-10 12:00 PT");
    });

    it("needs an applied Accept first", async () => {
      const sheet = sheetWith(row("a-1", { reopen: "TRUE" }));
      states([state("a-1", "APPLIED")]);

      await run(sheet);

      expect(cell(sheet, 1, "lastError")).toBe("Re-open needs an applied Accept first");
    });

    it("refuses a registered student", async () => {
      const sheet = sheetWith(ticked());
      states([state("a-1", "REGISTERED")]);

      await run(sheet);

      expect(cell(sheet, 1, "lastError")).toBe("Can't re-open: the student is now REGISTERED");
    });
  });

  it("logs when the seat cap no longer holds", async () => {
    const sheet = sheetWith();
    states([]);
    (repo.seatsTaken as jest.Mock).mockResolvedValueOnce({ data: 3, error: null });

    await run(sheet);

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('"event":"CAPACITY_INVARIANT_FAILED"'));
  });

  it("refuses an event without review", async () => {
    (repo.getEvent as jest.Mock).mockResolvedValueOnce({ data: { event_id: "e-1", name: "Mixer", max_attendees: 50, needs_review: false }, error: null });

    await expect(run(sheetWith())).rejects.toThrow("Mixer doesn't use review");
  });
});
