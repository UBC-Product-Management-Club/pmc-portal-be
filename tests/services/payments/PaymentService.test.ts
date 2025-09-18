jest.mock("../../../src/services/emails/confirmation", () => ({
    sendConfirmationEmail: jest.fn(),
    ConfirmationEvent: { MembershipPayment: "membership_payment" }, // match your code’s value
}));

jest.mock("../../../src/config/stripe", () => ({
    stripe: {
        paymentIntents: {
            create: jest.fn(),
        },
        checkout: {
            sessions: {
                create: jest.fn()
            }
        }
    }
}));

jest.mock("../../../src/services/Event/EventService", () => ({
    getEventPriceId: jest.fn(),
}));

jest.mock("../../../src/config/supabase", () => ({
    supabase: {
        from: jest.fn(),
    },
}));

import { supabase } from "../../../src/config/supabase";
import { createCheckoutSession, createMembershipPaymentIntent, createEventCheckoutSession} from "../../../src/services/Payment/PaymentService";
import * as PaymentService from "../../../src/services/Payment/PaymentService";
import * as EmailConfirmation from "../../../src/services/emails/confirmation";
import { stripe } from "../../../src/config/stripe";
import { getEventPriceId } from "../../../src/services/Event/EventService";
import Stripe from "stripe";

