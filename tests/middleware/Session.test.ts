jest.mock("express-oauth2-jwt-bearer", () => ({ auth: () => jest.fn() }));
jest.mock("../../src/config/supabase", () => ({ supabase: { auth: { getUser: jest.fn() } } }));

import express from "express";
import request from "supertest";
import { supabase } from "../../src/config/supabase";
import { supabaseJwtCheck } from "../../src/middleware/Session";

const getUser = supabase.auth.getUser as jest.Mock;

const app = express();
app.use("/admin", supabaseJwtCheck, (_req, res) => {
  res.status(200).json({ ok: true });
});

const signedInAs = (user: { email?: string; email_confirmed_at?: string }) =>
  getUser.mockResolvedValueOnce({ data: { user }, error: null });

const callAdmin = () => request(app).get("/admin").set("Authorization", "Bearer token-123");

describe("supabaseJwtCheck", () => {
  const originalDomains = process.env.ADMIN_EMAIL_DOMAINS;
  const confirmed = "2026-10-01T00:00:00Z";

  beforeEach(() => {
    process.env.ADMIN_EMAIL_DOMAINS = "ubcpmc.com";
  });

  afterAll(() => {
    process.env.ADMIN_EMAIL_DOMAINS = originalDomains;
  });

  it("lets a confirmed user on an allowed domain through", async () => {
    signedInAs({ email: "exec@ubcpmc.com", email_confirmed_at: confirmed });

    const res = await callAdmin();

    expect(res.status).toBe(200);
    expect(getUser).toHaveBeenCalledWith("token-123");
  });

  it("matches domains case-insensitively across a comma-separated list", async () => {
    process.env.ADMIN_EMAIL_DOMAINS = "example.org, UBCPMC.com";
    signedInAs({ email: "Exec@UBCPMC.COM", email_confirmed_at: confirmed });

    expect((await callAdmin()).status).toBe(200);
  });

  it("rejects a confirmed user on the wrong domain with 403", async () => {
    signedInAs({ email: "someone@gmail.com", email_confirmed_at: confirmed });

    expect((await callAdmin()).status).toBe(403);
  });

  it("rejects a lookalike domain with 403", async () => {
    signedInAs({ email: "someone@notubcpmc.com", email_confirmed_at: confirmed });

    expect((await callAdmin()).status).toBe(403);
  });

  it("rejects an unconfirmed email on an allowed domain with 403", async () => {
    signedInAs({ email: "exec@ubcpmc.com" });

    expect((await callAdmin()).status).toBe(403);
  });

  it("rejects a user with no email with 403", async () => {
    signedInAs({ email_confirmed_at: confirmed });

    expect((await callAdmin()).status).toBe(403);
  });

  it.each([
    ["unset", undefined],
    ["empty", " , "],
  ])("rejects everyone with 403 when ADMIN_EMAIL_DOMAINS is %s", async (_name, value) => {
    if (value === undefined) delete process.env.ADMIN_EMAIL_DOMAINS;
    else process.env.ADMIN_EMAIL_DOMAINS = value;
    signedInAs({ email: "exec@ubcpmc.com", email_confirmed_at: confirmed });

    expect((await callAdmin()).status).toBe(403);
  });

  it("returns 401 without an Authorization header", async () => {
    const res = await request(app).get("/admin");

    expect(res.status).toBe(401);
    expect(getUser).not.toHaveBeenCalled();
  });

  it("returns 401 when the header has no token", async () => {
    const res = await request(app).get("/admin").set("Authorization", "Bearer");

    expect(res.status).toBe(401);
    expect(getUser).not.toHaveBeenCalled();
  });

  it("returns 401 for a token Supabase rejects", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null }, error: { message: "invalid JWT" } });

    expect((await callAdmin()).status).toBe(401);
  });
});
