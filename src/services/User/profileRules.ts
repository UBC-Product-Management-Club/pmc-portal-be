import { ApiError } from "../ApiError";

// The only Profile fields a student can change. Email belongs to Auth0 and
// university sets the membership price, so neither is here.
const EDITABLE = ["first_name", "last_name", "pronouns", "year", "faculty", "major", "why_pm"] as const;
type Editable = (typeof EDITABLE)[number];
export type ProfileUpdate = Partial<Record<Editable, string>>;

// Same rules as the onboarding form (UserDataFromUserSchema in pmc-portal-fe)
const YEARS = ["1", "2", "3", "4", "5+"];
const WHY_PM_MAX = 300;

const checkField = (field: Editable, value: string): string | undefined => {
  if (field === "year") return YEARS.includes(value) ? undefined : "Pick a year from 1 to 5+.";
  if (field === "why_pm") return value.length >= 1 && value.length <= WHY_PM_MAX ? undefined : `Must be 1–${WHY_PM_MAX} characters`;
  return value ? undefined : "This can't be blank.";
};

// Checks a partial update. Fields left out stay as they are and aren't checked;
// any field that isn't editable, or any invalid value, rejects the whole request.
// Types are checked before trimming and are never coerced.
export const checkProfileUpdate = (body: unknown): ProfileUpdate => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ApiError(400, "VALIDATION_ERROR", "Send the fields to change as a JSON object.");
  }
  const fields: Record<string, string> = {};
  const update: ProfileUpdate = {};

  for (const [key, raw] of Object.entries(body)) {
    if (!(EDITABLE as readonly string[]).includes(key)) {
      fields[key] = "This can't be changed here.";
      continue;
    }
    if (typeof raw !== "string") {
      fields[key] = "Must be text.";
      continue;
    }
    const value = raw.trim();
    const error = checkField(key as Editable, value);
    if (error) fields[key] = error;
    else update[key as Editable] = value;
  }

  if (Object.keys(fields).length > 0) throw new ApiError(400, "VALIDATION_ERROR", "Please fix the highlighted fields.", fields);
  if (Object.keys(update).length === 0) throw new ApiError(400, "VALIDATION_ERROR", "No editable fields supplied.");
  return update;
};
