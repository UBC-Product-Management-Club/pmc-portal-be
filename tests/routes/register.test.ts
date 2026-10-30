jest.mock("../../src/middleware/Session", () => ({
  authenticated: [
    (req: any, _res: any, next: any) => {
      req.user = { user_id: "user-123" };
      next();
    },
  ],
}));
jest.mock("../../src/services/Event/EventService");
jest.mock("../../src/services/Attendee/AttendeeService");
jest.mock("../../src/services/Email/EmailService", () => ({
  sendEmail: jest.fn(),
  LoopsEvent: { ApplicationReceived: "application_received" },
}));
jest.mock("../../src/storage/Storage", () => ({
  uploadSupabaseFiles: jest.fn(),
  deleteSupabaseFile: jest.fn(),
  uploadDeliverableFiles: jest.fn(),
  getDeliverable: jest.fn(),
}));

import express from "express";
import request from "supertest";
import { PDFDocument } from "pdf-lib";
import { eventRouter } from "../../src/routes/v2/event";
import { getEvent } from "../../src/services/Event/EventService";
import { submitApplication } from "../../src/services/Attendee/AttendeeService";
import { deleteSupabaseFile, uploadSupabaseFiles } from "../../src/storage/Storage";
import { ApiError } from "../../src/services/ApiError";

const app = express();
app.use(express.json());
app.use("/events", eventRouter);

const event = {
  event_id: "event-456",
  name: "Product Jackpot",
  event_form_questions: {
    questions: [
      { id: "why_event", type: "long-answer", label: "Why?", required: true, maxWords: 3 },
      { id: "resume", type: "file", label: "Resume", required: true, accept: ["application/pdf"], maxSizeMB: 5 },
    ],
  },
};

let pdf: Buffer;
beforeAll(async () => {
  const doc = await PDFDocument.create();
  doc.addPage();
  pdf = Buffer.from(await doc.save());
});

beforeEach(() => {
  (getEvent as jest.Mock).mockResolvedValue(event);
  (uploadSupabaseFiles as jest.Mock).mockResolvedValue({ resume: "attendee/event-456/user-123/resume.pdf" });
  (deleteSupabaseFile as jest.Mock).mockResolvedValue(undefined);
});

const submit = (fields: Record<string, string>, file?: Buffer) => {
  const req = request(app).post("/events/event-456/register");
  for (const [key, value] of Object.entries(fields)) req.field(key, value);
  if (file) req.attach("resume", file, "resume.pdf");
  return req;
};

const valid = { name: "Simoon Song", email: "simoon@example.com", why_event: "I like products" };

describe("POST /events/:eventId/register", () => {
  it("saves a valid application", async () => {
    (submitApplication as jest.Mock).mockResolvedValueOnce({ attendee_id: "att-1", status: "APPLIED" });

    const res = await submit(valid, pdf);

    expect(res.status).toBe(201);
    expect(submitApplication).toHaveBeenCalledWith("event-456", "user-123", {
      ...valid,
      resume: "attendee/event-456/user-123/resume.pdf",
    });
  });

  it("rejects an over-limit answer with the field error and uploads nothing", async () => {
    const res = await submit({ ...valid, why_event: "one two three four" }, pdf);

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: { code: "WORD_LIMIT", message: "Please fix the highlighted answers.", fields: { why_event: "Over 3 words." } },
    });
    expect(uploadSupabaseFiles).not.toHaveBeenCalled();
    expect(submitApplication).not.toHaveBeenCalled();
  });

  it("rejects a file that isn't really a PDF", async () => {
    const res = await submit(valid, Buffer.from("not a pdf"));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("FILE_TYPE");
  });

  it("passes on the database's reason and removes the uploaded file", async () => {
    (submitApplication as jest.Mock).mockRejectedValueOnce(new ApiError(409, "EVENT_FULL", "This event is full."));

    const res = await submit(valid, pdf);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EVENT_FULL");
    expect(deleteSupabaseFile).toHaveBeenCalledWith("attendee/event-456/user-123/resume.pdf", process.env.SUPABASE_ATTENDEE_BUCKET_NAME);
  });

  it("returns 404 for an unknown event", async () => {
    (getEvent as jest.Mock).mockResolvedValueOnce(null);

    const res = await submit(valid, pdf);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("hides unexpected errors behind a generic message", async () => {
    (submitApplication as jest.Mock).mockRejectedValueOnce(new Error("connection reset"));
    jest.spyOn(console, "error").mockImplementation(() => {});

    const res = await submit(valid, pdf);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { code: "SERVER_ERROR", message: "Couldn't submit. Please try again." } });
  });
});
