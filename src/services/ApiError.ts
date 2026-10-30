import { Response } from "express";

// Errors in the shape the portal reads: { error: { code, message, fields } },
// so a form can show each message next to its field
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>
  ) {
    super(message);
  }
}

export const sendApiError = (res: Response, error: ApiError) =>
  res.status(error.status).json({
    error: { code: error.code, message: error.message, ...(error.fields && { fields: error.fields }) },
  });
