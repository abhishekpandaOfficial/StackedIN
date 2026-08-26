const json = (response, status, body) => {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.setHeader("x-content-type-options", "nosniff");
  response.end(JSON.stringify(body));
};

const normalizeUsername = value => String(value || "")
  .trim()
  .toLowerCase()
  .replace(/[^a-z0-9._]+/g, ".")
  .replace(/[._]{2,}/g, ".")
  .replace(/^[._]+|[._]+$/g, "")
  .slice(0, 30);

const invalidCredentials = response => json(response, 400, { error: "Invalid username or password." });

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("allow", "POST");
    return json(response, 405, { error: "Method not allowed" });
  }

  const projectUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const username = normalizeUsername(request.body?.username);
  const password = String(request.body?.password || "");
  if (!projectUrl || !anonKey || !serviceRoleKey) return json(response, 503, { error: "Username login is not configured on this deployment." });
  if (!/^[a-z0-9](?:[a-z0-9._]{1,28}[a-z0-9])?$/.test(username) || password.length < 8) return invalidCredentials(response);

  try {
    const directoryResponse = await fetch(
      `${projectUrl}/rest/v1/account_usernames?select=email&username=eq.${encodeURIComponent(username)}&limit=1`,
      {
        headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!directoryResponse.ok) return invalidCredentials(response);
    const rows = await directoryResponse.json().catch(() => []);
    const email = rows?.[0]?.email;
    if (!email) return invalidCredentials(response);

    const tokenResponse = await fetch(`${projectUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: anonKey, "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(15000),
    });
    const token = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !token.access_token || !token.refresh_token) return invalidCredentials(response);

    return json(response, 200, {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
    });
  } catch {
    return invalidCredentials(response);
  }
}
