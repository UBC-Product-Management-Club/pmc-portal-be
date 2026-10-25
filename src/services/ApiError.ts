import { Response } from "express";

// Errors in the shape the portal reads: { error: { code, message, fields } },
// so a form can show each message next to its field. extra sits beside error,
// e.g. the server's copy of a draft on STALE_DRAFT.
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
    public extra?: Record<string, unknown>
  ) {
    super(message);
  }
}

export const sendApiError = (res: Response, error: ApiError) =>
  res.status(error.status).json({
    ...error.extra,
    error: { code: error.code, message: error.message, ...(error.fields && { fields: error.fields }) },
  });
