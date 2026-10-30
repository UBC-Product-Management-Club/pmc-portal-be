jest.mock("../../src/middleware/Session", () => ({
  authenticated: [
    (req: any, _res: any, next: any) => {
      req.user = { user_id: "user-123" };
      next();
    },
  ],
}));
jest.mock("../../src/storage/SubmissionRepository");
jest.mock("../../src/services/Email/EmailService", () => ({ sendEmail: jest.fn(), LoopsEvent: {} }));
jest.mock("../../src/services/Email/EventEmailService", () => ({ deliverApplicationReceipt: jest.fn() }));
jest.mock("../../src/storage/Storage", () => ({
  uploadSupabaseFiles: jest.fn(),
  deleteSupabaseFile: jest.fn(),
}));

import express from "express";
import request from "supertest";
import { PDFDocument } from "pdf-lib";
import { eventRouter } from "../../src/routes/v2/event";
import { SubmissionRepository } from "../../src/storage/SubmissionRepository";
import { deleteSupabaseFile, uploadSupabaseFiles } from "../../src/storage/Storage";

const app = express();
app.use(express.json());
app.use("/events", eventRouter);

const PHASE = "0b3c6c1e-6f43-4a51-9d0b-3f1e2a7c9d10";
const fields = [
  { id: "deck", type: "file", label: "Slide deck", required: true, accept: ["application/pdf"], maxSizeMB: 25 },
  { id: "prototype", type: "url", label: "Prototype / demo link", required: true },
  { id: "description", type: "long-answer", label: "Short product description", required: true, maxWords: 5 },
];
const OLD_DECK = "events/e/teams/team-1/p/old/deck.pdf";
const saved = { submission: { deck: "deck.pdf" }, version: 1, submitted_at: "2026-11-22T19:00:00+00:00", submitted_by: "Simoon Song" };

const ok = (data: unknown) => ({ data, error: null });
const raised = (reason: string) => ({ data: null, error: { message: reason, code: "P0001" } });
const context = (submission: Record<string, string> | null = null) =>
  (SubmissionRepository.getContext as jest.Mock).mockResolvedValueOnce(ok({ team_id: "team-1", fields, submission }));

let pdf: Buffer;
beforeAll(async () => {
  const doc = await PDFDocument.create();
  doc.addPage();
  pdf = Buffer.from(await doc.save());
});

beforeEach(() => {
  jest.clearAllMocks();
  (uploadSupabaseFiles as jest.Mock).mockImplementation(async (files: Express.Multer.File[], { parentPath }: { parentPath: string }) =>
    Object.fromEntries(files.map((f) => [f.fieldname, `${parentPath}${f.originalname}`]))
  );
  (deleteSupabaseFile as jest.Mock).mockResolvedValue(undefined);
  (SubmissionRepository.save as jest.Mock).mockResolvedValue(ok(saved));
});

const valid = { prototype: "https://royalflush.app", description: "Saving as a weekly bet", expected_version: "0" };
const submit = (body: Record<string, string> = valid, deck: Buffer | null = pdf) => {
  const req = request(app).post(`/events/event-1/deliverable/${PHASE}`);
  for (const [key, value] of Object.entries(body)) req.field(key, value);
  if (deck) req.attach("deck", deck, "royal-flush.pdf");
  return req;
};

