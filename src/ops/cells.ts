// A value that starts with =, +, -, @, a tab or a return could run as a formula
// in a spreadsheet; a leading apostrophe keeps it as text
export const spreadsheetSafe = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
};

// e.g. "2026-11-04 12:00 PT"; blank for no time
export const pacific = (iso: string | null | undefined): string => (iso ? `${localTime(iso, "America/Vancouver")} PT` : "");

// e.g. "2026-11-04 12:00" in the given time zone
export const localTime = (iso: string, timeZone: string): string => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value])
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
};

export const yesNo = (value: boolean | null | undefined) => (value ? "Yes" : "No");
