const json = (response, status, payload) => {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
};

const decodeXml = (value = "") => value
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const rawBetween = (xml, tag) => xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1] || "";
const textBetween = (xml, tag) => decodeXml(rawBetween(xml, tag));
const attribute = (xml, tag, name) => xml.match(new RegExp(`<${tag}[^>]*\\s${name}=["']([^"']+)["'][^>]*>`, "i"))?.[1] || "";
const coverFrom = value => value.match(/<img[^>]+src=["'](https:\/\/[^"']+)["']/i)?.[1] || null;
const normalize = value => { const url = new URL(value); url.hash = ""; return url.toString(); };
const normalizeDate = value => {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};
const classify = title => {
  const value = title.toLowerCase();
  if (/mlops|mlflow|model serving/.test(value)) return { pillar: "MLOps", series: "Enterprise MLOps" };
  if (/deep learning|neural|pytorch|transformer/.test(value)) return { pillar: "Deep Learning", series: "Deep Learning Mastery" };
  if (/rag|retrieval|vector|llm/.test(value)) return { pillar: "GenAI & RAG", series: "RAG Systems" };
  if (/kubernetes|docker|container|devops/.test(value)) return { pillar: "Cloud Native", series: "Cloud Native" };
  if (/azure|\.net|dotnet|aws|gcp|cloud/.test(value)) return { pillar: ".NET & Cloud", series: "Cloud Architecture" };
  if (/system design|architecture|design pattern/.test(value)) return { pillar: "System Design", series: "Architecture" };
  if (/python|numpy|pandas|machine learning|xgboost|regression/.test(value)) return { pillar: "ML Engineering", series: "ML & Data" };
  return { pillar: "Architecture & Career", series: "Independent Essays" };
};

const parseFeed = xml => {
  const chunks = [...xml.matchAll(/<(item|entry)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi)].map(match => match[2]);
  return chunks.slice(0, 100).map(item => {
    const rawContent = rawBetween(item, "content:encoded") || rawBetween(item, "content") || rawBetween(item, "description") || rawBetween(item, "summary");
    const title = textBetween(item, "title").slice(0, 240);
    const url = textBetween(item, "link") || attribute(item, "link", "href") || textBetween(item, "guid") || textBetween(item, "id");
    const tags = [...item.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/gi)].map(match => decodeXml(match[1])).filter(Boolean).slice(0, 20);
    return { title, description: decodeXml(rawContent).slice(0, 1000), url, publishedAt: textBetween(item, "pubDate") || textBetween(item, "published") || textBetween(item, "updated"), coverImage: coverFrom(rawContent), tags, ...classify(title) };
  }).filter(item => item.title && /^https:\/\//i.test(item.url));
};

const fetchText = async (url, accept = "application/rss+xml,application/xml,text/xml,*/*") => {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { signal: controller.signal, redirect: "follow", headers: { accept, "user-agent": "StackedIN-XStudio/1.0" } });
    if (!response.ok) throw new Error(`Public source returned ${response.status}`);
    const length = Number(response.headers.get("content-length") || 0);
    if (length > 3_000_000) throw new Error("Public feed is too large");
    return await response.text();
  } finally { clearTimeout(timer); }
};

const verifyUser = async authorization => {
  const projectUrl = process.env.VITE_SUPABASE_URL; const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!projectUrl || !anonKey || !authorization?.startsWith("Bearer ")) return false;
  const response = await fetch(`${projectUrl}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: authorization } });
  return response.ok;
};

const safePublicUrl = value => {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.port) throw new Error("Use a public HTTPS URL without credentials or a custom port");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host === "[::1]") throw new Error("Private network addresses are not supported");
  return url;
};

export default async function handler(request, response) {
  if (request.method !== "POST") return json(response, 405, { error: "POST required" });
  try {
    if (!await verifyUser(request.headers.authorization)) return json(response, 401, { error: "Sign in to synchronize XStudio sources" });
    const { provider: rawProvider, profileUrl } = request.body || {};
    const provider = String(rawProvider || "").toUpperCase(); const profile = safePublicUrl(profileUrl);
    if (!["SUBSTACK","MEDIUM","HASHNODE","RSS","LINKEDIN"].includes(provider)) throw new Error("Unsupported publication provider");
    if (provider === "LINKEDIN") return json(response, 422, { error: "LinkedIn does not provide a general public author feed. Approved LinkedIn OAuth API access is required." });

    let posts = []; let feedUrl = profile.toString(); let syncSource = `${provider} public feed`;
    if (provider === "SUBSTACK") {
      if (!profile.hostname.endsWith(".substack.com")) throw new Error("Use a valid Substack publication URL");
      feedUrl = `${profile.origin}/api/v1/archive?sort=new&search=&offset=0&limit=100`;
      const payload = JSON.parse(await fetchText(feedUrl, "application/json"));
      posts = payload.slice(0, 100).map(item => ({ title: item.title, description: item.subtitle || "", url: item.canonical_url, publishedAt: item.post_date, coverImage: item.cover_image || null, tags: [], ...classify(item.title || "") }));
      syncSource = "Substack archive API";
    } else {
      if (provider === "MEDIUM") {
        if (profile.hostname !== "medium.com") throw new Error("Use a medium.com profile or publication URL");
        feedUrl = `https://medium.com/feed/${profile.pathname.replace(/\/$/, "")}`;
      } else if (provider === "HASHNODE") {
        const username = profile.hostname === "hashnode.com" ? profile.pathname.match(/@([^/]+)/)?.[1] : profile.hostname.endsWith(".hashnode.dev") ? profile.hostname.split(".")[0] : null;
        if (!username) throw new Error("Use a Hashnode profile or publication URL");
        feedUrl = `https://${username}.hashnode.dev/rss.xml`;
      }
      posts = parseFeed(await fetchText(feedUrl));
    }
    posts = posts.map(post => ({ ...post, url: normalize(post.url), publishedAt: normalizeDate(post.publishedAt) })).filter(post => post.title && post.url);
    return json(response, 200, { provider, feedUrl, syncSource, posts, discovered: posts.length });
  } catch (error) {
    const message = error?.name === "AbortError" ? "The public source timed out" : error?.message || "Source synchronization failed";
    return json(response, 400, { error: message });
  }
}
