import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, ArrowUpRight, BarChart3, BookOpen, CalendarDays, CheckCircle2,
  ChevronRight, Clock3, ExternalLink, FileText, Filter, Grid2X2, Layers3,
  Library, ListFilter, RefreshCw, Rss, Search, Share2, Sparkles, Upload,
  Workflow, X,
} from "lucide-react";
import "./studio.css";

const DATA_URL = `${import.meta.env.BASE_URL}posts.json`;
const METRICS_KEY = "abhishek-studio-article-metrics-v1";
const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "library", label: "Post library", icon: Library },
  { id: "modules", label: "Topic modules", icon: Grid2X2 },
  { id: "series", label: "Series map", icon: Workflow },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
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
      <div className="post-meta"><span>{post.code || "ARTICLE"}</span><i /><span>{post.series}</span><i /><span>{formatDate(post.publishedAt)}</span></div>
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

export default function Dashboard() {
  const [catalogue, setCatalogue] = useState({ posts: [], source: "", lastSyncedAt: null });
  const [metrics, setMetrics] = useState(loadMetrics);
  const [view, setView] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [pillar, setPillar] = useState("");
  const [series, setSeries] = useState("");
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
  const toneFor = name => PILLAR_TONES[Math.max(0, pillarNames.indexOf(name)) % PILLAR_TONES.length];
  const totals = useMemo(() => ({
    published: posts.filter(post => post.status !== "Draft").length,
    views: posts.reduce((sum, post) => sum + (post.views || 0), 0),
    shares: posts.reduce((sum, post) => sum + (post.shares || 0), 0),
  }), [posts]);
  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    return posts.filter(post => {
      const searchable = `${post.title} ${post.description} ${post.pillar} ${post.series} ${(post.tags || []).join(" ")}`.toLowerCase();
      return (!query || searchable.includes(query)) && (!pillar || post.pillar === pillar) && (!series || post.series === series);
    }).sort((a, b) => {
      if (sort === "title") return a.title.localeCompare(b.title);
      if (sort === "newest") return (safeDate(b.publishedAt)?.getTime() || b.id) - (safeDate(a.publishedAt)?.getTime() || a.id);
      if (sort === "views") return (b.views || 0) - (a.views || 0);
      return a.id - b.id;
    });
  }, [posts, search, pillar, series, sort]);
  const latestPosts = useMemo(() => [...posts].sort((a, b) => {
    const dateDelta = (safeDate(b.publishedAt)?.getTime() || 0) - (safeDate(a.publishedAt)?.getTime() || 0);
    return dateDelta || b.id - a.id;
  }).slice(0, 6), [posts]);
  const openModule = name => { setPillar(name); setSeries(""); setSearch(""); setView("library"); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const openSeries = name => { setSeries(name); setPillar(""); setSearch(""); setView("library"); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const clearFilters = () => { setSearch(""); setPillar(""); setSeries(""); setSort("index"); };
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
      <div className="studio-brand"><div className="studio-brand__mark">AP</div><div><strong>Abhishek Studio</strong><span>Knowledge publishing OS</span></div></div>
      <nav aria-label="Studio navigation">{NAV_ITEMS.map(item => {
        const Icon = item.icon;
        return <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}><Icon size={17} /><span>{item.label}</span>{item.id === "library" && <em>{posts.length}</em>}</button>;
      })}</nav>
      <div className="sidebar-sync"><span className="live-dot" /><div><strong>Auto-discovery active</strong><span>Checks Substack every 6 hours</span></div></div>
      <a className="sidebar-link" href="https://pandaabhishek.substack.com/" target="_blank" rel="noreferrer">Open publication <ExternalLink size={14} /></a>
    </aside>
    <main className="studio-main">
      <header className="topbar">
        <div><span>Content intelligence</span><h1>{navTitle}</h1></div>
        <div className="topbar-actions">
          <button className="button secondary" onClick={() => fetchCatalogue(true)} disabled={syncing}><RefreshCw size={15} className={syncing ? "spin" : ""} />{syncing ? "Refreshing" : "Refresh snapshot"}</button>
          <a className="button primary" href="https://pandaabhishek.substack.com/publish/post" target="_blank" rel="noreferrer"><Sparkles size={15} />Write on Substack</a>
        </div>
      </header>
      <div className="mobile-nav" aria-label="Mobile navigation">{NAV_ITEMS.map(item => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}>{item.label}</button>)}</div>
      {error && <div className="error-banner"><X size={17} />{error}<button onClick={() => fetchCatalogue()}>Retry</button></div>}
      {loading ? <div className="loading-state"><RefreshCw className="spin" /><p>Building your publishing map…</p></div> : <div className="view-frame">
        {view === "overview" && <>
          <section className="intro-row">
            <div><span className="eyebrow">The signal behind the writing</span><h2>Your ideas, mapped like a living system.</h2><p>Every published Substack post is organised into pillars and series, ready to search, audit, and extend.</p></div>
            <div className="sync-card"><div><Rss size={19} /><span>Catalogue health</span></div><strong>All systems current</strong><p>Last snapshot: {formatSyncTime(catalogue.lastSyncedAt)}</p><small>Source: {catalogue.source || "Substack catalogue"}</small></div>
          </section>
          <section className="metric-grid">
            <MetricCard label="Published posts" value={totals.published} note="Live content library" icon={FileText} accent="violet" />
            <MetricCard label="Topic pillars" value={pillarNames.length} note="Modular knowledge domains" icon={Layers3} accent="cyan" />
            <MetricCard label="Structured series" value={seriesNames.length} note="Curricula and deep dives" icon={Workflow} accent="lime" />
            <MetricCard label="Imported views" value={compactNumber.format(totals.views)} note="Private analytics on this device" icon={BarChart3} accent="amber" />
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
        {view === "library" && <section className="panel library-panel">
          <SectionHeading eyebrow="Master catalogue" title={`${filtered.length} of ${posts.length} articles`} action={<button className="text-button" onClick={clearFilters}>Clear filters <X size={14} /></button>} />
          <div className="filterbar">
            <label className="searchbox"><Search size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search title, topic, tag…" /></label>
            <label><Filter size={14} /><select value={pillar} onChange={event => setPillar(event.target.value)}><option value="">All pillars</option>{pillarNames.map(name => <option key={name}>{name}</option>)}</select></label>
            <label><ListFilter size={14} /><select value={series} onChange={event => setSeries(event.target.value)}><option value="">All series</option>{seriesNames.map(name => <option key={name}>{name}</option>)}</select></label>
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
            <MetricCard label="Article views" value={compactNumber.format(totals.views)} note="From your imported Substack CSV" icon={BarChart3} accent="violet" />
            <MetricCard label="Shares" value={compactNumber.format(totals.shares)} note="From your imported Substack CSV" icon={Share2} accent="cyan" />
            <MetricCard label="Measured posts" value={posts.filter(post => post.views || post.shares).length} note={`Out of ${posts.length} published posts`} icon={CheckCircle2} accent="lime" />
            <MetricCard label="Last content sync" value={formatDate(catalogue.lastSyncedAt)} note="Public catalogue freshness" icon={Clock3} accent="amber" />
          </section>
          <section className="analytics-grid">
            <div className="panel import-panel">
              <SectionHeading eyebrow="Private performance" title="Import Substack analytics" />
              <p>Substack does not expose private view and share counts publicly. Export your analytics as CSV and import it here; the data stays only in this browser.</p>
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
      <footer className="site-footer"><span>Abhishek Studio · Built for deliberate technical publishing</span><span><CalendarDays size={13} /> Auto-sync every 6 hours</span></footer>
    </main>
    {toast && <div className="toast"><CheckCircle2 size={16} />{toast}</div>}
  </div>;
}
