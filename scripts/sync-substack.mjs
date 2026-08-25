import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const seedPath = resolve(root, "data/posts.seed.json");
const outputPath = resolve(root, "public/posts.json");
const publication = "https://pandaabhishek.substack.com";
const offline = process.argv.includes("--offline");

const readJson = async (path, fallback) => {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch { return fallback; }
};

const slugOf = (url = "") => {
  try { return new URL(url).pathname.replace(/^\/p\//, "").replace(/\/$/, ""); }
  catch { return url.split("/p/")[1]?.replace(/\/$/, "") || ""; }
};

const decodeXml = (value = "") => value
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

const textBetween = (xml, tag) => decodeXml(xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1] || "");

const fromRss = (xml) => [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(([, item]) => ({
  title: textBetween(item, "title"),
  subtitle: textBetween(item, "description"),
  canonical_url: textBetween(item, "link"),
  post_date: textBetween(item, "pubDate"),
}));

const fetchArchive = async () => {
  const all = [];
  for (let offset = 0; offset < 1000; offset += 50) {
    const url = `${publication}/api/v1/archive?sort=new&search=&offset=${offset}&limit=50`;
    const response = await fetch(url, { headers: { accept: "application/json", "user-agent": "Abhishek-Studio-Sync/1.0" } });
    if (!response.ok) throw new Error(`Archive API returned ${response.status}`);
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error("Archive API returned an unexpected payload");
    all.push(...page);
    if (page.length < 50) break;
  }
  return all;
};

const fetchRss = async () => {
  const response = await fetch(`${publication}/feed`, { headers: { accept: "application/rss+xml", "user-agent": "Abhishek-Studio-Sync/1.0" } });
  if (!response.ok) throw new Error(`RSS feed returned ${response.status}`);
  return fromRss(await response.text());
};

const classify = (remote, seed = {}) => {
  const title = remote.title || seed.title || "Untitled post";
  const haystack = `${title} ${slugOf(remote.canonical_url || remote.url || seed.url)}`.toLowerCase();
  if (seed.pillar) return seed;
  if (/mlops|mlflow|model-serving/.test(haystack)) return { pillar: "MLOps", series: "Enterprise MLOps", tags: ["MLOps", "Production"] };
  if (/deep-learning|neural|pytorch|tensorflow/.test(haystack)) return { pillar: "Deep Learning", series: "Deep Learning Mastery", tags: ["Deep Learning", "AI"] };
  if (/rag|retrieval|vector/.test(haystack)) return { pillar: "GenAI & RAG", series: "RAG Systems", tags: ["RAG", "LLM"] };
  if (/kubernetes|docker|container/.test(haystack)) return { pillar: "Cloud Native", series: "Cloud Native", tags: ["Cloud Native", "DevOps"] };
  if (/azure|\.net|dotnet|service-bus|multithread/.test(haystack)) return { pillar: ".NET & Azure", series: ".NET & Azure Engineering", tags: [".NET", "Azure"] };
  if (/system-design|sd-\d/.test(haystack)) return { pillar: "System Design", series: "System Design Mastery", tags: ["System Design", "Architecture"] };
  if (/data-engineer|data-architect|kafka|spark|fabric/.test(haystack)) return { pillar: "Software & Data Architecture", series: "Data Engineering Mastery", tags: ["Data Engineering", "Architecture"] };
  if (/design-pattern|solid|architecture/.test(haystack)) return { pillar: "Software & Data Architecture", series: "Software Architecture", tags: ["Architecture", "Design Patterns"] };
  if (/logistic|nearest-neighbor|decision-tree|random-forest|xgboost|machine-learning|ml-\d/.test(haystack)) return { pillar: "ML Engineering", series: "ML Algorithms", tags: ["ML", "Engineering"] };
  if (/python|numpy|pandas|matplotlib|seaborn|eda/.test(haystack)) return { pillar: "Python & Data Tools", series: "Foundations", tags: ["Python", "Data"] };
  if (/cloud|aws|gcp|foundry|bedrock|gemini/.test(haystack)) return { pillar: "Architecture & Career", series: "Multi-Cloud AI Architect", tags: ["AI", "Cloud", "Architecture"] };
  return { pillar: "Architecture & Career", series: "Independent Essays", tags: ["AI", "Engineering"] };
};

const seed = await readJson(seedPath, []);
const previous = await readJson(outputPath, { posts: [] });
let remote = [];
let source = "seed";

if (!offline) {
  try { remote = await fetchArchive(); source = "Substack archive API"; }
  catch (archiveError) {
    console.warn(archiveError.message);
    try { remote = await fetchRss(); source = "Substack RSS fallback"; }
    catch (rssError) { console.warn(rssError.message); source = "cached seed fallback"; }
  }
}

const bySlug = new Map(seed.map(post => [slugOf(post.url), post]));
for (const post of previous.posts || []) if (!bySlug.has(slugOf(post.url))) bySlug.set(slugOf(post.url), post);
const remoteSlugs = new Set();

for (const item of remote) {
  const url = item.canonical_url || item.url;
  const slug = slugOf(url);
  if (!slug || !url?.includes("/p/")) continue;
  remoteSlugs.add(slug);
  const existing = bySlug.get(slug) || {};
  const taxonomy = classify(item, existing);
  bySlug.set(slug, {
    ...existing,
    ...taxonomy,
    title: item.title || existing.title || slug.replace(/-/g, " "),
    url,
    description: item.subtitle || item.description || existing.description || "A new article from Abhishek Panda.",
    publishedAt: item.post_date || item.postDate || existing.publishedAt || null,
    coverImage: item.cover_image || item.coverImage || existing.coverImage || null,
    status: "Published",
  });
}

const posts = [...bySlug.values()]
  .map((post, index) => ({ ...post, id: post.id || seed.length + index + 1, status: post.status || "Published", views: Number(post.views || 0), shares: Number(post.shares || 0) }))
  .sort((a, b) => a.id - b.id)
  .map((post, index) => ({ ...post, id: index + 1 }));

const payload = {
  publication,
  source,
  lastSyncedAt: new Date().toISOString(),
  discoveredThisRun: remoteSlugs.size,
  posts,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Wrote ${posts.length} posts from ${source} to public/posts.json`);

