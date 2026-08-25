import { afterEach, describe, expect, it, vi } from "vitest";
// The production endpoint is deliberately plain JavaScript for Vercel Functions.
import handler from "../api/publish-scheduled.mjs";

function responseHarness() {
  const headers = new Map<string, string>();
  let payload = "";
  return {
    response: {
      statusCode: 0,
      setHeader: (name: string, value: string) => headers.set(name, value),
      end: (value: string) => { payload = value; },
    },
    body: () => JSON.parse(payload),
  };
}

describe("scheduled publishing endpoint", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("rejects requests without the cron bearer secret", async () => {
    vi.stubEnv("CRON_SECRET", "expected");
    const harness = responseHarness();
    await handler({ method: "GET", headers: {} }, harness.response);
    expect(harness.response.statusCode).toBe(401);
    expect(harness.body()).toEqual({ error: "Unauthorized scheduler request" });
  });

  it("calls only the protected service-role RPC", async () => {
    vi.stubEnv("CRON_SECRET", "expected");
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "server-only-key");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(2) });
    vi.stubGlobal("fetch", fetchMock);
    const harness = responseHarness();
    await handler({ method: "GET", headers: { authorization: "Bearer expected" } }, harness.response);
    expect(harness.response.statusCode).toBe(200);
    expect(harness.body()).toEqual(expect.objectContaining({ ok: true, published: 2 }));
    expect(fetchMock).toHaveBeenCalledWith("https://example.supabase.co/rest/v1/rpc/publish_due_articles", expect.objectContaining({ method: "POST" }));
  });
});
