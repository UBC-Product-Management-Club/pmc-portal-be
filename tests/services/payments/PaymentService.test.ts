jest.mock("../../../src/services/payments/ProductService", () => ({
  fetchMembershipPriceId: jest.fn(),
}));

jest.mock("../../../src/config/firebase", () => ({
  stripe: {
    paymentIntents: { create: jest.fn() },
    checkout: { sessions: { create: jest.fn() } },
  },
}));

import { supabase } from "../../../src/config/supabase";
import { stripe } from "../../../src/config/firebase";
import { createCheckoutSession, createMembershipPaymentIntent } from "../../../src/services/payments/PaymentService";
import { fetchMembershipPriceId } from "../../../src/services/payments/ProductService";

const mockedSupabaseFrom = jest.fn();
const mockedSupabaseSelect = jest.fn();
const mockedSupabaseEq = jest.fn();
const mockedSupabaseInsert = jest.fn();
const mockedSupabaseSingle = jest.fn();
const mockedStripeCreate = jest.fn();
const mockedStripeSessionCreate = jest.fn();


(supabase.from as jest.Mock).mockImplementation(mockedSupabaseFrom);
(stripe.paymentIntents.create as jest.Mock).mockImplementation(mockedStripeCreate);
(stripe.checkout.sessions.create as jest.Mock).mockImplementation(mockedStripeSessionCreate);
// Setup helper
function setupMocks() {
    jest.clearAllMocks();

    mockedSupabaseSelect.mockImplementation(() => ({
        eq: mockedSupabaseEq,
    }));

    mockedSupabaseEq.mockImplementation(() => ({
        single: mockedSupabaseSingle,
    }));

    mockedSupabaseInsert.mockImplementation(() => ({
        select: () => ({
            single: jest.fn().mockResolvedValue({ data: { id: "payment-123" }, error: null }),
        }),
    }));

    mockedSupabaseFrom.mockReturnValue({
        select: mockedSupabaseSelect,
        insert: mockedSupabaseInsert,
    });
}

describe("createPaymentIntent", () => {
    beforeEach(() => {
        setupMocks();
    });

    it("creates payment intent for UBC student", async () => {
        const mockPaymentIntent = { id: "pi_ubc_test", amount: 5000 };

        mockedSupabaseSingle.mockResolvedValue({
            data: { university: "University of British Columbia" },
            error: null,
        });

        mockedStripeCreate.mockResolvedValue(mockPaymentIntent);

        const result = await createMembershipPaymentIntent("user-123");

        expect(result).toEqual(mockPaymentIntent);
        expect(mockedSupabaseFrom).toHaveBeenCalledWith("User");
        expect(mockedSupabaseSelect).toHaveBeenCalledWith("university");
        expect(mockedSupabaseEq).toHaveBeenCalledWith("user_id", "user-123");
        expect(mockedStripeCreate).toHaveBeenCalledWith({
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

        mockedSupabaseSingle.mockResolvedValue({
            data: { university: "University of Toronto" },
            error: null,
        });

        mockedStripeCreate.mockResolvedValue(mockPaymentIntent);

        const result = await createMembershipPaymentIntent("user-456");

        expect(result).toEqual(mockPaymentIntent);
        expect(mockedSupabaseFrom).toHaveBeenCalledWith("User");
        expect(mockedSupabaseEq).toHaveBeenCalledWith("user_id", "user-456");
        expect(mockedStripeCreate).toHaveBeenCalledWith({
            amount: expect.any(Number),
            currency: "cad",
            metadata: {
                user_id: "user-456",
                payment_type: "membership",
            },
        });
    });

    it("throws error when user lookup fails", async () => {
        mockedSupabaseSingle.mockResolvedValue({
            data: null,
            error: { message: "User not found" },
        });

        await expect(createMembershipPaymentIntent("invalid-user")).rejects.toThrow("User not found");
        expect(mockedStripeCreate).not.toHaveBeenCalled();
    });

    it("throws error when payment insertion fails", async () => {
        mockedSupabaseSingle.mockResolvedValue({
            data: { university: "University of British Columbia" },
            error: null,
        });

        mockedStripeCreate.mockResolvedValue({ id: "pi_test", amount: 5000 });

        // Mock payment insertion failure
        mockedSupabaseFrom
            .mockReturnValueOnce({
                select: mockedSupabaseSelect,
            })
            .mockReturnValueOnce({
                insert: () => ({
                    select: () => ({
                        single: jest.fn().mockResolvedValue({ data: null, error: { message: "Insert failed" } }),
                    }),
                }),
            });

        await expect(createMembershipPaymentIntent("user-123")).rejects.toThrow("Insert failed");
    });
});

describe("create membership checkout session", () => {
    beforeEach(() => {
        setupMocks();
    })

    it("creates payment intent for UBC student", async () => {

        mockedSupabaseSingle.mockResolvedValue({
            data: { university: "University of British Columbia" },
            error: null,
        });

        (fetchMembershipPriceId as jest.Mock).mockResolvedValue("price_ubc_test");
        mockedStripeSessionCreate.mockResolvedValue({ id: "sess_test" });

        const result = await createCheckoutSession("user-123");

        expect(fetchMembershipPriceId).toHaveBeenCalledWith(true);
        expect(mockedStripeSessionCreate).toHaveBeenCalledWith(
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
        mockedSupabaseSingle.mockResolvedValue({
            data: null,
            error: { message: "User not found" },
        });

        await expect(createCheckoutSession("invalid-user")).rejects.toThrow("User not found");
        expect(mockedStripeSessionCreate).not.toHaveBeenCalled();
    });

})
