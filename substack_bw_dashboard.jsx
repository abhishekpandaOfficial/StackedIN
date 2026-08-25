import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, ArrowRight, ArrowUpRight, BarChart3, BookOpen, BrainCircuit, CalendarDays, CheckCircle2,
  ChevronRight, Clock3, ExternalLink, FileText, Filter, Grid2X2, Layers3,
  Globe2, Library, ListFilter, PenTool, RefreshCw, Rss, Search, Share2, ShieldCheck, Sparkles, Upload,
  Users, Workflow, X, Zap,
} from "lucide-react";
import { SiHashnode, SiMedium, SiSubstack } from "@icons-pack/react-simple-icons";
import "./studio.css";

const DATA_URL = `${import.meta.env.BASE_URL}posts.json`;
const METRICS_KEY = "stackcraft-studio-article-metrics-v1";
const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "library", label: "Post library", icon: Library },
  { id: "platforms", label: "Platforms", icon: Share2 },
  { id: "modules", label: "Topic modules", icon: Grid2X2 },
  { id: "series", label: "Series map", icon: Workflow },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
];
const PLATFORMS = [
  { name: "Substack", handle: "pandaabhishek", profile: "https://pandaabhishek.substack.com/", editor: "https://pandaabhishek.substack.com/publish/post", color: "#ff6719", feed: "Automatic public feed" },
  { name: "Medium", handle: "@official.abhishekpanda", profile: "https://medium.com/@official.abhishekpanda", editor: "https://medium.com/new-story", color: "#111111", feed: "Automatic public feed" },
  { name: "Hashnode", handle: "@abhishekpanda", profile: "https://hashnode.com/@abhishekpanda", editor: "https://hashnode.com/draft/new", color: "#2962ff", feed: "Automatic public API" },
  { name: "LinkedIn", handle: "iamabhishekpanda", profile: "https://www.linkedin.com/in/iamabhishekpanda/", editor: "https://www.linkedin.com/article/new/", color: "#0a66c2", feed: "Profile + secure editor handoff" },
];
const PILLAR_TONES = ["violet", "cyan", "lime", "amber", "rose", "blue", "mint", "orange", "indigo", "teal", "slate"];
const compactNumber = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

const safeDate = value => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
const formatDate = value => {
  const date = safeDate(value);
  return date ? new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(date) : "Catalogue entry";
};
const formatSyncTime = value => {
  const date = safeDate(value);
  return date ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date) : "Not synced yet";
};
const slugOf = url => {
  try { return new URL(url).pathname.split("/p/")[1]?.replace(/\/$/, "") || url; }
  catch { return url; }
};
const loadMetrics = () => {
  try { return JSON.parse(localStorage.getItem(METRICS_KEY) || "{}"); }
  catch { return {}; }
};
const groupBy = (items, key) => items.reduce((groups, item) => {
  const value = item[key] || "Unclassified";
  (groups[value] ||= []).push(item);
  return groups;
}, {});
const parseCSV = text => {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') { cell += '"'; i += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(cell.trim()); cell = ""; }
    else if (/\r|\n/.test(char) && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; cell = "";
    } else cell += char;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows[0].map(header => header.toLowerCase().trim().replace(/\s+/g, "_"));
  return rows.slice(1).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
};

function PlatformIcon({ name, size = 15 }) {
  if (name === "Substack") return <SiSubstack size={size} aria-hidden="true" />;
  if (name === "Medium") return <SiMedium size={size} aria-hidden="true" />;
  if (name === "Hashnode") return <SiHashnode size={size} aria-hidden="true" />;
  return <span className="linkedin-glyph" style={{ width: size, height: size, fontSize: size * .72 }} aria-hidden="true">in</span>;
}

