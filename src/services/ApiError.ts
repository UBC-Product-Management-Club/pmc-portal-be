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

// Database functions raise errors by name (e.g. TEAM_FULL). Each known name maps
// to its status and message; its code is the name unless given. Anything else
// becomes a plain Error, which the routes turn into a 500.
export type DatabaseErrors = Record<string, [status: number, message: string, code?: string, fields?: Record<string, string>]>;

export const rpcResult = async <T>(
  call: PromiseLike<{ data: unknown; error: { message: string } | null }>,
  known: DatabaseErrors
): Promise<T> => {
  const { data, error } = await call;
  if (!error) return data as T;
  const name = Object.keys(known).find((n) => error.message.includes(n));
  if (!name) throw new Error(`Database call failed: ${error.message}`);
  const [status, message, code, fields] = known[name];
  throw new ApiError(status, code ?? name, message, fields);
};
