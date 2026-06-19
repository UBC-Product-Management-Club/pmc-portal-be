import { Tables } from "../../../src/schema/v2/database.types";
import {
  submitApplication,
  getApplicationByUser,
  listApplications,
  getApplication,
} from "../../../src/services/Application/ApplicationService";
import { ApplicationRepository } from "../../../src/storage/ApplicationRepository";

type ApplicationRow = Tables<"Application">;

const mockApplication: ApplicationRow = {
  application_id: "app-123",
  user_id: "user-123",
  form_id: null,
  application_data: { whyPm: "I love product" },
  status: "SUBMITTED",
  submitted_at: "2025-01-15T10:00:00.000Z",
};

describe("ApplicationService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("submitApplication", () => {
    it("creates an application when the user has none", async () => {
      (
        ApplicationRepository.getApplicationByUser as jest.Mock
      ).mockResolvedValueOnce({ data: null, error: null });
      (
        ApplicationRepository.addApplication as jest.Mock
      ).mockResolvedValueOnce({ data: mockApplication, error: null });

      const result = await submitApplication("user-123", {
        whyPm: "I love product",
      });

      expect(result).toEqual(mockApplication);
      expect(ApplicationRepository.addApplication).toHaveBeenCalledWith({
        user_id: "user-123",
        application_data: { whyPm: "I love product" },
        status: "SUBMITTED",
      });
    });

    it("rejects when the user already has an application", async () => {
      (
        ApplicationRepository.getApplicationByUser as jest.Mock
      ).mockResolvedValueOnce({ data: mockApplication, error: null });

      await expect(
        submitApplication("user-123", { whyPm: "again" })
      ).rejects.toThrow("User user-123 has already submitted an application");
      expect(ApplicationRepository.addApplication).not.toHaveBeenCalled();
    });

    it("throws when the duplicate check fails", async () => {
      (
        ApplicationRepository.getApplicationByUser as jest.Mock
      ).mockResolvedValueOnce({ data: null, error: { message: "lookup fail" } });

      await expect(
        submitApplication("user-123", {})
      ).rejects.toThrow(
        "Failed to check existing application for user user-123: lookup fail"
      );
    });

    it("throws on insert error", async () => {
      (
        ApplicationRepository.getApplicationByUser as jest.Mock
      ).mockResolvedValueOnce({ data: null, error: null });
      (
        ApplicationRepository.addApplication as jest.Mock
      ).mockResolvedValueOnce({ data: null, error: { message: "DB fail" } });

      await expect(submitApplication("user-123", {})).rejects.toThrow(
        "Failed to create application: DB fail"
      );
    });
  });

  describe("getApplicationByUser", () => {
    it("returns the application", async () => {
      (
        ApplicationRepository.getApplicationByUser as jest.Mock
      ).mockResolvedValueOnce({ data: mockApplication, error: null });

      expect(await getApplicationByUser("user-123")).toEqual(mockApplication);
    });

    it("throws on error", async () => {
      (
        ApplicationRepository.getApplicationByUser as jest.Mock
      ).mockResolvedValueOnce({ data: null, error: { message: "fail" } });

      await expect(getApplicationByUser("user-123")).rejects.toThrow(
        "Failed to get application for user user-123: fail"
      );
    });
  });

  describe("listApplications", () => {
    it("returns all applications", async () => {
      (
        ApplicationRepository.getApplications as jest.Mock
      ).mockResolvedValueOnce({ data: [mockApplication], error: null });

      expect(await listApplications()).toEqual([mockApplication]);
    });

    it("returns an empty array when data is null", async () => {
      (
        ApplicationRepository.getApplications as jest.Mock
      ).mockResolvedValueOnce({ data: null, error: null });

      expect(await listApplications()).toEqual([]);
    });

    it("throws on error", async () => {
      (
        ApplicationRepository.getApplications as jest.Mock
      ).mockResolvedValueOnce({ data: null, error: { message: "fail" } });

      await expect(listApplications()).rejects.toThrow(
        "Failed to list applications: fail"
      );
    });
  });

  describe("getApplication", () => {
    it("returns the application by id", async () => {
      (
        ApplicationRepository.getApplicationById as jest.Mock
      ).mockResolvedValueOnce({ data: mockApplication, error: null });

      expect(await getApplication("app-123")).toEqual(mockApplication);
    });

    it("throws on error", async () => {
      (
        ApplicationRepository.getApplicationById as jest.Mock
      ).mockResolvedValueOnce({ data: null, error: { message: "fail" } });

      await expect(getApplication("app-123")).rejects.toThrow(
        "Failed to get application app-123: fail"
      );
    });
  });
});
