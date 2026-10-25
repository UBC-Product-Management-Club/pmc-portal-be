import { GoogleAuth } from "google-auth-library";

// The review sheet, as tech's scripts see it. Rows and columns are 0-based and
// row 0 is the header. Every value is a string the way the sheet shows it
// (a checkbox reads "TRUE" or "FALSE").
export interface Sheet {
  read(tab: string): Promise<string[][]>;
  // Clears the tab and writes these rows (header included)
  replace(tab: string, rows: string[][]): Promise<void>;
  append(tab: string, rows: string[][]): Promise<void>;
  update(tab: string, cells: { row: number; col: number; value: string }[]): Promise<void>;
}

// A1 column letters: 0 → A, 25 → Z, 26 → AA
export const columnLetter = (col: number): string =>
  (col >= 26 ? columnLetter(Math.floor(col / 26) - 1) : "") + String.fromCharCode(65 + (col % 26));

const quoteTab = (tab: string) => `'${tab.replace(/'/g, "''")}'`;

// Google Sheets through its REST API, signed in as the service account in
// GOOGLE_APPLICATION_CREDENTIALS (share the sheet with that account as an editor).
// Values go in as USER_ENTERED, so a cell made safe with a leading apostrophe
// shows as text instead of running as a formula.
export class GoogleSheet implements Sheet {
  private auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/spreadsheets"] });

  constructor(private spreadsheetId: string) {}

  private async request<T>(path: string, method: "GET" | "POST" | "PUT", data?: unknown): Promise<T> {
    const client = await this.auth.getClient();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}${path}`;
    const res = await client.request<T>({ url, method, data });
    return res.data;
  }

  async read(tab: string) {
    const range = encodeURIComponent(quoteTab(tab));
    const res = await this.request<{ values?: string[][] }>(`/values/${range}?valueRenderOption=FORMATTED_VALUE`, "GET");
    return res.values ?? [];
  }

  async replace(tab: string, rows: string[][]) {
    const range = encodeURIComponent(quoteTab(tab));
    await this.request(`/values/${range}:clear`, "POST", {});
    await this.request(`/values/${range}?valueInputOption=USER_ENTERED`, "PUT", { values: rows });
  }

  async append(tab: string, rows: string[][]) {
    if (!rows.length) return;
    const range = encodeURIComponent(quoteTab(tab));
    await this.request(`/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, "POST", {
      values: rows,
    });
  }

  async update(tab: string, cells: { row: number; col: number; value: string }[]) {
    if (!cells.length) return;
    await this.request(`/values:batchUpdate`, "POST", {
      valueInputOption: "USER_ENTERED",
      data: cells.map((c) => ({ range: `${quoteTab(tab)}!${columnLetter(c.col)}${c.row + 1}`, values: [[c.value]] })),
    });
  }
}

type SheetMeta = { sheets: { properties: { sheetId: number; title: string } }[] };

// One-time setup of the review sheet: the four tabs, the Review header, the
// Decision dropdown and checkboxes, and every column except Decision, Re-open
// and Notes protected so only tech (and the scripts) can change them.
export const setUpReviewSheet = async (
  spreadsheetId: string,
  {
    tabs,
    reviewHeader,
    reviewerColumns,
    messagesHeader,
  }: {
    tabs: { review: string; messages: string; raw: string; paymentIssues: string };
    reviewHeader: string[];
    reviewerColumns: { decision: number; reopen: number; notes: number };
    messagesHeader: string[];
  }
) => {
  const sheet = new GoogleSheet(spreadsheetId);
  const auth = new GoogleAuth({ scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
  const client = await auth.getClient();
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
  const meta = async () => (await client.request<SheetMeta>({ url: `${base}?fields=sheets.properties` })).data;
  const batch = (requests: unknown[]) => client.request({ url: `${base}:batchUpdate`, method: "POST", data: { requests } });

  const existing = new Set((await meta()).sheets.map((s) => s.properties.title));
  const missing = Object.values(tabs).filter((t) => !existing.has(t));
  if (missing.length) await batch(missing.map((title) => ({ addSheet: { properties: { title } } })));

  if (!(await sheet.read(tabs.review)).length) await sheet.replace(tabs.review, [reviewHeader]);
  if (!(await sheet.read(tabs.messages)).length) await sheet.replace(tabs.messages, [messagesHeader]);

  const ids = Object.fromEntries((await meta()).sheets.map((s) => [s.properties.title, s.properties.sheetId]));
  const column = (sheetId: number, col: number) => ({ sheetId, startRowIndex: 1, startColumnIndex: col, endColumnIndex: col + 1 });
  const editors = [
    (await auth.getCredentials()).client_email,
    ...(process.env.OPS_SHEET_EDITORS ?? "").split(",").map((e) => e.trim()),
  ].filter(Boolean) as string[];
  const reviewerOwned = new Set(Object.values(reviewerColumns));
  const protect = (range: object, description: string) => ({
    addProtectedRange: { protectedRange: { range, description, editors: { users: editors } } },
  });

  await batch([
    {
      setDataValidation: {
        range: column(ids[tabs.review], reviewerColumns.decision),
        rule: {
          condition: { type: "ONE_OF_LIST", values: [{ userEnteredValue: "Accept" }, { userEnteredValue: "Reject" }] },
          strict: true,
          showCustomUi: true,
        },
      },
    },
    { setDataValidation: { range: column(ids[tabs.review], reviewerColumns.reopen), rule: { condition: { type: "BOOLEAN" } } } },
    {
      setDataValidation: {
        range: column(ids[tabs.messages], messagesHeader.indexOf("Sent")),
        rule: { condition: { type: "BOOLEAN" } },
      },
    },
    {
      updateSheetProperties: {
        properties: { sheetId: ids[tabs.review], gridProperties: { frozenRowCount: 1 } },
        fields: "gridProperties.frozenRowCount",
      },
    },
    ...reviewHeader
      .map((_, col) => col)
      .filter((col) => !reviewerOwned.has(col))
      .map((col) =>
        protect(
          { sheetId: ids[tabs.review], startColumnIndex: col, endColumnIndex: col + 1 },
          `${reviewHeader[col]}: filled by tech's scripts`
        )
      ),
    protect({ sheetId: ids[tabs.raw] }, `${tabs.raw}: replaced on every sync`),
    protect({ sheetId: ids[tabs.paymentIssues] }, `${tabs.paymentIssues}: replaced on every sync`),
  ]);
};
