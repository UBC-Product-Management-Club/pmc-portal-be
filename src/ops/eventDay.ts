import { normalizeQuestions } from "../services/Attendee/applicationRules";
import { OpsRepository } from "../storage/OpsRepository";
import { localTime, pacific, spreadsheetSafe } from "./cells";

// Event day scripts (4.5, Event day). Every change goes through a database
// function that only moves deadlines later and guards the finalist reveal.

// Times must say their offset, so nobody extends to the wrong hour
export const parseTime = (value: string) => {
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new Error(`Give a time with its offset, e.g. 2026-11-22T12:30:00-08:00 (got ${value})`);
  }
  return new Date(value).toISOString();
};

export const parseCodes = (value: string) => [...new Set(value.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean))];

const fail = (what: string, error: { message: string }) => new Error(`${what}: ${error.message}`);

// The event's only submission phase, unless one is named
export const resolvePhase = async (eventId: string, phaseId?: string) => {
  if (phaseId) return phaseId;
  const { data, error } = await OpsRepository.getPhases(eventId);
  if (error) throw fail("Couldn't load phases", error);
  if (data?.length !== 1) throw new Error(`The event has ${data?.length ?? 0} phases; pick one with --phase`);
  return data[0].id;
};

export const extendPhase = async (phaseId: string, until: string) => {
  const { data, error } = await OpsRepository.extendPhase(phaseId, parseTime(until));
  if (error) throw fail("Couldn't extend the deadline", error);
  return data as string;
};

export const extendTeam = async (eventId: string, teamCode: string, until: string) => {
  const { data, error } = await OpsRepository.extendTeam(eventId, teamCode, parseTime(until));
  if (error) throw fail(`Couldn't extend ${teamCode}`, error);
  return data as string;
};

type Schedule = { days?: { date: string; items?: { time: string; title: string }[] }[] };

// The schedule's "Submission Deadline" is display text, separate from the
// enforced deadline. Returns a warning when they no longer match.
export const scheduleMismatch = (schedule: unknown, timezone: string, deadline: string) => {
  const actual = localTime(deadline, timezone);
  for (const day of (schedule as Schedule | null)?.days ?? []) {
    const item = day.items?.find((i) => /submission deadline/i.test(i.title));
    if (!item) continue;
    const shown = `${day.date} ${item.time}`;
    return shown === actual ? null : `The schedule still shows the submission deadline as ${shown}; the real one is ${actual}. Update Event.schedule if the page should show it.`;
  }
  return null;
};

export const checkSchedule = async (eventId: string, deadline: string) => {
  const { data, error } = await OpsRepository.getSchedule(eventId);
  if (error) throw fail("Couldn't load the schedule", error);
  return data ? scheduleMismatch(data.schedule, data.timezone, deadline) : null;
};

export const listFinalists = async (eventId: string) => {
  const { data, error } = await OpsRepository.getFinalists(eventId);
  if (error) throw fail("Couldn't load finalists", error);
  return data ?? [];
};

export const setFinalists = async (eventId: string, codes: string[], isFinalist: boolean, correction = false) => {
  if (!codes.length) throw new Error("No team codes given");
  const { data, error } = await OpsRepository.setFinalists(eventId, codes, isFinalist, correction);
  if (error) throw fail("Couldn't change finalists", error);
  return data as number;
};

// codes is the list the events team OK'd; the database refuses if it differs
export const publishFinalists = async (eventId: string, codes: string[]) => {
  const { data, error } = await OpsRepository.publishFinalists(eventId, codes);
  if (error) throw fail("Didn't publish", error);
  return data as string;
};

const csvCell = (value: unknown) => `"${spreadsheetSafe(value).replace(/"/g, '""')}"`;
export const toCsv = (rows: unknown[][]) => rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";

// One row per team with a column per configured field, in the phase's order.
// File answers become fresh 7-day signed links. The judges' copy leaves out
// contact details.
export const exportSubmissions = async (phaseId: string) => {
  const { data, error } = await OpsRepository.submissionExport(phaseId);
  if (error) throw fail("Couldn't export submissions", error);
  const rows = data ?? [];
  const { questions } = normalizeQuestions(rows[0]?.fields ?? []);

  const answerCells = async (submission: Record<string, unknown> | null) =>
    Promise.all(
      questions.map(async (q) => {
        const value = submission?.[q.id];
        if (typeof value !== "string" || !value) return "";
        if (q.type !== "file") return value;
        const signed = await OpsRepository.signDeliverable(value);
        if (signed.error) throw fail(`Couldn't sign ${q.label}`, signed.error);
        return signed.data.signedUrl;
      })
    );

  const header = [
    "Team id", "Code", "Team name", "Size", "Members", "Emails", "Finalist",
    "Submission status", "Submitted at (UTC)", "Submitted at (Pacific)", "Submitted by", "Version", "Effective deadline (Pacific)",
    ...questions.map((q) => q.label),
  ];
  const full: unknown[][] = [header];
  for (const r of rows) {
    full.push([
      r.team_id, r.team_code, r.team_name, r.team_size, r.member_names.join("; "), r.member_emails.join("; "),
      r.is_finalist ? "Yes" : "No",
      r.submitted_at ? "Submitted" : "Not submitted",
      r.submitted_at ?? "", pacific(r.submitted_at), r.submitted_by ?? "", r.version ?? "", pacific(r.effective_deadline),
      ...(await answerCells(r.submission as Record<string, unknown> | null)),
    ]);
  }

  const emails = header.indexOf("Emails");
  const judges = full.map((row) => row.filter((_, i) => i !== emails));
  return { teams: rows.length, submitted: rows.filter((r) => r.submitted_at).length, full: toCsv(full), judges: toCsv(judges) };
};
