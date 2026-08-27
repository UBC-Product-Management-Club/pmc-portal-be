import { Tables } from "../../../src/schema/v2/database.types";
import {
  getActiveCycle,
  getApplicationForm,
  getOpenRoles,
} from "../../../src/services/Application/ApplicationService";
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
});