describe("POST /events/:eventId/deliverable/:phaseId", () => {
  it("uploads the deck privately and saves the whole entry with the version it loaded", async () => {
    context();

    const res = await submit();

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ message: "Submission saved", data: saved });
    const [, options] = (uploadSupabaseFiles as jest.Mock).mock.calls[0];
    expect(options).toMatchObject({ isPublic: false });
    expect(options.parentPath).toMatch(new RegExp(`^events/event-1/teams/team-1/${PHASE}/[0-9a-f-]{36}/$`));
    const [eventId, userId, phaseId, submission, version] = (SubmissionRepository.save as jest.Mock).mock.calls[0];
    expect([eventId, userId, phaseId, version]).toEqual(["event-1", "user-123", PHASE, 0]);
    expect(submission).toEqual({
      prototype: "https://royalflush.app",
      description: "Saving as a weekly bet",
      deck: `${options.parentPath}royal-flush.pdf`,
    });
  });

  it("keeps the saved deck when an edit doesn't replace it", async () => {
    context({ deck: OLD_DECK, prototype: "https://old.app", description: "Old" });

    const res = await submit({ ...valid, expected_version: "1" }, null);

    expect(res.status).toBe(201);
    expect((SubmissionRepository.save as jest.Mock).mock.calls[0][3].deck).toBe(OLD_DECK);
    expect(deleteSupabaseFile).not.toHaveBeenCalled();
  });

  it("deletes the replaced deck once the new one is saved", async () => {
    context({ deck: OLD_DECK });

    await submit({ ...valid, expected_version: "1" });

    expect(deleteSupabaseFile).toHaveBeenCalledWith(OLD_DECK, process.env.SUPABASE_DELIVERABLES_BUCKET);
  });

  it("needs a deck on the first save", async () => {
    context();

    const res = await submit(valid, null);

    expect(res.status).toBe(400);
    expect(res.body.error.fields).toEqual({ deck: "Please upload a file." });
    expect(SubmissionRepository.save).not.toHaveBeenCalled();
  });

  it.each([
    ["a javascript: link", "javascript:alert(1)"],
    ["an http link", "http://royalflush.app"],
    ["a link with no host", "https://"],
    ["a 2,049-character link", `https://a.com/${"x".repeat(2049 - 14)}`],
  ])("rejects %s", async (_label, link) => {
    context();

    const res = await submit({ ...valid, prototype: link });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: "VALIDATION_ERROR", fields: { prototype: "Enter a link that starts with https://." } });
    expect(uploadSupabaseFiles).not.toHaveBeenCalled();
  });

  it("accepts a link of exactly 2,048 characters", async () => {
    context();
    const link = `https://a.com/${"x".repeat(2048 - 14)}`;
    expect(link).toHaveLength(2048);

    expect((await submit({ ...valid, prototype: link })).status).toBe(201);
  });

  it("checks the deck is really a PDF", async () => {
    context();

    const res = await submit(valid, Buffer.from("not a pdf"));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("FILE_TYPE");
  });

  it("refuses a closed window before uploading anything", async () => {
    (SubmissionRepository.getContext as jest.Mock).mockResolvedValueOnce(raised("CLOSED"));

    const res = await submit();

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("CLOSED");
    expect(uploadSupabaseFiles).not.toHaveBeenCalled();
  });

  it("deletes the upload when the database refuses the save", async () => {
    context();
    (SubmissionRepository.save as jest.Mock).mockResolvedValueOnce(raised("STALE"));
    const logged = jest.spyOn(console, "error").mockImplementation(() => {});

    const res = await submit();

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("STALE");
    const uploadedPath = (SubmissionRepository.save as jest.Mock).mock.calls[0][3].deck;
    expect(deleteSupabaseFile).toHaveBeenCalledWith(uploadedPath, process.env.SUPABASE_DELIVERABLES_BUCKET);
    expect(logged).not.toHaveBeenCalledWith(expect.stringContaining("SUBMISSION_SAVE_FAILED"));
    logged.mockRestore();
  });

  it("logs SUBMISSION_SAVE_FAILED when the save breaks", async () => {
    context();
    (SubmissionRepository.save as jest.Mock).mockResolvedValueOnce(raised("connection reset"));
    const logged = jest.spyOn(console, "error").mockImplementation(() => {});

    const res = await submit();

    expect(res.status).toBe(500);
    expect(logged).toHaveBeenCalledWith(expect.stringContaining('"event":"SUBMISSION_SAVE_FAILED"'));
    expect(deleteSupabaseFile).toHaveBeenCalled();
    logged.mockRestore();
  });

  it.each([[undefined], ["1.5"]])("needs a whole expected_version (got %s)", async (version) => {
    const { expected_version, ...rest } = valid;
    const res = await submit(version === undefined ? rest : { ...rest, expected_version: version });

    expect(res.status).toBe(400);
    expect(SubmissionRepository.getContext).not.toHaveBeenCalled();
  });

  it("treats a phase id that isn't a uuid as not found", async () => {
    const res = await request(app).post("/events/event-1/deliverable/discovery").field("expected_version", "0");

    expect(res.status).toBe(404);
    expect(SubmissionRepository.getContext).not.toHaveBeenCalled();
  });
});

describe("reading submissions and phases", () => {
  it("returns the team's submission", async () => {
    (SubmissionRepository.getSubmission as jest.Mock).mockResolvedValueOnce(ok(saved));

    const res = await request(app).get(`/events/event-1/deliverable/${PHASE}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(saved);
  });

  it("wraps the phases as { data }", async () => {
    const phase = { id: PHASE, fields, extended_until: null, server_time: "2026-11-22T19:00:00+00:00" };
    (SubmissionRepository.getPhases as jest.Mock).mockResolvedValueOnce(ok([phase]));

    const res = await request(app).get("/events/event-1/flags");

    expect(res.body).toEqual({ data: [phase] });
  });
});
