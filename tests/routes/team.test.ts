jest.mock("../../src/middleware/Session", () => ({
  authenticated: [
    (req: any, _res: any, next: any) => {
      req.user = { user_id: req.headers["x-user"] ?? "user-123" };
      next();
    },
  ],
}));
jest.mock("../../src/storage/TeamRepository");
jest.mock("../../src/services/Email/EmailService", () => ({ sendEmail: jest.fn(), LoopsEvent: {} }));
jest.mock("../../src/services/Email/EventEmailService", () => ({ deliverApplicationReceipt: jest.fn() }));
jest.mock("../../src/storage/Storage", () => ({
  uploadSupabaseFiles: jest.fn(),
  deleteSupabaseFile: jest.fn(),
}));

import express from "express";
import request from "supertest";
import { eventRouter } from "../../src/routes/v2/event";
import { TeamRepository } from "../../src/storage/TeamRepository";

const app = express();
app.use(express.json());
app.use("/events", eventRouter);

const team = { team_id: "team-1", Team: { team_name: "Royal Flush", team_code: "R4827", Team_Member: [] } };
const ok = (data: unknown = team) => ({ data, error: null });
const raised = (reason: string) => ({ data: null, error: { message: reason, code: "P0001" } });

beforeEach(() => jest.clearAllMocks());

describe("team routes", () => {
  it("returns the student's team", async () => {
    (TeamRepository.myTeam as jest.Mock).mockResolvedValueOnce(ok());

    const res = await request(app).get("/events/event-1/team");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(team);
    expect(TeamRepository.myTeam).toHaveBeenCalledWith("event-1", "user-123");
  });

  it.each([
    ["NOT_ON_TEAM", 404],
    ["NOT_REGISTERED", 403],
  ])("sends %s as its code", async (reason, status) => {
    (TeamRepository.myTeam as jest.Mock).mockResolvedValueOnce(raised(reason));

    const res = await request(app).get("/events/event-1/team");

    expect(res.status).toBe(status);
    expect(res.body.error.code).toBe(reason);
  });

  it("creates a team", async () => {
    (TeamRepository.createTeam as jest.Mock).mockResolvedValueOnce(ok());

    const res = await request(app).post("/events/event-1/team").send({ team_name: "Royal Flush" });

    expect(res.status).toBe(201);
    expect(TeamRepository.createTeam).toHaveBeenCalledWith("event-1", "user-123", "Royal Flush");
  });

  it("checks the name is text before calling the database", async () => {
    const res = await request(app).post("/events/event-1/team").send({ team_name: ["Royal"] });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: "VALIDATION_ERROR", fields: { team_name: "Required." } });
    expect(TeamRepository.createTeam).not.toHaveBeenCalled();
  });

  it("puts name errors next to the name field", async () => {
    (TeamRepository.createTeam as jest.Mock).mockResolvedValueOnce(raised("INVALID_TEAM_NAME"));

    const res = await request(app).post("/events/event-1/team").send({ team_name: "x".repeat(81) });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: "VALIDATION_ERROR", fields: { team_name: "Use 1 to 80 characters." } });
  });

  it("refuses a join with the database's reason", async () => {
    (TeamRepository.joinTeam as jest.Mock).mockResolvedValueOnce(raised("TEAM_FULL"));

    const res = await request(app).post("/events/event-1/team/join").set("x-user", "joiner").send({ team_code: "r4827" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("TEAM_FULL");
  });

  it("allows 10 join attempts a minute, then RATE_LIMITED", async () => {
    (TeamRepository.joinTeam as jest.Mock).mockResolvedValue(raised("NOT_FOUND"));
    const attempt = () => request(app).post("/events/event-1/team/join").set("x-user", "guesser").send({ team_code: "A0000" });

    for (let i = 0; i < 10; i++) expect((await attempt()).status).toBe(404);
    const limited = await attempt();

    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe("RATE_LIMITED");
    expect(limited.headers["retry-after"]).toBeDefined();
    expect(TeamRepository.joinTeam).toHaveBeenCalledTimes(10);
  });

  it("counts each student separately", async () => {
    (TeamRepository.joinTeam as jest.Mock).mockResolvedValue(ok());
    for (let i = 0; i < 10; i++) await request(app).post("/events/event-1/team/join").set("x-user", "busy").send({ team_code: "A0000" });

    const other = await request(app).post("/events/event-1/team/join").set("x-user", "someone-else").send({ team_code: "A0000" });

    expect(other.status).toBe(200);
  });

  it("renames the team", async () => {
    (TeamRepository.renameTeam as jest.Mock).mockResolvedValueOnce(ok());

    const res = await request(app).patch("/events/event-1/team").send({ team_name: "Full House" });

    expect(res.status).toBe(200);
    expect(TeamRepository.renameTeam).toHaveBeenCalledWith("event-1", "user-123", "Full House");
  });

  it("leaves the team", async () => {
    (TeamRepository.leaveTeam as jest.Mock).mockResolvedValueOnce(ok(null));

    const res = await request(app).delete("/events/event-1/team");

    expect(res.status).toBe(200);
  });

  it("hides unexpected database errors", async () => {
    (TeamRepository.myTeam as jest.Mock).mockResolvedValueOnce(raised("connection reset"));
    jest.spyOn(console, "error").mockImplementationOnce(() => {});

    const res = await request(app).get("/events/event-1/team");

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("SERVER_ERROR");
    expect(JSON.stringify(res.body)).not.toContain("connection reset");
  });
});
