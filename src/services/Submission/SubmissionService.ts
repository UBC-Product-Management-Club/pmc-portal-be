import { randomUUID } from "crypto";
import { Json } from "../../schema/v2/database.types";
import { SubmissionRepository } from "../../storage/SubmissionRepository";
import { deleteSupabaseFile, uploadSupabaseFiles } from "../../storage/Storage";
import { checkAnswers, normalizeQuestions, summarizeErrors } from "../Attendee/applicationRules";
import { ApiError, DatabaseErrors, rpcResult } from "../ApiError";
import { logEvent } from "../logEvent";

const SUBMISSION_ERRORS: DatabaseErrors = {
  NOT_REGISTERED: [403, "Only registered students can submit."],
  NOT_ON_TEAM: [404, "Join or create a team to submit."],
  NOT_FOUND: [404, "This submission phase doesn't exist."],
  DISABLED: [403, "Submissions are paused by the organizers."],
  NOT_OPEN: [403, "Submissions aren't open yet."],
  CLOSED: [403, "Submissions closed before your save finished."],
  TEAM_TOO_SMALL: [409, "Your team doesn't have enough members to submit yet."],
  STALE: [409, "A teammate saved since you opened the form."],
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const checkPhaseId = (phaseId: string) => {
  if (!UUID.test(phaseId)) throw new ApiError(404, "NOT_FOUND", "This submission phase doesn't exist.");
};

const bucket = () => process.env.SUPABASE_DELIVERABLES_BUCKET!;

// The event's phases with this team's extension and the database's time, wrapped
// as { data } because the older event pages read it that way
export const getPhases = async (eventId: string, userId: string) => ({
  data: await rpcResult<Json>(SubmissionRepository.getPhases(eventId, userId), SUBMISSION_ERRORS),
});

export const getSubmission = (eventId: string, userId: string, phaseId: string) => {
  checkPhaseId(phaseId);
  return rpcResult<Json>(SubmissionRepository.getSubmission(eventId, userId, phaseId), SUBMISSION_ERRORS);
};

type Context = { team_id: string; fields: Json; submission: Record<string, string> | null };

// Saves the team's entry. Answers are checked against the phase's fields, new
// files go to a fresh private folder, then the database decides whether the
// save counts (window, roster, version). A rejected save deletes its upload; a
// successful one deletes the files it replaced.
export const saveSubmission = async (
  eventId: string,
  userId: string,
  phaseId: string,
  body: Record<string, unknown>,
  uploads: Express.Multer.File[]
) => {
  checkPhaseId(phaseId);
  const expectedVersion = Number(body.expected_version);
  if (typeof body.expected_version !== "string" || !Number.isInteger(expectedVersion) || expectedVersion < 0) {
    throw new ApiError(400, "VALIDATION_ERROR", "expected_version must be a whole number.");
  }

  // Fails early when the window is shut, before anything is uploaded
  const context = await rpcResult<Context>(SubmissionRepository.getContext(eventId, userId, phaseId), SUBMISSION_ERRORS);
  const { questions } = normalizeQuestions(context.fields);
  const previous = context.submission ?? {};
  const fileFields = questions.filter((q) => q.type === "file").map((q) => q.id);
  const kept = new Set(fileFields.filter((id) => typeof previous[id] === "string"));

  const { answers, files, errors } = await checkAnswers(questions, body, uploads, kept);
  if (Object.keys(errors).length > 0) {
    const { code, fields } = summarizeErrors(errors);
    throw new ApiError(400, code, "Please fix the highlighted fields.", fields);
  }

  const uploaded = await uploadSupabaseFiles(files, {
    parentPath: `events/${eventId}/teams/${context.team_id}/${phaseId}/${randomUUID()}/`,
    bucketName: bucket(),
    isPublic: false,
  });
  const submission: Record<string, string> = { ...answers };
  for (const id of fileFields) {
    const path = uploaded[id] ?? previous[id];
    if (path) submission[id] = path;
  }

  let saved: Json;
  try {
    saved = await rpcResult<Json>(SubmissionRepository.save(eventId, userId, phaseId, submission, expectedVersion), SUBMISSION_ERRORS);
  } catch (error) {
    await removeFiles(Object.values(uploaded));
    if (!(error instanceof ApiError)) {
      logEvent("SUBMISSION_SAVE_FAILED", { event_id: eventId, team_id: context.team_id, phase_id: phaseId });
    }
    throw error;
  }

  await removeFiles(fileFields.filter((id) => uploaded[id] && previous[id]).map((id) => previous[id]));
  return saved;
};

// Best effort: a leftover file is harmless, a failed save or response isn't
const removeFiles = (paths: string[]) => Promise.allSettled(paths.map((path) => deleteSupabaseFile(path, bucket())));
