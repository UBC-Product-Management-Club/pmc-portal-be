jest.mock("../../../src/config/loops", () => ({
  loops: { sendTransactionalEmail: jest.fn() },
}));
jest.mock("../../../src/storage/NotificationRepository");

import { APIError, RateLimitExceededError } from "loops";
import { loops } from "../../../src/config/loops";
import {
  deliverApplicationReceipt,
  deliverNotification,
  isDue,
  sendEventEmail,
  templateVars,
} from "../../../src/services/Email/EventEmailService";
import { NotificationRepository } from "../../../src/storage/NotificationRepository";

const send = loops.sendTransactionalEmail as jest.Mock;
const getHook = NotificationRepository.getHook as jest.Mock;
const findHook = NotificationRepository.findHook as jest.Mock;
const markSent = NotificationRepository.markSent as jest.Mock;

const now = new Date("2026-11-02T20:00:00Z");
const hook = (overrides: Record<string, unknown> = {}) =>
  ({
    notification_id: "n-1",
    event_id: "event-456",
    attendee_id: "att-1",
    type: "accepted",
    acceptance_version: 1,
    eligible_at: "2026-11-02T19:00:00Z",
    payload: {
      recipient_name: "Simoon Song",
      recipient_email: "simoon@example.com",
      event_name: "Product Jackpot",
      event_path: "/events/event-456",
      payment_due_at: "2026-11-04T20:00:00Z",
      amount_due: 8.55,
    },
    cancelled_at: null,
    cancel_reason: null,
    sent_at: null,
    sent_by: null,
    provider: null,
    provider_message_id: null,
    created_at: "2026-11-02T19:00:00Z",
    ...overrides,
  }) as any;
const accepted = { status: "ACCEPTED", acceptance_version: 1, payment_due_at: "2026-11-04T20:00:00Z" } as any;

const env = { ...process.env };
beforeEach(() => {
  process.env = {
    ...env,
    EMAIL_DELIVERY_ENABLED: "true",
    LOOPS_API_KEY: "key",
    LOOPS_ACCEPTED_ID: "tmpl_accepted",
    LOOPS_APPLICATION_RECEIVED_ID: "tmpl_received",
    ORIGIN: "https://portal.example",
  };
  markSent.mockResolvedValue({ error: null });
  send.mockResolvedValue({ success: true });
});
afterAll(() => {
  process.env = env;
});

describe("sendEventEmail", () => {
  it("sends with the notification's idempotency key", async () => {
    await sendEventEmail("accepted", "simoon@example.com", { eventName: "PJ" }, "n-1");

    expect(send).toHaveBeenCalledWith({
      transactionalId: "tmpl_accepted",
      email: "simoon@example.com",
      dataVariables: { eventName: "PJ" },
      headers: { "Idempotency-Key": "product-jackpot:n-1" },
    });
  });

  it("fails closed when delivery is off, or a key or template is missing", async () => {
    process.env.EMAIL_DELIVERY_ENABLED = "false";
    await expect(sendEventEmail("accepted", "a@example.com", {}, "n-1")).rejects.toThrow("off");
    process.env.EMAIL_DELIVERY_ENABLED = "true";
    await expect(sendEventEmail("rejected", "a@example.com", {}, "n-1")).rejects.toThrow("LOOPS_REJECTED_ID");
    delete process.env.LOOPS_API_KEY;
    await expect(sendEventEmail("accepted", "a@example.com", {}, "n-1")).rejects.toThrow("LOOPS_API_KEY");
    expect(send).not.toHaveBeenCalled();
  });

  it("retries rate limits and server errors with the same key", async () => {
    jest.useFakeTimers();
    send
      .mockRejectedValueOnce(new RateLimitExceededError(10, 0))
      .mockRejectedValueOnce(new APIError(503, { success: false, message: "down" } as any))
      .mockResolvedValueOnce({ success: true });

    const sending = sendEventEmail("accepted", "a@example.com", {}, "n-1");
    await jest.runAllTimersAsync();
    await expect(sending).resolves.toEqual({ success: true });
    expect(send).toHaveBeenCalledTimes(3);
    expect(new Set(send.mock.calls.map((c) => c[0].headers["Idempotency-Key"]))).toEqual(new Set(["product-jackpot:n-1"]));
    jest.useRealTimers();
  });

  it("never retries a 409", async () => {
    send.mockRejectedValueOnce(new APIError(409, { success: false, message: "conflict" } as any));

    await expect(sendEventEmail("accepted", "a@example.com", {}, "n-1")).rejects.toThrow();
    expect(send).toHaveBeenCalledTimes(1);
  });
});

