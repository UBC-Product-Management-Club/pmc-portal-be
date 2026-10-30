jest.mock("../../src/storage/OpsRepository");

import {
  exportSubmissions,
  extendPhase,
  extendTeam,
  parseCodes,
  parseTime,
  resolvePhase,
  setFinalists,
} from "../../src/ops/eventDay";
import { OpsRepository } from "../../src/storage/OpsRepository";

const repo = OpsRepository as jest.Mocked<typeof OpsRepository>;

beforeEach(() => jest.resetAllMocks());

describe("parsing", () => {
  it("needs times with an offset", () => {
    expect(parseTime("2026-11-22T12:30:00-08:00")).toBe("2026-11-22T20:30:00.000Z");
    expect(parseTime("2026-11-22T20:30:00Z")).toBe("2026-11-22T20:30:00.000Z");
    expect(() => parseTime("2026-11-22T12:30:00")).toThrow("offset");
    expect(() => parseTime("noon")).toThrow("offset");
  });

  it("normalizes team codes", () => {
    expect(parseCodes(" r4827, K1093,,r4827 ")).toEqual(["R4827", "K1093"]);
  });
});

describe("extensions", () => {
  it("extends the phase deadline", async () => {
    (repo.extendPhase as jest.Mock).mockResolvedValueOnce({ data: "2026-11-22T20:30:00+00:00", error: null });

    await extendPhase("phase-1", "2026-11-22T12:30:00-08:00");

    expect(repo.extendPhase).toHaveBeenCalledWith("phase-1", "2026-11-22T20:30:00.000Z");
  });

  it("passes on the database's reason", async () => {
    (repo.extendTeam as jest.Mock).mockResolvedValueOnce({ data: null, error: { message: "UNKNOWN_TEAM: Z9999" } });

    await expect(extendTeam("e1", "Z9999", "2026-11-22T20:30:00Z")).rejects.toThrow("UNKNOWN_TEAM: Z9999");
  });

  it("uses the event's only phase unless one is named", async () => {
    (repo.getPhases as jest.Mock).mockResolvedValueOnce({ data: [{ id: "p1" }], error: null });
    await expect(resolvePhase("e1")).resolves.toBe("p1");

    (repo.getPhases as jest.Mock).mockResolvedValueOnce({ data: [{ id: "p1" }, { id: "p2" }], error: null });
    await expect(resolvePhase("e1")).rejects.toThrow("--phase");

    await expect(resolvePhase("e1", "p2")).resolves.toBe("p2");
  });
});

describe("finalists", () => {
  it("refuses an empty list", async () => {
    await expect(setFinalists("e1", [], true)).rejects.toThrow("No team codes");
  });

  it("marks finalists, as a correction only when asked", async () => {
    (repo.setFinalists as jest.Mock).mockResolvedValueOnce({ data: 2, error: null });

    await expect(setFinalists("e1", ["R4827", "K1093"], true)).resolves.toBe(2);
    expect(repo.setFinalists).toHaveBeenCalledWith("e1", ["R4827", "K1093"], true, false);
  });
});

describe("exportSubmissions", () => {
  const fields = [
    { id: "deck", type: "file", label: "Slide deck", required: true },
    { id: "prototype", type: "url", label: "Prototype / demo link", required: true },
    { id: "description", type: "long-answer", label: "Short product description", required: true },
  ];
  const row = (overrides: Record<string, unknown> = {}) => ({
    team_id: "t1",
    team_code: "R4827",
    team_name: "Royal Flush",
    team_size: 2,
    member_names: ["Simoon Song", "Alex Kim"],
    member_emails: ["simoon@example.com", "alex@example.com"],
    is_finalist: false,
    submitted_at: "2026-11-22T19:42:00+00:00",
    submitted_by: "Alex Kim",
    version: 3,
    effective_deadline: "2026-11-22T20:00:00+00:00",
    submission: { deck: "events/e/teams/t1/p/x/deck.pdf", prototype: "https://royalflush.app", description: "=SUM(A1)" },
    fields,
    ...overrides,
  });
  const parse = (csv: string) => csv.trimEnd().split("\r\n").map((line) => line.slice(1, -1).split('","'));

  beforeEach(() => {
    (repo.signDeliverable as jest.Mock).mockImplementation(async (path: string) => ({
      data: { signedUrl: `https://signed/${path}` },
      error: null,
    }));
  });

  it("writes one row per team with a column per field and a signed deck link", async () => {
    (repo.submissionExport as jest.Mock).mockResolvedValueOnce({
      data: [row(), row({ team_id: "t2", team_code: "K1093", team_name: "Aces", submitted_at: null, submitted_by: null, version: null, submission: null })],
      error: null,
    });

    const result = await exportSubmissions("p1");
    const [header, flush, aces] = parse(result.full);

    expect(result).toMatchObject({ teams: 2, submitted: 1 });
    expect(header.slice(-3)).toEqual(["Slide deck", "Prototype / demo link", "Short product description"]);
    const cell = (r: string[], name: string) => r[header.indexOf(name)];
    expect(cell(flush, "Slide deck")).toBe("https://signed/events/e/teams/t1/p/x/deck.pdf");
    expect(cell(flush, "Submitted at (Pacific)")).toBe("2026-11-22 11:42 PT");
    expect(cell(flush, "Members")).toBe("Simoon Song; Alex Kim");
    expect(cell(aces, "Submission status")).toBe("Not submitted");
    expect(cell(aces, "Slide deck")).toBe("");
  });

  it("makes every cell spreadsheet-safe", async () => {
    (repo.submissionExport as jest.Mock).mockResolvedValueOnce({ data: [row()], error: null });

    const [header, flush] = parse((await exportSubmissions("p1")).full);

    expect(flush[header.indexOf("Short product description")]).toBe("'=SUM(A1)");
  });

  it("leaves contact details out of the judges' copy", async () => {
    (repo.submissionExport as jest.Mock).mockResolvedValueOnce({ data: [row()], error: null });

    const { judges } = await exportSubmissions("p1");

    expect(judges).not.toContain("Emails");
    expect(judges).not.toContain("@example.com");
    expect(judges).toContain("Simoon Song; Alex Kim");
  });
});
