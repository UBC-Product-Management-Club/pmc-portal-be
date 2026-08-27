import { Tables } from "../../../src/schema/v2/database.types";
import {
  ApplicationNotFoundError,
  ForbiddenError,
  InvalidStatusTransitionError,
  getAdminCycle,
  getApplicationDetail,
  listApplications,
  updateNotes,
  updateStatus,
} from "../../../src/services/Application/AdminApplicationService";
import { ApplicationRepository } from "../../../src/storage/ApplicationRepository";
import { RecruitingRepository } from "../../../src/storage/RecruitingRepository";

// Not automocked in tests/setup.ts, and getApplicationDetail signs resume paths
// through it.
jest.mock("../../../src/storage/SignedUrl");

const mockCycle = {
  cycle_id: "cycle-1",
  name: "Fall '26 Hiring",
  is_active: false,
  general_questions: [],
  opens_at: null,
  closes_at: null,
  created_at: "2026-07-01T00:00:00.000Z",
} as unknown as Tables<"Recruiting_Cycle">;

const mockApplication = {
  application_id: "app-1",
  user_id: "user-1",
  cycle_id: "cycle-1",
  role_id: "role-1",
  choice_rank: "FIRST",
  answers: {},
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

const mockLatestCycle = (cycle: unknown = mockCycle) =>
  (RecruitingRepository.getLatestCycle as jest.Mock).mockResolvedValueOnce({
    data: cycle,
    error: null,
  });

const mockList = (rows: unknown[] = [mockApplication]) =>
  (ApplicationRepository.listApplications as jest.Mock).mockResolvedValueOnce({
    data: rows,
    error: null,
  });

const mockGet = (application: unknown = mockApplication) =>
  (ApplicationRepository.getApplication as jest.Mock).mockResolvedValueOnce({
    data: application,
    error: null,
  });

const mockUpdate = (application: unknown = mockApplication) =>
  (ApplicationRepository.updateApplication as jest.Mock).mockResolvedValueOnce({
    data: application,
    error: null,
  });

const updateArgs = () =>
  (ApplicationRepository.updateApplication as jest.Mock).mock.calls[0];

describe("AdminApplicationService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getAdminCycle", () => {
    // Execs review applications after a cycle closes, so unlike the applicant
    // side this must not require is_active.
    it("returns an inactive cycle with all of its roles", async () => {
      mockLatestCycle();
      (
        RecruitingRepository.getAllRolesForCycle as jest.Mock
      ).mockResolvedValueOnce({
        data: [
          {
            role_id: "role-1",
            cycle_id: "cycle-1",
            name: "Developer",
            team: "TECH",
            is_active: false,
          },
        ],
        error: null,
      });

      expect(await getAdminCycle()).toEqual({
        cycle: mockCycle,
        roles: [
          { role_id: "role-1", name: "Developer", team: "TECH", is_active: false },
        ],
      });
    });

    it("returns nothing when no cycle exists yet", async () => {
      mockLatestCycle(null);

      expect(await getAdminCycle()).toEqual({ cycle: null, roles: [] });
      expect(RecruitingRepository.getAllRolesForCycle).not.toHaveBeenCalled();
    });
  });

  describe("listApplications", () => {
    it("passes the viewer's filters through to the query", async () => {
      mockLatestCycle();
      mockList();

      await listApplications({
        status: "REVIEWED",
        role_id: "role-1",
        team: "TECH",
        search: "ege",
        include_drafts: "true",
      });

      expect(ApplicationRepository.listApplications).toHaveBeenCalledWith({
        cycleId: "cycle-1",
        status: "REVIEWED",
        roleId: "role-1",
        team: "TECH",
        search: "ege",
        includeDrafts: true,
      });
    });

    // Drafts belong to the applicant until they submit.
    it("excludes drafts unless they are asked for", async () => {
      mockLatestCycle();
      mockList();

      await listApplications({});

      expect(ApplicationRepository.listApplications).toHaveBeenCalledWith(
        expect.objectContaining({ includeDrafts: false })
      );
    });

    it("returns nothing when no cycle exists yet", async () => {
      mockLatestCycle(null);

      expect(await listApplications({})).toEqual({
        cycle: null,
        applications: [],
      });
      expect(ApplicationRepository.listApplications).not.toHaveBeenCalled();
    });

    it("throws when the query fails", async () => {
      mockLatestCycle();
      (
        ApplicationRepository.listApplications as jest.Mock
      ).mockResolvedValueOnce({ data: null, error: { message: "boom" } });

      await expect(listApplications({})).rejects.toThrow(
        "Failed to list applications: boom"
      );
    });
  });

  describe("getApplicationDetail", () => {
    it("throws when the application does not exist", async () => {
      mockGet(null);

      await expect(getApplicationDetail("app-x")).rejects.toThrow(
        ApplicationNotFoundError
      );
    });

    // Opening an application is what puts it under review.
    it("moves a SUBMITTED application to REVIEWED", async () => {
      mockGet();
      mockUpdate({ ...mockApplication, status: "REVIEWED" });

      const detail = await getApplicationDetail("app-1");

      expect(updateArgs()[0]).toBe("app-1");
      expect(updateArgs()[1]).toMatchObject({ status: "REVIEWED" });
      // No DB trigger maintains this column.
      expect(updateArgs()[1].updated_at).toBeDefined();
      expect(detail.status).toBe("REVIEWED");
    });

    it("leaves an application further down the pipeline alone", async () => {
      mockGet({ ...mockApplication, status: "INTERVIEW_INVITED" });

      const detail = await getApplicationDetail("app-1");

      expect(ApplicationRepository.updateApplication).not.toHaveBeenCalled();
      expect(detail.status).toBe("INTERVIEW_INVITED");
    });

    it("does not re-review an application that was already opened", async () => {
      mockGet({ ...mockApplication, status: "REVIEWED" });

      await getApplicationDetail("app-1");

      expect(ApplicationRepository.updateApplication).not.toHaveBeenCalled();
    });
  });

  describe("updateNotes", () => {
    it("lets any exec edit referral notes", async () => {
      mockUpdate();

      await updateNotes("app-1", "EXEC", { referral_notes: "Met at a workshop" });

      expect(updateArgs()[1]).toMatchObject({
        referral_notes: "Met at a workshop",
      });
    });

    it("blocks an exec from editing general notes", async () => {
      await expect(
        updateNotes("app-1", "EXEC", { general_notes: "Strong candidate" })
      ).rejects.toThrow(ForbiddenError);
      expect(ApplicationRepository.updateApplication).not.toHaveBeenCalled();
    });

    it.each(["VP", "PRESIDENT"] as const)(
      "lets a %s edit general notes",
      async (role) => {
        mockUpdate();

        await updateNotes("app-1", role, { general_notes: "Strong candidate" });

        expect(updateArgs()[1]).toMatchObject({
          general_notes: "Strong candidate",
        });
      }
    );

    // The update is built field by field rather than spread from the request,
    // so a caller can never reach answers, status or ownership through here.
    it("writes only the note fields it was given", async () => {
      mockUpdate();

      await updateNotes("app-1", "VP", { referral_notes: "note" });

      expect(Object.keys(updateArgs()[1]).sort()).toEqual([
        "referral_notes",
        "updated_at",
      ]);
    });

    it("allows a note to be cleared", async () => {
      mockUpdate();

      await updateNotes("app-1", "EXEC", { referral_notes: null });

      expect(updateArgs()[1]).toMatchObject({ referral_notes: null });
    });

    it("throws when the application does not exist", async () => {
      mockUpdate(null);

      await expect(
        updateNotes("app-x", "VP", { referral_notes: "note" })
      ).rejects.toThrow(ApplicationNotFoundError);
    });
  });

  describe("updateStatus", () => {
    it("moves a submitted application along the pipeline", async () => {
      mockGet();
      mockUpdate({ ...mockApplication, status: "INTERVIEW_INVITED" });

      const application = await updateStatus("app-1", "INTERVIEW_INVITED");

      expect(updateArgs()[1]).toMatchObject({ status: "INTERVIEW_INVITED" });
      expect(updateArgs()[1].updated_at).toBeDefined();
      expect(application.status).toBe("INTERVIEW_INVITED");
    });

    // A check constraint ties status to is_submitted; catching it here turns an
    // opaque 500 into a 409.
    it("refuses to move a draft", async () => {
      mockGet({ ...mockApplication, is_submitted: false, status: "DRAFT" });

      await expect(updateStatus("app-1", "REVIEWED")).rejects.toThrow(
        InvalidStatusTransitionError
      );
      expect(ApplicationRepository.updateApplication).not.toHaveBeenCalled();
    });

    it("throws when the application does not exist", async () => {
      mockGet(null);

      await expect(updateStatus("app-x", "REVIEWED")).rejects.toThrow(
        ApplicationNotFoundError
      );
    });
  });
});