function MetricCard({ label, value, note, icon: Icon, accent }) {
  return <article className={`metric-card tone-${accent}`}>
    <div className="metric-card__icon"><Icon size={18} /></div>
    <div className="metric-card__value">{value}</div>
    <div className="metric-card__label">{label}</div>
    <div className="metric-card__note">{note}</div>
  </article>;
}
function SectionHeading({ eyebrow, title, action }) {
  return <div className="section-heading"><div><span>{eyebrow}</span><h2>{title}</h2></div>{action}</div>;
}
function PostRow({ post, tone }) {
  return <article className="post-row">
    <div className={`post-index tone-${tone}`}>{String(post.id).padStart(2, "0")}</div>
    <div className="post-main">
      <div className="post-meta"><span>{post.code || "ARTICLE"}</span><i /><span className={`platform-chip platform-${(post.platform || "Substack").toLowerCase()}`}><PlatformIcon name={post.platform || "Substack"} size={11} />{post.platform || "Substack"}</span><i /><span>{post.series}</span><i /><span>{formatDate(post.publishedAt)}</span></div>
      <h3>{post.title}</h3>
      <p>{post.description}</p>
      <div className="tag-line">{(post.tags || []).slice(0, 4).map(tag => <span key={tag}>{tag}</span>)}</div>
    </div>
    <div className="post-actions">
      <div className="mini-metrics"><span>{compactNumber.format(post.views || 0)} views</span><span>{compactNumber.format(post.shares || 0)} shares</span></div>
      <a href={post.url} target="_blank" rel="noreferrer" aria-label={`Read ${post.title}`}>Read <ArrowUpRight size={15} /></a>
    </div>
  </article>;
}

