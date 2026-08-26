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

const safePersonalKey = value => {
  const key = String(value || "").trim();
  return key.length >= 20 && key.length <= 512 ? key : "";
};

const safeModel = value => {
  const model = String(value || "").trim();
  return /^[a-zA-Z0-9._:-]{1,120}$/.test(model) ? model : "";
};

async function sarvamText(prompt, currentText) {
  const apiKey = process.env.SARVAM_API_KEY;
  const model = "sarvam-105b";
  if (!apiKey) throw new Error("Sarvam is not configured. Add SARVAM_API_KEY in Vercel.");
  const result = await fetch("https://api.sarvam.ai/v1/chat/completions", {
    method: "POST",
    headers: { "api-subscription-key": apiKey, "content-type": "application/json" },
    body: JSON.stringify({ model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: `Brief:\n${prompt}\n\nCurrent draft (optional):\n${currentText || ""}` }], max_tokens: 1200, reasoning_effort: null, temperature: 0.35 }),
    signal: AbortSignal.timeout(30000),
  });
  const payload = await result.json().catch(() => ({}));
  if (!result.ok) throw new Error(payload.error?.message || payload.message || "Sarvam rejected the writing request.");
  return { text: payload.choices?.[0]?.message?.content || "", model: payload.model || model };
}

async function openAIText(prompt, currentText, apiKey, model) {
  if (!apiKey || !model) throw new Error("Test an OpenAI key and choose a model before generating.");
  const result = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model, instructions: systemPrompt, input: `Brief:\n${prompt}\n\nCurrent draft (optional):\n${currentText || ""}`, max_output_tokens: 1200 }),
    signal: AbortSignal.timeout(30000),
  });
  const payload = await result.json().catch(() => ({}));
  if (!result.ok) throw new Error(payload.error?.message || "OpenAI rejected the writing request.");
  return { text: payload.output_text || payload.output?.flatMap(item => item.content || []).find(item => item.type === "output_text")?.text || "", model: payload.model || model };
}

async function anthropicText(prompt, currentText, apiKey, model) {
  if (!apiKey || !model) throw new Error("Test an Anthropic key and choose a model before generating.");
  const result = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 1200, system: systemPrompt, messages: [{ role: "user", content: `Brief:\n${prompt}\n\nCurrent draft (optional):\n${currentText || ""}` }] }),
    signal: AbortSignal.timeout(30000),
  });
  const payload = await result.json().catch(() => ({}));
  if (!result.ok) throw new Error(payload.error?.message || "Claude rejected the writing request.");
  return { text: payload.content?.filter(item => item.type === "text").map(item => item.text).join("\n") || "", model: payload.model || model };
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("allow", "POST");
    return json(response, 405, { error: "Method not allowed" });
  }
  try {
    if (!await authenticate(request)) return json(response, 401, { error: "Sign in again before using AI writing assistance." });
    const provider = String(request.body?.provider || "sarvam").toLowerCase();
    const personalKey = safePersonalKey(request.body?.apiKey);
    const requestedModel = safeModel(request.body?.model);
    const prompt = String(request.body?.prompt || "").trim().slice(0, 2000);
    const currentText = String(request.body?.currentText || "").trim().slice(0, 5000);
    if (!prompt) return json(response, 400, { error: "Describe the post you want to draft." });
    if (!['sarvam', 'openai', 'anthropic'].includes(provider)) return json(response, 400, { error: "Choose Sarvam, OpenAI, or Anthropic." });
    if (provider !== "sarvam" && (!personalKey || !requestedModel)) return json(response, 400, { error: `Test a ${provider === "openai" ? "OpenAI" : "Anthropic"} key and choose a model first.` });
    await reserveUsage(request, provider);
    const result = provider === "sarvam" ? await sarvamText(prompt, currentText)
      : provider === "anthropic" ? await anthropicText(prompt, currentText, personalKey, requestedModel)
        : await openAIText(prompt, currentText, personalKey, requestedModel);
    if (!result.text.trim()) return json(response, 502, { error: "The model returned an empty draft." });
    return json(response, 200, { text: result.text.trim(), provider, model: result.model });
  } catch (error) {
    return json(response, /not configured/i.test(error.message || "") ? 503 : 502, { error: error.message || "AI writing assistance is unavailable." });
  }
}
