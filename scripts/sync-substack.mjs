import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const seedPath = resolve(root, "data/posts.seed.json");
const outputPath = resolve(root, "public/posts.json");
const offline = process.argv.includes("--offline");
const profiles = {
  Substack: "https://pandaabhishek.substack.com",
  Medium: "https://medium.com/@official.abhishekpanda",
  Hashnode: "https://hashnode.com/@abhishekpanda",
  LinkedIn: "https://www.linkedin.com/in/iamabhishekpanda/",
};
const browserHeaders = {
  "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0 Safari/537.36",
  "accept-language": "en-US,en;q=0.9",
};

const readJson = async (path, fallback) => {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch { return fallback; }
};
const normalizeUrl = (value = "") => {
  try { const url = new URL(value); url.hash = ""; url.search = ""; return url.toString().replace(/\/$/, ""); }
  catch { return value.replace(/\/$/, ""); }
};
const slugOf = (url = "") => {
  try { return new URL(url).pathname.replace(/^\/p\//, "").replace(/^\//, "").replace(/\/$/, ""); }
  catch { return url.split("/p/")[1]?.replace(/\/$/, "") || url; }
};
const decodeXml = (value = "") => value
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
  .replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
const textBetween = (xml, tag) => decodeXml(xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1] || "");
const fromRss = (xml, platform) => [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)].map(([, item]) => ({
  title: textBetween(item, "title"),
  description: textBetween(item, "description") || textBetween(item, "content:encoded"),
  url: textBetween(item, "link") || textBetween(item, "guid"),
  publishedAt: textBetween(item, "pubDate"),
  platform,
}));

const fetchRss = async (url, platform) => {
  const response = await fetch(url, { headers: { ...browserHeaders, accept: "application/rss+xml,application/xml,text/xml,*/*" } });
  if (!response.ok) throw new Error(`${platform} RSS returned ${response.status}`);
  return fromRss(await response.text(), platform);
};
const fetchRssProxy = async (url, platform) => {
  const endpoint = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`;
  const response = await fetch(endpoint, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`${platform} RSS mirror returned ${response.status}`);
  const payload = await response.json();
  if (payload.status !== "ok" || !Array.isArray(payload.items)) throw new Error(payload.message || `${platform} RSS mirror returned an unexpected payload`);
  return payload.items.map(item => ({ title: item.title, description: decodeXml(item.description || item.content), url: item.link, publishedAt: item.pubDate, coverImage: item.thumbnail || null, platform }));
};
const fetchFeedWithFallback = async (url, platform) => {
  try { return { posts: await fetchRss(url, platform), source: `${platform} RSS` }; }
  catch (error) { console.warn(error.message); return { posts: await fetchRssProxy(url, platform), source: `${platform} RSS mirror` }; }
};

const fetchSubstack = async () => {
  const all = [];
  try {
    for (let offset = 0; offset < 1000; offset += 50) {
      const url = `${profiles.Substack}/api/v1/archive?sort=new&search=&offset=${offset}&limit=50`;
      const response = await fetch(url, { headers: { ...browserHeaders, referer: `${profiles.Substack}/`, accept: "application/json,text/plain,*/*" } });
      if (!response.ok) throw new Error(`Substack archive API returned ${response.status}`);
      const page = await response.json();
      if (!Array.isArray(page)) throw new Error("Substack archive API returned an unexpected payload");
      all.push(...page.map(item => ({ title: item.title, description: item.subtitle, url: item.canonical_url, publishedAt: item.post_date, coverImage: item.cover_image, platform: "Substack" })));
      if (page.length < 50) break;
    }
    return { posts: all, source: "Substack archive API" };
  } catch (error) {
    console.warn(error.message);
    return fetchFeedWithFallback(`${profiles.Substack}/feed`, "Substack");
  }
};

const fetchHashnodeGraphql = async () => {
  const query = `query PublicationPosts($after: String) {
    publication(host: "abhishekpanda.hashnode.dev") {
      posts(first: 50, after: $after) {
        pageInfo { hasNextPage endCursor }
        edges { node { id title brief slug url publishedAt coverImage { url } tags { name slug } } }
      }
    }
  }`;
  const posts = [];
  let after = null;
  do {
    const response = await fetch("https://gql.hashnode.com/", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query, variables: { after } }) });
    if (!response.ok) throw new Error(`Hashnode API returned ${response.status}`);
    const payload = await response.json();
    if (payload.errors?.length) throw new Error(`Hashnode API: ${payload.errors[0].message}`);
    const connection = payload.data?.publication?.posts;
    if (!connection) throw new Error("Hashnode publication was not found");
    posts.push(...connection.edges.map(({ node }) => ({ title: node.title, description: node.brief, url: node.url || `https://abhishekpanda.hashnode.dev/${node.slug}`, publishedAt: node.publishedAt, coverImage: node.coverImage?.url, tags: node.tags?.map(tag => tag.name), platform: "Hashnode" })));
    after = connection.pageInfo.hasNextPage ? connection.pageInfo.endCursor : null;
  } while (after);
  return { posts, source: "Hashnode public GraphQL API" };
};
const fetchHashnode = async () => {
  try { return await fetchHashnodeGraphql(); }
  catch (error) {
    console.warn(error.message);
    return fetchFeedWithFallback("https://abhishekpanda.hashnode.dev/rss.xml", "Hashnode");
  }
};

