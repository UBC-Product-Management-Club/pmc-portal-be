import { supabase } from "../../../src/config/supabase";
import { User } from "../../../src/schema/v1/User";
import { addUser, getUser } from "../../../src/services/User/UserService";
import { checkSupabaseUserExists, mapToSupabaseUser } from "../../../src/services/User/utils";

jest.mock("../../../src/services/User/utils", () => ({
    checkSupabaseUserExists: jest.fn(),
    mapToSupabaseUser: jest.fn(),
    TABLES: { USER: "User" },
}));

describe("UserService", () => {
    let mockFrom: jest.Mock;
    let mockInsert: jest.Mock;
    let mockSelect: jest.Mock;
    let mockEq: jest.Mock;
    let mockMaybeSingle: jest.Mock;


    beforeEach(() => {
        mockSelect = jest.fn()
        mockEq = jest.fn()
        mockMaybeSingle = jest.fn()
        mockInsert = jest.fn()
        mockFrom = (supabase.from as jest.Mock).mockReturnValue({
            select: mockSelect,
            eq: mockEq,
            maybeSingle: mockMaybeSingle
        });

        jest.clearAllMocks();
    });

    describe("getUser", () => {
        it("throws error if no userId is provided", async () => {
            await expect(getUser("")).rejects.toThrow("User Id is required!");
        });

        it("returns user data if userId is valid", async () => {
            mockFrom.mockReturnValueOnce({
                select: mockSelect.mockReturnValueOnce({
                    eq: mockEq.mockReturnValueOnce({
                        maybeSingle: mockMaybeSingle.mockResolvedValueOnce({
                            data: { name: "Toby", email: "toby@example.com" },
                            error: null,
                        })
                    })
                })
            })

            const userData = await getUser("some-id");
            expect(userData).toEqual({ name: "Toby", email: "toby@example.com" });
            expect(mockFrom).toHaveBeenCalledWith("User");
            expect(mockSelect).toHaveBeenCalledWith();
            expect(mockEq).toHaveBeenCalledWith("user_id", "some-id");
            expect(mockMaybeSingle).toHaveBeenCalled();
        });

        it("throws error if Supabase returns an error object", async () => {
            mockFrom.mockReturnValueOnce({
                select: mockSelect.mockReturnValueOnce({
                    eq: mockEq.mockReturnValueOnce({
                        maybeSingle: mockMaybeSingle.mockResolvedValueOnce({
                            data: null,
                            error: { message: "Supabase down" },
                        })
                    })
                })
            })

            await expect(getUser("some-id")).rejects.toThrow("Failed to fetch user: Supabase down");
        });

        it("throws error if maybeSingle() itself throws", async () => {
            mockFrom.mockReturnValueOnce({
                select: mockSelect.mockReturnValueOnce({
                    eq: mockEq.mockReturnValueOnce({
                        maybeSingle: mockMaybeSingle.mockRejectedValueOnce(new Error("Network failure"))
                    })
                })
            })


            await expect(getUser("some-id")).rejects.toThrow("Network failure");
        });
    });

    describe("addUser", () => {
        let mockUser: User = {
            userId: "",
            pfp: "",
            firstName: "",
            lastName: "",
            pronouns: "",
            email: "",
            displayName: "",
            university: "",
            studentId: "",
            year: "",
            faculty: "",
            major: "",
            whyPm: "",
        };

        it("throws error when onboarding existing user", async () => {
            (checkSupabaseUserExists as jest.Mock).mockResolvedValueOnce(true);
            await expect(addUser(mockUser)).rejects.toThrow("User already exists.");
        });

        it("adds a new user to database", async () => {
            (checkSupabaseUserExists as jest.Mock).mockResolvedValueOnce(false);
            (mapToSupabaseUser as jest.Mock).mockReturnValue({ user_id: mockUser.userId });
            mockFrom.mockReturnValueOnce({
                insert: mockInsert.mockResolvedValueOnce({
                     error: null
                })
            })

            await expect(addUser(mockUser)).resolves.toEqual({ message: "success" });
            expect(mockInsert).toHaveBeenCalledWith({ user_id: mockUser.userId });
        });

        it("throws when adding a user fails", async () => {
            (checkSupabaseUserExists as jest.Mock).mockResolvedValueOnce(false);
            (mapToSupabaseUser as jest.Mock).mockReturnValue({ user_id: mockUser.userId });
            mockFrom.mockReturnValueOnce({
                insert: mockInsert.mockResolvedValueOnce({ error: { message: "insert error" }})
            })

            await expect(addUser(mockUser)).rejects.toThrow("Error creating user: insert error");
        });
    });

})

