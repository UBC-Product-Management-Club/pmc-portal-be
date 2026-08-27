import { Tables } from "../../../src/schema/v2/database.types";
import {
  AlreadySubmittedError,
  AnswerValidationError,
  ApplicationsClosedError,
  getActiveCycle,
  getApplicationForm,
  getApplicationsByUser,
  getOpenRoles,
  saveDraft,
  submitApplication,
} from "../../../src/services/Application/ApplicationService";
import { ApplicationRepository } from "../../../src/storage/ApplicationRepository";
import { RecruitingRepository } from "../../../src/storage/RecruitingRepository";

const generalQuestion = {
  key: "why_pm",
  label: "Why PM?",
  type: "LONG_TEXT",
  options: null,
  required: true,
  max_words: null,
  display_order: 2,
};

const roleQuestion = {
  key: "portfolio",
  label: "Portfolio",
  type: "URL",
  options: null,
  required: false,
  max_words: null,
  display_order: 1,
};

const mockCycle = {
  cycle_id: "cycle-1",
  name: "Fall '26 Hiring",
  is_active: true,
  general_questions: [generalQuestion],
  opens_at: null,
  closes_at: null,
  created_at: "2026-07-01T00:00:00.000Z",
} as unknown as Tables<"Recruiting_Cycle">;

const mockRole = {
  role_id: "role-1",
  cycle_id: "cycle-1",
  name: "Developer",
  team: "TECH",
  questions: [roleQuestion],
  is_active: true,
  created_at: "2026-07-01T00:00:00.000Z",
} as unknown as Tables<"Recruiting_Role">;

const submission = {
  role_id: "role-1",
  choice_rank: "FIRST" as const,
  answers: { why_pm: "Because I love building things." },
};

const mockApplication = {
  application_id: "app-1",
  user_id: "user-1",
  cycle_id: "cycle-1",
  role_id: "role-1",
  choice_rank: "FIRST",
  answers: submission.answers,
  resume_url: null,
  referred_by: null,
  referral_notes: null,
  general_notes: null,
  is_submitted: true,
  status: "SUBMITTED",
  submitted_at: "2026-07-21T00:00:00.000Z",
  created_at: "2026-07-21T00:00:00.000Z",
  updated_at: "2026-07-21T00:00:00.000Z",
} as unknown as Tables<"Recruiting_Application">;

const mockActiveCycle = () =>
  (RecruitingRepository.getActiveCycle as jest.Mock).mockResolvedValueOnce({
    data: mockCycle,
    error: null,
  });

const mockNoCycle = () =>
  (RecruitingRepository.getActiveCycle as jest.Mock).mockResolvedValueOnce({
    data: null,
    error: null,
  });

const mockRoleLookup = (role: unknown = mockRole) =>
  (RecruitingRepository.getRole as jest.Mock).mockResolvedValueOnce({
    data: role,
    error: null,
  });

// The "have they already submitted?" guard that runs before save and submit.
const mockExisting = (existing: unknown = null) =>
  (
    ApplicationRepository.getApplicationForRole as jest.Mock
  ).mockResolvedValueOnce({ data: existing, error: null });

