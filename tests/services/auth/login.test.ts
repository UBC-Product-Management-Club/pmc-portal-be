import { db } from "../../../src/config/firebase";
import { handleLogin } from "../../../src/services/auth/login";

jest.mock("../../../src/config/firebase", () => ({
    db: {
      collection: jest.fn()
    }
  }))

describe("login sevice", () => {
    const mockGet = jest.fn()
    const mockDoc = jest.fn()
    const mockCollection = db.collection as jest.Mock;
  
    beforeEach(() => {
      jest.clearAllMocks()
  
      mockCollection.mockImplementation(() => ({
        doc: mockDoc
      }))
      mockDoc.mockImplementation(() => ({
        get: mockGet
      }))
    })
  
    it("throws error if no userId is provided", async () => {
      await expect(handleLogin("")).rejects.toThrow("400: Bad request")
    })
  
    it("returns user data if userId is valid", async () => {
      mockGet.mockResolvedValueOnce({
        data: () => ({ name: "Toby", email: "toby@example.com" })
      })
  
      const userData = await handleLogin("some-id")
      expect(userData).toEqual({ name: "Toby", email: "toby@example.com" })
    })
  
    it("throws error if get() fails", async () => {
      mockGet.mockRejectedValueOnce(new Error("Firestore down"))
  
      await expect(handleLogin("some-id")).rejects.toThrow(
        "500: something went wrong fetching users"
      )
    })

})