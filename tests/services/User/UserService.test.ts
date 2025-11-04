import { addUser, getUser, getUsers, findUserByEmail, addUserFromGuestRegistration } from "../../../src/services/User/UserService";
import { UserRepository } from "../../../src/storage/UserRepository";
import { mapToSupabaseUser } from "../../../src/services/User/utils";
import { User } from "../../../src/schema/v1/User";

jest.mock("../../../src/storage/UserRepository");
jest.mock("../../../src/services/User/utils", () => ({
  mapToSupabaseUser: jest.fn()
}));

describe("UserService", () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getUser", () => {
    it("throws if no userId provided", async () => {
      await expect(getUser("")).rejects.toThrow("User Id is required!");
    });

    it("returns user when found", async () => {
      const mockUser = { name: "Toby", email: "toby@example.com" };
      (UserRepository.getUser as jest.Mock).mockResolvedValueOnce({ data: mockUser });

      const result = await getUser("some-id");
      expect(result).toEqual(mockUser);
      expect(UserRepository.getUser).toHaveBeenCalledWith("some-id");
    });

    it("throws when repo returns error", async () => {
      (UserRepository.getUser as jest.Mock).mockResolvedValueOnce({ error: { message: "DB Down" } });

      await expect(getUser("some-id")).rejects.toThrow("Failed to fetch user: DB Down");
    });

    it("returns null when no user found", async () => {
      (UserRepository.getUser as jest.Mock).mockResolvedValueOnce({ data: null });

      const result = await getUser("missing-id");
      expect(result).toBeNull();
    });
  });

  describe("addUser", () => {
    const mockUser: User = {
      userId: "123",
      pfp: "",
      firstName: "Toby",
      lastName: "Fox",
      pronouns: "",
      email: "toby@example.com",
      displayName: "",
      university: "",
      studentId: "",
      year: "",
      faculty: "",
      major: "",
      whyPm: "",
    };

    it("adds user successfully", async () => {
      (mapToSupabaseUser as jest.Mock).mockReturnValueOnce({ user_id: "123" });
      (UserRepository.addUser as jest.Mock).mockResolvedValueOnce({ error: null });

      await expect(addUser(mockUser)).resolves.toEqual({ message: "success" });
      expect(UserRepository.addUser).toHaveBeenCalledWith({ user_id: "123" });
    });

    it("throws when insert fails", async () => {
      (mapToSupabaseUser as jest.Mock).mockReturnValueOnce({ user_id: "123" });
      (UserRepository.addUser as jest.Mock).mockResolvedValueOnce({ error: { message: "Insert failed" } });

      await expect(addUser(mockUser)).rejects.toThrow("Error creating user: Insert failed");
    });
  });

  describe("addUserFromGuestRegistration", () => {
    const guest = {
      firstName: "Guest",
      lastName: "User",
      studentId: "s123",
      email: "guest@test.com",
      university: "Uni",
      faculty: "Science",
      major: "CS",
      pronouns: "they/them"
    } as any;

    it("inserts guest user successfully", async () => {
      const returned = { id: "guest-user" };
      (UserRepository.addUserFromGuestRegistration as jest.Mock).mockResolvedValueOnce({ data: returned });

      const result = await addUserFromGuestRegistration(guest, "uid123");
      expect(result).toEqual(returned);
    });

    it("throws if insert error", async () => {
      (UserRepository.addUserFromGuestRegistration as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: "DB Error" }
      });

      await expect(addUserFromGuestRegistration(guest, "uid123")).rejects.toThrow("Error inserting guestUser: DB Error");
    });
  });

  describe("findUserByEmail", () => {
    it("returns user on success", async () => {
      const mockUser = { email: "a@test.com" };
      (UserRepository.findUserByEmail as jest.Mock).mockResolvedValueOnce({ data: mockUser });

      const result = await findUserByEmail("a@test.com");
      expect(result).toEqual(mockUser);
    });

    it("throws on DB error", async () => {
      (UserRepository.findUserByEmail as jest.Mock).mockResolvedValueOnce({ error: { message: "Not found" } });

      await expect(findUserByEmail("a@test.com")).rejects.toThrow("Failed to find user: Not found");
    });
  });

  describe("getUsers", () => {
    it("returns user list", async () => {
      const users = [{ email: "a@test.com" }];
      (UserRepository.getUsers as jest.Mock).mockResolvedValueOnce({ data: users });

      const result = await getUsers();
      expect(result).toEqual(users);
    });

    it("throws on error", async () => {
      (UserRepository.getUsers as jest.Mock).mockResolvedValueOnce({ error: { message: "DB Error" } });

      await expect(getUsers()).rejects.toThrow("Failed to fetch users: DB Error");
    });
  });
});