function MarketingLanding({ openStudio }) {
  const base = import.meta.env.BASE_URL;
  const features = [
    { icon: PenTool, number: "01", title: "Publish with depth", text: "Long-form ideas, technical series, architecture notes, and lessons that deserve more than a disappearing feed." },
    { icon: Layers3, number: "02", title: "Build a knowledge graph", text: "Every post becomes part of a topic, module, and learning path—your expertise finally compounds." },
    { icon: BrainCircuit, number: "03", title: "Be discovered by intent", text: "AI-native discovery connects readers to the right expert, not merely the loudest timeline." },
    { icon: ShieldCheck, number: "04", title: "Own your professional signal", text: "One credible profile shaped by what you know, what you build, and what you teach." },
  ];
  return <div className="stackedin-site">
    <header className="marketing-nav">
      <a className="marketing-brand" href="#top" aria-label="StackedIN home"><img src={`${base}stackedin-wordmark.webp`} alt="StackedIN" /></a>
      <nav aria-label="Marketing navigation"><a href="#why">Why StackedIN</a><a href="#experience">Experience</a><a href="#how">How it works</a></nav>
      <button className="nav-cta" onClick={openStudio}>Open Studio <ArrowUpRight size={15} /></button>
    </header>

    <main id="top">
      <section className="marketing-hero">
        <div className="hero-noise" />
        <div className="hero-copy">
          <span className="launch-pill"><i />The professional knowledge network</span>
          <h1>Your expertise deserves a stage.<br /><span>Not another feed.</span></h1>
          <p>StackedIN is where builders publish deeply, map what they know, and turn every useful idea into professional gravity.</p>
          <div className="hero-actions"><a className="hero-primary" href="#why">Explore StackedIN <ArrowRight size={17} /></a><button className="hero-secondary" onClick={openStudio}>View publishing studio</button></div>
          <div className="hero-proof"><div><strong>45+</strong><span>published ideas</span></div><i /><div><strong>11</strong><span>knowledge domains</span></div><i /><div><strong>4</strong><span>publishing platforms</span></div></div>
        </div>
        <div className="hero-stage" aria-label="Animated StackedIN publishing preview">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <img className="hero-product-icon" src={`${base}stackedin-icon.webp`} alt="StackedIN layered IN logo" />
          <article className="float-card float-card-one"><span>NEW SERIES</span><strong>Multi-Cloud AI Architect</strong><small>Azure · AWS · Google Cloud</small></article>
          <article className="float-card float-card-two"><Globe2 size={16} /><div><strong>Publish once</strong><small>Build authority everywhere</small></div></article>
          <article className="float-card float-card-three"><span>KNOWLEDGE SIGNAL</span><strong>92%</strong><small>Architecture & AI</small></article>
        </div>
        <div className="scroll-cue"><span>Scroll to enter</span><i /></div>
      </section>

      <section className="signal-marquee" aria-label="StackedIN topics"><div>{["AI Architecture", "System Design", "MLOps", "Cloud Native", "Deep Learning", "RAG Systems", "Data Engineering", "Forward Deployed Engineering"].concat(["AI Architecture", "System Design", "MLOps", "Cloud Native", "Deep Learning", "RAG Systems", "Data Engineering", "Forward Deployed Engineering"]).map((item, index) => <span key={`${item}-${index}`}>{item}<i /></span>)}</div></section>

      <section className="manifesto-section" id="why">
        <div className="manifesto-kicker">Why StackedIN</div>
        <div className="manifesto-copy"><h2>The internet has enough noise.<br />We’re building <em>signal.</em></h2><p>Professional identity should be earned through ideas, systems, and real work—not optimized posting rituals. StackedIN turns knowledge into a living portfolio that keeps working long after you hit publish.</p></div>
      </section>

      <section className="feature-grid" id="experience">{features.map(({ icon: Icon, number, title, text }) => <article className="marketing-feature" key={number}><div><span>{number}</span><Icon size={22} /></div><h3>{title}</h3><p>{text}</p><ArrowUpRight className="feature-arrow" size={19} /></article>)}</section>

      <section className="product-story">
        <div className="product-story-copy"><span>Built for people who build</span><h2>Your body of work.<br />Finally, in one orbit.</h2><p>Articles from Substack, Medium, Hashnode, and LinkedIn become one modular, searchable map of your professional thinking.</p><button onClick={openStudio}>See it in action <ArrowRight size={16} /></button></div>
        <div className="story-canvas">
          <div className="story-profile"><img src={`${base}stackedin-icon.webp`} alt="" /><div><strong>Abhishek Panda</strong><span>AI Architect · Builder · Writer</span></div><em>STACKED</em></div>
          <div className="story-columns"><article><span>TOPIC 01</span><strong>AI & Machine Learning</strong><small>18 articles · 4 series</small></article><article><span>TOPIC 02</span><strong>System Architecture</strong><small>12 articles · 3 series</small></article><article><span>TOPIC 03</span><strong>Cloud Engineering</strong><small>15 articles · 5 series</small></article></div>
          <div className="story-track"><i /><i /><i /><i /><i /></div>
        </div>
      </section>

      <section className="how-section" id="how"><div className="how-heading"><span>From thought to authority</span><h2>Stack it. Connect it.<br />Let it compound.</h2></div><div className="how-steps"><article><b>01</b><div><PenTool /><h3>Write where you love</h3><p>Publish through your official Substack, Medium, Hashnode, or LinkedIn editor.</p></div></article><article><b>02</b><div><Zap /><h3>StackedIN organizes</h3><p>Your public work is classified into topics, series, tags, and learning paths.</p></div></article><article><b>03</b><div><Users /><h3>Your signal travels</h3><p>Readers discover the ideas, expertise, and professional story behind the profile.</p></div></article></div></section>

      <section className="closing-cta"><img src={`${base}stackedin-wordmark-mono.webp`} alt="StackedIN" /><h2>Don’t just post.<br /><span>Build a body of work.</span></h2><p>Your knowledge already has value. Give it an architecture.</p><button onClick={openStudio}>Enter StackCraft Studio <ArrowUpRight size={18} /></button></section>
    </main>
    <footer className="marketing-footer"><img src={`${base}stackedin-wordmark.webp`} alt="StackedIN" /><span>Knowledge compounds here.</span><div><a href="https://www.linkedin.com/in/iamabhishekpanda/" target="_blank" rel="noreferrer">LinkedIn</a><a href="https://pandaabhishek.substack.com/" target="_blank" rel="noreferrer">Substack</a><a href="https://hashnode.com/@abhishekpanda" target="_blank" rel="noreferrer">Hashnode</a></div><small>© 2026 StackedIN by StackCraft</small></footer>
  </div>;
}