describe("ApplicationService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getActiveCycle", () => {
    it("returns the open cycle", async () => {
      mockActiveCycle();
      expect(await getActiveCycle()).toEqual(mockCycle);
    });

    it("returns null when applications are closed", async () => {
      mockNoCycle();
      expect(await getActiveCycle()).toBeNull();
    });

    it("throws on error", async () => {
      (RecruitingRepository.getActiveCycle as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: "boom" },
      });

      await expect(getActiveCycle()).rejects.toThrow(
        "Failed to resolve the active recruiting cycle: boom"
      );
    });
  });

  describe("getOpenRoles", () => {
    it("returns the cycle's roles with their team", async () => {
      mockActiveCycle();
      (
        RecruitingRepository.getRolesForCycle as jest.Mock
      ).mockResolvedValueOnce({
        data: [{ role_id: "role-1", cycle_id: "cycle-1", name: "Developer", team: "TECH" }],
        error: null,
      });

      expect(await getOpenRoles()).toEqual([
        { role_id: "role-1", name: "Developer", team: "TECH" },
      ]);
    });

    it("returns an empty list when no cycle is open", async () => {
      mockNoCycle();
      expect(await getOpenRoles()).toEqual([]);
      expect(RecruitingRepository.getRolesForCycle).not.toHaveBeenCalled();
    });
  });

  describe("getApplicationForm", () => {
    it("returns general questions followed by the role's, in display order", async () => {
      mockActiveCycle();
      mockRoleLookup();

      const form = await getApplicationForm("role-1");

      expect(form).toEqual({
        role_id: "role-1",
        role_name: "Developer",
        team: "TECH",
        questions: [generalQuestion, roleQuestion],
      });
    });

    it("returns null for a role from another cycle", async () => {
      mockActiveCycle();
      mockRoleLookup({ ...mockRole, cycle_id: "an-older-cycle" });

      expect(await getApplicationForm("role-1")).toBeNull();
    });

    it("returns null when applications are closed", async () => {
      mockNoCycle();
      expect(await getApplicationForm("role-1")).toBeNull();
    });
  });

  describe("saveDraft", () => {
    it("saves a partial draft without enforcing required answers", async () => {
      mockActiveCycle();
      mockRoleLookup();
      mockExisting(null);
      (
        ApplicationRepository.upsertApplication as jest.Mock
      ).mockResolvedValueOnce({ data: mockApplication, error: null });

      // No answers at all -- would fail validation on submit, fine as a draft.
      await saveDraft("user-1", { role_id: "role-1" });

      const saved = (ApplicationRepository.upsertApplication as jest.Mock).mock
        .calls[0][0];
      expect(saved).toMatchObject({
        user_id: "user-1",
        cycle_id: "cycle-1",
        role_id: "role-1",
        answers: {},
        is_submitted: false,
        submitted_at: null,
      });
      // The DB has a check constraint tying is_submitted to status, so a draft
      // must never carry a submitted status. Leaving it unset lets the column
      // default ('DRAFT') apply.
      expect(saved.status).toBeUndefined();
    });

    it("refuses to overwrite an application that was already submitted", async () => {
      mockActiveCycle();
      mockRoleLookup();
      mockExisting({ ...mockApplication, is_submitted: true });

      await expect(saveDraft("user-1", { role_id: "role-1" })).rejects.toThrow(
        AlreadySubmittedError
      );
      expect(ApplicationRepository.upsertApplication).not.toHaveBeenCalled();
    });

    it("rejects when applications are closed", async () => {
      mockNoCycle();
      await expect(saveDraft("user-1", { role_id: "role-1" })).rejects.toThrow(
        ApplicationsClosedError
      );
    });
  });

  describe("submitApplication", () => {
    it("submits, stamps submitted_at and returns the role name", async () => {
      mockActiveCycle();
      mockRoleLookup();
      mockExisting(null);
      (
        ApplicationRepository.upsertApplication as jest.Mock
      ).mockResolvedValueOnce({ data: mockApplication, error: null });

      const result = await submitApplication("user-1", submission);

      expect(result).toEqual({
        application: mockApplication,
        role_name: "Developer",
      });

      const saved = (ApplicationRepository.upsertApplication as jest.Mock).mock
        .calls[0][0];
      expect(saved).toMatchObject({
        user_id: "user-1",
        cycle_id: "cycle-1",
        role_id: "role-1",
        choice_rank: "FIRST",
        is_submitted: true,
        status: "SUBMITTED",
      });
      expect(saved.submitted_at).not.toBeNull();
    });

    it("rejects when applications are closed", async () => {
      mockNoCycle();

      await expect(submitApplication("user-1", submission)).rejects.toThrow(
        ApplicationsClosedError
      );
      expect(ApplicationRepository.upsertApplication).not.toHaveBeenCalled();
    });

    it("rejects a role belonging to a previous cycle", async () => {
      mockActiveCycle();
      mockRoleLookup({ ...mockRole, cycle_id: "an-older-cycle" });

      await expect(submitApplication("user-1", submission)).rejects.toThrow(
        "This role is not part of the current hiring cycle"
      );
      expect(ApplicationRepository.upsertApplication).not.toHaveBeenCalled();
    });

    it("rejects a second submission for the same role", async () => {
      mockActiveCycle();
      mockRoleLookup();
      mockExisting({ ...mockApplication, is_submitted: true });

      await expect(submitApplication("user-1", submission)).rejects.toThrow(
        AlreadySubmittedError
      );
      expect(ApplicationRepository.upsertApplication).not.toHaveBeenCalled();
    });

    it("validates answers against the cycle's and role's questions", async () => {
      mockActiveCycle();
      mockRoleLookup();
      mockExisting(null);

      // why_pm is a required general question, so empty answers must fail.
      await expect(
        submitApplication("user-1", { ...submission, answers: {} })
      ).rejects.toThrow(AnswerValidationError);
      expect(ApplicationRepository.upsertApplication).not.toHaveBeenCalled();
    });
  });

  describe("getApplicationsByUser", () => {
    it("returns the user's applications", async () => {
      (
        ApplicationRepository.getApplicationsByUser as jest.Mock
      ).mockResolvedValueOnce({ data: [mockApplication], error: null });

      expect(await getApplicationsByUser("user-1")).toEqual([mockApplication]);
    });

    it("returns an empty array when there are none", async () => {
      (
        ApplicationRepository.getApplicationsByUser as jest.Mock
      ).mockResolvedValueOnce({ data: null, error: null });

      expect(await getApplicationsByUser("user-1")).toEqual([]);
    });

    it("throws on error", async () => {
      (
        ApplicationRepository.getApplicationsByUser as jest.Mock
      ).mockResolvedValueOnce({ data: null, error: { message: "fail" } });

      await expect(getApplicationsByUser("user-1")).rejects.toThrow(
        "Failed to get applications for user user-1: fail"
      );
    });
  });
});
