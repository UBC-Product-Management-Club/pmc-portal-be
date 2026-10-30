jest.mock("../../../src/services/Email/EmailService", () => ({
  sendEmail: jest.fn(),
  addToMailingList: jest.fn(),
  LoopsEvent: { MembershipPayment: "membership_payment" }, // match your code’s value
}));

jest.mock("../../../src/config/stripe", () => ({
  stripe: {
    paymentIntents: {
      create: jest.fn(),
    },
    refunds: {
      create: jest.fn(),
    },
    checkout: {
      sessions: {
        create: jest.fn(),
        retrieve: jest.fn(),
        expire: jest.fn(),
      },
    },
  },
}));

import {
  createCheckoutSession,
  createMembershipPaymentIntent,
  getOrCreateEventCheckoutSession,
  getOrCreateRSVPCheckoutSession,
} from "../../../src/services/Payment/PaymentService";
import * as PaymentService from "../../../src/services/Payment/PaymentService";
import * as EventService from "../../../src/services/Event/EventService";
import * as AttendeeService from "../../../src/services/Attendee/AttendeeService";
import { stripe } from "../../../src/config/stripe";
import Stripe from "stripe";
import { UserRepository } from "../../../src/storage/UserRepository";
import { PaymentRepository } from "../../../src/storage/PaymentRepository";
// import { AttendeeRepository } from "../../../src/storage/AttendeeRepository";
import { ProductRepository } from "../../../src/storage/ProductRepository";
import {
  addToMailingList,
  sendEmail,
} from "../../../src/services/Email/EmailService";
import { CheckoutSessionRepository } from "../../../src/storage/CheckoutSessionRepository";

jest.mock("../../../src/services/User/UserService");
jest.mock("../../../src/services/Attendee/AttendeeService");
jest.mock("../../../src/services/Event/EventService");
jest.mock("../../../src/services/Email/EmailService");

