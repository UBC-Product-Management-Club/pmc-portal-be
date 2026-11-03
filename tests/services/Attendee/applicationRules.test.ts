import { PDFDocument } from "pdf-lib";
import {
  checkApplication,
  countWords,
  isRealPdf,
  normalizeQuestions,
  summarizeErrors,
} from "../../../src/services/Attendee/applicationRules";

const questions = {
  questions: [
    { id: "phone", type: "short-answer", label: "Phone number", required: true },
    { id: "why_event", type: "long-answer", label: "Why?", required: true, maxWords: 5 },
    { id: "year", type: "dropdown", label: "Year", required: false, options: ["1", "2"] },
    { id: "resume", type: "file", label: "Resume", required: true, accept: ["application/pdf"], maxSizeMB: 5 },
  ],
};

const file = (buffer: Buffer, overrides: Partial<Express.Multer.File> = {}) =>
  ({ fieldname: "resume", originalname: "resume.pdf", mimetype: "application/pdf", size: buffer.length, buffer, ...overrides }) as Express.Multer.File;

let pdf: Buffer;
beforeAll(async () => {
  const doc = await PDFDocument.create();
  doc.addPage();
  pdf = Buffer.from(await doc.save());
});

const valid = () => ({
  name: " Simoon Song ",
  email: "simoon@example.com",
  phone: "604-555-0123",
  why_event: "I like products",
});

describe("countWords", () => {
  it("counts like the frontend", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("   ")).toBe(0);
    expect(countWords("one")).toBe(1);
    expect(countWords("  two   words\n")).toBe(2);
    expect(countWords("well-known, product-led!")).toBe(2);
  });
});

describe("normalizeQuestions", () => {
  it("reads the current format", () => {
    const { questions: list, keyedById } = normalizeQuestions(questions);
    expect(keyedById).toBe(true);
    expect(list.map((q) => q.id)).toEqual(["phone", "why_event", "year", "resume"]);
  });

  it("reads older events keyed by label", () => {
    const { questions: list, keyedById } = normalizeQuestions({
      title: "Form",
      questions: [{ label: "Shirt size", questionType: "dropdown", options: ["S", "M"], required: true }],
    });
    expect(keyedById).toBe(false);
    expect(list[0]).toMatchObject({ id: "Shirt size", type: "dropdown", required: true });
  });

  it("treats anything else as no questions", () => {
    expect(normalizeQuestions({}).questions).toEqual([]);
    expect(normalizeQuestions(null).questions).toEqual([]);
  });
});

describe("isRealPdf", () => {
  it("accepts a real PDF and rejects a renamed file", async () => {
    expect(await isRealPdf(pdf)).toBe(true);
    expect(await isRealPdf(Buffer.from("just text"))).toBe(false);
    expect(await isRealPdf(Buffer.from("%PDF-1.7 but not really a pdf"))).toBe(false);
    expect(await isRealPdf(Buffer.from("%PDF-1.7\ngarbage\n%%EOF\n"))).toBe(false);
  });
});

describe("checkApplication", () => {
  it("keeps only known, trimmed answers when everything is valid", async () => {
    const result = await checkApplication(questions, { ...valid(), extra: "dropped" }, [file(pdf)]);
    expect(result.errors).toEqual({});
    expect(result.answers).toEqual({
      name: "Simoon Song",
      email: "simoon@example.com",
      phone: "604-555-0123",
      why_event: "I like products",
    });
    expect(result.files).toHaveLength(1);
  });

  it("rejects a blank required answer and a missing file", async () => {
    const { errors } = await checkApplication(questions, { ...valid(), why_event: "   " }, []);
    expect(errors.why_event.code).toBe("VALIDATION_ERROR");
    expect(errors.resume.message).toBe("Please upload a file.");
  });

  it("rejects an answer over its word limit", async () => {
    const { errors } = await checkApplication(questions, { ...valid(), why_event: "one two three four five six" }, [file(pdf)]);
    expect(errors).toEqual({ why_event: { code: "WORD_LIMIT", message: "Over 5 words." } });
  });

  it("allows exactly the word limit", async () => {
    const { errors } = await checkApplication(questions, { ...valid(), why_event: "one two three four five" }, [file(pdf)]);
    expect(errors).toEqual({});
  });

  it("rejects answers that aren't text", async () => {
    const { errors } = await checkApplication(questions, { ...valid(), why_event: ["a", "b"] }, [file(pdf)]);
    expect(errors.why_event.code).toBe("VALIDATION_ERROR");
  });

  it("checks name, email, phone and dropdown values", async () => {
    const { errors } = await checkApplication(
      questions,
      { ...valid(), name: " ", email: "simoon@example", phone: "555-01", year: "9" },
      [file(pdf)]
    );
    expect(Object.keys(errors).sort()).toEqual(["email", "name", "phone", "year"]);
  });

  it("rejects a file that isn't really a PDF", async () => {
    const { errors } = await checkApplication(questions, valid(), [file(Buffer.from("not a pdf"))]);
    expect(errors.resume.code).toBe("FILE_TYPE");
  });

  it("rejects a file over the size limit, using decimal megabytes", async () => {
    const atLimit = await checkApplication(questions, valid(), [file(pdf, { size: 5_000_000 })]);
    const over = await checkApplication(questions, valid(), [file(pdf, { size: 5_000_001 })]);
    expect(atLimit.errors).toEqual({});
    expect(over.errors.resume.code).toBe("FILE_TOO_LARGE");
  });

  it("ignores files for unknown fields", async () => {
    const result = await checkApplication(questions, valid(), [file(pdf), file(pdf, { fieldname: "other" })]);
    expect(result.files.map((f) => f.fieldname)).toEqual(["resume"]);
  });

  it("doesn't ask older forms for name and email", async () => {
    const legacy = { questions: [{ label: "Shirt size", questionType: "short-answer", required: true }] };
    const result = await checkApplication(legacy, { "Shirt size": "M" }, []);
    expect(result.errors).toEqual({});
    expect(result.answers).toEqual({ "Shirt size": "M" });
  });
});

describe("summarizeErrors", () => {
  it("uses the shared code when every error has it", () => {
    expect(summarizeErrors({ a: { code: "WORD_LIMIT", message: "Over 5 words." } })).toEqual({
      code: "WORD_LIMIT",
      fields: { a: "Over 5 words." },
    });
  });

  it("falls back to VALIDATION_ERROR for mixed errors", () => {
    const { code } = summarizeErrors({
      a: { code: "WORD_LIMIT", message: "x" },
      b: { code: "FILE_TYPE", message: "y" },
    });
    expect(code).toBe("VALIDATION_ERROR");
  });
});
