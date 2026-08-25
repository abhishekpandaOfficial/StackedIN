const json = (response, status, body) => {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(JSON.stringify(body));
};

export default async function handler(request, response) {
  if (request.method !== "GET" && request.method !== "POST") {
    response.setHeader("allow", "GET, POST");
    return json(response, 405, { error: "Method not allowed" });
  }

  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.authorization || "";
  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return json(response, 401, { error: "Unauthorized scheduler request" });
  }

  const projectUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!projectUrl || !serviceRoleKey) {
    return json(response, 503, { error: "Scheduler environment is incomplete" });
  }

  try {
    const result = await fetch(`${projectUrl.replace(/\/$/, "")}/rest/v1/rpc/publish_due_articles`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        authorization: `Bearer ${serviceRoleKey}`,
        "content-type": "application/json",
      },
      body: "{}",
    });
    const payload = await result.json().catch(() => null);
    if (!result.ok) return json(response, 502, { error: "Scheduled publishing failed", detail: payload?.message || "Supabase RPC rejected the request" });
    return json(response, 200, { ok: true, published: Number(payload || 0), checkedAt: new Date().toISOString() });
  } catch {
    return json(response, 502, { error: "Scheduled publishing service is unavailable" });
  }
}