describe("PaymentService", () => {
  // Declare mocks
  let mockGetUser: jest.Mock;
  let mockGetProduct: jest.Mock;
  let mockGetCheckoutSession: jest.Mock;
  let mockGetAttendee: jest.Mock;
  let mockGetEvent: jest.Mock;
  let mockUpdateUser: jest.Mock;
  let mockUpdateAttendee: jest.Mock;
  let mockTransactionLogger: jest.Mock;
  let mockCreatePaymentIntent: jest.Mock;
  let mockCreateStripeCheckout: jest.Mock;
  let mockRetrieveStripeCheckout: jest.Mock;
  let mockSaveCheckoutSession: jest.Mock;
  let mockDeleteCheckoutSession: jest.Mock;
  let mockDeleteAttendee: jest.Mock;
  let mockAddToMailingList: jest.Mock;
  let mockGetAttendeeWithEvent: jest.Mock;
  let mockRefund: jest.Mock;
  let mockExpireStripeCheckout: jest.Mock;
  let mockFulfill: jest.Mock;
  let mockRecordRefund: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUser = UserRepository.getUser as jest.Mock;
    mockGetProduct = ProductRepository.getPriceId as jest.Mock;
    mockGetCheckoutSession =
      CheckoutSessionRepository.getCheckoutSession as jest.Mock;
    mockGetAttendee = AttendeeService.getAttendee as jest.Mock;
    mockGetEvent = EventService.getEvent as jest.Mock;
    mockUpdateUser = UserRepository.updateUser as jest.Mock;
    mockUpdateAttendee = AttendeeService.updateAttendee as jest.Mock;
    mockTransactionLogger = PaymentRepository.logTransaction as jest.Mock;
    mockCreatePaymentIntent = stripe.paymentIntents.create as jest.Mock;
    mockCreateStripeCheckout = stripe.checkout.sessions.create as jest.Mock;
    mockRetrieveStripeCheckout = stripe.checkout.sessions.retrieve as jest.Mock;
    mockSaveCheckoutSession =
      CheckoutSessionRepository.saveCheckoutSession as jest.Mock;
    mockDeleteCheckoutSession =
      CheckoutSessionRepository.deleteCheckoutSession as jest.Mock;
    mockDeleteAttendee = AttendeeService.deleteAttendee as jest.Mock;
    mockAddToMailingList = addToMailingList as jest.Mock;
    mockGetAttendeeWithEvent = AttendeeService.getAttendeeWithEvent as jest.Mock;
    mockRefund = stripe.refunds.create as jest.Mock;
    mockExpireStripeCheckout = stripe.checkout.sessions.expire as jest.Mock;
    mockFulfill = CheckoutSessionRepository.fulfill as jest.Mock;
    mockRecordRefund = CheckoutSessionRepository.recordRefund as jest.Mock;
    mockDeleteCheckoutSession.mockResolvedValue({ error: null });
    mockRecordRefund.mockResolvedValue({ error: null });
  });

  describe("createPaymentIntent", () => {
    it("creates payment intent for UBC student", async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { university: "University of British Columbia" },
      });
      const mockPaymentIntent = { id: "pi_ubc_test", amount: 5000 };
      mockCreatePaymentIntent.mockResolvedValueOnce(mockPaymentIntent);

      const result = await createMembershipPaymentIntent("user-123");

      expect(result).toEqual(mockPaymentIntent);
      expect(mockCreatePaymentIntent).toHaveBeenCalledWith({
        amount: expect.any(Number),
        currency: "cad",
        metadata: {
          user_id: "user-123",
          payment_type: "membership",
        },
      });
    });

    it("creates payment intent for non-UBC student", async () => {
      const mockPaymentIntent = { id: "pi_non_ubc_test", amount: 7500 };
      mockGetUser.mockResolvedValueOnce({
        data: { university: "Simon Fraser University" },
      });
      mockCreatePaymentIntent.mockResolvedValueOnce(mockPaymentIntent);
      const result = await createMembershipPaymentIntent("user-456");

      expect(result).toEqual(mockPaymentIntent);
      expect(mockCreatePaymentIntent).toHaveBeenCalledWith({
        amount: expect.any(Number),
        currency: "cad",
        metadata: {
          user_id: "user-456",
          payment_type: "membership",
        },
      });
    });

    it("throws error when user lookup fails", async () => {
      mockGetUser.mockResolvedValueOnce({
        error: { message: "User not found" },
      });
      await expect(
        createMembershipPaymentIntent("invalid-user")
      ).rejects.toThrow("User not found");
      expect(mockCreatePaymentIntent).not.toHaveBeenCalled();
    });
  });

  describe("handleStripeEvent", () => {
    const paymentIntentMembership = {
      id: "pi_test",
      amount: 1234,
      metadata: { user_id: "user-123", payment_type: "membership" },
    };

    const paymentIntentEventRegistration = {
      id: "pi_event_test",
      amount: 5678,
      metadata: {
        user_id: "user-123",
        payment_type: "event",
        attendee_id: "att-456",
      },
    };

    const checkoutSessionFreeEventRegistration = {
      id: "cs_event_test",
      amount_total: 0,
      object: "checkout.session",
      metadata: {
        user_id: "user-123",
        payment_type: "event",
        attendee_id: "att-456",
      },
    };

    const checkoutSessionEventRegistration = {
      id: "cs_event_test",
      amount_total: 1000,
      object: "checkout.session",
      metadata: {
        user_id: "user-123",
        payment_type: "event",
        attendee_id: "att-456",
      },
    };

    const makeEvent = (
      type: Stripe.Event.Type,
      status: Stripe.PaymentIntent.Status | Stripe.Checkout.Session.Status,
      baseIntent: any = paymentIntentMembership
    ): Stripe.Event => {
      return {
        id: "event_test",
        type,
        data: {
          object: { ...baseIntent, status } as
            | Stripe.PaymentIntent
            | Stripe.Checkout.Session,
        },
      } as unknown as Stripe.Event;
    };

    beforeEach(() => {
      mockTransactionLogger.mockResolvedValue({});
    });

    it("check canceled", async () => {
      await PaymentService.handleStripeEvent(
        makeEvent(
          "payment_intent.canceled",
          "canceled",
          paymentIntentMembership
        )
      );
      expect(mockTransactionLogger).toHaveBeenLastCalledWith(
        expect.objectContaining({
          payment_id: "pi_test",
          user_id: "user-123",
          type: "membership",
          amount: 1234,
          status: PaymentService.Status.PAYMENT_CANCELED,
          payment_date: expect.any(String),
        })
      );
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it("check payment_failed", async () => {
      mockUpdateAttendee.mockResolvedValueOnce({});
      await PaymentService.handleStripeEvent(
        makeEvent(
          "payment_intent.payment_failed",
          "requires_payment_method",
          paymentIntentMembership
        )
      );
      expect(mockTransactionLogger).toHaveBeenLastCalledWith(
        expect.objectContaining({
          payment_id: "pi_test",
          user_id: "user-123",
          type: "membership",
          amount: 1234,
          status: PaymentService.Status.PAYMENT_FAILED,
          payment_date: expect.any(String),
        })
      );
      expect(mockUpdateUser).not.toHaveBeenCalled();
    });

    it("check processing", async () => {
      await PaymentService.handleStripeEvent(
        makeEvent(
          "payment_intent.processing",
          "processing",
          paymentIntentMembership
        )
      );
      expect(mockTransactionLogger).toHaveBeenLastCalledWith(
        expect.objectContaining({
          payment_id: "pi_test",
          user_id: "user-123",
          type: "membership",
          amount: 1234,
          status: PaymentService.Status.PAYMENT_PENDING,
          payment_date: expect.any(String),
        })
      );
    });

    it("check membership payment succeeded", async () => {
      mockUpdateUser.mockResolvedValueOnce({});
      await PaymentService.handleStripeEvent(
        makeEvent(
          "payment_intent.succeeded",
          "succeeded",
          paymentIntentMembership
        )
      );
      expect(mockTransactionLogger).toHaveBeenLastCalledWith(
        expect.objectContaining({
          payment_id: "pi_test",
          user_id: "user-123",
          type: "membership",
          amount: 1234,
          status: PaymentService.Status.PAYMENT_SUCCESS,
          payment_date: expect.any(String),
        })
      );

      expect(mockUpdateUser).toHaveBeenCalledWith("user-123", {
        is_payment_verified: true,
      });
    });

    it("doesn't register anyone from an event payment intent", async () => {
      await PaymentService.handleStripeEvent(
        makeEvent("payment_intent.succeeded", "succeeded", paymentIntentEventRegistration)
      );

      expect(mockTransactionLogger).toHaveBeenLastCalledWith(
        expect.objectContaining({ payment_id: "pi_event_test", status: PaymentService.Status.PAYMENT_SUCCESS })
      );
      expect(mockUpdateAttendee).not.toHaveBeenCalled();
      expect(mockFulfill).not.toHaveBeenCalled();
    });

    it("records a pending payment for an event without review", async () => {
      mockGetAttendeeWithEvent.mockResolvedValueOnce({ attendee_id: "att-456", status: "PROCESSING", Event: { needs_review: false } });
      await PaymentService.handleStripeEvent(
        makeEvent("payment_intent.processing", "processing", paymentIntentEventRegistration)
      );

      expect(mockUpdateAttendee).toHaveBeenCalledWith("att-456", {
        is_payment_verified: false,
        payment_id: "pi_event_test",
      });
    });

    it("leaves a reviewed student Accepted while their payment is pending", async () => {
      mockGetAttendeeWithEvent.mockResolvedValueOnce({ attendee_id: "att-456", status: "ACCEPTED", Event: { needs_review: true } });
      await PaymentService.handleStripeEvent(
        makeEvent("payment_intent.processing", "processing", paymentIntentEventRegistration)
      );

      expect(mockUpdateAttendee).not.toHaveBeenCalled();
    });

    it("never changes a reviewed student when a payment fails", async () => {
      await PaymentService.handleStripeEvent(
        makeEvent("payment_intent.payment_failed", "requires_payment_method", paymentIntentEventRegistration)
      );

      expect(mockTransactionLogger).toHaveBeenLastCalledWith(
        expect.objectContaining({ payment_id: "pi_event_test", status: PaymentService.Status.PAYMENT_FAILED })
      );
      expect(mockUpdateAttendee).not.toHaveBeenCalled();
    });

    describe("checkout.session.completed", () => {
      const paidCheckout = {
        ...checkoutSessionEventRegistration,
        payment_status: "paid",
        payment_intent: "pi_event_test",
      };
      const completed = (session: any = paidCheckout) =>
        ({ ...makeEvent("checkout.session.completed", "complete", session), id: "evt_1", created: 1793649600 }) as Stripe.Event;

      it("registers through the database check and adds the mailing list", async () => {
        mockFulfill.mockResolvedValueOnce({ data: "REGISTERED", error: null });
        await PaymentService.handleStripeEvent(completed());

        expect(mockTransactionLogger).toHaveBeenCalledWith(
          expect.objectContaining({ payment_id: "pi_event_test", type: "event", amount: 1000, status: PaymentService.Status.PAYMENT_SUCCESS })
        );
        expect(mockFulfill).toHaveBeenCalledWith("cs_event_test", "evt_1", true, "2026-11-02T20:00:00.000Z", "pi_event_test");
        expect(mockAddToMailingList).toHaveBeenCalledWith("att-456");
        expect(mockRefund).not.toHaveBeenCalled();
        expect(mockDeleteCheckoutSession).not.toHaveBeenCalled();
      });

      it.each(["LATE_PAYMENT", "OLD_ACCEPTANCE", "REJECTED", "EVENT_FULL_LATE", "NO_REVIEW_FULL"])(
        "refunds once and records the refund for %s",
        async (reason) => {
          jest.spyOn(console, "error").mockImplementation(() => {});
          mockFulfill.mockResolvedValueOnce({ data: reason, error: null });
          mockRefund.mockResolvedValueOnce({ id: "re_1" });
          await PaymentService.handleStripeEvent(completed());

          expect(mockRefund).toHaveBeenCalledWith(
            { payment_intent: "pi_event_test" },
            { idempotencyKey: "refund-cs_event_test" }
          );
          expect(mockRecordRefund).toHaveBeenCalledWith("cs_event_test", "re_1");
          expect(console.error).toHaveBeenCalledWith(
            JSON.stringify({ event: "PAYMENT_REFUND_REQUIRED", reason, attendeeId: "att-456", checkoutId: "cs_event_test" })
          );
          expect(mockAddToMailingList).not.toHaveBeenCalled();
        }
      );

      it("does nothing more for a repeated webhook", async () => {
        mockFulfill.mockResolvedValueOnce({ data: "ALREADY_FULFILLED", error: null });
        await PaymentService.handleStripeEvent(completed());

        expect(mockAddToMailingList).not.toHaveBeenCalled();
        expect(mockRefund).not.toHaveBeenCalled();
      });

      it("passes an unpaid checkout on without logging a payment", async () => {
        mockFulfill.mockResolvedValueOnce({ data: "UNPAID", error: null });
        await PaymentService.handleStripeEvent(completed({ ...paidCheckout, payment_status: "unpaid" }));

        expect(mockTransactionLogger).not.toHaveBeenCalled();
        expect(mockFulfill).toHaveBeenCalledWith("cs_event_test", "evt_1", false, expect.any(String), "pi_event_test");
      });

      it("registers a free checkout under the checkout id with nothing to refund", async () => {
        const free = { ...checkoutSessionFreeEventRegistration, payment_status: "no_payment_required", payment_intent: null };
        mockFulfill.mockResolvedValueOnce({ data: "REGISTERED", error: null });
        await PaymentService.handleStripeEvent(completed(free));

        expect(mockFulfill).toHaveBeenCalledWith("cs_event_test", "evt_1", true, expect.any(String), "cs_event_test");
        expect(mockAddToMailingList).toHaveBeenCalledWith("att-456");
      });

      it("doesn't refund a free checkout for a full event", async () => {
        jest.spyOn(console, "error").mockImplementation(() => {});
        const free = { ...checkoutSessionFreeEventRegistration, payment_status: "no_payment_required", payment_intent: null };
        mockFulfill.mockResolvedValueOnce({ data: "NO_REVIEW_FULL", error: null });
        await PaymentService.handleStripeEvent(completed(free));

        expect(mockRefund).not.toHaveBeenCalled();
      });

      it("fails the webhook when the database check fails, so Stripe retries", async () => {
        mockFulfill.mockResolvedValueOnce({ data: null, error: { message: "timeout" } });
        await expect(PaymentService.handleStripeEvent(completed())).rejects.toThrow("timeout");
      });
    });

    describe("checkout.session.expired", () => {
      const expired = () => makeEvent("checkout.session.expired", "expired", checkoutSessionEventRegistration);

      it("drops an unpaid application for an event without review", async () => {
        mockGetCheckoutSession.mockResolvedValueOnce({ data: { checkout_id: "cs_event_test", fulfilled_at: null }, error: null });
        mockGetAttendeeWithEvent.mockResolvedValueOnce({ attendee_id: "att-456", status: "PROCESSING", Event: { needs_review: false } });
        mockDeleteAttendee.mockResolvedValueOnce({});
        await PaymentService.handleStripeEvent(expired());

        expect(mockDeleteCheckoutSession).toHaveBeenCalledWith("att-456");
        expect(mockDeleteAttendee).toHaveBeenCalledWith("att-456");
      });

      it("keeps a reviewed student's acceptance", async () => {
        mockGetCheckoutSession.mockResolvedValueOnce({ data: { checkout_id: "cs_event_test", fulfilled_at: null }, error: null });
        mockGetAttendeeWithEvent.mockResolvedValueOnce({ attendee_id: "att-456", status: "ACCEPTED", Event: { needs_review: true } });
        await PaymentService.handleStripeEvent(expired());

        expect(mockDeleteAttendee).not.toHaveBeenCalled();
        expect(mockDeleteCheckoutSession).not.toHaveBeenCalled();
      });

      it("ignores a checkout that was already replaced", async () => {
        mockGetCheckoutSession.mockResolvedValueOnce({ data: { checkout_id: "cs_newer", fulfilled_at: null }, error: null });
        await PaymentService.handleStripeEvent(expired());

        expect(mockGetAttendeeWithEvent).not.toHaveBeenCalled();
        expect(mockDeleteAttendee).not.toHaveBeenCalled();
      });
    });
  });

  describe("create membership checkout session", () => {
    it("creates membership checkout session for UBC student", async () => {
      mockGetUser.mockResolvedValue({
        data: { university: "University of British Columbia" },
      });
      mockGetProduct.mockResolvedValue({ data: { product: "price_ubc_test" } });
      mockCreateStripeCheckout.mockResolvedValue({ id: "sess_test" });

      const result = await createCheckoutSession("user-123");

      expect(mockCreateStripeCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [
            {
              price: "price_ubc_test",
              quantity: 1,
            },
          ],
        })
      );
      expect(result).toEqual({ id: "sess_test" });
      expect(mockGetUser).toHaveBeenCalledWith("user-123");
      expect(mockGetProduct).toHaveBeenCalledWith(
        "28b6e39a-c480-4e66-87e7-af9be35b8c0d"
      );
    });

    it("throws error when user lookup fails", async () => {
      mockGetUser.mockResolvedValue({ error: { message: "User not found" } });
      await expect(createCheckoutSession("invalid-user")).rejects.toThrow(
        "User not found"
      );
      expect(mockCreateStripeCheckout).not.toHaveBeenCalled();
      expect(mockGetUser).toHaveBeenCalledWith("invalid-user");
    });
  });

  describe("checkoutExpiry", () => {
    const now = Date.parse("2026-11-02T20:00:20Z");
    const minute = (iso: string) => Date.parse(iso) / 1000;

    it("ends with the payment hold when that's within a day", () => {
      expect(PaymentService.checkoutExpiry("2026-11-03T08:00:00Z", now)).toBe(minute("2026-11-03T08:00:00Z"));
    });

    it("lasts at most 24 hours, rounded down to the minute", () => {
      expect(PaymentService.checkoutExpiry("2026-11-05T20:00:00Z", now)).toBe(minute("2026-11-03T20:00:00Z"));
    });

    it("never lasts under Stripe's 30 minutes, rounded up to the minute", () => {
      expect(PaymentService.checkoutExpiry("2026-11-02T20:10:00Z", now)).toBe(minute("2026-11-02T20:32:00Z"));
      expect(PaymentService.checkoutExpiry(null, now)).toBe(minute("2026-11-02T20:32:00Z"));
    });
  });

  describe("create event checkout session", () => {
    const userId = "user_123";
    const eventId = "event_456";
    const attendeeId = "att_789";
    const priceId = "price_123";
    const fakeSession = { id: "sess_pmc", url: "https://checkout" };
    const reviewed = { event_id: eventId, needs_review: true };
    const inAnHour = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const accepted = (overrides = {}) => ({
      attendee_id: attendeeId,
      status: "ACCEPTED" as const,
      payment_due_at: inAnHour(),
      acceptance_version: 2,
      ...overrides,
    });

    beforeEach(() => {
      process.env.ORIGIN = "http://localhost:5173";
      process.env.CARD_PAYMENT_METHOD_ID = "pm_mocked_123";
      mockSaveCheckoutSession.mockResolvedValue({ error: null });
    });

    it("creates a checkout for the current acceptance and saves it", async () => {
      mockGetCheckoutSession.mockResolvedValueOnce({ data: null, error: null });
      mockCreateStripeCheckout.mockResolvedValueOnce(fakeSession);

      const result = await getOrCreateEventCheckoutSession(accepted(), reviewed, userId, priceId);

      const metadata = { user_id: userId, payment_type: "event", attendee_id: attendeeId, event_id: eventId, acceptance_version: "2" };
      const [params, options] = mockCreateStripeCheckout.mock.calls[0];
      expect(params).toMatchObject({
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "payment",
        payment_method_configuration: "pm_mocked_123",
        metadata: { ...metadata, price_id: priceId },
        payment_intent_data: { metadata },
        success_url: `http://localhost:5173/events/${eventId}?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `http://localhost:5173/events/${eventId}`,
      });
      expect(options).toEqual({ idempotencyKey: `event-checkout-${attendeeId}-v2-${priceId}-${params.expires_at}` });
      expect(result).toEqual(fakeSession);
      expect(mockSaveCheckoutSession).toHaveBeenCalledWith({
        attendee_id: attendeeId,
        checkout_id: fakeSession.id,
        acceptance_version: 2,
        expires_at: new Date(params.expires_at * 1000).toISOString(),
      });
    });

    it("reuses an open checkout for the same acceptance and price", async () => {
      mockGetCheckoutSession.mockResolvedValueOnce({ data: { checkout_id: "prev-session", fulfilled_at: null }, error: null });
      const open = { id: "prev-session", status: "open", metadata: { acceptance_version: "2", price_id: priceId } };
      mockRetrieveStripeCheckout.mockResolvedValueOnce(open);

      await expect(getOrCreateEventCheckoutSession(accepted(), reviewed, userId, priceId)).resolves.toEqual(open);
      expect(mockCreateStripeCheckout).not.toHaveBeenCalled();
      expect(mockExpireStripeCheckout).not.toHaveBeenCalled();
    });

    it.each([
      ["an earlier acceptance", { acceptance_version: "1", price_id: priceId }],
      ["a different price", { acceptance_version: "2", price_id: "price_old" }],
    ])("expires and replaces an open checkout from %s", async (_, metadata) => {
      mockGetCheckoutSession.mockResolvedValueOnce({ data: { checkout_id: "prev-session", fulfilled_at: null }, error: null });
      mockRetrieveStripeCheckout.mockResolvedValueOnce({ id: "prev-session", status: "open", metadata });
      mockCreateStripeCheckout.mockResolvedValueOnce(fakeSession);

      await expect(getOrCreateEventCheckoutSession(accepted(), reviewed, userId, priceId)).resolves.toEqual(fakeSession);
      expect(mockExpireStripeCheckout).toHaveBeenCalledWith("prev-session");
    });

    it("refuses a second checkout while a paid one is waiting on the webhook", async () => {
      mockGetCheckoutSession.mockResolvedValueOnce({ data: { checkout_id: "prev-session", fulfilled_at: null }, error: null });
      mockRetrieveStripeCheckout.mockResolvedValueOnce({ id: "prev-session", status: "complete", metadata: {} });

      await expect(getOrCreateEventCheckoutSession(accepted(), reviewed, userId, priceId)).rejects.toMatchObject({
        status: 409,
        code: "PAYMENT_PROCESSING",
      });
      expect(mockCreateStripeCheckout).not.toHaveBeenCalled();
    });

    it.each([
      ["HOLD_EXPIRED", accepted({ payment_due_at: new Date(Date.now() - 1000).toISOString() })],
      ["NOT_ACCEPTED", accepted({ status: "APPLIED" })],
      ["NOT_ACCEPTED", accepted({ status: "REJECTED" })],
      ["ALREADY_REGISTERED", accepted({ status: "REGISTERED" })],
    ])("refuses with %s", async (code, attendee) => {
      await expect(getOrCreateEventCheckoutSession(attendee as any, reviewed, userId, priceId)).rejects.toMatchObject({ code });
      expect(mockCreateStripeCheckout).not.toHaveBeenCalled();
    });

    it("lets a student pay for an event without review, with no version", async () => {
      mockGetCheckoutSession.mockResolvedValueOnce({ data: null, error: null });
      mockCreateStripeCheckout.mockResolvedValueOnce(fakeSession);

      await getOrCreateEventCheckoutSession(
        accepted({ status: "PROCESSING", payment_due_at: null, acceptance_version: 0 }),
        { event_id: eventId, needs_review: false },
        userId,
        priceId
      );

      expect(mockCreateStripeCheckout.mock.calls[0][0].metadata.acceptance_version).toBe("none");
      expect(mockSaveCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({ acceptance_version: null }));
    });

    it("logs an unresolved payment issue before replacing its row", async () => {
      const log = jest.spyOn(console, "error").mockImplementation(() => {});
      mockGetCheckoutSession.mockResolvedValueOnce({
        data: { checkout_id: "prev-session", fulfilled_at: "2026-11-01T00:00:00Z", attention_reason: "LATE_PAYMENT", attention_resolved_at: null, refund_id: "re_1" },
        error: null,
      });
      mockCreateStripeCheckout.mockResolvedValueOnce(fakeSession);

      await getOrCreateEventCheckoutSession(accepted(), reviewed, userId, priceId);

      expect(log).toHaveBeenCalledWith(expect.stringContaining('"event":"ATTENTION_REPLACED"'));
      expect(mockRetrieveStripeCheckout).not.toHaveBeenCalled();
    });

    it("stripe session creation fails", async () => {
      mockGetCheckoutSession.mockResolvedValueOnce({ data: null, error: null });
      mockCreateStripeCheckout.mockRejectedValueOnce(new Error("Stripe failed"));
      await expect(getOrCreateEventCheckoutSession(accepted(), reviewed, userId, priceId)).rejects.toThrow("Stripe failed");
    });
  });

  describe("create rsvp checkout session", () => {
    const userId = "user_123";
    const eventId = "event_456";
    const attendeeId = "att_789";
    const priceId = "price_123";
    const fakeSession = { id: "sess_pmc", expires_at: 1793736000 };

    it("creates and saves rsvp checkout session", async () => {
      process.env.ORIGIN = "http://localhost:5173";
      process.env.CARD_PAYMENT_METHOD_ID = "pm_mocked_123";
      mockGetCheckoutSession.mockResolvedValueOnce({ data: null, error: null });
      mockCreateStripeCheckout.mockResolvedValueOnce(fakeSession);
      mockSaveCheckoutSession.mockResolvedValueOnce({ error: null });
      const result = await getOrCreateRSVPCheckoutSession(
        attendeeId,
        eventId,
        userId,
        priceId
      );

      expect(mockGetCheckoutSession).toHaveBeenCalledWith(attendeeId);
      expect(mockCreateStripeCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [{ price: priceId, quantity: 1 }],
          mode: "payment",
          payment_method_configuration: process.env.CARD_PAYMENT_METHOD_ID,
          payment_intent_data: {
            metadata: {
              user_id: userId,
              payment_type: "event",
              attendee_id: attendeeId,
            },
          },
          success_url: `${process.env.ORIGIN}/events/${eventId}`,
          cancel_url: `${process.env.ORIGIN}/events/${eventId}`,
        })
      );
      expect(result).toEqual(fakeSession);
      expect(mockSaveCheckoutSession).toHaveBeenCalledWith({
        attendee_id: attendeeId,
        checkout_id: fakeSession.id,
        acceptance_version: null,
        expires_at: "2026-11-03T20:00:00.000Z",
      });
    });

    it("returns previously saved checkout session", async () => {
      mockGetCheckoutSession.mockResolvedValueOnce({
        data: { checkout_id: "prev-session" },
        error: null,
      });
      mockRetrieveStripeCheckout.mockResolvedValueOnce({ id: "prev-session" });

      const result = await getOrCreateRSVPCheckoutSession(
        attendeeId,
        eventId,
        userId,
        priceId
      );

      expect(result).toEqual({ id: "prev-session" });
      expect(mockGetCheckoutSession).toHaveBeenCalledWith(attendeeId);
      expect(mockRetrieveStripeCheckout).toHaveBeenCalledWith("prev-session");
      expect(mockCreateStripeCheckout).not.toHaveBeenCalled();
      expect(mockSaveCheckoutSession).not.toHaveBeenCalled();
    });

    it("stripe session creation fails", async () => {
      mockGetCheckoutSession.mockResolvedValueOnce({ data: null, error: null });
      mockCreateStripeCheckout.mockRejectedValueOnce(new Error("Stripe failed"));
      await expect(
        getOrCreateRSVPCheckoutSession(attendeeId, eventId, userId, priceId)
      ).rejects.toThrow("Stripe failed");
    });
  });
});
