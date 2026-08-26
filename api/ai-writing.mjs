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
  const result = await fetch(`${projectUrl.replace(/\/$/, "")}/auth/v1/user`, { headers: { apikey: anonKey, authorization } });
  return result.ok;
}

async function reserveUsage(request, provider) {
  const projectUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const result = await fetch(`${projectUrl.replace(/\/$/, "")}/rest/v1/rpc/reserve_ai_writing_generation`, {
    method: "POST",
    headers: { apikey: anonKey, authorization: request.headers.authorization, "content-type": "application/json" },
    body: JSON.stringify({ requested_provider: provider }),
  });
  if (!result.ok) {
    const payload = await result.json().catch(() => ({}));
    throw new Error(payload.message || "AI writing usage could not be reserved.");
  }
}

const systemPrompt = `You are the StackedIN writing assistant. Draft a useful professional-network post, not marketing sludge.
Preserve factual claims from the user's brief, never invent metrics, people, employers, links, or achievements.
Use a natural first-person voice when appropriate, short paragraphs, concrete details, and at most five relevant hashtags.
Return only the post text. Do not explain your work and do not wrap the answer in quotation marks.`;

async function openAIText(prompt, currentText) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_WRITING_MODEL;
  if (!apiKey || !model) throw new Error("OpenAI is not configured. Add OPENAI_API_KEY and OPENAI_WRITING_MODEL in Vercel.");
  const result = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model, instructions: systemPrompt, input: `Brief:\n${prompt}\n\nCurrent draft (optional):\n${currentText || ""}`, max_output_tokens: 1200 }),
    signal: AbortSignal.timeout(30000),
  });
  const payload = await result.json().catch(() => ({}));
  if (!result.ok) throw new Error(payload.error?.message || "OpenAI rejected the writing request.");
  return payload.output_text || payload.output?.flatMap(item => item.content || []).find(item => item.type === "output_text")?.text || "";
}

async function anthropicText(prompt, currentText) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.ANTHROPIC_WRITING_MODEL;
  if (!apiKey || !model) throw new Error("Claude is not configured. Add ANTHROPIC_API_KEY and ANTHROPIC_WRITING_MODEL in Vercel.");
  const result = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 1200, system: systemPrompt, messages: [{ role: "user", content: `Brief:\n${prompt}\n\nCurrent draft (optional):\n${currentText || ""}` }] }),
    signal: AbortSignal.timeout(30000),
  });
  const payload = await result.json().catch(() => ({}));
  if (!result.ok) throw new Error(payload.error?.message || "Claude rejected the writing request.");
  return payload.content?.filter(item => item.type === "text").map(item => item.text).join("\n") || "";
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("allow", "POST");
    return json(response, 405, { error: "Method not allowed" });
  }
  try {
    if (!await authenticate(request)) return json(response, 401, { error: "Sign in again before using AI writing assistance." });
    const provider = String(request.body?.provider || "openai").toLowerCase();
    const prompt = String(request.body?.prompt || "").trim().slice(0, 2000);
    const currentText = String(request.body?.currentText || "").trim().slice(0, 5000);
    if (!prompt) return json(response, 400, { error: "Describe the post you want to draft." });
    if (!['openai', 'anthropic'].includes(provider)) return json(response, 400, { error: "Choose OpenAI or Claude." });
    await reserveUsage(request, provider);
    const text = provider === "anthropic" ? await anthropicText(prompt, currentText) : await openAIText(prompt, currentText);
    if (!text.trim()) return json(response, 502, { error: "The model returned an empty draft." });
    return json(response, 200, { text: text.trim(), provider });
  } catch (error) {
    return json(response, /not configured/i.test(error.message || "") ? 503 : 502, { error: error.message || "AI writing assistance is unavailable." });
  }
}
