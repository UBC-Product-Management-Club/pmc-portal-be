import { NextFunction, Request, Response } from "express";
import { supabaseJwtCheck } from "../../src/middleware/Session";
import { supabase } from "../../src/config/supabase";

const mockRes = () => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
};

const run = async (req: Partial<Request>) => {
  const res = mockRes();
  const next: NextFunction = jest.fn();
  await supabaseJwtCheck(req as Request, res, next);
  return { res, next };
};

describe("supabaseJwtCheck", () => {
  const getUser = supabase.auth.getUser as jest.Mock;

  beforeEach(() => jest.clearAllMocks());

  it("401s when the Authorization header is missing", async () => {
    const { res, next } = await run({ headers: {} });
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("401s when the token is invalid", async () => {
    getUser.mockResolvedValueOnce({ data: null, error: { message: "bad" } });
    const { res, next } = await run({ headers: { authorization: "Bearer x" } });
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("403s a valid user whose email is not a PMC exec address", async () => {
    getUser.mockResolvedValueOnce({
      data: { user: { email: "applicant@gmail.com" } },
      error: null,
    });
    const { res, next } = await run({ headers: { authorization: "Bearer x" } });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("403s a lookalike domain", async () => {
    getUser.mockResolvedValueOnce({
      data: { user: { email: "x@evil-ubcpmc.com" } },
      error: null,
    });
    const { res, next } = await run({ headers: { authorization: "Bearer x" } });
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next for a @ubcpmc.com email (case-insensitive)", async () => {
    getUser.mockResolvedValueOnce({
      data: { user: { email: "Exec@UBCPMC.com" } },
      error: null,
    });
    const { res, next } = await run({ headers: { authorization: "Bearer x" } });
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
