import { handleSupabaseOnboarding } from "../../../src/services/auth/register";
import { User } from "../../../src/schema/v1/User";
import { checkSupabaseUserExists, mapToSupabaseUser } from "../../../src/services/auth/utils";
import { supabase } from "../../../src/config/supabase";

jest.mock("../../../src/services/auth/utils", () => ({
  checkSupabaseUserExists: jest.fn(),
  mapToSupabaseUser: jest.fn(),
  TABLES: { USER: "User" },
}));

jest.mock("../../../src/config/supabase", () => ({
  supabase: {
    from: jest.fn(() => ({ insert: jest.fn() })),
  },
}));

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
    whyPm: "",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("throws error when onboarding existing user", async () => {
    (checkSupabaseUserExists as jest.Mock).mockResolvedValueOnce(true);
    await expect(handleSupabaseOnboarding(mockUser)).rejects.toThrow("User already exists.");
  });

  it("adds a new user to database", async () => {
    (checkSupabaseUserExists as jest.Mock).mockResolvedValueOnce(false);
    (mapToSupabaseUser as jest.Mock).mockReturnValue({ user_id: mockUser.id });
    const insertMock = jest.fn().mockResolvedValueOnce({ error: null });
    (supabase.from as jest.Mock).mockReturnValue({ insert: insertMock });

    await expect(handleSupabaseOnboarding(mockUser)).resolves.toEqual({ message: "success" });
    expect(insertMock).toHaveBeenCalledWith([{ user_id: mockUser.id }]);
  });

  it("throws when adding a user fails", async () => {
    (checkSupabaseUserExists as jest.Mock).mockResolvedValueOnce(false);
    (mapToSupabaseUser as jest.Mock).mockReturnValue({ user_id: mockUser.id });
    const insertMock = jest.fn().mockResolvedValueOnce({ error: { message: "insert error" } });
    (supabase.from as jest.Mock).mockReturnValue({ insert: insertMock });

    await expect(handleSupabaseOnboarding(mockUser)).rejects.toThrow("Error creating user: insert error");
  });
});
