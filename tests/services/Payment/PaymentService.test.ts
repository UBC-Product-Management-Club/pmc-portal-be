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
        checkout: {
            sessions: {
                create: jest.fn(),
                retrieve: jest.fn()
            }
        }
    }
}));


import { createCheckoutSession, createMembershipPaymentIntent, getOrCreateEventCheckoutSession, getOrCreateRSVPCheckoutSession} from "../../../src/services/Payment/PaymentService";
import * as PaymentService from "../../../src/services/Payment/PaymentService";
import { stripe } from "../../../src/config/stripe";
import Stripe from "stripe";
import { UserRepository } from "../../../src/storage/UserRepository";
import { PaymentRepository } from "../../../src/storage/PaymentRepository";
import { AttendeeRepository } from "../../../src/storage/AttendeeRepository";
import { ProductRepository } from "../../../src/storage/ProductRepository";
import { addToMailingList, sendEmail } from "../../../src/services/Email/EmailService";
import { CheckoutSessionRepository } from "../../../src/storage/CheckoutSessionRepository";

jest.mock("../../../src/services/User/UserService")
jest.mock("../../../src/services/Event/EventService");
jest.mock("../../../src/services/Email/EmailService")

describe("PaymentService", () => {
    // Declare mocks
    let mockGetUser: jest.Mock;
    let mockGetProduct: jest.Mock;
    let mockGetCheckoutSession: jest.Mock;
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
    let mocksendEmail: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        mockGetUser = UserRepository.getUser as jest.Mock;
        mockGetProduct = ProductRepository.getPriceId as jest.Mock;
        mockGetCheckoutSession = CheckoutSessionRepository.getCheckoutSession as jest.Mock;
        mockUpdateUser = UserRepository.updateUser as jest.Mock;
        mockUpdateAttendee = AttendeeRepository.updateAttendee as jest.Mock;
        mockTransactionLogger = PaymentRepository.logTransaction as jest.Mock;
        mockCreatePaymentIntent = stripe.paymentIntents.create as jest.Mock;
        mockCreateStripeCheckout = stripe.checkout.sessions.create as jest.Mock;
        mockRetrieveStripeCheckout = stripe.checkout.sessions.retrieve as jest.Mock;
        mockSaveCheckoutSession = CheckoutSessionRepository.addCheckoutSession as jest.Mock
        mockDeleteCheckoutSession = CheckoutSessionRepository.deleteCheckoutSession as jest.Mock
        mockDeleteAttendee = AttendeeRepository.deleteAttendee as jest.Mock;
        mockAddToMailingList = (addToMailingList as jest.Mock)
        mocksendEmail = (sendEmail as jest.Mock)
    });

    describe("createPaymentIntent", () => {
        it("creates payment intent for UBC student", async () => {
            mockGetUser.mockResolvedValueOnce({ data: { university: "University of British Columbia"}});
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
            mockGetUser.mockResolvedValueOnce({ data: { university: "Simon Fraser University"}});
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
            mockGetUser.mockResolvedValueOnce({ error: { message: "User not found" }});
            await expect(createMembershipPaymentIntent("invalid-user")).rejects.toThrow("User not found");
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
            metadata: { user_id: "user-123", payment_type: "event", attendee_id: "att-456"},
        } 

        const checkoutSessionFreeEventRegistration = {
            id: "cs_event_test",
            amount_total: 0,
            object: "checkout.session",
            metadata: { user_id: "user-123", payment_type: "event", attendee_id: "att-456"},
        }

        const checkoutSessionEventRegistration = {
            id: "cs_event_test",
            amount_total: 1000,
            object: "checkout.session",
            metadata: { user_id: "user-123", payment_type: "event", attendee_id: "att-456"},
        }

        const makeEvent = (type: Stripe.Event.Type, status: Stripe.PaymentIntent.Status | Stripe.Checkout.Session.Status, baseIntent: any = paymentIntentMembership): Stripe.Event => {
            return {
                id: "event_test",
                type,
                data: { object: { ...baseIntent, status } as Stripe.PaymentIntent | Stripe.Checkout.Session },
            } as unknown as Stripe.Event;
        };

        beforeEach(() => {
            mockTransactionLogger.mockResolvedValue({})
        })

        it("check canceled", async () => {
            await PaymentService.handleStripeEvent(makeEvent("payment_intent.canceled", "canceled", paymentIntentMembership));
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
            expect(mockUpdateUser).not.toHaveBeenCalled()
        });

        it("check payment_failed", async () => {
            await PaymentService.handleStripeEvent(makeEvent("payment_intent.payment_failed", "requires_payment_method", paymentIntentMembership));
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
            expect(mockUpdateUser).not.toHaveBeenCalled()
        });

        it("check processing", async () => {
            await PaymentService.handleStripeEvent(makeEvent("payment_intent.processing", "processing", paymentIntentMembership));
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
            mockUpdateUser.mockResolvedValueOnce({})
            await PaymentService.handleStripeEvent(makeEvent("payment_intent.succeeded", "succeeded", paymentIntentMembership));
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

            expect(mockUpdateUser).toHaveBeenCalledWith("user-123", { is_payment_verified: true })
            expect(mocksendEmail).toHaveBeenCalledWith("user-123", "membership_payment");
        });

        it("check event payment succeeded", async () => {
            mockUpdateAttendee.mockResolvedValueOnce({})
            await PaymentService.handleStripeEvent(makeEvent("payment_intent.succeeded", "succeeded", paymentIntentEventRegistration));

            expect(mockTransactionLogger).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    payment_id: "pi_event_test",
                    user_id: "user-123",
                    type: "event",
                    amount: 5678,
                    status: PaymentService.Status.PAYMENT_SUCCESS,
                    payment_date: expect.any(String),
                })
            );
            expect(mockUpdateAttendee).toHaveBeenCalledWith("att-456", { is_payment_verified: true, payment_id: "pi_event_test", status: "REGISTERED" })
        });

        it("check free event payment succeeded", async () => {
            mockDeleteCheckoutSession.mockResolvedValueOnce({});
            mockUpdateAttendee.mockResolvedValueOnce({});
            await PaymentService.handleStripeEvent(makeEvent("checkout.session.completed", "complete", checkoutSessionFreeEventRegistration));

            expect(mockTransactionLogger).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    payment_id: "cs_event_test",
                    user_id: "user-123",
                    type: "event",
                    amount: 0,
                    status: PaymentService.Status.PAYMENT_SUCCESS,
                    payment_date: expect.any(String),
                })
            );
            expect(mockUpdateAttendee).toHaveBeenCalledWith("att-456", { is_payment_verified: true, payment_id: "cs_event_test", status: "REGISTERED"});
            expect(mockAddToMailingList).toHaveBeenCalledWith("att-456")
        })

        it("checkout session completed", async () => {
            mockDeleteCheckoutSession.mockResolvedValueOnce({});
            mockUpdateAttendee.mockResolvedValueOnce({});
            await PaymentService.handleStripeEvent(makeEvent("checkout.session.completed", "complete", checkoutSessionEventRegistration));

            expect(mockAddToMailingList).toHaveBeenCalledWith(checkoutSessionEventRegistration.metadata.attendee_id)
            expect(mockDeleteCheckoutSession).toHaveBeenCalledWith(checkoutSessionEventRegistration.metadata.attendee_id)
        })

        it('checkout session expired', async () => {
            mockDeleteCheckoutSession.mockResolvedValueOnce({});
            mockDeleteAttendee.mockResolvedValueOnce({});
            await PaymentService.handleStripeEvent(makeEvent("checkout.session.expired", "expired", checkoutSessionEventRegistration));

            expect(mockDeleteCheckoutSession).toHaveBeenCalledWith(checkoutSessionEventRegistration.metadata.attendee_id)
            expect(mockDeleteAttendee).toHaveBeenCalledWith(checkoutSessionEventRegistration.metadata.attendee_id)
        })
    });

    describe("create membership checkout session", () => {
        it("creates membership checkout session for UBC student", async () => {
            mockGetUser.mockResolvedValue({ data: { university: "University of British Columbia"}})
            mockGetProduct.mockResolvedValue({ data: { product: "price_ubc_test" }})
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
            expect(mockGetUser).toHaveBeenCalledWith("user-123")
            expect(mockGetProduct).toHaveBeenCalledWith("28b6e39a-c480-4e66-87e7-af9be35b8c0d")
        });

        it("throws error when user lookup fails", async () => {
            mockGetUser.mockResolvedValue({ error: { message: "User not found" }})
            await expect(createCheckoutSession("invalid-user")).rejects.toThrow("User not found");
            expect(mockCreateStripeCheckout).not.toHaveBeenCalled();
            expect(mockGetUser).toHaveBeenCalledWith("invalid-user")
        });

    })

    describe("create event checkout session", () => {
        const userId = "user_123";
        const eventId = "event_456";
        const attendeeId = "att_789";
        const priceId = "price_123";
        const fakeSession = { id: "sess_pmc" };

        it("creates and saves event registration checkout session", async () => {
            process.env.ORIGIN = 'http://localhost:5173';
            process.env.CARD_PAYMENT_METHOD_ID = 'pm_mocked_123';
            mockGetCheckoutSession.mockResolvedValueOnce({ data: null, error: null })
            mockCreateStripeCheckout.mockResolvedValueOnce(fakeSession);
            mockSaveCheckoutSession.mockResolvedValueOnce({ error: null })
            const result = await getOrCreateEventCheckoutSession(attendeeId, eventId, userId, priceId);

            expect(mockGetCheckoutSession).toHaveBeenCalledWith(attendeeId)
            expect(mockCreateStripeCheckout).toHaveBeenCalledWith(
            expect.objectContaining({
                    line_items: [{ price: priceId, quantity: 1 }],
                    mode: "payment",
                    payment_method_configuration: process.env.CARD_PAYMENT_METHOD_ID,
                    payment_intent_data: {
                    metadata: { user_id: userId, payment_type: "event", attendee_id: attendeeId },
                    },
                    success_url: `${process.env.ORIGIN}/events/${eventId}/register?success=true`,
                    cancel_url: `${process.env.ORIGIN}/events/${eventId}/register`,
                })
            );
            expect(result).toEqual(fakeSession);
            expect(mockSaveCheckoutSession).toHaveBeenCalledWith(attendeeId, fakeSession.id)
        });

        it('returns previously saved checkout session', async () => {
            mockGetCheckoutSession.mockResolvedValueOnce({ data: { checkout_id: "prev-session" }, error: null });
            mockRetrieveStripeCheckout.mockResolvedValueOnce({ id: "prev-session" });

            const result = await getOrCreateEventCheckoutSession(attendeeId, eventId, userId, priceId);

            expect(result).toEqual({id : "prev-session"});
            expect(mockGetCheckoutSession).toHaveBeenCalledWith(attendeeId);
            expect(mockRetrieveStripeCheckout).toHaveBeenCalledWith("prev-session")
            expect(mockCreateStripeCheckout).not.toHaveBeenCalled();
            expect(mockSaveCheckoutSession).not.toHaveBeenCalled();
        })

        it("stripe session creation fails", async() => {
            mockGetCheckoutSession.mockResolvedValueOnce({ data: null, error: null });
            mockCreateStripeCheckout.mockRejectedValue(new Error("Stripe failed"));
            await expect(getOrCreateEventCheckoutSession(userId, eventId, attendeeId, priceId))
                .rejects
                .toThrow("Stripe failed");
        });
    })

    describe("create rsvp checkout session", () => {
        const userId = "user_123";
        const eventId = "event_456";
        const attendeeId = "att_789";
        const priceId = "price_123";
        const fakeSession = { id: "sess_pmc" };

        it("creates and saves rsvp checkout session", async () => {
            process.env.ORIGIN = 'http://localhost:5173';
            process.env.CARD_PAYMENT_METHOD_ID = 'pm_mocked_123';
            mockGetCheckoutSession.mockResolvedValueOnce({ data: null, error: null })
            mockCreateStripeCheckout.mockResolvedValueOnce(fakeSession);
            mockSaveCheckoutSession.mockResolvedValueOnce({ error: null })
            const result = await getOrCreateRSVPCheckoutSession(attendeeId, eventId, userId, priceId);

            expect(mockGetCheckoutSession).toHaveBeenCalledWith(attendeeId)
            expect(mockCreateStripeCheckout).toHaveBeenCalledWith(
            expect.objectContaining({
                    line_items: [{ price: priceId, quantity: 1 }],
                    mode: "payment",
                    payment_method_configuration: process.env.CARD_PAYMENT_METHOD_ID,
                    payment_intent_data: {
                    metadata: { user_id: userId, payment_type: "event", attendee_id: attendeeId },
                    },
                    success_url: `${process.env.ORIGIN}/events/${eventId}`,
                    cancel_url: `${process.env.ORIGIN}/events/${eventId}`,
                })
            );
            expect(result).toEqual(fakeSession);
            expect(mockSaveCheckoutSession).toHaveBeenCalledWith(attendeeId, fakeSession.id)
        });

        it('returns previously saved checkout session', async () => {
            mockGetCheckoutSession.mockResolvedValueOnce({ data: { checkout_id: "prev-session" }, error: null });
            mockRetrieveStripeCheckout.mockResolvedValueOnce({ id: "prev-session" });

            const result = await getOrCreateRSVPCheckoutSession(attendeeId, eventId, userId, priceId);

            expect(result).toEqual({id : "prev-session"});
            expect(mockGetCheckoutSession).toHaveBeenCalledWith(attendeeId);
            expect(mockRetrieveStripeCheckout).toHaveBeenCalledWith("prev-session")
            expect(mockCreateStripeCheckout).not.toHaveBeenCalled();
            expect(mockSaveCheckoutSession).not.toHaveBeenCalled();
        })

        it("stripe session creation fails", async() => {
            mockGetCheckoutSession.mockResolvedValueOnce({ data: null, error: null });
            mockCreateStripeCheckout.mockRejectedValue(new Error("Stripe failed"));
            await expect(getOrCreateEventCheckoutSession(userId, eventId, attendeeId, priceId))
                .rejects
                .toThrow("Stripe failed");
        });
    })
})



