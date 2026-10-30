jest.mock("../../src/middleware/Session", () => ({
  authenticated: [
    (req: any, _res: any, next: any) => {
      req.user = { user_id: "user-123", is_payment_verified: req.headers["x-member"] === "yes", email: "s@example.com" };
      next();
    },
  ],
}));
jest.mock("../../src/storage/HomeRepository");
jest.mock("../../src/services/Email/EmailService", () => ({ sendEmail: jest.fn(), LoopsEvent: {} }));
jest.mock("../../src/services/Email/EventEmailService", () => ({ deliverApplicationReceipt: jest.fn() }));
jest.mock("../../src/storage/Storage", () => ({ uploadSupabaseFiles: jest.fn(), deleteSupabaseFile: jest.fn() }));

import express from "express";
import request from "supertest";
import { authenticated } from "../../src/middleware/Session";
import { eventRouter } from "../../src/routes/v2/event";
import { announcementRouter } from "../../src/routes/v2/announcements";
import { profileRouter } from "../../src/routes/v2/profile";
import { HomeRepository } from "../../src/storage/HomeRepository";
import { UserRepository } from "../../src/storage/UserRepository";

const app = express();
app.use(express.json());
app.use("/events", eventRouter);
app.use("/announcements", authenticated, announcementRouter);
app.use("/profile", authenticated, profileRouter);

beforeEach(() => jest.clearAllMocks());

describe("GET /events/events/statuses", () => {
  it("returns the student's status per event", async () => {
    const rows = [{ event_id: "e1", status: null, has_draft: true, payment_due_at: null }];
    (HomeRepository.eventStatuses as jest.Mock).mockResolvedValueOnce({ data: rows, error: null });

    const res = await request(app).get("/events/events/statuses");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(rows);
    expect(HomeRepository.eventStatuses).toHaveBeenCalledWith("user-123");
  });
});

describe("GET /announcements", () => {
  it.each([
    ["a member", "yes", true],
    ["a non-member", "no", false],
  ])("asks for %s's rows", async (_label, header, isMember) => {
    (HomeRepository.activeAnnouncements as jest.Mock).mockResolvedValueOnce({ data: [], error: null });

    const res = await request(app).get("/announcements").set("x-member", header);

    expect(res.status).toBe(200);
    expect(HomeRepository.activeAnnouncements).toHaveBeenCalledWith(isMember);
  });
});

describe("/profile/profile", () => {
  it("returns the signed-in student's profile", async () => {
    const res = await request(app).get("/profile/profile");

    expect(res.status).toBe(200);
    expect(res.body.user_id).toBe("user-123");
  });

  it("saves only the checked fields", async () => {
    (UserRepository.updateProfile as jest.Mock).mockResolvedValueOnce({ data: { user_id: "user-123", major: "CS" }, error: null });

    const res = await request(app).patch("/profile/profile").send({ major: " CS " });

    expect(res.status).toBe(200);
    expect(UserRepository.updateProfile).toHaveBeenCalledWith("user-123", { major: "CS" });
  });

  it("saves nothing when any field is refused", async () => {
    const res = await request(app).patch("/profile/profile").send({ major: "CS", university: "SFU" });

    expect(res.status).toBe(400);
    expect(res.body.error.fields).toEqual({ university: "This can't be changed here." });
    expect(UserRepository.updateProfile).not.toHaveBeenCalled();
  });
});
