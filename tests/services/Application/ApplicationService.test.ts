import { Tables } from "../../../src/schema/v2/database.types";
import {
  submitApplication,
  getApplicationsByUser,
  listApplications,
  getApplication,
  setApplicationStar,
  updateApplicationStatus,
  viewApplication,
} from "../../../src/services/Application/ApplicationService";
import { ApplicationRepository } from "../../../src/storage/ApplicationRepository";

type ExecApplicationRow = Tables<"Exec_Application">;

const mockApplication: ExecApplicationRow = {
  application_id: "app-123",
  user_id: "user-123",
  position: "Developer",
  choice_rank: "First Choice",
  resume_url: "https://storage/resume.pdf",
  application_data: { whyPm: "I love product" },
  is_starred: false,
  status: "SUBMITTED",
  submitted_at: "2025-01-15T10:00:00.000Z",
};

const newApplication = {
  position: "Developer",
  application_data: { whyPm: "I love product" },
  choice_rank: "First Choice",
  resume_url: "https://storage/resume.pdf",
};

describe("ApplicationService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("submitApplication", () => {
    it("creates an application", async () => {
      (
        ApplicationRepository.addApplication as jest.Mock
      ).mockResolvedValueOnce({ data: mockApplication, error: null });

      const result = await submitApplication("user-123", newApplication);

      expect(result).toEqual(mockApplication);
      expect(ApplicationRepository.addApplication).toHaveBeenCalledWith({
        user_id: "user-123",
        position: "Developer",
        application_data: { whyPm: "I love product" },
        choice_rank: "First Choice",
        resume_url: "https://storage/resume.pdf",
        status: "SUBMITTED",
      });
    });

    it("maps a unique-violation to an 'already applied for position' error", async () => {
      (
        ApplicationRepository.addApplication as jest.Mock
      ).mockResolvedValueOnce({
        data: null,
        error: { code: "23505", message: "duplicate key value" },
      });

      await expect(
        submitApplication("user-123", newApplication)
      ).rejects.toThrow("User user-123 has already applied for Developer");
    });

    it("throws on a non-unique insert error", async () => {
      (
        ApplicationRepository.addApplication as jest.Mock
      ).mockResolvedValueOnce({ data: null, error: { message: "DB fail" } });

      await expect(
        submitApplication("user-123", newApplication)
      ).rejects.toThrow("Failed to create application: DB fail");
    });
  });

  describe("getApplicationsByUser", () => {
    it("returns the user's applications", async () => {
      (
        ApplicationRepository.getApplicationsByUser as jest.Mock
      ).mockResolvedValueOnce({ data: [mockApplication], error: null });

      expect(await getApplicationsByUser("user-123")).toEqual([mockApplication]);
    });

    it("returns an empty array when data is null", async () => {
      (
        ApplicationRepository.getApplicationsByUser as jest.Mock
      ).mockResolvedValueOnce({ data: null, error: null });

      expect(await getApplicationsByUser("user-123")).toEqual([]);
    });

    it("throws on error", async () => {
      (
        ApplicationRepository.getApplicationsByUser as jest.Mock
      ).mockResolvedValueOnce({ data: null, error: { message: "fail" } });

      await expect(getApplicationsByUser("user-123")).rejects.toThrow(
        "Failed to get applications for user user-123: fail"
      );
    });
  });

  describe("listApplications", () => {
    it("returns paginated applications with a total count", async () => {
      (
        ApplicationRepository.getApplications as jest.Mock
      ).mockResolvedValueOnce({ data: [mockApplication], error: null, count: 1 });

      expect(await listApplications(20, 0)).toEqual({
        applications: [mockApplication],
        total: 1,
      });
      expect(ApplicationRepository.getApplications).toHaveBeenCalledWith(20, 0);
    });

    it("defaults to empty list and zero total when data/count are null", async () => {
      (
        ApplicationRepository.getApplications as jest.Mock
      ).mockResolvedValueOnce({ data: null, error: null, count: null });

      expect(await listApplications(20, 0)).toEqual({
        applications: [],
        total: 0,
      });
    });

    it("throws on error", async () => {
      (
        ApplicationRepository.getApplications as jest.Mock
      ).mockResolvedValueOnce({ data: null, error: { message: "fail" }, count: null });

      await expect(listApplications(20, 0)).rejects.toThrow(
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

  describe("viewApplication", () => {
    it("marks a SUBMITTED application UNDER_REVIEW on first view", async () => {
      (
        ApplicationRepository.getApplicationById as jest.Mock
      ).mockResolvedValueOnce({ data: mockApplication, error: null });
      (
        ApplicationRepository.updateStatus as jest.Mock
      ).mockResolvedValueOnce({ error: null });

      const result = await viewApplication("app-123");

      expect(result?.status).toBe("UNDER_REVIEW");
      expect(ApplicationRepository.updateStatus).toHaveBeenCalledWith(
        "app-123",
        "UNDER_REVIEW"
      );
    });

    it("does not touch the status of an already-reviewed application", async () => {
      const accepted = { ...mockApplication, status: "ACCEPTED" as const };
      (
        ApplicationRepository.getApplicationById as jest.Mock
      ).mockResolvedValueOnce({ data: accepted, error: null });

      const result = await viewApplication("app-123");

      expect(result?.status).toBe("ACCEPTED");
      expect(ApplicationRepository.updateStatus).not.toHaveBeenCalled();
    });

    it("returns null when the application does not exist", async () => {
      (
        ApplicationRepository.getApplicationById as jest.Mock
      ).mockResolvedValueOnce({ data: null, error: null });

      expect(await viewApplication("missing")).toBeNull();
      expect(ApplicationRepository.updateStatus).not.toHaveBeenCalled();
    });

    it("throws when marking under review fails", async () => {
      (
        ApplicationRepository.getApplicationById as jest.Mock
      ).mockResolvedValueOnce({ data: mockApplication, error: null });
      (
        ApplicationRepository.updateStatus as jest.Mock
      ).mockResolvedValueOnce({ error: { message: "fail" } });

      await expect(viewApplication("app-123")).rejects.toThrow(
        "Failed to mark application app-123 under review: fail"
      );
    });
  });

  describe("setApplicationStar", () => {
    it("returns the updated application", async () => {
      const starred = { ...mockApplication, is_starred: true };
      (
        ApplicationRepository.setStarred as jest.Mock
      ).mockResolvedValueOnce({ data: starred, error: null });

      const result = await setApplicationStar("app-123", true);

      expect(result).toEqual(starred);
      expect(ApplicationRepository.setStarred).toHaveBeenCalledWith(
        "app-123",
        true
      );
    });

    it("returns null when the application does not exist", async () => {
      (
        ApplicationRepository.setStarred as jest.Mock
      ).mockResolvedValueOnce({ data: null, error: null });

      expect(await setApplicationStar("missing", true)).toBeNull();
    });

    it("throws on error", async () => {
      (
        ApplicationRepository.setStarred as jest.Mock
      ).mockResolvedValueOnce({ data: null, error: { message: "fail" } });

      await expect(setApplicationStar("app-123", true)).rejects.toThrow(
        "Failed to update star on application app-123: fail"
      );
    });
  });

  describe("updateApplicationStatus", () => {
    it("returns the updated application", async () => {
      const updated = { ...mockApplication, status: "ACCEPTED" as const };
      (
        ApplicationRepository.updateStatus as jest.Mock
      ).mockResolvedValueOnce({ data: updated, error: null });

      const result = await updateApplicationStatus("app-123", "ACCEPTED");

      expect(result).toEqual(updated);
      expect(ApplicationRepository.updateStatus).toHaveBeenCalledWith(
        "app-123",
        "ACCEPTED"
      );
    });

    it("returns null when the application does not exist", async () => {
      (
        ApplicationRepository.updateStatus as jest.Mock
      ).mockResolvedValueOnce({ data: null, error: null });

      expect(await updateApplicationStatus("missing", "ACCEPTED")).toBeNull();
    });

    it("throws on error", async () => {
      (
        ApplicationRepository.updateStatus as jest.Mock
      ).mockResolvedValueOnce({ data: null, error: { message: "fail" } });

      await expect(
        updateApplicationStatus("app-123", "ACCEPTED")
      ).rejects.toThrow("Failed to update application app-123 status: fail");
    });
  });
});
