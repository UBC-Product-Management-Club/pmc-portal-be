import Stripe from "stripe"
import { db } from "../../../src/config/firebase"
import { onboard } from "../../../src/services/auth/register"
import { User } from "../../../src/schema/v1/User"

jest.mock("../../../src/config/firebase", () => ({
    db: {
      collection: jest.fn()
    }
}))


describe("register service", () => {
    let mockUser: User = {
        id: "",
        pfp: "",
        firstName: "",
        lastName: "",
        pronouns: "",
        email: "",
        displayName: "",
        university: "",
        studentId: 0,
        year: "",
        faculty: "",
        major: "",
        whyPm: ""
    }
    const mockGet = jest.fn()
    const mockDoc = jest.fn()
    const mockSet = jest.fn()
    const mockCollection = db.collection as jest.Mock;
  
    beforeEach(() => {
      jest.clearAllMocks()
  
      mockCollection.mockImplementation(() => ({
        doc: mockDoc
      }))
      mockDoc.mockImplementation(() => ({
        get: mockGet,
        set: mockSet
      }))
      mockGet.mockResolvedValue({
        exists: false
      })
    })

    it("throws error when payment fails", async () => {
        const mockPayment = {
            status: "canceled"
        } as Stripe.PaymentIntent
        await expect(onboard(mockUser, mockPayment)).rejects.toThrow("Payment failed!")
    })

    it("throws error when onboarding existing user", async () => {
        const mockPayment = {
            status: "succeeded"
        } as Stripe.PaymentIntent
        mockGet.mockResolvedValueOnce({
            exists: true
        })
        await expect(onboard(mockUser, mockPayment)).rejects.toThrow("User already exists!")
    })

    it("adds a new user to database", async () => {
        const mockPayment = {
            status: "succeeded"
        } as Stripe.PaymentIntent
        mockSet.mockResolvedValueOnce({})

        await expect(onboard(mockUser, mockPayment)).resolves.toBeUndefined()
    })

    it("throws when adding a user fails", async () => {
        const mockPayment = {
            status: "succeeded"
        } as Stripe.PaymentIntent
        mockSet.mockRejectedValueOnce(new Error("some firebase error"))

        await expect(onboard(mockUser, mockPayment)).rejects.toThrow("some firebase error")
    })
})