describe("isDue", () => {
  it("sends a receipt only while the application is under review", () => {
    const receipt = hook({ type: "application_received", acceptance_version: 0 });
    expect(isDue(receipt, { ...accepted, status: "APPLIED" }, null, now)).toBe(true);
    expect(isDue(receipt, accepted, null, now)).toBe(false);
  });

  it("sends a rejection only while the student is still rejected", () => {
    expect(isDue(hook({ type: "rejected" }), { ...accepted, status: "REJECTED" }, null, now)).toBe(true);
    expect(isDue(hook({ type: "rejected" }), { ...accepted, status: "REGISTERED" }, null, now)).toBe(false);
  });

  it("sends an acceptance only for the current acceptance while its window is open", () => {
    expect(isDue(hook(), accepted, null, now)).toBe(true);
    expect(isDue(hook({ acceptance_version: 0 }), accepted, null, now)).toBe(false);
    expect(isDue(hook(), { ...accepted, payment_due_at: "2026-11-02T20:00:00Z" }, null, now)).toBe(false);
    expect(isDue(hook(), { ...accepted, status: "REGISTERED" }, null, now)).toBe(false);
  });

  it("sends a reminder only after its time, and only if the acceptance went out first", () => {
    const reminder = hook({ type: "reminder", eligible_at: "2026-11-02T19:30:00Z" });
    expect(isDue(reminder, accepted, "2026-11-02T19:00:00Z", now)).toBe(true);
    expect(isDue(reminder, accepted, null, now)).toBe(false);
    expect(isDue(reminder, accepted, "2026-11-02T19:45:00Z", now)).toBe(false);
    expect(isDue(hook({ type: "reminder", eligible_at: "2026-11-03T20:00:00Z" }), accepted, "2026-11-02T19:00:00Z", now)).toBe(false);
  });

  it("skips sent and cancelled rows", () => {
    expect(isDue(hook({ sent_at: "2026-11-02T19:10:00Z" }), accepted, null, now)).toBe(false);
    expect(isDue(hook({ cancelled_at: "2026-11-02T19:10:00Z" }), accepted, null, now)).toBe(false);
  });
});

describe("templateVars", () => {
  it("links to the event page and says what to pay and by when, in Pacific time", () => {
    expect(templateVars(hook())).toEqual({
      recipientName: "Simoon Song",
      eventName: "Product Jackpot",
      eventUrl: "https://portal.example/events/event-456",
      amountDue: "$8.55",
      paymentDue: "Wednesday, November 4 at 12:00 PM PT",
    });
  });

  it("leaves payment details out of a rejection", () => {
    expect(Object.keys(templateVars(hook({ type: "rejected" })))).toEqual(["recipientName", "eventName", "eventUrl"]);
  });
});

describe("deliverNotification", () => {
  // The hooks' times are relative to `now`; only the clock is faked
  beforeAll(() => jest.useFakeTimers({ now, doNotFake: ["setTimeout", "setImmediate", "nextTick", "queueMicrotask"] }));
  afterAll(() => jest.useRealTimers());

  it("does nothing with delivery off", async () => {
    process.env.EMAIL_DELIVERY_ENABLED = "false";
    await expect(deliverNotification("n-1")).resolves.toBe("disabled");
    expect(getHook).not.toHaveBeenCalled();
  });

  it("re-checks, sends, then marks the row sent", async () => {
    getHook.mockResolvedValueOnce({ data: { ...hook(), Attendee: accepted }, error: null });

    await expect(deliverNotification("n-1")).resolves.toBe("sent");
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ email: "simoon@example.com" }));
    expect(markSent).toHaveBeenCalledWith("n-1", "loops");
  });

  it("skips a row that no longer applies", async () => {
    getHook.mockResolvedValueOnce({ data: { ...hook(), Attendee: { ...accepted, status: "REJECTED" } }, error: null });

    await expect(deliverNotification("n-1")).resolves.toBe("skipped");
    expect(send).not.toHaveBeenCalled();
  });

  it("looks up the acceptance before sending a reminder", async () => {
    getHook.mockResolvedValueOnce({ data: { ...hook({ type: "reminder" }), Attendee: accepted }, error: null });
    findHook.mockResolvedValueOnce({ data: { notification_id: "n-0", sent_at: null }, error: null });

    await expect(deliverNotification("n-1")).resolves.toBe("skipped");
    expect(findHook).toHaveBeenCalledWith("att-1", "accepted", 1);
  });

  it("leaves sent_at empty when Loops refuses", async () => {
    getHook.mockResolvedValueOnce({ data: { ...hook(), Attendee: accepted }, error: null });
    send.mockRejectedValueOnce(new APIError(400, { success: false, message: "bad template" } as any));

    await expect(deliverNotification("n-1")).rejects.toThrow();
    expect(markSent).not.toHaveBeenCalled();
  });
});

describe("deliverApplicationReceipt", () => {
  it("sends the receipt hook and never throws", async () => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    findHook.mockResolvedValueOnce({ data: { notification_id: "n-r", sent_at: null }, error: null });
    getHook.mockResolvedValueOnce({ data: null, error: { message: "timeout" } });

    await expect(deliverApplicationReceipt("att-1")).resolves.toBeUndefined();
    expect(findHook).toHaveBeenCalledWith("att-1", "application_received", 0);
  });
});
