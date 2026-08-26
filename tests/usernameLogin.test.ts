import { afterEach, describe, expect, it, vi } from "vitest";
import handler from "../api/username-login.mjs";

const responseDouble = () => {
  const result = { statusCode: 0, headers: {} as Record<string, string>, payload: null as unknown };
  return {
    result,
    response: {
      statusCode: 0,
      setHeader(name: string, value: string) { result.headers[name] = value; },
      end(body: string) { result.statusCode = this.statusCode; result.payload = JSON.parse(body); },
    },
  };
};

describe("username login endpoint", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  it("resolves a username privately and returns only session tokens", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [{ email: "private@example.com" }] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "access", refresh_token: "refresh", user: { email: "private@example.com" } }) });
    vi.stubGlobal("fetch", fetchMock);
    const { result, response } = responseDouble();

    await handler({ method: "POST", body: { username: "Abhishek.Panda", password: "secure-pass" } }, response);

    expect(result.statusCode).toBe(200);
    expect(result.payload).toEqual({ accessToken: "access", refreshToken: "refresh" });
    expect(JSON.stringify(result.payload)).not.toContain("private@example.com");
    expect(String(fetchMock.mock.calls[0][0])).toContain("username=eq.abhishek.panda");
  });

  it("does not reveal whether a username exists", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "anon-key";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    const { result, response } = responseDouble();

    await handler({ method: "POST", body: { username: "missing.user", password: "secure-pass" } }, response);

    expect(result.statusCode).toBe(400);
    expect(result.payload).toEqual({ error: "Invalid username or password." });
  });
});
