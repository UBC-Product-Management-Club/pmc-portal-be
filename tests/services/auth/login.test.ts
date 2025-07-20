import { handleSupabaseLogin } from "../../../src/services/auth/login";
import { supabase } from "../../../src/config/supabase";

const mockQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(), // <-- use maybeSingle here
};

jest.mock("../../../src/config/supabase", () => ({
    supabase: {
        from: jest.fn(() => mockQuery),
    },
}));

describe("login sevice", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("throws error if no userId is provided", async () => {
        await expect(handleSupabaseLogin("")).rejects.toThrow("400: Bad request");
    });

    it("returns user data if userId is valid", async () => {
        mockQuery.maybeSingle.mockResolvedValueOnce({
            data: { name: "Toby", email: "toby@example.com" },
            error: null,
        });

        const userData = await handleSupabaseLogin("some-id");
        expect(userData).toEqual({ name: "Toby", email: "toby@example.com" });
        expect(supabase.from).toHaveBeenCalledWith("User");
        expect(mockQuery.select).toHaveBeenCalledWith();
        expect(mockQuery.eq).toHaveBeenCalledWith("user_id", "some-id");
        expect(mockQuery.maybeSingle).toHaveBeenCalled();
    });

    it("throws error if Supabase returns an error object", async () => {
        mockQuery.maybeSingle.mockResolvedValueOnce({
            data: null,
            error: { message: "Supabase down" },
        });

        await expect(handleSupabaseLogin("some-id")).rejects.toThrow("Failed to fetch user: Supabase down");
    });

    it("throws error if maybeSingle() itself throws", async () => {
        mockQuery.maybeSingle.mockRejectedValueOnce(new Error("Network failure"));

        await expect(handleSupabaseLogin("some-id")).rejects.toThrow("Network failure");
    });
});