const classify = (remote, seed = {}) => {
  const title = remote.title || seed.title || "Untitled post";
  const haystack = `${title} ${slugOf(remote.url || seed.url)}`.toLowerCase();
  if (seed.pillar) return { pillar: seed.pillar, series: seed.series, tags: remote.tags?.length ? remote.tags : seed.tags };
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
  return { pillar: "Architecture & Career", series: "Independent Essays", tags: remote.tags?.length ? remote.tags : ["AI", "Engineering"] };
};

const seed = await readJson(seedPath, []);
const previous = await readJson(outputPath, { posts: [] });
const byUrl = new Map();
for (const post of [...seed, ...(previous.posts || [])]) {
  const normalized = normalizeUrl(post.url);
  if (normalized && !byUrl.has(normalized)) byUrl.set(normalized, { ...post, platform: post.platform || "Substack" });
}

const sources = [];
let discoveredThisRun = 0;
if (!offline) {
  const jobs = [
    ["Substack", fetchSubstack],
    ["Medium", () => fetchFeedWithFallback("https://medium.com/feed/@official.abhishekpanda", "Medium")],
    ["Hashnode", fetchHashnode],
  ];
  for (const [platform, fetcher] of jobs) {
    try {
      const result = await fetcher();
      sources.push(result.source);
      discoveredThisRun += result.posts.length;
      for (const item of result.posts) {
        const url = normalizeUrl(item.url);
        if (!url) continue;
        const existing = byUrl.get(url) || {};
        const taxonomy = classify(item, existing);
        byUrl.set(url, {
          ...existing, ...taxonomy,
          title: item.title || existing.title || slugOf(url).replace(/-/g, " "),
          url,
          description: decodeXml(item.description || existing.description || "A new article from Abhishek Panda."),
          publishedAt: item.publishedAt || existing.publishedAt || null,
          coverImage: item.coverImage || existing.coverImage || null,
          platform,
          status: "Published",
        });
      }
    } catch (error) { console.warn(`${platform} sync skipped: ${error.message}`); }
  }
}

const posts = [...byUrl.values()]
  .map(post => ({ ...post, platform: post.platform || "Substack", status: post.status || "Published", views: Number(post.views || 0), shares: Number(post.shares || 0) }))
  .sort((a, b) => (a.id || Number.MAX_SAFE_INTEGER) - (b.id || Number.MAX_SAFE_INTEGER))
  .map((post, index) => ({ ...post, id: index + 1 }));
const payload = {
  publication: profiles.Substack,
  profiles,
  source: sources.length ? sources.join(" + ") : "cached multi-platform catalogue",
  lastSyncedAt: new Date().toISOString(),
  discoveredThisRun,
  posts,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`Wrote ${posts.length} posts from ${payload.source} to public/posts.json`);
