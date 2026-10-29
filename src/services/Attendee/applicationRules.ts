import { PDFDocument } from "pdf-lib";

// Server-side checks for an application or a submission. The frontend runs the
// same rules so students see errors early, but only these decide what gets saved.

type QuestionType = "short-answer" | "long-answer" | "dropdown" | "file" | "checkbox" | "radio" | "url";

export type Question = {
  id: string;
  type: QuestionType;
  label: string;
  required: boolean;
  options?: string[];
  maxWords?: number;
  accept?: string[];
  maxSizeMB?: number;
};

export type FieldErrorCode = "VALIDATION_ERROR" | "WORD_LIMIT" | "FILE_TYPE" | "FILE_TOO_LARGE";
export type FieldError = { code: FieldErrorCode; message: string };

export type ApplicationCheck = {
  answers: Record<string, string>;
  files: Express.Multer.File[];
  errors: Record<string, FieldError>;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Ten-digit North American numbers, with or without +1, spaces, dashes or brackets
const PHONE = /^(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/;

// https links of up to 2,048 characters, so javascript: and data: links never reach a judge
const isHttpsLink = (value: string) => {
  if (value.length > 2048 || /\s/.test(value) || !/^https:\/\//i.test(value)) return false;
  try {
    return new URL(value).hostname !== "";
  } catch {
    return false;
  }
};

// Same as the frontend: trim, then split on runs of whitespace (an empty answer is 0 words)
export const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

// Sizes use decimal bytes: 5 MB = 5,000,000 bytes
const bytes = (mb: number) => mb * 1_000_000;

// New events use { id, type, ... }; older ones use { label, questionType, ... } and key answers by label
export const normalizeQuestions = (raw: unknown): { questions: Question[]; keyedById: boolean } => {
  const list = raw && typeof raw === "object" && "questions" in raw ? (raw as { questions: unknown }).questions : raw;
  if (!Array.isArray(list)) return { questions: [], keyedById: false };

  const keyedById = list.some((q) => q && typeof q === "object" && typeof q.id === "string");
  const questions = list
    .filter((q) => q && typeof q === "object" && typeof q.label === "string")
    .map((q) => ({
      id: typeof q.id === "string" ? q.id : q.label,
      type: q.type ?? q.questionType,
      label: q.label,
      required: q.required === true,
      options: Array.isArray(q.options) ? q.options : undefined,
      maxWords: typeof q.maxWords === "number" ? q.maxWords : undefined,
      accept: Array.isArray(q.accept) ? q.accept : undefined,
      maxSizeMB: typeof q.maxSizeMB === "number" ? q.maxSizeMB : undefined,
    }));
  return { questions, keyedById };
};

// A real PDF starts with %PDF-, ends with %%EOF and opens in the parser with at
// least one page; the file name and the browser-reported type are not trusted
export const isRealPdf = async (buffer: Buffer) => {
  if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") return false;
  if (!buffer.subarray(-1024).toString("latin1").includes("%%EOF")) return false;
  try {
    const doc = await PDFDocument.load(buffer, {
      ignoreEncryption: true,
      updateMetadata: false,
      throwOnInvalidObject: true,
    });
    return doc.getPageCount() > 0;
  } catch {
    return false;
  }
};

const checkFile = async (q: Question, file: Express.Multer.File): Promise<FieldError | undefined> => {
  const wantsPdf = q.accept?.includes("application/pdf");
  if (wantsPdf && !(await isRealPdf(file.buffer))) {
    return { code: "FILE_TYPE", message: "Upload a PDF file." };
  }
  if (!wantsPdf && q.accept?.length && !q.accept.includes(file.mimetype)) {
    return { code: "FILE_TYPE", message: "That file type isn't allowed." };
  }
  if (q.maxSizeMB && file.size > bytes(q.maxSizeMB)) {
    return { code: "FILE_TOO_LARGE", message: `That file is too large. The limit is ${q.maxSizeMB} MB.` };
  }
};

const checkText = (q: Question, value: string): FieldError | undefined => {
  if (!value) {
    return q.required ? { code: "VALIDATION_ERROR", message: "This field is required." } : undefined;
  }
  if (q.type === "long-answer" && q.maxWords !== undefined && countWords(value) > q.maxWords) {
    return { code: "WORD_LIMIT", message: `Over ${q.maxWords} words.` };
  }
  if ((q.type === "dropdown" || q.type === "radio") && q.options && !q.options.includes(value)) {
    return { code: "VALIDATION_ERROR", message: "Pick one of the options." };
  }
  if (q.type === "url" && !isHttpsLink(value)) {
    return { code: "VALIDATION_ERROR", message: "Enter a link that starts with https://." };
  }
  if (q.id === "phone" && !PHONE.test(value)) {
    return { code: "VALIDATION_ERROR", message: "Enter a phone number like 604-555-0123." };
  }
};

// Reads one text answer: strings only, trimmed. undefined means it wasn't text.
const readText = (body: Record<string, unknown>, key: string, errors: Record<string, FieldError>) => {
  const value = body[key];
  if (value === undefined) return "";
  if (typeof value !== "string") {
    errors[key] = { code: "VALIDATION_ERROR", message: "Answer with text." };
    return undefined;
  }
  return value.trim();
};

// Checks every answer and file against the questions. Only known answers are
// kept, each trimmed; anything else in the request is dropped. A required file
// question listed in alreadyUploaded may be left without a new file.
export const checkAnswers = async (
  questions: Question[],
  body: Record<string, unknown>,
  uploads: Express.Multer.File[],
  alreadyUploaded: Set<string> = new Set()
): Promise<ApplicationCheck> => {
  const answers: Record<string, string> = {};
  const files: Express.Multer.File[] = [];
  const errors: Record<string, FieldError> = {};

  for (const q of questions) {
    if (q.type === "file") {
      const matching = uploads.filter((f) => f.fieldname === q.id);
      if (matching.length > 1) {
        errors[q.id] = { code: "VALIDATION_ERROR", message: "Upload one file." };
        continue;
      }
      const [file] = matching;
      if (!file) {
        if (q.required && !alreadyUploaded.has(q.id)) errors[q.id] = { code: "VALIDATION_ERROR", message: "Please upload a file." };
        continue;
      }
      const error = await checkFile(q, file);
      if (error) errors[q.id] = error;
      else files.push(file);
      continue;
    }

    const value = readText(body, q.id, errors);
    if (value === undefined) continue;
    const error = checkText(q, value);
    if (error) errors[q.id] = error;
    else if (value) answers[q.id] = value;
  }

  return { answers, files, errors };
};

// An application: the event's questions, plus name and email, which are fixed
// fields on forms that use the current question format
export const checkApplication = async (
  rawQuestions: unknown,
  body: Record<string, unknown>,
  uploads: Express.Multer.File[]
): Promise<ApplicationCheck> => {
  const { questions, keyedById } = normalizeQuestions(rawQuestions);
  const fixed: Record<string, string> = {};
  const fixedErrors: Record<string, FieldError> = {};

  if (keyedById) {
    const name = readText(body, "name", fixedErrors);
    if (name !== undefined) {
      if (!name) fixedErrors.name = { code: "VALIDATION_ERROR", message: "Please enter your name." };
      else fixed.name = name;
    }
    const email = readText(body, "email", fixedErrors);
    if (email !== undefined) {
      if (!EMAIL.test(email)) fixedErrors.email = { code: "VALIDATION_ERROR", message: "Enter an email like you@example.com." };
      else fixed.email = email;
    }
  }

  const { answers, files, errors } = await checkAnswers(questions, body, uploads);
  return { answers: { ...fixed, ...answers }, files, errors: { ...fixedErrors, ...errors } };
};

// One code for the whole response: the specific one when every error shares it
export const summarizeErrors = (errors: Record<string, FieldError>) => {
  const codes = new Set(Object.values(errors).map((e) => e.code));
  const code: FieldErrorCode = codes.size === 1 ? [...codes][0] : "VALIDATION_ERROR";
  const fields = Object.fromEntries(Object.entries(errors).map(([key, e]) => [key, e.message]));
  return { code, fields };
};
