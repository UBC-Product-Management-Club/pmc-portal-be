import { workflowState } from "../../../src/services/Attendee/workflowState";

const now = new Date("2026-11-02T20:00:00Z");
const row = (status: any, payment_due_at: string | null = null) => ({ status, payment_due_at });

describe("workflowState", () => {
  it("maps each status to what the event page shows", () => {
    expect(workflowState(row("APPLIED"), now)).toBe("UNDER_REVIEW");
    expect(workflowState(row("PROCESSING"), now)).toBe("PAYMENT_PROCESSING");
    expect(workflowState(row("REGISTERED"), now)).toBe("REGISTERED");
    expect(workflowState(row("REJECTED"), now)).toBe("NOT_SELECTED");
    expect(workflowState(row("FAILED"), now)).toBe("NOT_SELECTED");
    expect(workflowState(row(null), now)).toBeNull();
  });

  it("keeps the payment window open until the deadline, not through it", () => {
    expect(workflowState(row("ACCEPTED", "2026-11-02T20:00:01Z"), now)).toBe("PAYMENT_WINDOW_OPEN");
    expect(workflowState(row("ACCEPTED", "2026-11-02T20:00:00Z"), now)).toBe("PAYMENT_WINDOW_PASSED");
  });

  it("shows a paid checkout as processing, even past the deadline", () => {
    expect(workflowState(row("ACCEPTED", "2026-11-01T20:00:00Z"), now, true)).toBe("PAYMENT_PROCESSING");
  });
});
