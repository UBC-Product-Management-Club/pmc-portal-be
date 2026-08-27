import { NextFunction, Request, Response } from "express";

// Session.ts builds an Auth0 verifier at import time, which throws without
// AUTH0_DOMAIN set. These tests cover the Supabase/allowlist half, so the Auth0
// middleware is stubbed rather than configured.
jest.mock("express-oauth2-jwt-bearer", () => ({ auth: () => jest.fn() }));

import { supabase } from "../../src/config/supabase";
import {
  requireAdmin,
  requireVP,
  supabaseJwtCheck,
} from "../../src/middleware/Session";
import { Tables } from "../../src/schema/v2/database.types";
import { AdminAllowlistRepository } from "../../src/storage/AdminAllowlistRepository";

// The middleware is exercised directly rather than through the app: index.ts
// calls app.listen() at module scope, so it cannot be imported into a test.
const mockRes = () =>
  ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response);

const mockReq = (overrides: Partial<Request> = {}) =>
  ({ headers: {}, ...overrides } as Request);

const mockToken = (user: unknown) =>
  (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
    data: { user },
    error: null,
  });

const mockAllowlist = (row: unknown) =>
  (AdminAllowlistRepository.getByEmail as jest.Mock).mockResolvedValueOnce({
    data: row,
    error: null,
  });

const execRow = {
  email: "exec@ubcpmc.com",
  role: "EXEC",
  team: null,
  added_by: null,
  created_at: "2026-08-01T00:00:00.000Z",
} as Tables<"Admin_Allowlist">;

describe("supabaseJwtCheck", () => {
  beforeEach(() => jest.clearAllMocks());

  it("rejects a request with no Authorization header", async () => {
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    await supabaseJwtCheck(mockReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
    expect(supabase.auth.getUser).not.toHaveBeenCalled();
  });

  it("rejects a token Supabase does not recognise", async () => {
    (supabase.auth.getUser as jest.Mock).mockResolvedValueOnce({
      data: null,
      error: { message: "bad jwt" },
    });
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    await supabaseJwtCheck(
      mockReq({ headers: { authorization: "Bearer nope" } }),
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  // Permissions are keyed by email, so an account without one can never match.
  it("rejects a verified account that has no email", async () => {
    mockToken({ id: "sb-1", email: null });
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    await supabaseJwtCheck(
      mockReq({ headers: { authorization: "Bearer token" } }),
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("attaches the verified account and continues", async () => {
    mockToken({ id: "sb-1", email: "exec@ubcpmc.com" });
    const req = mockReq({ headers: { authorization: "Bearer token" } });
    const next = jest.fn() as NextFunction;

    await supabaseJwtCheck(req, mockRes(), next);

    expect(req.supabaseUser).toEqual({ id: "sb-1", email: "exec@ubcpmc.com" });
    expect(next).toHaveBeenCalled();
  });
});

describe("requireAdmin", () => {
  beforeEach(() => jest.clearAllMocks());

  it("403s an authenticated user who is not on the allowlist", async () => {
    mockAllowlist(null);
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    await requireAdmin(
      mockReq({ supabaseUser: { id: "sb-1", email: "random@gmail.com" } }),
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("attaches the allowlist row and continues", async () => {
    mockAllowlist(execRow);
    const req = mockReq({
      supabaseUser: { id: "sb-1", email: "exec@ubcpmc.com" },
    });
    const next = jest.fn() as NextFunction;

    await requireAdmin(req, mockRes(), next);

    expect(req.admin).toEqual(execRow);
    expect(next).toHaveBeenCalled();
  });

  // Rows are stored lowercase, so the caller's address has to be normalised or
  // an exec signing in as Exec@UBCPMC.com would be locked out.
  it("normalises case and whitespace before looking the email up", async () => {
    mockAllowlist(execRow);
    const next = jest.fn() as NextFunction;

    await requireAdmin(
      mockReq({ supabaseUser: { id: "sb-1", email: "  Exec@UBCPMC.com " } }),
      mockRes(),
      next
    );

    expect(AdminAllowlistRepository.getByEmail).toHaveBeenCalledWith(
      "exec@ubcpmc.com"
    );
    expect(next).toHaveBeenCalled();
  });

  // A lookup failure has to close the door, not open it.
  it("500s rather than passing through when the allowlist read fails", async () => {
    (AdminAllowlistRepository.getByEmail as jest.Mock).mockResolvedValueOnce({
      data: null,
      error: { message: "DB down" },
    });
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    await requireAdmin(
      mockReq({ supabaseUser: { id: "sb-1", email: "exec@ubcpmc.com" } }),
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });

  it("500s when mounted without supabaseJwtCheck ahead of it", async () => {
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    await requireAdmin(mockReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
    expect(AdminAllowlistRepository.getByEmail).not.toHaveBeenCalled();
  });
});

describe("requireVP", () => {
  beforeEach(() => jest.clearAllMocks());

  it.each(["VP", "PRESIDENT"] as const)("lets a %s through", (role) => {
    const next = jest.fn() as NextFunction;

    requireVP(mockReq({ admin: { ...execRow, role } }), mockRes(), next);

    expect(next).toHaveBeenCalled();
  });

  it("403s a plain exec", () => {
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    requireVP(mockReq({ admin: execRow }), res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("500s when mounted without requireAdmin ahead of it", () => {
    const res = mockRes();
    const next = jest.fn() as NextFunction;

    requireVP(mockReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(next).not.toHaveBeenCalled();
  });
});
