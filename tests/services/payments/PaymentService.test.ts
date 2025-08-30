// Mock before import plz
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
}));

jest.mock("../../../src/services/Event/EventService", () => ({
    getEventPrice: jest.fn(),
}));

jest.mock("../../../src/config/supabase", () => ({
    supabase: {
        from: jest.fn(),
    },
}));

import { supabase } from "../../../src/config/supabase";
import { createCheckoutSession, createMembershipPaymentIntent, createEventCheckoutSession, updateMembershipPaymentStatus, updateEventPaymentStatus} from "../../../src/services/Payment/PaymentService";
import * as PaymentService from "../../../src/services/Payment/PaymentService";
import { stripe } from "../../../src/config/stripe";
import { getEventPrice } from "../../../src/services/Event/EventService";

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

    describe("create event checkout session", () => {
        const userId = "user_123";
        const eventId = "event_456";
        const attendeeId = "att_789";
        const fakePriceId = "price_123";
        const fakeSession = { id: "sess_pmc" };
        const mockUserData = { is_payment_verified: true };

        it("creates event registration checkout session for members", async () => {

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

            (getEventPrice as jest.Mock).mockResolvedValue(fakePriceId);
            mockCreateCheckoutSession.mockResolvedValue(fakeSession);

            const result = await createEventCheckoutSession(userId, eventId, attendeeId);
            const expectedIsMember = mockUserData.is_payment_verified ?? false;

            expect(getEventPrice).toHaveBeenCalledWith(eventId, expectedIsMember);
            expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
            expect.objectContaining({
                    line_items: [{ price: fakePriceId, quantity: 1 }],
                    mode: 'payment',
                    payment_method_configuration: "pmc_1RwtRfL4ingF9CfzbEtiSzOS",
                    metadata: { user_id: userId, payment_type: "event", attendee_id: attendeeId },
                    success_url: `http://localhost:5173/events/${eventId}?attendeeId=${attendeeId}&success=true`,
                    cancel_url: `http://localhost:5173/events/${eventId}?attendeeId=${attendeeId}&canceled=true`,
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
        
            (getEventPrice as jest.Mock).mockResolvedValue(fakePriceId);
            mockCreateCheckoutSession.mockRejectedValue(new Error("Stripe failed"));
            await expect(createEventCheckoutSession(userId, eventId, attendeeId))
                .rejects
                .toThrow("Stripe failed");
        });
    })

    describe("handle membership payment verification", () => {
        const userId = "user_123";
        const sessionIntent = { id: "sess_pmc" } as any;


        it("updates Supabase and logs success", async () => {
            mockFrom.mockReturnValueOnce({
                update: mockUpdate.mockReturnValueOnce({
                    eq: mockEq.mockReturnValueOnce({
                        error: null
                    })
                })
            });

            const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
            await updateMembershipPaymentStatus(userId, sessionIntent);
            expect(mockFrom).toHaveBeenCalledWith("User");
            expect(mockUpdate).toHaveBeenCalledWith({ is_payment_verified: true });
            expect(mockEq).toHaveBeenCalledWith("user_id", userId);
            expect(consoleSpy).toHaveBeenCalledWith(
                `Membership PaymentIntent for ${userId} succeeded: ${sessionIntent.id}`
            );

            consoleSpy.mockRestore();
        });

        it("logs error if Supabase update fails", async () => {
            const supabaseError = { message: "DB error" };
            mockFrom.mockReturnValueOnce({
                update: mockUpdate.mockReturnValueOnce({
                    eq: mockEq.mockReturnValueOnce({
                        error: supabaseError
                    })
                })
            });
            const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

            await updateMembershipPaymentStatus(userId, sessionIntent);
            expect(consoleSpy).toHaveBeenCalledWith("User verify update err:", supabaseError);
            consoleSpy.mockRestore();
        });

    })

    describe("handle event payment verification", () => {
        const attendeeId = "attendee_123";
        const sessionIntent = { id: "sess_pmc" } as any;


        it("throws error if attendeeId is missing", async () => {
            await expect(updateEventPaymentStatus(undefined, sessionIntent))
                .rejects
                .toThrow("attendee_id is missing in metadata!");
        });
        
        it("updates Supabase and logs success", async () => {
            mockFrom.mockReturnValueOnce({
                update: mockUpdate.mockReturnValueOnce({
                    eq: mockEq.mockReturnValueOnce({
                        error: null
                    })
                })
            });

            const consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});

            await updateEventPaymentStatus(attendeeId, sessionIntent);

            expect(mockFrom).toHaveBeenCalledWith("Attendee");
            expect(mockUpdate).toHaveBeenCalledWith({ is_payment_verified: true });
            expect(mockEq).toHaveBeenCalledWith("attendee_id", attendeeId);
            expect(consoleSpy).toHaveBeenCalledWith(
                `Membership PaymentIntent for ${attendeeId} succeeded: ${sessionIntent.id}`
            );

            consoleSpy.mockRestore();
        });
    
        it("logs error if Supabase update fails", async () => {
            const supabaseError = { message: "DB error" };
            mockFrom.mockReturnValueOnce({
                update: mockUpdate.mockReturnValueOnce({
                    eq: mockEq.mockReturnValueOnce({
                        error: supabaseError
                    })
                })
            });
            const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});

            await updateEventPaymentStatus(attendeeId, sessionIntent);
            expect(consoleSpy).toHaveBeenCalledWith("User verify update err:", supabaseError);
            consoleSpy.mockRestore();
        });
    })

})



