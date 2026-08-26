const json = (response, status, body) => {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(JSON.stringify(body));
};

async function authenticate(request) {
  const projectUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const authorization = request.headers.authorization || "";
  if (!projectUrl || !anonKey || !authorization.startsWith("Bearer ")) return false;
  const result = await fetch(`${projectUrl.replace(/\/$/, "")}/auth/v1/user`, { headers: { apikey: anonKey, authorization }, signal: AbortSignal.timeout(10000) });
  return result.ok;
}

const safeKey = value => {
  const key = String(value || "").trim();
  return key.length >= 20 && key.length <= 512 ? key : "";
};

const supportedOpenAIModel = id => /^(gpt-|o\d|chatgpt-)/i.test(id)
  && !/(audio|realtime|transcri|tts|image|search|embedding|moderation)/i.test(id);

async function listOpenAIModels(apiKey) {
  const result = await fetch("https://api.openai.com/v1/models", {
    headers: { authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(20000),
  });
  const payload = await result.json().catch(() => ({}));
  if (!result.ok) throw new Error(payload.error?.message || "OpenAI rejected this API key.");
  return (payload.data || []).filter(item => supportedOpenAIModel(item.id)).sort((a, b) => b.created - a.created || a.id.localeCompare(b.id)).slice(0, 80).map(item => ({ id: item.id, name: item.id }));
}

async function listAnthropicModels(apiKey) {
  const result = await fetch("https://api.anthropic.com/v1/models?limit=100", {
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" }, signal: AbortSignal.timeout(20000),
  });
  const payload = await result.json().catch(() => ({}));
  if (!result.ok) throw new Error(payload.error?.message || "Anthropic rejected this API key.");
  return (payload.data || []).map(item => ({ id: item.id, name: item.display_name || item.id }));
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("allow", "POST");
    return json(response, 405, { error: "Method not allowed" });
  }
  try {
    if (!await authenticate(request)) return json(response, 401, { error: "Sign in again before configuring an AI provider." });
    const provider = String(request.body?.provider || "").toLowerCase();
    const apiKey = safeKey(request.body?.apiKey);
    if (!['openai', 'anthropic'].includes(provider)) return json(response, 400, { error: "Choose OpenAI or Anthropic." });
    if (!apiKey) return json(response, 400, { error: "Enter a valid API key." });
    const models = provider === "openai" ? await listOpenAIModels(apiKey) : await listAnthropicModels(apiKey);
    if (!models.length) return json(response, 422, { error: "The key worked, but no supported writing models are available to it." });
    return json(response, 200, { provider, models });
  } catch (error) {
    return json(response, 502, { error: error.message || "The provider connection could not be tested." });
  }
}

