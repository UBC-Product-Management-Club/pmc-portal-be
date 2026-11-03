jest.mock("../../src/storage/OpsRepository");
jest.mock("../../src/config/stripe", () => ({
  stripe: { refunds: { create: jest.fn() } },
}));

import { stripe } from "../../src/config/stripe";
import { markSent, markSentFromSheet, resolveIssue, retryRefunds } from "../../src/ops/payments";
import { MESSAGES_HEADER, TABS } from "../../src/ops/reviewSheet";
import { OpsRepository } from "../../src/storage/OpsRepository";
import { MemorySheet } from "./memorySheet";

const repo = OpsRepository as jest.Mocked<typeof OpsRepository>;
const refund = stripe.refunds.create as jest.Mock;

const issue = (overrides: Record<string, unknown> = {}) => ({
  checkout_id: "cs_1",
  attendee_id: "a-1",
  name: "A",
  email: "a@example.com",
  amount_cents: 1500,
  payment_id: "pi_1",
  refund_id: null,
  attention_reason: "LATE_PAYMENT",
  handled_at: "2026-11-05T18:00:00Z",
  ...overrides,
});

beforeEach(() => {
  jest.resetAllMocks();
  (repo.setRefund as jest.Mock).mockResolvedValue({ error: null });
});

describe("retryRefunds", () => {
  it("retries only refunds without an id, with the webhook's idempotency key", async () => {
    (repo.paymentIssues as jest.Mock).mockResolvedValueOnce({
      data: [issue(), issue({ checkout_id: "cs_2", refund_id: "re_done" })],
      error: null,
    });
    refund.mockResolvedValueOnce({ id: "re_1" });

    await expect(retryRefunds("e-1")).resolves.toEqual([{ checkoutId: "cs_1", refundId: "re_1" }]);
    expect(refund).toHaveBeenCalledTimes(1);
    expect(refund).toHaveBeenCalledWith({ payment_intent: "pi_1" }, { idempotencyKey: "refund-cs_1" });
    expect(repo.setRefund).toHaveBeenCalledWith("cs_1", "re_1");
  });

  it("skips a checkout with no card payment and reports it", async () => {
    (repo.paymentIssues as jest.Mock).mockResolvedValueOnce({
      data: [issue({ payment_id: "cs_1", amount_cents: 0, attention_reason: "NO_REVIEW_FULL" })],
      error: null,
    });

    const [result] = await retryRefunds("e-1");
    expect(result.error).toContain("No card payment");
    expect(refund).not.toHaveBeenCalled();
  });

  it("logs a refund that still fails and keeps going", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    (repo.paymentIssues as jest.Mock).mockResolvedValueOnce({
      data: [issue(), issue({ checkout_id: "cs_2", payment_id: "pi_2" })],
      error: null,
    });
    refund.mockRejectedValueOnce(new Error("card_declined")).mockResolvedValueOnce({ id: "re_2" });

    const results = await retryRefunds("e-1");

    expect(results).toEqual([
      { checkoutId: "cs_1", error: "card_declined" },
      { checkoutId: "cs_2", refundId: "re_2" },
    ]);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('"event":"PAYMENT_REFUND_REQUIRED"'));
  });
});

describe("resolveIssue", () => {
  it("marks an open issue resolved", async () => {
    (repo.resolveIssue as jest.Mock).mockResolvedValueOnce({ data: [{ checkout_id: "cs_1" }], error: null });
    await expect(resolveIssue("cs_1")).resolves.toBeUndefined();
  });

  it("says so when there's no open issue", async () => {
    (repo.resolveIssue as jest.Mock).mockResolvedValueOnce({ data: [], error: null });
    await expect(resolveIssue("cs_9")).rejects.toThrow("isn't an open payment issue");
  });
});

describe("markSent", () => {
  it("marks each id once and reports the ones already marked", async () => {
    (repo.markSent as jest.Mock).mockResolvedValueOnce({ data: [{ notification_id: "n-1" }], error: null });

    await expect(markSent(["n-1", " n-1", "n-2", ""], " Events team ")).resolves.toEqual({
      marked: ["n-1"],
      alreadyMarkedOrUnknown: ["n-2"],
    });
    expect(repo.markSent).toHaveBeenCalledWith(["n-1", "n-2"], "Events team");
  });

  it("needs ids and who sent them", async () => {
    await expect(markSent([], "Events team")).rejects.toThrow("No notification ids");
    await expect(markSent(["n-1"], " ")).rejects.toThrow("--by");
  });

  it("marks the rows ticked in the Messages tab", async () => {
    const sheet = new MemorySheet({
      [TABS.messages]: [
        MESSAGES_HEADER,
        ["n-1", "Accepted", "", "", "", "", "", "TRUE"],
        ["n-2", "Rejected", "", "", "", "", "", "FALSE"],
      ],
    });
    (repo.markSent as jest.Mock).mockResolvedValueOnce({ data: [{ notification_id: "n-1" }], error: null });

    await markSentFromSheet(sheet, "Events team");

    expect(repo.markSent).toHaveBeenCalledWith(["n-1"], "Events team");
  });
});