function Dashboard({ onExit }) {
  const [catalogue, setCatalogue] = useState({ posts: [], source: "", lastSyncedAt: null });
  const [metrics, setMetrics] = useState(loadMetrics);
  const [view, setView] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [pillar, setPillar] = useState("");
  const [series, setSeries] = useState("");
  const [platform, setPlatform] = useState("");
  const [sort, setSort] = useState("index");
  const [toast, setToast] = useState("");
  const [importReport, setImportReport] = useState(null);
  const fileRef = useRef(null);

  const fetchCatalogue = useCallback(async (manual = false) => {
    manual ? setSyncing(true) : setLoading(true);
    setError("");
    try {
      const response = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Catalogue returned ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.posts)) throw new Error("Catalogue format is invalid");
      setCatalogue(data);
      if (manual) setToast("Catalogue refreshed from the latest published snapshot.");
    } catch (fetchError) {
      setError("The catalogue could not be loaded. Please refresh the page in a moment.");
      console.error(fetchError);
    } finally {
      setLoading(false); setSyncing(false);
    }
  }, []);
  useEffect(() => { fetchCatalogue(); }, [fetchCatalogue]);
  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const posts = useMemo(() => catalogue.posts.map(post => ({
    ...post,
    views: Number(metrics[slugOf(post.url)]?.views ?? post.views ?? 0),
    shares: Number(metrics[slugOf(post.url)]?.shares ?? post.shares ?? 0),
  })), [catalogue.posts, metrics]);
  const pillars = useMemo(() => groupBy(posts, "pillar"), [posts]);
  const seriesGroups = useMemo(() => groupBy(posts, "series"), [posts]);
  const pillarNames = useMemo(() => Object.keys(pillars).sort(), [pillars]);
  const seriesNames = useMemo(() => Object.keys(seriesGroups).sort(), [seriesGroups]);
  const platformNames = useMemo(() => [...new Set(posts.map(post => post.platform || "Substack"))].sort(), [posts]);
  const toneFor = name => PILLAR_TONES[Math.max(0, pillarNames.indexOf(name)) % PILLAR_TONES.length];
  const totals = useMemo(() => ({
    published: posts.filter(post => post.status !== "Draft").length,
    views: posts.reduce((sum, post) => sum + (post.views || 0), 0),
    shares: posts.reduce((sum, post) => sum + (post.shares || 0), 0),
  }), [posts]);
  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    return posts.filter(post => {
      const searchable = `${post.title} ${post.description} ${post.pillar} ${post.series} ${post.platform || "Substack"} ${(post.tags || []).join(" ")}`.toLowerCase();
      return (!query || searchable.includes(query)) && (!pillar || post.pillar === pillar) && (!series || post.series === series) && (!platform || (post.platform || "Substack") === platform);
    }).sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "newest") return (safeDate(b.publishedAt)?.getTime() || b.id) - (safeDate(a.publishedAt)?.getTime() || a.id);
      if (sort === "views") return (b.views || 0) - (a.views || 0);
      return a.id - b.id;
    });
  }, [posts, search, pillar, series, platform, sort]);
  const latestPosts = useMemo(() => [...posts].sort((a, b) => {
    const dateDelta = (safeDate(b.publishedAt)?.getTime() || 0) - (safeDate(a.publishedAt)?.getTime() || 0);
    return dateDelta || b.id - a.id;
  }).slice(0, 6), [posts]);
  const openModule = name => { setPillar(name); setSeries(""); setSearch(""); setView("library"); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const openSeries = name => { setSeries(name); setPillar(""); setSearch(""); setView("library"); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const clearFilters = () => { setSearch(""); setPillar(""); setSeries(""); setPlatform(""); setSort("index"); };
  const navTitle = NAV_ITEMS.find(item => item.id === view)?.label || "Overview";

  const importMetrics = event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCSV(String(reader.result || ""));
      let matched = 0;
      const next = { ...metrics };
      rows.forEach(row => {
        const title = (row.title || row.post_title || row.article_title || "").toLowerCase();
        const url = row.url || row.post_url || "";
        const match = posts.find(post => (url && slugOf(url) === slugOf(post.url)) || (title && post.title.toLowerCase().includes(title)));
        if (!match) return;
        next[slugOf(match.url)] = {
          views: Number(String(row.views || row.total_views || row.view_count || 0).replace(/,/g, "")) || 0,
          shares: Number(String(row.shares || row.total_shares || row.share_count || 0).replace(/,/g, "")) || 0,
          importedAt: new Date().toISOString(),
        };
        matched += 1;
      });
      localStorage.setItem(METRICS_KEY, JSON.stringify(next));
      setMetrics(next);
      setImportReport({ file: file.name, rows: rows.length, matched });
      setToast(`${matched} article metrics imported.`);
    };
    reader.readAsText(file);
    event.target.value = "";
  };

  return <div className="studio-shell">
    <aside className="sidebar">
      <button className="studio-brand brand-button" onClick={onExit}><img className="studio-brand__mark" src={`${import.meta.env.BASE_URL}stackcraft-studio-logo.jpg`} alt="StackCraft Studio" /><div><strong>StackCraft Studio</strong><span>Back to StackedIN</span></div></button>
      <nav aria-label="Studio navigation">{NAV_ITEMS.map(item => {
        const Icon = item.icon;
        return <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><Icon size={17} /><span>{item.label}</span>{item.id === "library" && <em>{posts.length}</em>}</button>;
      })}</nav>
      <div className="sidebar-sync"><span className="live-dot" /><div><strong>Auto-discovery active</strong><span>Checks public publishing feeds every 6 hours</span></div></div>
      <a className="sidebar-link" href="https://pandaabhishek.substack.com/" target="_blank" rel="noreferrer">Open main publication <ExternalLink size={14} /></a>
    </aside>
    <main className="studio-main">
      <header className="topbar">
        <div><span>Content intelligence</span><h1>{navTitle}</h1></div>
        <div className="topbar-actions">
          <button className="button secondary" onClick={() => fetchCatalogue(true)} disabled={syncing}><RefreshCw size={15} className={syncing ? "spin" : ""} />{syncing ? "Refreshing" : "Refresh snapshot"}</button>
          <button className="button primary" onClick={() => setView("platforms")}><Sparkles size={15} />Create a post</button>
        </div>
      </header>
      <div className="mobile-nav" aria-label="Mobile navigation">{NAV_ITEMS.map(item => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}>{item.label}</button>)}</div>
      {error && <div className="error-banner"><X size={17} />{error}<button onClick={() => fetchCatalogue()}>Retry</button></div>}
      {loading ? <div className="loading-state"><RefreshCw className="spin" /><p>Building your publishing map…</p></div> : <div className="view-frame">
        {view === "overview" && <>
          <section className="intro-row">
            <div><span className="eyebrow">The signal behind the writing</span><h2>Your ideas, mapped like a living system.</h2><p>Published work across Substack, Medium, Hashnode, and LinkedIn is organised into platforms, pillars, and series—ready to search, audit, and extend.</p></div>
            <div className="sync-card"><div><Rss size={19} /><span>Catalogue health</span></div><strong>All systems current</strong><p>Last snapshot: {formatSyncTime(catalogue.lastSyncedAt)}</p><small>Source: {catalogue.source || "Substack catalogue"}</small></div>
          </section>
          <section className="metric-grid">
            <MetricCard label="Published posts" value={totals.published} note="Live content library" icon={FileText} accent="violet" />
            <MetricCard label="Publishing platforms" value={PLATFORMS.length} note="One secure writing launchpad" icon={Share2} accent="rose" />
            <MetricCard label="Topic pillars" value={pillarNames.length} note="Modular knowledge domains" icon={Layers3} accent="cyan" />
            <MetricCard label="Structured series" value={seriesNames.length} note="Curricula and deep dives" icon={Workflow} accent="lime" />
          </section>
          <section className="overview-grid">
            <div className="panel">
              <SectionHeading eyebrow="Coverage" title="Content architecture" action={<button className="text-button" onClick={() => setView("modules")}>Explore modules <ChevronRight size={15} /></button>} />
              <div className="pillar-bars">{Object.entries(pillars).sort((a, b) => b[1].length - a[1].length).map(([name, items]) => <button key={name} onClick={() => openModule(name)}><span className={`pillar-swatch tone-${toneFor(name)}`} /><div><strong>{name}</strong><span>{new Set(items.map(item => item.series)).size} series</span></div><div className="bar"><i className={`tone-${toneFor(name)}`} style={{ width: `${(items.length / posts.length) * 100}%` }} /></div><em>{items.length}</em></button>)}</div>
            </div>
            <div className="panel latest-panel">
              <SectionHeading eyebrow="Momentum" title="Recently added" action={<button className="text-button" onClick={() => setView("library")}>View all <ChevronRight size={15} /></button>} />
              <div className="latest-list">{latestPosts.map(post => <a href={post.url} target="_blank" rel="noreferrer" key={post.url}><span className={`tone-${toneFor(post.pillar)}`}>{post.code || "NEW"}</span><div><strong>{post.title}</strong><small>{post.pillar} · {formatDate(post.publishedAt)}</small></div><ArrowUpRight size={15} /></a>)}</div>
            </div>
          </section>
        </>}
        {view === "platforms" && <>
          <SectionHeading eyebrow="Publishing launchpad" title="Write securely on every platform" />
          <div className="security-note"><CheckCircle2 size={18} /><div><strong>Your passwords never touch StackCraft Studio.</strong><span>Each Write button opens the official platform. If you are signed out, that platform handles verification before opening its editor.</span></div></div>
          <section className="platform-grid">{PLATFORMS.map(item => {
            const count = posts.filter(post => (post.platform || "Substack") === item.name).length;
            return <article className="platform-card" key={item.name} style={{ "--platform-color": item.color }}>
              <div className="platform-card__head"><div className="platform-logo"><PlatformIcon name={item.name} size={25} /></div><span className="verified-chip"><CheckCircle2 size={12} />Official handoff</span></div>
              <h3>{item.name}</h3><a className="platform-handle" href={item.profile} target="_blank" rel="noreferrer">{item.handle}<ExternalLink size={12} /></a>
              <div className="platform-stats"><div><strong>{count}</strong><span>tracked posts</span></div><div><strong>{item.name === "LinkedIn" ? "Secure" : "6 hr"}</strong><span>{item.feed}</span></div></div>
              <div className="platform-actions"><a className="button primary" href={item.editor} target="_blank" rel="noreferrer"><PlatformIcon name={item.name} size={15} />Write on {item.name}</a><a className="button secondary" href={item.profile} target="_blank" rel="noreferrer">View profile</a></div>
            </article>;
          })}</section>
          <div className="panel platform-help"><SectionHeading eyebrow="How it works" title="One dashboard, provider-managed security" /><p>StackCraft Studio indexes public articles and opens official editors. It does not impersonate you, store credentials, or publish without your confirmation. LinkedIn does not provide a public author feed for this static dashboard, so LinkedIn publishing and article history stay inside LinkedIn.</p></div>
        </>}
        {view === "library" && <section className="panel library-panel">
          <SectionHeading eyebrow="Master catalogue" title={`${filtered.length} of ${posts.length} articles`} action={<button className="text-button" onClick={clearFilters}>Clear filters <X size={14} /></button>} />
          <div className="filterbar">
            <label className="searchbox"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search title, topic, tag…" /></label>
            <label><Filter size={14} /><select value={pillar} onChange={event => setPillar(event.target.value)}><option value="">All pillars</option>{pillarNames.map(name => <option key={name}>{name}</option>)}</select></label>
            <label><ListFilter size={14} /><select value={series} onChange={event => setSeries(event.target.value)}><option value="">All series</option>{seriesNames.map(name => <option key={name}>{name}</option>)}</select></label>
            <label><Share2 size={14} /><select value={platform} onChange={event => setPlatform(event.target.value)}><option value="">All platforms</option>{platformNames.map(name => <option key={name}>{name}</option>)}</select></label>
            <select aria-label="Sort posts" value={sort} onChange={event => setSort(event.target.value)}><option value="index">Series order</option><option value="newest">Newest first</option><option value="title">Title A–Z</option><option value="views">Most viewed</option></select>
          </div>
          <div className="post-list">{filtered.map(post => <PostRow key={post.url} post={post} tone={toneFor(post.pillar)} />)}{!filtered.length && <div className="empty-state"><BookOpen /><h3>No matching articles</h3><p>Try removing a filter or using a broader search.</p></div>}</div>
        </section>}
        {view === "modules" && <>
          <SectionHeading eyebrow="Knowledge domains" title={`${pillarNames.length} modular content pillars`} />
          <section className="module-grid">{Object.entries(pillars).sort((a, b) => b[1].length - a[1].length).map(([name, items]) => {
            const moduleSeries = [...new Set(items.map(item => item.series))];
            const tags = [...new Set(items.flatMap(item => item.tags || []))].slice(0, 5);
            return <button className="module-card" key={name} onClick={() => openModule(name)}><div className={`module-card__mark tone-${toneFor(name)}`}><Layers3 /></div><div className="module-card__count">{items.length}<span>articles</span></div><h3>{name}</h3><p>{moduleSeries.length} connected series building one coherent knowledge domain.</p><div className="tag-line">{tags.map(tag => <span key={tag}>{tag}</span>)}</div><footer><span>{moduleSeries.join(" · ")}</span><ChevronRight size={17} /></footer></button>;
          })}</section>
        </>}
        {view === "series" && <section className="panel series-panel">
          <SectionHeading eyebrow="Learning paths" title={`${seriesNames.length} structured series`} />
          <div className="series-list">{Object.entries(seriesGroups).sort((a, b) => b[1].length - a[1].length).map(([name, items], index) => <button key={name} onClick={() => openSeries(name)}><div className="series-rank">{String(index + 1).padStart(2, "0")}</div><div className="series-body"><span>{items[0]?.pillar}</span><h3>{name}</h3><p>{items.map(item => item.code).filter(Boolean).slice(0, 6).join(" · ")}{items.length > 6 ? ` · +${items.length - 6}` : ""}</p></div><div className="series-count"><strong>{items.length}</strong><span>posts</span></div><ChevronRight size={18} /></button>)}</div>
        </section>}
        {view === "analytics" && <>
          <section className="metric-grid analytics-metrics">
            <MetricCard label="Article views" value={compactNumber.format(totals.views)} note="From your imported platform CSV" icon={BarChart3} accent="violet" />
            <MetricCard label="Shares" value={compactNumber.format(totals.shares)} note="From your imported platform CSV" icon={Share2} accent="cyan" />
            <MetricCard label="Measured posts" value={posts.filter(post => post.views || post.shares).length} note={`Out of ${posts.length} published posts`} icon={CheckCircle2} accent="lime" />
            <MetricCard label="Last content sync" value={formatDate(catalogue.lastSyncedAt)} note="Public catalogue freshness" icon={Clock3} accent="amber" />
          </section>
          <section className="analytics-grid">
            <div className="panel import-panel">
              <SectionHeading eyebrow="Private performance" title="Import platform analytics" />
              <p>Platforms do not expose private view and share counts in public feeds. Export your analytics as CSV and import it here; the data stays only in this browser.</p>
              <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={importMetrics} />
              <button className="upload-zone" onClick={() => fileRef.current?.click()}><Upload size={22} /><strong>Choose analytics CSV</strong><span>Recommended columns: title, views, shares, url</span></button>
              {importReport && <div className="import-result"><CheckCircle2 size={18} /><div><strong>{importReport.matched} posts updated</strong><span>{importReport.file} · {importReport.rows} rows processed</span></div></div>}
            </div>
            <div className="panel performance-panel">
              <SectionHeading eyebrow="Top performance" title="Most-viewed articles" />
              {[...posts].sort((a, b) => b.views - a.views).slice(0, 8).map((post, index) => <div className="performance-row" key={post.url}><span>{index + 1}</span><div><strong>{post.title}</strong><i><b style={{ width: `${totals.views ? (post.views / Math.max(...posts.map(item => item.views), 1)) * 100 : 0}%` }} /></i></div><em>{compactNumber.format(post.views)}</em></div>)}
            </div>
          </section>
        </>}
      </div>}
      <footer className="site-footer"><span>StackCraft Studio · Built for deliberate multi-platform publishing</span><span><CalendarDays size={13} /> Auto-sync every 6 hours</span></footer>
    </main>
    {toast && <div className="toast"><CheckCircle2 size={16} />{toast}</div>}
  </div>;
}

export default function App() {
  const [studioOpen, setStudioOpen] = useState(() => window.location.hash === "#studio");
  useEffect(() => {
    const onHashChange = () => setStudioOpen(window.location.hash === "#studio");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  const openStudio = () => { window.location.hash = "studio"; window.scrollTo({ top: 0, behavior: "instant" }); };
  const closeStudio = () => { history.pushState(null, "", window.location.pathname + window.location.search); setStudioOpen(false); window.scrollTo({ top: 0, behavior: "instant" }); };
  return studioOpen ? <Dashboard onExit={closeStudio} /> : <MarketingLanding openStudio={openStudio} />;
}
