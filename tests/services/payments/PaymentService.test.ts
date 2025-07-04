import { stripe } from "../../../src/config/firebase"
import { createMembershipPaymentIntent, MEMBERSHIP_FEE_NONUBC, MEMBERSHIP_FEE_UBC } from "../../../src/services/payments/PaymentService"

jest.mock("../../../src/config/firebase", () => ({
        stripe: {
            paymentIntents: {
                create: jest.fn()
            }
        }
    })
)

describe("payment service", () => {
    const mockCreate = stripe.paymentIntents.create as jest.Mock

    beforeEach(() => {
      jest.clearAllMocks()
    })

    it("creates membership payment intent for ubc student", async () => {
        mockCreate.mockResolvedValue({ id: "pi_ubc" })

        const result = await createMembershipPaymentIntent(true)

        expect(mockCreate).toHaveBeenCalledWith({
            amount: MEMBERSHIP_FEE_UBC,
            currency: "cad"
        })
        expect(result).toEqual({ id: "pi_ubc" })
    })

    it("creates membership payment intent for non ubc student", async () => {
        mockCreate.mockResolvedValue({ id: "pi_non_ubc" })

        const result = await createMembershipPaymentIntent(false)

        expect(mockCreate).toHaveBeenCalledWith({
            amount: MEMBERSHIP_FEE_NONUBC,
            currency: "cad"
        })
        expect(result).toEqual({ id: "pi_non_ubc" })
    })

})