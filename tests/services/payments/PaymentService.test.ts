import { supabase } from "../../../src/config/supabase";
import { createCheckoutSession, createMembershipPaymentIntent } from "../../../src/services/Payment/PaymentService";
import * as PaymentService from "../../../src/services/Payment/PaymentService";
import { stripe } from "../../../src/config/stripe";

jest.mock("../../../src/config/stripe", () => ({
    stripe: {
        paymentIntents: {
            create: jest.fn()
        },
        checkout: {
            sessions: {
                create: jest.fn()
            }
        }
    }
}))

describe("PaymentService", () => {
    let mockFrom = (supabase.from as jest.Mock);
    let mockCreatePaymentIntent = (stripe.paymentIntents.create as jest.Mock)
    let mockCreateCheckoutSession = (stripe.checkout.sessions.create as jest.Mock)
    let mockSelect = jest.fn();
    let mockEq = jest.fn();
    let mockInsert = jest.fn();
    let mockSingle= jest.fn();
    let spyLogTransaction: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks()
        spyLogTransaction = jest.spyOn(PaymentService, "logTransaction")
    })

    describe("createPaymentIntent", () => {

        it("creates payment intent for UBC student", async () => {
            const mockPaymentIntent = { id: "pi_ubc_test", amount: 5000 };
            mockCreatePaymentIntent.mockResolvedValueOnce(mockPaymentIntent)
            mockFrom.mockReturnValueOnce({
                select: mockSelect.mockReturnValueOnce({
                    eq: mockEq.mockReturnValueOnce({
                        single: mockSingle.mockResolvedValueOnce({
                            data: { university: "University of British Columbia" },
                            error: null
                        })
                    })
                })
            })
            spyLogTransaction.mockResolvedValueOnce(undefined)

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
            mockCreatePaymentIntent.mockResolvedValueOnce(mockPaymentIntent)
            mockFrom.mockReturnValueOnce({
                select: mockSelect.mockReturnValueOnce({
                    eq: mockEq.mockReturnValueOnce({
                        single: mockSingle.mockResolvedValueOnce({
                            data: { university: "Simon Fraser University" },
                            error: null
                        })
                    })
                })
            })
            spyLogTransaction.mockResolvedValueOnce(undefined)


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
                        })
                    })
                })
            })

            await expect(createMembershipPaymentIntent("invalid-user")).rejects.toThrow("User not found");
            expect(mockCreatePaymentIntent).not.toHaveBeenCalled();
        });

        it("throws error when payment insertion fails", async () => {
            mockFrom.mockReturnValueOnce({
                select: mockSelect.mockReturnValueOnce({
                    eq: mockEq.mockReturnValueOnce({
                        single: mockSingle.mockResolvedValueOnce({
                            data: { university: "University of British Columbia" },
                            error: null,
                        })
                    })
                })
            })

            mockCreatePaymentIntent.mockResolvedValueOnce({ id: "pi_test", amount: 5000 });
            spyLogTransaction.mockRejectedValueOnce(new Error("Insert failed"))

            // Mock payment insertion failure
            await expect(createMembershipPaymentIntent("user-123")).rejects.toThrow("Insert failed");
        });
    });

    describe("create membership checkout session", () => {

        it("creates payment intent for UBC student", async () => {

            mockFrom.mockReturnValueOnce({
                select: mockSelect.mockReturnValueOnce({
                    eq: mockEq.mockReturnValueOnce({
                        single: mockSingle.mockResolvedValueOnce({
                            data: { university: "University of British Columbia"},
                            error: null
                        })
                    })
                })
            }).mockReturnValueOnce({
                select: mockSelect.mockReturnValueOnce({
                    eq: mockEq.mockReturnValueOnce({
                        single: mockSingle.mockResolvedValueOnce({
                            data: { product: "price_ubc_test"},
                            error: null
                        })
                    })
                })
            })

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
                            error: { message: "User not found"}
                        })
                    })
                })
            })

            await expect(createCheckoutSession("invalid-user")).rejects.toThrow("User not found");
            expect(mockCreateCheckoutSession).not.toHaveBeenCalled();
        });

    })

})