describe("PaymentService", () => {
    // Declare mocks
    let mockFrom: jest.Mock;
    let mockCreatePaymentIntent: jest.Mock;
    let mockCreateCheckoutSession: jest.Mock;
    let mockSelect: jest.Mock;
    let mockEq: jest.Mock;
    let mockInsert: jest.Mock;
    let mockSingle: jest.Mock;
    let mockUpdate: jest.Mock;
    let spyLogTransaction: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();

        // Reassign mocks
        mockFrom = supabase.from as jest.Mock;
        mockCreatePaymentIntent = stripe.paymentIntents.create as jest.Mock;
        mockCreateCheckoutSession = stripe.checkout.sessions.create as jest.Mock;

        mockSelect = jest.fn();
        mockEq = jest.fn();
        mockInsert = jest.fn();
        mockSingle = jest.fn();
        mockUpdate = jest.fn();

        spyLogTransaction = jest.spyOn(PaymentService, "logTransaction");
    });

    describe("createPaymentIntent", () => {
        it("creates payment intent for UBC student", async () => {
            const mockPaymentIntent = { id: "pi_ubc_test", amount: 5000 };
            mockCreatePaymentIntent.mockResolvedValueOnce(mockPaymentIntent);
            mockFrom.mockReturnValueOnce({
                select: mockSelect.mockReturnValueOnce({
                    eq: mockEq.mockReturnValueOnce({
                        single: mockSingle.mockResolvedValueOnce({
                            data: { university: "University of British Columbia" },
                            error: null,
                        }),
                    }),
                }),
            });

            const result = await createMembershipPaymentIntent("user-123");

            expect(result).toEqual(mockPaymentIntent);
            expect(mockFrom).toHaveBeenCalledWith("User");
            expect(mockSelect).toHaveBeenCalledWith("university");
            expect(mockEq).toHaveBeenCalledWith("user_id", "user-123");
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
            mockCreatePaymentIntent.mockResolvedValueOnce(mockPaymentIntent);
            mockFrom.mockReturnValueOnce({
                select: mockSelect.mockReturnValueOnce({
                    eq: mockEq.mockReturnValueOnce({
                        single: mockSingle.mockResolvedValueOnce({
                            data: { university: "Simon Fraser University" },
                            error: null,
                        }),
                    }),
                }),
            });

            const result = await createMembershipPaymentIntent("user-456");

            expect(result).toEqual(mockPaymentIntent);
            expect(mockFrom).toHaveBeenCalledWith("User");
            expect(mockEq).toHaveBeenCalledWith("user_id", "user-456");
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
            mockFrom.mockReturnValueOnce({
                select: mockSelect.mockReturnValueOnce({
                    eq: mockEq.mockReturnValueOnce({
                        single: mockSingle.mockResolvedValueOnce({
                            data: null,
                            error: { message: "User not found" },
                        }),
                    }),
                }),
            });

            await expect(createMembershipPaymentIntent("invalid-user")).rejects.toThrow("User not found");
            expect(mockCreatePaymentIntent).not.toHaveBeenCalled();
        });
    });

    describe("handleStripeEvent", () => {
        beforeEach(() => {
            spyLogTransaction.mockResolvedValue(undefined);
        });

        const paymentIntentMembership = {
            id: "pi_test",
            amount: 1234,
            metadata: { user_id: "user-123", payment_type: "membership" },
        };

        const paymentIntentEventRegistration = {
            id: "pi_event_test",
            amount: 5678,
            metadata: { user_id: "user-123", payment_type: "event", attendee_id: "att-456"},
        } as any;

        const checkoutSessionCompletedEventRegistration = {
            id: "pi_event_test",
            amount_total: 0,
            object: "checkout.session",
            metadata: { user_id: "user-123", payment_type: "event", attendee_id: "att-456"},
        } as any;

        const makeEvent = (type: Stripe.Event.Type, status: Stripe.PaymentIntent.Status | Stripe.Checkout.Session.Status, baseIntent: any = paymentIntentMembership): Stripe.Event => {
            return {
                id: "event_test",
                type,
                data: { object: { ...baseIntent, status } as Stripe.PaymentIntent | Stripe.Checkout.Session },
            } as unknown as Stripe.Event;
        };

        it("check canceled", async () => {
            await PaymentService.handleStripeEvent(makeEvent("payment_intent.canceled", "canceled", paymentIntentMembership));
            expect(spyLogTransaction).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    payment_id: "pi_test",
                    user_id: "user-123",
                    type: "membership",
                    amount: 1234,
                    status: PaymentService.Status.PAYMENT_CANCELED,
                    payment_date: expect.any(String),
                })
            );
            expect(mockFrom).not.toHaveBeenCalledWith("User");
        });

        it("check payment_failed", async () => {
            await PaymentService.handleStripeEvent(makeEvent("payment_intent.payment_failed", "requires_payment_method", paymentIntentMembership));
            expect(spyLogTransaction).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    payment_id: "pi_test",
                    user_id: "user-123",
                    type: "membership",
                    amount: 1234,
                    status: PaymentService.Status.PAYMENT_FAILED,
                    payment_date: expect.any(String),
                })
            );
            expect(mockFrom).not.toHaveBeenCalledWith("User");
        });

        it("check processing", async () => {
            await PaymentService.handleStripeEvent(makeEvent("payment_intent.processing", "processing", paymentIntentMembership));
            expect(spyLogTransaction).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    payment_id: "pi_test",
                    user_id: "user-123",
                    type: "membership",
                    amount: 1234,
                    status: PaymentService.Status.PAYMENT_PENDING,
                    payment_date: expect.any(String),
                })
            );
            expect(mockFrom).not.toHaveBeenCalledWith("User");
        });

        it("check membership payment succeeded", async () => {
            jest.spyOn(EmailConfirmation, "sendConfirmationEmail").mockResolvedValue(undefined as any);

            mockFrom.mockReturnValueOnce({
                update: mockUpdate.mockReturnValue({
                    eq: mockEq.mockResolvedValue({ data: null, error: null }),
                }),
            });

            await PaymentService.handleStripeEvent(makeEvent("payment_intent.succeeded", "succeeded", paymentIntentMembership));
            expect(spyLogTransaction).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    payment_id: "pi_test",
                    user_id: "user-123",
                    type: "membership",
                    amount: 1234,
                    status: PaymentService.Status.PAYMENT_SUCCESS,
                    payment_date: expect.any(String),
                })
            );

            expect(mockFrom).toHaveBeenCalledWith("User");
            expect(mockUpdate).toHaveBeenCalledWith({ is_payment_verified: true });
            expect(mockEq).toHaveBeenCalledWith("user_id", "user-123");
            expect(EmailConfirmation.sendConfirmationEmail).toHaveBeenCalledWith("user-123", "membership_payment");
        });

        it("check event payment succeeded", async () => {
            mockFrom.mockReturnValueOnce({
                update: mockUpdate.mockReturnValue({
                    eq: mockEq.mockResolvedValue({ data: null, error: null }),
                }),
            });

            await PaymentService.handleStripeEvent(makeEvent("payment_intent.succeeded", "succeeded", paymentIntentEventRegistration));

            expect(spyLogTransaction).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    payment_id: "pi_event_test",
                    user_id: "user-123",
                    type: "event",
                    amount: 5678,
                    status: PaymentService.Status.PAYMENT_SUCCESS,
                    payment_date: expect.any(String),
                })
            );
            expect(mockFrom).toHaveBeenCalledWith("Attendee");
            expect(mockUpdate).toHaveBeenCalledWith({ is_payment_verified: true, payment_id: "pi_event_test"});
            expect(mockEq).toHaveBeenCalledWith("attendee_id", "att-456");
        });

        it("check free event payment succeeded", async () => {
            mockFrom.mockReturnValueOnce({
                update: mockUpdate.mockReturnValue({
                    eq: mockEq.mockResolvedValue({ data: null, error: null }),
                }),
            });

            await PaymentService.handleStripeEvent(makeEvent("checkout.session.completed", "complete", checkoutSessionCompletedEventRegistration));

            expect(spyLogTransaction).toHaveBeenLastCalledWith(
                expect.objectContaining({
                    payment_id: "pi_event_test",
                    user_id: "user-123",
                    type: "event",
                    amount: 0,
                    status: PaymentService.Status.PAYMENT_SUCCESS,
                    payment_date: expect.any(String),
                })
            );
            expect(mockFrom).toHaveBeenCalledWith("Attendee");
            expect(mockUpdate).toHaveBeenCalledWith({ is_payment_verified: true, payment_id: "pi_event_test"});
            expect(mockEq).toHaveBeenCalledWith("attendee_id", "att-456");
        })
    });

    describe("create membership checkout session", () => {
        it("creates payment intent for UBC student", async () => {
            mockFrom
                .mockReturnValueOnce({
                    select: mockSelect.mockReturnValueOnce({
                        eq: mockEq.mockReturnValueOnce({
                            single: mockSingle.mockResolvedValueOnce({
                                data: { university: "University of British Columbia" },
                                error: null,
                            }),
                        }),
                    }),
                })
                .mockReturnValueOnce({
                    select: mockSelect.mockReturnValueOnce({
                        eq: mockEq.mockReturnValueOnce({
                            single: mockSingle.mockResolvedValueOnce({
                                data: { product: "price_ubc_test" },
                                error: null,
                            }),
                        }),
                    }),
                });

            mockCreateCheckoutSession.mockResolvedValue({ id: "sess_test" });

            const result = await createCheckoutSession("user-123");

            expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
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
        });

        it("throws error when user lookup fails", async () => {
            mockFrom.mockReturnValueOnce({
                select: mockSelect.mockReturnValueOnce({
                    eq: mockEq.mockReturnValueOnce({
                        single: mockSingle.mockResolvedValueOnce({
                            data: null,
                            error: { message: "User not found" },
                        }),
                    }),
                }),
            });

            await expect(createCheckoutSession("invalid-user")).rejects.toThrow("User not found");
            expect(mockCreateCheckoutSession).not.toHaveBeenCalled();
        });

    })

    describe("create event checkout session", () => {
        const userId = "user_123";
        const eventId = "event_456";
        const attendeeId = "att_789";
        const fakePriceId = "price_123";
        const fakeSession = { id: "sess_pmc" };
        const mockUserData = { is_payment_verified: true };

        it("creates event registration checkout session for members", async () => {
            process.env.ORIGIN = 'http://localhost:5173';
            process.env.CARD_PAYMENT_METHOD_ID = 'pm_mocked_123';
            mockFrom.mockReturnValueOnce({
                select: mockSelect.mockReturnValueOnce({
                    eq: mockEq.mockReturnValueOnce({
                        single: mockSingle.mockReturnValueOnce({
                            data: mockUserData,
                            error: null
                        })
                    })
                })
            });

            (getEventPriceId as jest.Mock).mockResolvedValue(fakePriceId);
            mockCreateCheckoutSession.mockResolvedValue(fakeSession);

            const result = await createEventCheckoutSession(userId, eventId, attendeeId);
            const expectedIsMember = mockUserData.is_payment_verified ?? false;

            expect(getEventPriceId).toHaveBeenCalledWith(eventId, expectedIsMember);
            expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
            expect.objectContaining({
                    line_items: [{ price: fakePriceId, quantity: 1 }],
                    mode: "payment",
                    payment_method_configuration: process.env.CARD_PAYMENT_METHOD_ID,
                    payment_intent_data: {
                    metadata: { user_id: userId, payment_type: "event", attendee_id: attendeeId },
                    },
                    success_url: `${process.env.ORIGIN}/events/${eventId}/register/?attendeeId=${attendeeId}&success=true`,
                    cancel_url: `${process.env.ORIGIN}/events/${eventId}/register/?attendeeId=${attendeeId}&canceled=true`,
                })
            );
            expect(result).toEqual(fakeSession);
        });

        it("supabase returning error", async () => {
            mockFrom.mockReturnValueOnce({
                select: mockSelect.mockReturnValueOnce({
                    eq: mockEq.mockReturnValueOnce({
                        single: mockSingle.mockReturnValueOnce({
                            data: null,
                            error: { message: "User not found"}
                        })
                    })
                })
            });
            await expect(createEventCheckoutSession(userId, eventId, attendeeId))
                .rejects
                .toThrow("User not found");
        });

        it("stripe session creation fails", async() => {
            mockFrom.mockReturnValueOnce({
                select: mockSelect.mockReturnValueOnce({
                    eq: mockEq.mockReturnValueOnce({
                        single: mockSingle.mockReturnValueOnce({
                            data: mockUserData,
                            error: null
                        })
                    })
                })
            });
        
            (getEventPriceId as jest.Mock).mockResolvedValue(fakePriceId);
            mockCreateCheckoutSession.mockRejectedValue(new Error("Stripe failed"));
            await expect(createEventCheckoutSession(userId, eventId, attendeeId))
                .rejects
                .toThrow("Stripe failed");
        });
    })
})



