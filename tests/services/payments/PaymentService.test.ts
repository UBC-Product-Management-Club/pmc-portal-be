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
                create: jest.fn(),
            },
        },
    },
}));

import { supabase } from "../../../src/config/supabase";
import { createCheckoutSession, createMembershipPaymentIntent } from "../../../src/services/Payment/PaymentService";
import * as PaymentService from "../../../src/services/Payment/PaymentService";
import * as EmailConfirmation from "../../../src/services/emails/confirmation";
import { stripe } from "../../../src/config/stripe";
import Stripe from "stripe";

describe("PaymentService", () => {
    let mockFrom = supabase.from as jest.Mock;
    let mockCreatePaymentIntent = stripe.paymentIntents.create as jest.Mock;
    let mockCreateCheckoutSession = stripe.checkout.sessions.create as jest.Mock;
    let mockSelect = jest.fn();
    let mockUpdate = jest.fn();
    let mockEq = jest.fn();
    let mockSingle = jest.fn();
    let spyLogTransaction: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
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

        const paymentIntent = {
            id: "pi_test",
            amount: 1234,
            metadata: { user_id: "user-123", payment_type: "membership" },
        } as any;

        const makeEvent = (type: Stripe.Event.Type, status: Stripe.PaymentIntent.Status): Stripe.Event => {
            return {
                id: "event_test",
                type,
                data: { object: { ...paymentIntent, status } as Stripe.PaymentIntent },
            } as unknown as Stripe.Event;
        };

        it("check canceled", async () => {
            await PaymentService.handleStripeEvent(makeEvent("payment_intent.canceled", "canceled"));
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
            await PaymentService.handleStripeEvent(makeEvent("payment_intent.payment_failed", "requires_payment_method"));
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
            await PaymentService.handleStripeEvent(makeEvent("payment_intent.processing", "processing"));
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

        it("check succeeded", async () => {
            jest.spyOn(EmailConfirmation, "sendConfirmationEmail").mockResolvedValue(undefined as any);

            mockFrom.mockReturnValueOnce({
                update: mockUpdate.mockReturnValue({
                    eq: mockEq.mockResolvedValue({ data: null, error: null }),
                }),
            });

            await PaymentService.handleStripeEvent(makeEvent("payment_intent.succeeded", "succeeded"));
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
    });
});
