import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  BookOpen,
  Bookmark,
  BrainCircuit,
  CalendarDays,
  CheckCircle2,
  Award,
  Building2,
  Camera,
  Check,
  ChevronRight,
  Clock3,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Flag,
  GraduationCap,
  Grid2X2,
  Heart,
  Home,
  KeyRound,
  Layers3,
  Link2,
  BriefcaseBusiness,
  Globe2,
  Library,
  ListFilter,
  LockKeyhole,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  PenTool,
  RefreshCw,
  Repeat2,
  Rss,
  Search,
  Send,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  ThumbsUp,
  Upload,
  BellRing,
  Plus,
  Trash2,
  UserMinus,
  UserRound,
  Users,
  Workflow,
  X,
  Zap
} from "lucide-react";
import { SiGithub, SiGitlab, SiGoogle, SiHashnode, SiMedium, SiSubstack } from "@icons-pack/react-simple-icons";
import { getAppRedirectUrl, supabase, supabasePublicConfig } from "./supabase.js";
import { loadTenantContext } from "./tenant.js";
import { ProfessionalGraphService } from "./src/services/professionalGraph.ts";
import { ProfileSearchService } from "./src/services/profileSearch.ts";
import { NativePublishingService } from "./src/services/nativePublishing.ts";
import { ProfileHubService } from "./src/services/profileHub.ts";
import { ContentBlocks, RichBlockEditor } from "./src/components/RichBlockEditor.jsx";
import XStudioEditor from "./src/components/XStudioEditor.jsx";
import FeedComposer from "./src/components/FeedComposer.jsx";
import AIScoreDialog from "./src/components/AIScoreDialog.jsx";
import { scoreWritingSignals } from "./src/domain/writingSignals.js";
import "./studio.css";
const DATA_URL = `${import.meta.env.BASE_URL}posts.json`;
const METRICS_KEY = "stackcraft-studio-article-metrics-v1";
const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "cms", label: "Content CMS", icon: PenTool },
  { id: "calendar", label: "Content calendar", icon: CalendarDays },
  { id: "distribution", label: "Distribution queue", icon: Send },
  { id: "library", label: "Post library", icon: Library },
  { id: "platforms", label: "Platforms", icon: Share2 },
  { id: "modules", label: "Topic modules", icon: Grid2X2 },
  { id: "series", label: "Series map", icon: Workflow }
];
const PLATFORMS = [
  { name: "Substack", handle: "pandaabhishek", profile: "https://pandaabhishek.substack.com/", editor: "https://pandaabhishek.substack.com/publish/post", color: "#ff6719", feed: "Automatic public feed" },
  { name: "Medium", handle: "@official.abhishekpanda", profile: "https://medium.com/@official.abhishekpanda", editor: "https://medium.com/new-story", color: "#111111", feed: "Automatic public feed" },
  { name: "Hashnode", handle: "@abhishekpanda", profile: "https://hashnode.com/@abhishekpanda", editor: "https://hashnode.com/draft/new", color: "#2962ff", feed: "Automatic public API" },
  { name: "LinkedIn", handle: "iamabhishekpanda", profile: "https://www.linkedin.com/in/iamabhishekpanda/", editor: "https://www.linkedin.com/article/new/", color: "#0a66c2", feed: "Profile + secure editor handoff" }
];
const PILLAR_TONES = ["violet", "cyan", "lime", "amber", "rose", "blue", "mint", "orange", "indigo", "teal", "slate"];
const compactNumber = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const professionalGraph = new ProfessionalGraphService(supabase);
const profileSearch = new ProfileSearchService(supabase);
const nativePublishing = new NativePublishingService(supabase);
const profileHub = new ProfileHubService(supabase);
const safeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};
const formatDate = (value) => {
  const date = safeDate(value);
  return date ? new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(date) : "Catalogue entry";
};
const formatSyncTime = (value) => {
  const date = safeDate(value);
  return date ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(date) : "Not synced yet";
};
const formatMessageTime = (value) => {
  const date = safeDate(value);
  if (!date) return "";
  const sameDay = date.toDateString() === (/* @__PURE__ */ new Date()).toDateString();
  return new Intl.DateTimeFormat("en", sameDay ? { hour: "numeric", minute: "2-digit" } : { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
};
const isSafeExternalUrl = (value) => typeof value === "string" && /^https:\/\//i.test(value);
const slugOf = (url) => {
  try {
    return new URL(url).pathname.split("/p/")[1]?.replace(/\/$/, "") || url;
  } catch {
    return url;
  }
};
const loadMetrics = () => {
  try {
    return JSON.parse(localStorage.getItem(METRICS_KEY) || "{}");
  } catch {
    return {};
  }
};
const groupBy = (items, key) => items.reduce((groups, item) => {
  const value = item[key] || "Unclassified";
  (groups[value] ||= []).push(item);
  return groups;
}, {});
const parseCSV = (text) => {
  const rows = [];
  let row = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if (/\r|\n/.test(char) && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => header.toLowerCase().trim().replace(/\s+/g, "_"));
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
};
function PlatformIcon({ name, size = 15 }) {
  if (name === "Substack") return <SiSubstack size={size} aria-hidden="true" />;
  if (name === "Medium") return <SiMedium size={size} aria-hidden="true" />;
  if (name === "Hashnode") return <SiHashnode size={size} aria-hidden="true" />;
  return <span className="linkedin-glyph" style={{ width: size, height: size, fontSize: size * 0.72 }} aria-hidden="true">in</span>;
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
      <div className="tag-line">{(post.tags || []).slice(0, 4).map((tag) => <span key={tag}>{tag}</span>)}</div>
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
    { icon: Layers3, number: "02", title: "Build a knowledge graph", text: "Every post becomes part of a topic, module, and learning path\u2014your expertise finally compounds." },
    { icon: BrainCircuit, number: "03", title: "Be discovered by intent", text: "AI-native discovery connects readers to the right expert, not merely the loudest timeline." },
    { icon: ShieldCheck, number: "04", title: "Own your professional signal", text: "One credible profile shaped by what you know, what you build, and what you teach." }
  ];
  return <div className="stackedin-site">
    <header className="marketing-nav">
      <a className="marketing-brand" href="#top" aria-label="StackedIN home"><img src={`${base}stackedin-wordmark.webp`} alt="StackedIN" /></a>
      <nav aria-label="Marketing navigation"><a href="#why">Why StackedIN</a><a href="#experience">Experience</a><a href="#how">How it works</a></nav>
      <button className="nav-cta" onClick={openStudio}>Open XStudio <ArrowUpRight size={15} /></button>
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

      <section className="closing-cta"><img src={`${base}stackedin-wordmark-mono.webp`} alt="StackedIN" /><h2>Don’t just post.<br /><span>Build a body of work.</span></h2><p>Your knowledge already has value. Give it an architecture.</p><button onClick={openStudio}>Enter XStudio <ArrowUpRight size={18} /></button></section>
    </main>
    <footer className="marketing-footer"><img src={`${base}stackedin-wordmark.webp`} alt="StackedIN" /><span>Knowledge compounds here.</span><div><a href="https://www.linkedin.com/in/iamabhishekpanda/" target="_blank" rel="noreferrer">LinkedIn</a><a href="https://pandaabhishek.substack.com/" target="_blank" rel="noreferrer">Substack</a><a href="https://hashnode.com/@abhishekpanda" target="_blank" rel="noreferrer">Hashnode</a></div><small>© 2026 StackedIN by StackCraft</small></footer>
  </div>;
}
function AuthView({ onBack }) {
  const [mode, setMode] = useState("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [providers, setProviders] = useState({ google: null, github: null });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const redirectTo = getAppRedirectUrl();
  useEffect(() => {
    fetch(`${supabasePublicConfig.url}/auth/v1/settings`, { headers: { apikey: supabasePublicConfig.anonKey } }).then((response) => response.json()).then((settings) => setProviders({ google: Boolean(settings.external?.google), github: Boolean(settings.external?.github) })).catch(() => setProviders({ google: null, github: null }));
  }, []);
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (password.length < 8) throw new Error("Use at least 8 characters for your password.");
      if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name.trim() }, emailRedirectTo: redirectTo } });
        if (authError) throw authError;
        if (!data.session) setMessage("Check your inbox to confirm your email, then return here to sign in.");
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
      }
    } catch (authError) {
      setError(authError.message || "Authentication could not be completed.");
    } finally {
      setBusy(false);
    }
  };
  const oauth = async (provider) => {
    setBusy(true);
    setError("");
    const { error: authError } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
    if (authError) {
      setError(authError.message);
      setBusy(false);
    }
  };
  const resetPassword = async () => {
    if (!email) {
      setError("Enter your email first, then choose reset password.");
      return;
    }
    setBusy(true);
    setError("");
    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    authError ? setError(authError.message) : setMessage("Password reset instructions are on the way.");
    setBusy(false);
  };
  return <div className="auth-page">
    <button className="auth-back" onClick={onBack}><ArrowLeft size={16} />Back to StackedIN</button>
    <section className="auth-brand-panel"><div className="auth-orbit" /><img src={`${import.meta.env.BASE_URL}stackedin-icon.webp`} alt="StackedIN" /><span>Knowledge becomes identity</span><h1>Build a professional signal that compounds.</h1><p>Publish deeply. Connect your ideas. Let the right people discover what you actually know.</p><div className="auth-trust"><ShieldCheck size={18} /><div><strong>Secure by Supabase</strong><small>Encrypted sessions · Provider-managed OAuth · No passwords stored by StackedIN</small></div></div></section>
    <section className="auth-form-panel"><div className="auth-form-wrap"><img src={`${import.meta.env.BASE_URL}stackedin-wordmark.webp`} alt="StackedIN" /><span className="auth-eyebrow">{mode === "signin" ? "Welcome back" : "Create your professional knowledge profile"}</span><h2>{mode === "signin" ? "Sign in to your feed" : "Join StackedIN"}</h2><p>{mode === "signin" ? "Your ideas are waiting where you left them." : "Start turning your work into a living body of knowledge."}</p>
      <div className="oauth-grid"><button disabled={busy || providers.google === false} onClick={() => oauth("google")}><SiGoogle size={16} /><span>Continue with Google{providers.google === false && <small>Setup required</small>}</span></button><button disabled={busy || providers.github === false} onClick={() => oauth("github")}><SiGithub size={17} /><span>Continue with GitHub{providers.github === false && <small>Setup required</small>}</span></button></div>
      {(providers.google === false || providers.github === false) && <div className="provider-note"><ShieldCheck size={14} />Email registration is live. Social login activates when its provider is enabled in Supabase.</div>}
      <div className="auth-divider"><span>or continue with email</span></div>
      <form onSubmit={submit}>{mode === "signup" && <label><span>Full name</span><div><UserRound size={16} /><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Your professional name" autoComplete="name" /></div></label>}<label><span>Email address</span><div><Mail size={16} /><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" autoComplete="email" /></div></label><label><span>Password</span><div><KeyRound size={16} /><input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" autoComplete={mode === "signin" ? "current-password" : "new-password"} /></div></label>{mode === "signin" && <button type="button" className="forgot-link" onClick={resetPassword}>Forgot password?</button>}{error && <div className="auth-alert error"><X size={15} />{error}</div>}{message && <div className="auth-alert success"><CheckCircle2 size={15} />{message}</div>}<button className="auth-submit" disabled={busy}>{busy ? <RefreshCw className="spin" size={16} /> : <LockKeyhole size={16} />}{mode === "signin" ? "Sign in securely" : "Create account"}</button></form>
      <div className="auth-switch">{mode === "signin" ? "New to StackedIN?" : "Already have an account?"}<button onClick={() => {
    setMode(mode === "signin" ? "signup" : "signin");
    setError("");
    setMessage("");
  }}>{mode === "signin" ? "Create an account" : "Sign in"}</button></div><small className="auth-legal">By continuing, you agree to build useful things and avoid adding more internet noise. The serious legal copy can arrive before commercial launch.</small>
    </div></section>
  </div>;
}
function FeedCard({ post, liked, saved, onLike, onSave, onShare }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);
  const score = scoreWritingSignals(`${post.title || ""} ${post.description || ""}`);
  return <article className="feed-card">
    <header><img src={`${import.meta.env.BASE_URL}stackedin-icon.webp`} alt="" /><div><strong>Abhishek Panda <CheckCircle2 size={13} /></strong><span>AI Architect · .NET · Multi-Cloud · FDE Mindset</span><small>{formatDate(post.publishedAt)} · <Globe2 size={11} /></small></div><div className="post-menu-wrap"><button aria-label="More options" onClick={() => setMenuOpen(value => !value)}><MoreHorizontal size={18} /></button>{menuOpen && <div className="post-action-menu"><button onClick={() => { setScoreOpen(true); setMenuOpen(false); }}><BrainCircuit size={17} />AI writing signal</button><button onClick={onSave}><Bookmark size={17} />{saved ? "Unsave post" : "Save post"}</button></div>}</div></header>
    <div className="feed-copy"><p>{post.description}</p><div className="feed-tags">{(post.tags || []).slice(0, 4).map((tag) => <span key={tag}>#{tag.replace(/\s+/g, "")}</span>)}</div></div>
    <div className={`feed-article-cover feed-cover-${(post.pillar || "architecture").length % 5}`}><span><PlatformIcon name={post.platform || "Substack"} size={14} />{post.platform || "Substack"} reference</span><small>{post.pillar}</small><h2>{post.title}</h2><p>{post.series}</p><div>External knowledge reference · connect this source in Studio</div></div>
    <div className="feed-engagement"><span><Eye size={13} />{compactNumber.format(post.views || 0)} views</span><span>{compactNumber.format(post.shares || 0)} shares</span></div>
    <footer><button className={liked ? "active" : ""} onClick={onLike}><Heart size={17} fill={liked ? "currentColor" : "none"} />Like</button><button onClick={onShare}><MessageCircle size={17} />Discuss</button><button onClick={onShare}><Share2 size={17} />Share</button><button className={saved ? "active" : ""} onClick={onSave}><Bookmark size={17} fill={saved ? "currentColor" : "none"} />Save</button></footer>{scoreOpen && <AIScoreDialog score={score} onClose={() => setScoreOpen(false)} />}
  </article>;
}
const REACTIONS = [
  { id: "LIKE", emoji: "\u{1F44D}", label: "Like" },
  { id: "LOVE", emoji: "\u2764\uFE0F", label: "Love" },
  { id: "CELEBRATE", emoji: "\u{1F389}", label: "Celebrate" },
  { id: "INSIGHTFUL", emoji: "\u{1F4A1}", label: "Insightful" },
  { id: "SUPPORT", emoji: "\u{1F64C}", label: "Support" },
  { id: "CURIOUS", emoji: "\u{1F914}", label: "Curious" }
];
function NativeFeedCard({ article, tenantContext, onRefresh, onNetworkRefresh, onOpenProfile, onToast }) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [restackOpen, setRestackOpen] = useState(false);
  const [restackThoughtsOpen, setRestackThoughtsOpen] = useState(false);
  const [restackThoughts, setRestackThoughts] = useState(article.viewerRestackThoughts || "");
  const [scoreOpen, setScoreOpen] = useState(false);
  const [pollBusy, setPollBusy] = useState("");
  const authorName = article.author?.display_name || "StackedIN member";
  const tenantId = tenantContext?.tenant?.id;
  const profileId = tenantContext?.profile?.id;
  const isOwnPost = profileId === article.author_id;
  const writingScore = article.writingScore || scoreWritingSignals(`${article.title || ""} ${article.description || ""} ${(article.content_blocks || []).map(block => block.text || block.code || block.caption || block.label || "").join(" ")}`);
  const articleUrl = () => {
    const url = new URL(import.meta.env.BASE_URL, window.location.origin);
    url.hash = `article-${article.id}`;
    return url;
  };
  const loadComments = async () => {
    setBusy("comments");
    setError("");
    try {
      setComments(await nativePublishing.listComments(article.id));
      setCommentsOpen(true);
    } catch (commentError) {
      setError(commentError.message || "Discussion could not be loaded.");
    } finally {
      setBusy("");
    }
  };
  const toggleDiscussion = () => commentsOpen ? setCommentsOpen(false) : loadComments();
  const react = async (reaction) => {
    setBusy("reaction");
    setError("");
    try {
      await nativePublishing.react(article.id, article.viewerReaction === reaction ? null : reaction);
      await onRefresh();
    } catch (reactionError) {
      setError(reactionError.message || "Reaction could not be saved.");
    } finally {
      setBusy("");
    }
  };
  const addComment = async () => {
    if (!commentText.trim()) return;
    setBusy("comment");
    setError("");
    try {
      await nativePublishing.comment(article.id, commentText);
      setCommentText("");
      setComments(await nativePublishing.listComments(article.id));
      await onRefresh();
    } catch (commentError) {
      setError(commentError.message || "Comment could not be published.");
    } finally {
      setBusy("");
    }
  };
  const share = async (destination) => {
    const url = articleUrl();
    try {
      if (destination === "NATIVE_SHARE" && navigator.share) await navigator.share({ title: article.title, text: article.description, url: url.toString() });
      else if (destination === "LINKEDIN") window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url.toString())}`, "_blank", "noopener,noreferrer");
      else if (destination === "EMAIL") window.location.href = `mailto:?subject=${encodeURIComponent(article.title)}&body=${encodeURIComponent(`${article.description}

${url}`)}`;
      else await navigator.clipboard.writeText(url.toString());
      if (tenantId && profileId) await nativePublishing.recordShare(tenantId, profileId, article.id, destination);
      onToast?.(destination === "COPY_LINK" ? "Article link copied." : "Share recorded.");
      setShareOpen(false);
      await onRefresh();
    } catch (shareError) {
      if (shareError.name !== "AbortError") setError("Share could not be completed.");
    }
  };
  const save = async () => {
    if (!tenantId || !profileId) return;
    setBusy("save");
    setError("");
    try {
      await nativePublishing.setSaved(tenantId, profileId, article.id, !article.viewerSaved);
      onToast?.(article.viewerSaved ? "Removed from saved posts." : "Post saved.");
      await onRefresh();
    } catch (saveError) {
      setError(saveError.message || "Save could not be updated.");
    } finally {
      setBusy("");
    }
  };
  const restack = async (thoughts) => {
    if (!tenantId || !profileId) return;
    setBusy("restack");
    setError("");
    try {
      await nativePublishing.restack(tenantId, profileId, article.id, thoughts);
      setRestackOpen(false);
      setRestackThoughtsOpen(false);
      onToast?.(thoughts?.trim() ? "Restacked with your thoughts." : "Restacked to your network.");
      await onRefresh();
    } catch (restackError) {
      setError(restackError.message || "Restack could not be completed.");
    } finally {
      setBusy("");
    }
  };
  const removeRestack = async () => {
    if (!profileId) return;
    setBusy("restack");
    try {
      await nativePublishing.removeRestack(profileId, article.id);
      setRestackOpen(false);
      onToast?.("Restack removed.");
      await onRefresh();
    } catch (restackError) {
      setError(restackError.message || "Restack could not be removed.");
    } finally {
      setBusy("");
    }
  };
  const authorAction = async (action) => {
    if (!tenantId || !profileId || isOwnPost) return;
    setBusy(action);
    setError("");
    try {
      if (action === "follow") article.viewerFollowingAuthor ? await professionalGraph.unfollow(tenantId, article.author_id) : await professionalGraph.follow(tenantId, article.author_id);
      if (action === "subscribe") await nativePublishing.setSubscribed(tenantId, profileId, article.author_id, !article.viewerSubscribedAuthor);
      if (action === "disconnect") await professionalGraph.removeConnectionWithProfile(tenantId, article.author_id);
      setMenuOpen(false);
      await Promise.all([onRefresh(), onNetworkRefresh?.()]);
    } catch (actionError) {
      setError(actionError.message || "Author action could not be completed.");
    } finally {
      setBusy("");
    }
  };
  const preference = async (value) => {
    if (!tenantId || !profileId) return;
    setBusy("preference");
    try {
      await nativePublishing.setFeedPreference(tenantId, profileId, article.id, value);
      setMenuOpen(false);
      onToast?.(value === "HIDDEN" ? "Post hidden from your feed." : "Your feed preference was recorded.");
      await onRefresh();
    } catch (preferenceError) {
      setError(preferenceError.message || "Feed preference could not be saved.");
    } finally {
      setBusy("");
    }
  };
  const report = async () => {
    if (!tenantId || !profileId) return;
    setBusy("report");
    try {
      await nativePublishing.reportArticle(tenantId, profileId, article.id, "OTHER", "Reported from the feed controls for moderation review.");
      setMenuOpen(false);
      onToast?.("Report submitted for review.");
    } catch (reportError) {
      setError(reportError.message || "Report could not be submitted.");
    } finally {
      setBusy("");
    }
  };
  const votePoll = async optionId => {
    setPollBusy(optionId);
    setError("");
    try { await nativePublishing.votePoll(article.id, optionId); await onRefresh(); }
    catch (pollError) { setError(pollError.message || "Your vote could not be recorded."); }
    finally { setPollBusy(""); }
  };
  return <article className="native-feed-card">
    <header><div className="native-author-avatar" role="button" tabIndex={0} onClick={() => onOpenProfile(article.author_id)} onKeyDown={(event) => {
    if (event.key === "Enter") onOpenProfile(article.author_id);
  }}>{article.author?.avatar_url ? <img src={article.author.avatar_url} alt="" /> : authorName.charAt(0).toUpperCase()}</div><div><strong className="native-author-name" role="button" tabIndex={0} onClick={() => onOpenProfile(article.author_id)} onKeyDown={(event) => {
    if (event.key === "Enter") onOpenProfile(article.author_id);
  }}>{authorName}<CheckCircle2 size={13} /></strong><span>{article.author?.headline || "StackedIN professional"}</span><small>{formatDate(article.published_at)} · {article.reading_minutes} min read · <Globe2 size={10} /></small></div><div className="post-menu-wrap"><button className="post-more" aria-label="Post options" aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}><MoreHorizontal size={19} /></button>{menuOpen && <div className="post-action-menu"><button onClick={save}><Bookmark size={17} />{article.viewerSaved ? "Unsave post" : "Save post"}</button><button onClick={() => { setScoreOpen(true); setMenuOpen(false); }}><BrainCircuit size={17} />AI writing signal</button>{!isOwnPost && <><button onClick={() => authorAction("follow")}><UserRound size={17} />{article.viewerFollowingAuthor ? "Unfollow author" : "Follow author"}</button><button onClick={() => authorAction("subscribe")}><BellRing size={17} />{article.viewerSubscribedAuthor ? "Unsubscribe from posts" : "Subscribe to posts"}</button><button onClick={() => authorAction("disconnect")}><UserMinus size={17} />Disconnect</button></>}<button onClick={() => preference("HIDDEN")}><EyeOff size={17} />Hide post</button><button onClick={() => preference("NOT_INTERESTED")}><ThumbsUp className="thumb-down" size={17} />Not interested</button><button onClick={report}><Flag size={17} />Report post</button></div>}</div></header>
    {article.content_type !== "POST" && <section className="native-article-intro"><h2>{article.title}</h2>{article.description && <p>{article.description}</p>}<div>{(article.hashtags || []).map((tag) => <span key={tag}>#{tag}</span>)}</div></section>}
    {article.cover_image_url && <img className="native-cover" src={article.cover_image_url} alt="" />}
    <ContentBlocks blocks={article.content_blocks || []} />
    {article.content_type === "POST" && <div className="native-post-hashtags">{(article.hashtags || []).map(tag => <span key={tag}>#{tag}</span>)}</div>}
    {article.poll && <section className="native-poll"><header><div><BarChart3 size={16} /><strong>{article.poll.question}</strong></div><span>{new Date(article.poll.ends_at) > new Date() ? `Ends ${formatDate(article.poll.ends_at)}` : "Poll closed"}</span></header><div>{article.poll.options.map(option => { const percent = article.poll.total_votes ? Math.round(option.vote_count / article.poll.total_votes * 100) : 0; const selected = article.poll.viewerOptionId === option.id; return <button className={selected ? "selected" : ""} disabled={Boolean(pollBusy) || new Date(article.poll.ends_at) <= new Date()} key={option.id} onClick={() => votePoll(option.id)}><span><b>{option.label}</b><strong>{percent}%</strong></span><i><em style={{ width: `${percent}%` }} /></i></button>; })}</div><footer>{article.poll.total_votes} vote{article.poll.total_votes === 1 ? "" : "s"}{article.poll.viewerOptionId && <span>Vote recorded · choose another option to change it</span>}</footer></section>}
    {article.source_type !== "USER" && <div className="native-source-note"><Rss size={13} />Imported from {article.source_provider || article.source_type} as an internal knowledge reference.</div>}
    <section className="reaction-summary"><div>{REACTIONS.filter((reaction) => article.reactionSummary?.[reaction.id]).map((reaction) => <span key={reaction.id}>{reaction.emoji}<b>{article.reactionSummary[reaction.id]}</b></span>)}</div><span>{article.reaction_count || 0} reactions · {article.comment_count || 0} comments · {article.restack_count || 0} restacks · {article.share_count || 0} shares</span></section>
    <footer className="native-actions"><div className="reaction-control"><button className={article.viewerReaction ? "active" : ""} disabled={busy === "reaction"} onClick={() => react(article.viewerReaction || "LIKE")}><span>{REACTIONS.find((item) => item.id === article.viewerReaction)?.emoji || <ThumbsUp size={16} />}</span>{REACTIONS.find((item) => item.id === article.viewerReaction)?.label || "React"}</button><div className="reaction-hover-menu">{REACTIONS.map((reaction) => <button key={reaction.id} className={article.viewerReaction === reaction.id ? "active" : ""} onClick={() => react(reaction.id)} title={reaction.label} aria-label={reaction.label}>{reaction.emoji}</button>)}</div></div><button onClick={toggleDiscussion}>{busy === "comments" ? <RefreshCw className="spin" size={16} /> : <MessageCircle size={16} />}Comment</button><div className="action-popover-wrap"><button className={article.viewerRestacked ? "active" : ""} onClick={() => setRestackOpen((value) => !value)}><Repeat2 size={16} />Restack</button>{restackOpen && <div className="action-popover restack-popover">{article.viewerRestacked && <button onClick={removeRestack}><X size={15} />Undo restack</button>}<button onClick={() => restack(null)}><Repeat2 size={15} />Restack instantly</button><button onClick={() => {
    setRestackThoughtsOpen(true);
    setRestackOpen(false);
  }}><PenTool size={15} />Restack with thoughts</button></div>}</div><div className="action-popover-wrap"><button onClick={() => setShareOpen((value) => !value)}><Share2 size={16} />Share</button>{shareOpen && <div className="action-popover share-popover"><button onClick={() => share("COPY_LINK")}><Link2 size={15} />Copy link</button><button onClick={() => share("NATIVE_SHARE")}><Send size={15} />Share from device</button><button onClick={() => share("LINKEDIN")}><span className="linkedin-glyph">in</span>LinkedIn</button><button onClick={() => share("EMAIL")}><Mail size={15} />Email</button></div>}</div><button className={article.viewerSaved ? "active" : ""} onClick={save}><Bookmark size={16} fill={article.viewerSaved ? "currentColor" : "none"} />Save</button></footer>
    {restackThoughtsOpen && <section className="restack-thoughts"><header><Repeat2 size={15} /><strong>Restack with your perspective</strong><button onClick={() => setRestackThoughtsOpen(false)}><X size={14} /></button></header><textarea autoFocus value={restackThoughts} onChange={(event) => setRestackThoughts(event.target.value)} maxLength={1200} placeholder="Why should your network read this? Add context, evidence, or a useful angle…" /><footer><span>{restackThoughts.length}/1200</span><button disabled={!restackThoughts.trim() || busy === "restack"} onClick={() => restack(restackThoughts)}>{busy === "restack" ? <RefreshCw className="spin" size={14} /> : <Repeat2 size={14} />}Restack</button></footer></section>}
    {error && <div className="native-inline-error">{error}</div>}
    {commentsOpen && <section className="native-discussion"><header><div><MessageCircle size={16} /><strong>Professional discussion</strong></div><span>{comments.length} contributions</span></header><form onSubmit={(event) => {
    event.preventDefault();
    addComment();
  }}><div>{tenantContext?.profile?.display_name?.charAt(0).toUpperCase() || "S"}</div><textarea value={commentText} onChange={(event) => setCommentText(event.target.value)} onKeyDown={(event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      addComment();
    }
  }} placeholder="Add a useful perspective… Enter to post · Shift+Enter for a new line" maxLength={4e3} /><button aria-label="Post comment" disabled={busy === "comment" || !commentText.trim()}>{busy === "comment" ? <RefreshCw className="spin" size={14} /> : <Send size={14} />}</button></form><div className="discussion-list">{comments.map((comment) => <article key={comment.id}><div>{comment.author?.avatar_url ? <img src={comment.author.avatar_url} alt="" /> : (comment.author?.display_name || "S").charAt(0).toUpperCase()}</div><section><header><strong>{comment.author?.display_name || "StackedIN member"}</strong><span>{comment.author?.headline || "Professional"} · {formatDate(comment.created_at)}</span></header><p>{comment.body}</p><button>Reply</button></section></article>)}{!comments.length && <p className="discussion-empty">Start the useful conversation. Empty comment sections are just uninitialized knowledge graphs.</p>}</div></section>}
    {scoreOpen && <AIScoreDialog score={writingScore} onClose={() => setScoreOpen(false)} />}
  </article>;
}
function LegacyWriteExperience({ session, openFeed, openProfile }) {
  const [tenantContext, setTenantContext] = useState(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [contentType, setContentType] = useState("ARTICLE");
  const [hashtags, setHashtags] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [blocks, setBlocks] = useState([{ id: crypto.randomUUID(), type: "paragraph", text: "" }]);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    loadTenantContext(session.user.id).then(setTenantContext).catch(() => setError("Your workspace could not be loaded."));
  }, [session.user.id]);
  const save = async (status) => {
    if (!tenantContext?.tenant?.id) return;
    setBusy(status);
    setError("");
    try {
      await nativePublishing.save({ tenantId: tenantContext.tenant.id, title, description, contentType, blocks, hashtags, tags: hashtags.split(/[\s,]+/), coverImageUrl, status });
      openFeed();
    } catch (saveError) {
      setError(saveError.message || "Your article could not be saved.");
    } finally {
      setBusy("");
    }
  };
  const uploadImage = (file) => nativePublishing.uploadImage(session.user.id, file);
  const name = tenantContext?.profile?.display_name || session.user.email?.split("@")[0] || "StackedIN member";
  return <div className="writer-page"><header className="writer-topbar"><button onClick={openFeed}><ArrowLeft size={16} />Feed</button><img src={`${import.meta.env.BASE_URL}stackedin-wordmark.webp`} alt="StackedIN" /><div><button className={preview ? "" : "active"} onClick={() => setPreview(false)}>Edit</button><button className={preview ? "active" : ""} onClick={() => setPreview(true)}>Preview</button><button disabled={Boolean(busy)} onClick={() => save("draft")}>{busy === "draft" ? "Saving\u2026" : "Save draft"}</button><button className="publish" disabled={Boolean(busy)} onClick={() => save("published")}>{busy === "published" ? <RefreshCw className="spin" size={14} /> : <Zap size={14} />}Publish</button></div></header><main className="writer-shell"><aside><span>Native publishing</span><h2>Build signal,<br />not sludge.</h2><p>Your article lives on StackedIN first. External platforms become optional distribution lanes.</p><button onClick={openProfile}><UserRound size={15} />View my profile</button></aside><section className="writer-canvas"><div className="writer-identity"><div>{name.charAt(0).toUpperCase()}</div><span><strong>{name}</strong><small>Publishing to {tenantContext?.tenant?.name || "your workspace"}</small></span><select value={contentType} onChange={(event) => setContentType(event.target.value)}><option value="ARTICLE">Long-form article</option><option value="POST">Professional post</option></select></div>{!preview ? <><input className="writer-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="A title worth someone’s attention" maxLength={240} /><textarea className="writer-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="A concise promise: what will the reader understand or be able to do?" maxLength={1e3} /><div className="writer-meta-fields"><label>Hashtags<input value={hashtags} onChange={(event) => setHashtags(event.target.value)} placeholder="#AgenticAI #Azure #SystemDesign" /></label><label>Cover image URL<input value={coverImageUrl} onChange={(event) => setCoverImageUrl(event.target.value)} placeholder="https://… or upload an image block" /></label></div><RichBlockEditor blocks={blocks} onChange={setBlocks} onUploadImage={uploadImage} /></> : <article className="writer-preview"><span>{contentType}</span><h1>{title || "Untitled draft"}</h1><p>{description}</p>{coverImageUrl && <img src={coverImageUrl} alt="" />}<div className="preview-tags">{hashtags.split(/[\s,]+/).filter(Boolean).map((tag) => <b key={tag}>{tag.startsWith("#") ? tag : `#${tag}`}</b>)}</div><ContentBlocks blocks={blocks} /></article>}{error && <div className="auth-alert error"><X size={15} />{error}</div>}</section></main></div>;
}
void LegacyWriteExperience;
function WriteExperience({ session, openFeed, openProfile, openStudio }) {
  return <XStudioEditor session={session} openFeed={openFeed} openProfile={openProfile} openStudio={openStudio} />;
}
const PROFILE_RECORD_CONFIG = {
  experience: { table: "profile_experiences", title: "Experience", fields: [["title", "Role"], ["company", "Company"], ["employment_type", "Employment type", "employment"], ["location", "Location"], ["start_date", "Start date", "date"], ["currently_working", "I currently work here", "checkbox"], ["end_date", "End date", "date"], ["description", "Description", "textarea"], ["skills", "Skills, comma separated"]] },
  education: { table: "profile_education", title: "Education", fields: [["institution", "Institution"], ["degree", "Degree"], ["field_of_study", "Field of study"], ["start_date", "Start date", "date"], ["end_date", "End date", "date"], ["description", "Description", "textarea"]] },
  project: { table: "profile_projects", title: "Portfolio project", fields: [["title", "Project title"], ["project_url", "Project URL", "url"], ["repository_url", "Repository URL", "url"], ["image_url", "Image URL", "url"], ["description", "Description", "textarea"], ["skills", "Skills, comma separated"]] },
  achievement: { table: "profile_achievements", title: "Achievement", fields: [["title", "Achievement"], ["issuer", "Issuer"], ["issued_on", "Issued on", "date"], ["credential_url", "Credential URL", "url"], ["description", "Description", "textarea"]] },
  link: { table: "profile_links", title: "Professional link", fields: [["label", "Label"], ["url", "HTTPS URL", "url"], ["link_type", "Type", "link-type"]] }
};
function ProfileRecordEditor({ type, record, onSave, onCancel, busy }) {
  const config = PROFILE_RECORD_CONFIG[type];
  const [draft, setDraft] = useState(() => ({ ...record, skills: Array.isArray(record?.skills) ? record.skills.join(", ") : record?.skills || "" }));
  const submit = (event) => {
    event.preventDefault();
    const payload = { ...draft };
    if ("skills" in payload) payload.skills = String(payload.skills || "").split(",").map((item) => item.trim()).filter(Boolean);
    if (payload.currently_working) payload.end_date = null;
    for (const key of ["end_date", "start_date", "issued_on", "project_url", "repository_url", "image_url", "credential_url"]) if (payload[key] === "") payload[key] = null;
    onSave(config.table, payload);
  };
  const change = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
  return <form className="profile-record-editor" onSubmit={submit}><header><div><span>{record?.id ? "Update" : "Add"}</span><h3>{config.title}</h3></div><button type="button" onClick={onCancel}><X size={15} /></button></header><div>{config.fields.map(([field, label, inputType]) => <label className={inputType === "checkbox" ? "checkbox-field" : ""} key={field}>{inputType === "checkbox" ? <><input type="checkbox" checked={Boolean(draft[field])} onChange={(event) => change(field, event.target.checked)} />{label}</> : <>{label}{inputType === "textarea" ? <textarea value={draft[field] || ""} onChange={(event) => change(field, event.target.value)} /> : inputType === "employment" ? <select value={draft[field] || "FULL_TIME"} onChange={(event) => change(field, event.target.value)}>{["FULL_TIME", "PART_TIME", "CONTRACT", "FREELANCE", "INTERNSHIP", "SELF_EMPLOYED", "OTHER"].map((option) => <option value={option} key={option}>{option.replaceAll("_", " ")}</option>)}</select> : inputType === "link-type" ? <select value={draft[field] || "OTHER"} onChange={(event) => change(field, event.target.value)}>{["WEBSITE", "GITHUB", "GITLAB", "LINKEDIN", "MEDIUM", "HASHNODE", "PORTFOLIO", "OTHER"].map((option) => <option value={option} key={option}>{option}</option>)}</select> : <input required={["title", "company", "institution", "label", "url"].includes(field) || type === "experience" && field === "start_date"} disabled={field === "end_date" && Boolean(draft.currently_working)} type={inputType || "text"} value={draft[field] || ""} onChange={(event) => change(field, event.target.value)} />}</>}</label>)}</div><footer><button type="button" onClick={onCancel}>Cancel</button><button disabled={busy}>{busy ? <RefreshCw className="spin" size={14} /> : <Check size={14} />}Save</button></footer></form>;
}

function ProfileJourneyView({ profile, bundle, draft, setDraft, tab, setTab, editingProfile, setEditingProfile, recordEditor, setRecordEditor, identityFields, linkFields, beginProfileEdit, saveProfile, saveRecord, deleteRecord, uploadImage, avatarInput, bannerInput, busy, message, isOwner, session, openFeed, openWrite, openInbox, openStudio, signOut, relationshipAction, load }) {
  const name = profile.display_name || "StackedIN member";
  const links = [["Website", profile.website_url, Globe2], ["GitHub", profile.github_url, SiGithub], ["GitLab", profile.gitlab_url, SiGitlab], ["LinkedIn", profile.linkedin_url, ExternalLink], ["Medium", profile.medium_url, SiMedium], ["Hashnode", profile.hashnode_url, SiHashnode], ...(bundle.links || []).map((link) => [link.label, link.url, Link2])].filter((item) => isSafeExternalUrl(item[1]));
  const signals = [profile.display_name, profile.headline, profile.about || profile.bio, profile.location, profile.industry, profile.avatar_url, profile.banner_url, profile.current_company, bundle.experiences.length, bundle.education.length, (profile.featured_skills || []).length, links.length];
  const completion = Math.round(signals.filter(Boolean).length / signals.length * 100);
  const tabs = [["about", "About"], ["experience", "Experience"], ["skills", "Skills"], ["portfolio", "Portfolio"], ["activity", "Activity"]];
  const openRecord = (type, record = {}) => setRecordEditor({ type, record });
  const journeyRows = (type, rows, Icon, titleOf, subtitleOf, metaOf) => rows.map((item) => <div className="journey-row" key={item.id}><Icon size={21} /><section><h3>{titleOf(item)}</h3><p>{subtitleOf(item)}</p><span>{metaOf(item)}</span>{item.description && <p>{item.description}</p>}{item.skills?.length > 0 && <div>{item.skills.map((skill) => <b key={skill}>{skill}</b>)}</div>}</section>{isOwner && <div><button aria-label={`Edit ${type}`} onClick={() => openRecord(type, item)}><PenTool size={13} /></button><button aria-label={`Delete ${type}`} onClick={() => deleteRecord(type, item.id)}><Trash2 size={13} /></button></div>}</div>);
  return <div className="profile-page"><header className="feed-topbar"><button className="feed-logo" onClick={openFeed}><img src={`${import.meta.env.BASE_URL}stackedin-icon.webp`} alt="StackedIN" /></button><label><Search size={17} /><input value="Professional profile" readOnly /></label><nav><button onClick={openFeed}><Home size={18} /><span>Home</span></button><button onClick={() => openInbox()}><Bell size={18} /><span>Inbox</span></button>{isOwner && <><button onClick={openWrite}><PenTool size={18} /><span>Write</span></button><button onClick={openStudio}><Sparkles size={18} /><span>XStudio</span></button></>}<button className="active feed-avatar" onClick={() => isOwner && beginProfileEdit("about")}><b>{name.charAt(0).toUpperCase()}</b><span>{isOwner ? "Me" : "Profile"}</span></button></nav></header><main className="profile-journey-shell"><section className="profile-journey-hero"><div className="profile-journey-banner" style={profile.banner_url ? { backgroundImage: `url(${profile.banner_url})` } : undefined}>{isOwner && <div className="profile-media-actions"><button onClick={() => bannerInput.current?.click()}><Camera size={14} />Change banner</button>{profile.banner_url && <button aria-label="Remove banner" onClick={() => profileHub.updateProfile(session.user.id, { banner_url: null }).then(load)}><Trash2 size={14} /></button>}<input ref={bannerInput} hidden type="file" accept="image/*" onChange={(event) => uploadImage(event, "banner")} /></div>}</div><div className="profile-journey-identity"><div className="profile-journey-avatar">{profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : name.charAt(0).toUpperCase()}{isOwner && <button aria-label="Change profile photo" onClick={() => avatarInput.current?.click()}><Camera size={14} /></button>}<input ref={avatarInput} hidden type="file" accept="image/*" onChange={(event) => uploadImage(event, "avatar")} /></div><section><div><h1>{name}</h1><CheckCircle2 size={19} /></div><p>{profile.headline || [profile.current_job_title, profile.current_company].filter(Boolean).join(" · ") || "StackedIN professional"}</p><span><MapPin size={14} />{[profile.location, profile.country].filter(Boolean).join(", ") || "Location not specified"}<Users size={14} />{bundle.counts.followers} followers<Users size={14} />{bundle.counts.connections} connections</span><div className="profile-skill-chips">{(profile.featured_skills || []).slice(0, 8).map((skill) => <b key={skill}>{skill}</b>)}</div><div className="profile-badge-chips">{(profile.featured_badges || []).slice(0, 5).map((badge) => <b key={badge}><Award size={12} />{badge}</b>)}</div></section><aside>{isOwner ? <><button className="primary" onClick={() => beginProfileEdit(tab === "skills" ? "skills" : tab === "portfolio" ? "links" : "about")}><PenTool size={15} />Edit {tab === "skills" ? "skills" : tab === "portfolio" ? "links" : "profile"}</button><button onClick={openWrite}><Plus size={15} />Add post</button></> : <><button className="primary" disabled={busy || bundle.relationship.connectionStatus} onClick={() => relationshipAction("connect")}><Users size={15} />{bundle.relationship.connectionStatus === "PENDING" ? "Pending" : bundle.relationship.connectionStatus === "ACCEPTED" ? "Connected" : "Connect"}</button><button disabled={bundle.relationship.connectionStatus !== "ACCEPTED"} onClick={() => relationshipAction("message")}><MessageCircle size={15} />Message</button><button className={bundle.relationship.isFollowing ? "active" : ""} onClick={() => relationshipAction("follow")}><UserRound size={15} />{bundle.relationship.isFollowing ? "Following" : "Follow"}</button></>}</aside></div></section><nav className="profile-tabs">{tabs.map(([id, label]) => <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>)}</nav>{message && <div className="profile-journey-message">{message}</div>}
  {editingProfile && <div className="profile-edit-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setEditingProfile(null)}><section className="profile-base-editor" role="dialog" aria-modal="true"><header><div><span>Editing only this section</span><h2>{editingProfile === "skills" ? "Skills and recognition" : editingProfile === "links" ? "Professional profiles" : "About and identity"}</h2></div><button onClick={() => setEditingProfile(null)}><X size={16} /></button></header><div>{editingProfile === "about" && <>{identityFields.map(([field, label]) => <label key={field}>{label}<input type={field === "years_experience" ? "number" : "text"} value={draft[field] || ""} onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))} /></label>)}<label className="wide">About<textarea value={draft.about || ""} onChange={(event) => setDraft((current) => ({ ...current, about: event.target.value }))} /></label></>}{editingProfile === "skills" && <><label className="wide">Featured skills<input value={Array.isArray(draft.featured_skills) ? draft.featured_skills.join(", ") : draft.featured_skills || ""} onChange={(event) => setDraft((current) => ({ ...current, featured_skills: event.target.value }))} placeholder="Azure, AI Architecture, .NET" /></label><label className="wide">Badges and recognitions<input value={Array.isArray(draft.featured_badges) ? draft.featured_badges.join(", ") : draft.featured_badges || ""} onChange={(event) => setDraft((current) => ({ ...current, featured_badges: event.target.value }))} placeholder="Top Voice, Community Builder" /></label></>}{editingProfile === "links" && linkFields.map(([field, label]) => <label key={field}>{label}<input type="url" value={draft[field] || ""} onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))} placeholder="https://…" /></label>)}</div><footer><button onClick={() => setEditingProfile(null)}>Cancel</button><button onClick={saveProfile} disabled={busy}><Check size={15} />Save section</button></footer></section></div>}
  {recordEditor && <div className="profile-edit-overlay" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setRecordEditor(null)}><ProfileRecordEditor type={recordEditor.type} record={recordEditor.record} onSave={saveRecord} onCancel={() => setRecordEditor(null)} busy={busy} /></div>}
  <div className="profile-journey-grid"><section className="profile-journey-main">{tab === "about" && <><article className="journey-card"><header><div><span>About</span><h2>Professional story</h2></div>{isOwner && <button onClick={() => beginProfileEdit("about")}><PenTool size={14} />Edit</button>}</header><p>{profile.about || profile.bio || "Add the story behind your work, decisions, and direction."}</p></article><article className="journey-card"><header><div><span>Education</span><h2>Learning journey</h2></div>{isOwner && <button onClick={() => openRecord("education")}><Plus size={14} />Add</button>}</header>{journeyRows("education", bundle.education, GraduationCap, (item) => item.institution, (item) => [item.degree, item.field_of_study].filter(Boolean).join(" · "), (item) => `${item.start_date || ""}${item.end_date ? ` — ${item.end_date}` : ""}`)}</article><article className="journey-card"><header><div><span>Recognition</span><h2>Achievements</h2></div>{isOwner && <button onClick={() => openRecord("achievement")}><Plus size={14} />Add</button>}</header>{journeyRows("achievement", bundle.achievements, Award, (item) => item.title, (item) => item.issuer, (item) => item.issued_on || "")}</article></>}{tab === "experience" && <article className="journey-card"><header><div><span>Career</span><h2>Experience</h2></div>{isOwner && <button onClick={() => openRecord("experience", { employment_type: "FULL_TIME" })}><Plus size={14} />Add experience</button>}</header>{journeyRows("experience", bundle.experiences, Building2, (item) => item.title, (item) => `${item.company} · ${String(item.employment_type || "").replaceAll("_", " ")}`, (item) => `${item.start_date || ""} — ${item.currently_working ? "Present" : item.end_date || "Present"}${item.location ? ` · ${item.location}` : ""}`)}</article>}{tab === "skills" && <article className="journey-card"><header><div><span>Expertise</span><h2>Skills and recognition</h2></div>{isOwner && <button onClick={() => beginProfileEdit("skills")}><PenTool size={14} />Edit</button>}</header><div className="journey-skills">{(profile.featured_skills || []).map((skill) => <span key={skill}>{skill}</span>)}</div><div className="journey-badges">{(profile.featured_badges || []).map((badge) => <span key={badge}><Award size={16} />{badge}</span>)}</div></article>}{tab === "portfolio" && <><article className="journey-card"><header><div><span>Selected work</span><h2>Portfolio</h2></div>{isOwner && <button onClick={() => openRecord("project")}><Plus size={14} />Add project</button>}</header><div className="journey-projects">{bundle.projects.map((item) => <article key={item.id}>{item.image_url && <img src={item.image_url} alt="" />}<h3>{item.title}</h3><p>{item.description}</p><div>{(item.skills || []).map((skill) => <b key={skill}>{skill}</b>)}</div><footer>{item.project_url && <a href={item.project_url} target="_blank" rel="noreferrer">View project <ExternalLink size={12} /></a>}{item.repository_url && <a href={item.repository_url} target="_blank" rel="noreferrer">Repository <SiGithub size={12} /></a>}{isOwner && <><button onClick={() => openRecord("project", item)}><PenTool size={13} /></button><button onClick={() => deleteRecord("project", item.id)}><Trash2 size={13} /></button></>}</footer></article>)}</div></article><article className="journey-card"><header><div><span>Links</span><h2>Professional presence</h2></div>{isOwner && <><button onClick={() => beginProfileEdit("links")}><PenTool size={14} />Edit profiles</button><button onClick={() => openRecord("link", { link_type: "OTHER" })}><Plus size={14} />Add link</button></>}</header><div className="journey-links">{links.map(([label, url, Icon]) => <a href={url} target="_blank" rel="noreferrer" key={`${label}-${url}`}><Icon size={18} /><span><strong>{label}</strong><small>{url}</small></span><ExternalLink size={13} /></a>)}</div></article></>}{tab === "activity" && <article className="journey-card"><header><div><span>Journey timeline</span><h2>Posts and professional activity</h2></div>{isOwner && <button onClick={openWrite}><Plus size={14} />Publish</button>}</header>{bundle.activities.map((item) => <div className="journey-activity" key={item.id}><div><FileText size={16} /></div><section><span>{item.content_type} · {formatDate(item.published_at)}</span><h3>{item.title}</h3><p>{item.description}</p><footer>{item.reaction_count || 0} reactions · {item.comment_count || 0} comments · {item.restack_count || 0} restacks</footer></section></div>)}</article>}</section><aside className="profile-journey-side"><article><span>Profile completeness</span><div className="completion-ring" style={{ "--completion": `${completion * 3.6}deg` }}><strong>{completion}%</strong><small>Complete</small></div></article><article><span>Professional signal</span><div className="signal-stats"><strong>{bundle.counts.publications}</strong><small>Publications</small><strong>{bundle.counts.followers}</strong><small>Followers</small><strong>{bundle.counts.connections}</strong><small>Connections</small></div></article>{links.length > 0 && <article><span>Connect elsewhere</span><div className="profile-side-links">{links.slice(0, 6).map(([label, url, Icon]) => <a href={url} target="_blank" rel="noreferrer" key={`${label}-${url}`}><Icon size={16} />{label}<ExternalLink size={11} /></a>)}</div></article>}{isOwner && <article><button className="profile-signout" onClick={signOut}><LogOut size={14} />Sign out</button></article>}</aside></div></main></div>;
}
function ProfileExperience({ session, targetProfileId, openFeed, openWrite, openInbox, openStudio, signOut }) {
  const [context, setContext] = useState(null);
  const [bundle, setBundle] = useState(null);
  const [tab, setTab] = useState("about");
  const [editingProfile, setEditingProfile] = useState(null);
  const [draft, setDraft] = useState(null);
  const [recordEditor, setRecordEditor] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const avatarInput = useRef(null);
  const bannerInput = useRef(null);
  const isOwner = targetProfileId === session.user.id;
  const load = useCallback(async () => {
    setBusy(true);
    try {
      const nextContext = context || await loadTenantContext(session.user.id);
      setContext(nextContext);
      const nextBundle = await profileHub.loadProfile(targetProfileId, nextContext.tenant.id, session.user.id);
      setBundle(nextBundle);
      setDraft(nextBundle.profile);
    } catch (error) {
      setMessage(error.message || "Profile could not be loaded.");
    } finally {
      setBusy(false);
    }
  }, [context, session.user.id, targetProfileId]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    const channel = profileHub.subscribe(targetProfileId, load);
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [targetProfileId, load]);
  const saveProfile = async () => {
    setBusy(true);
    setMessage("");
    try {
      const fields = ["display_name", "headline", "about", "location", "country", "industry", "current_company", "current_job_title", "years_experience", "website_url", "github_url", "gitlab_url", "linkedin_url", "medium_url", "hashnode_url", "avatar_url", "banner_url", "featured_skills", "featured_badges"];
      const changes = Object.fromEntries(fields.map((field) => [field, draft[field] ?? (field.startsWith("featured_") ? [] : null)]));
      for (const field of ["website_url", "github_url", "gitlab_url", "linkedin_url", "medium_url", "hashnode_url"]) if (changes[field] && !isSafeExternalUrl(changes[field])) throw new Error(`${field.replace("_url", "")} must start with https://`);
      changes.years_experience = changes.years_experience === "" ? null : Number(changes.years_experience || 0);
      for (const field of ["featured_skills", "featured_badges"]) if (!Array.isArray(changes[field])) changes[field] = String(changes[field] || "").split(",").map((item) => item.trim()).filter(Boolean);
      await profileHub.updateProfile(session.user.id, changes);
      setEditingProfile(null);
      setMessage("Professional profile saved.");
      await load();
    } catch (error) {
      setMessage(error.message || "Profile could not be saved.");
    } finally {
      setBusy(false);
    }
  };
  const uploadImage = async (event, kind) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const url = await profileHub.uploadProfileImage(session.user.id, file, kind);
      await profileHub.updateProfile(session.user.id, { [kind === "avatar" ? "avatar_url" : "banner_url"]: url });
      await load();
    } catch (error) {
      setMessage(error.message || "Image could not be uploaded.");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  };
  const saveRecord = async (table, record) => {
    setBusy(true);
    try {
      await profileHub.saveRecord(table, context.tenant.id, session.user.id, record);
      setRecordEditor(null);
      await load();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };
  const deleteRecord = async (type, id) => {
    setBusy(true);
    try {
      await profileHub.deleteRecord(PROFILE_RECORD_CONFIG[type].table, session.user.id, id);
      await load();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };
  const relationshipAction = async (action) => {
    if (!context || isOwner) return;
    setBusy(true);
    try {
      if (action === "connect") await professionalGraph.sendConnectionRequest(context.tenant.id, targetProfileId);
      if (action === "follow") bundle.relationship.isFollowing ? await professionalGraph.unfollow(context.tenant.id, targetProfileId) : await professionalGraph.follow(context.tenant.id, targetProfileId);
      if (action === "message") {
        const conversationId = await profileHub.startConversation(context.tenant.id, targetProfileId);
        openInbox(conversationId);
        return;
      }
      await load();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  };
  if (!bundle) return <div className="auth-loading"><img src={`${import.meta.env.BASE_URL}stackedin-icon.webp`} alt="" />{busy ? <RefreshCw className="spin" /> : <ShieldCheck size={24} />}<p>{message || "Loading the professional journey\u2026"}</p>{message && <button onClick={openFeed}>Return to feed</button>}</div>;
  const profile = bundle.profile;
  const identityFields = [["display_name", "Display name"], ["headline", "Headline"], ["current_job_title", "Current role"], ["current_company", "Company"], ["industry", "Industry"], ["location", "Location"], ["country", "Country"], ["years_experience", "Years experience"]];
  const linkFields = [["website_url", "Website"], ["github_url", "GitHub"], ["gitlab_url", "GitLab"], ["linkedin_url", "LinkedIn"], ["medium_url", "Medium"], ["hashnode_url", "Hashnode"]];
  const beginProfileEdit = (section) => {
    setDraft({ ...profile });
    setEditingProfile(section);
  };
  return <ProfileJourneyView {...{ profile, bundle, draft, setDraft, tab, setTab, editingProfile, setEditingProfile, recordEditor, setRecordEditor, identityFields, linkFields, beginProfileEdit, saveProfile, saveRecord, deleteRecord, uploadImage, avatarInput, bannerInput, busy, message, isOwner, session, openFeed, openWrite, openInbox, openStudio, signOut, relationshipAction, load }} />;
}
function MessagingExperience({ session, initialConversationId, openFeed, openProfile, openWrite, openStudio }) {
  const [context, setContext] = useState(null);
  const [tab, setTab] = useState(initialConversationId ? "messages" : "notifications");
  const [notifications, setNotifications] = useState([]);
  const [requests, setRequests] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [selectedId, setSelectedId] = useState(initialConversationId || "");
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [search, setSearch] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const listRef = useRef(null);
  const load = useCallback(async () => {
    try {
      const nextContext = context || await loadTenantContext(session.user.id);
      setContext(nextContext);
      const [nextNotifications, nextRequests, nextConversations, nextContacts] = await Promise.all([
        profileHub.listNotifications(), profileHub.listPendingRequests(), profileHub.listConversations(session.user.id),
        profileHub.listMessageableProfiles(nextContext.tenant.id, session.user.id)
      ]);
      setNotifications(nextNotifications); setRequests(nextRequests); setConversations(nextConversations); setContacts(nextContacts);
      if (selectedId) {
        setMessages(await profileHub.listMessages(selectedId));
        await profileHub.markConversationRead(selectedId, session.user.id);
      }
    } catch (loadError) { setError(loadError.message || "Inbox could not be loaded."); }
  }, [context, selectedId, session.user.id]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const channel = profileHub.subscribe(session.user.id, load); return () => { void supabase.removeChannel(channel); }; }, [session.user.id, load]);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);
  const chooseConversation = async (id) => {
    setSelectedId(id); setTab("messages"); setBusy("conversation"); setError("");
    try { setMessages(await profileHub.listMessages(id)); await profileHub.markConversationRead(id, session.user.id); }
    catch (chooseError) { setError(chooseError.message); }
    finally { setBusy(""); }
  };
  const startConversation = async (profileId) => {
    if (!context?.tenant?.id) return;
    setBusy("compose");
    try { const id = await profileHub.startConversation(context.tenant.id, profileId); setComposeOpen(false); await load(); await chooseConversation(id); }
    catch (composeError) { setError(composeError.message); }
    finally { setBusy(""); }
  };
  const sendMessage = async () => {
    if (!selectedId || !messageText.trim()) return;
    setBusy("send");
    try { await profileHub.sendMessage(selectedId, session.user.id, messageText); setMessageText(""); setMessages(await profileHub.listMessages(selectedId)); }
    catch (sendError) { setError(sendError.message); }
    finally { setBusy(""); }
  };
  const saveEditedMessage = async () => {
    if (!editing?.body?.trim()) return;
    setBusy("edit");
    try { await profileHub.editMessage(editing.id, editing.body); setEditing(null); setMessages(await profileHub.listMessages(selectedId)); }
    catch (editError) { setError(editError.message); }
    finally { setBusy(""); }
  };
  const removeMessage = async (id) => {
    setBusy(`delete-${id}`);
    try { await profileHub.deleteMessage(id); setMessages(await profileHub.listMessages(selectedId)); }
    catch (deleteError) { setError(deleteError.message); }
    finally { setBusy(""); }
  };
  const respond = async (request, decision) => { setBusy("request"); try { await professionalGraph.respondToConnection(request.id, decision); await load(); } catch (responseError) { setError(responseError.message); } finally { setBusy(""); } };
  const openNotification = async (notification) => {
    if (!notification.read_at) await profileHub.markNotificationRead(notification.id);
    if (notification.notification_type === "MESSAGE" && notification.entity_id) return chooseConversation(notification.entity_id);
    if (notification.notification_type === "CONNECTION_REQUEST") { setTab("requests"); return load(); }
    if (["FOLLOW", "SUBSCRIPTION", "CONNECTION_ACCEPTED"].includes(notification.notification_type) && notification.actor_profile_id) return openProfile(notification.actor_profile_id);
    if (notification.entity_type === "ARTICLE" && notification.entity_id) window.location.hash = `article-${notification.entity_id}`;
    else await load();
  };
  const filteredConversations = conversations.filter((conversation) => `${conversation.otherProfile?.display_name || ""} ${conversation.otherProfile?.headline || ""} ${conversation.lastMessage?.body || ""}`.toLowerCase().includes(search.toLowerCase()));
  const selectedConversation = conversations.find((item) => item.id === selectedId);
  const unreadCount = notifications.filter((item) => !item.read_at).length;
  const lastOwnMessageId = [...messages].reverse().find((item) => item.sender_profile_id === session.user.id)?.id;
  return <div className="inbox-page"><header className="feed-topbar"><button className="feed-logo" onClick={openFeed}><img src={`${import.meta.env.BASE_URL}stackedin-icon.webp`} alt="StackedIN" /></button><label><Search size={17} /><input value="Notifications, requests, and messages" readOnly /></label><nav><button onClick={openFeed}><Home size={18} /><span>Home</span></button><button className="active"><Bell size={18} /><span>Inbox</span>{unreadCount > 0 && <em>{unreadCount}</em>}</button><button onClick={openWrite}><PenTool size={18} /><span>Write</span></button><button onClick={openStudio}><Sparkles size={18} /><span>XStudio</span></button><button className="feed-avatar" onClick={() => openProfile()}><b>{context?.profile?.display_name?.charAt(0).toUpperCase() || "S"}</b><span>Me</span></button></nav></header><main className="inbox-shell"><aside className="inbox-nav"><header><span>Communication hub</span><h1>Inbox</h1></header><button className={tab === "notifications" ? "active" : ""} onClick={() => setTab("notifications")}><Bell size={17} />Notifications{unreadCount > 0 && <b>{unreadCount}</b>}</button><button className={tab === "requests" ? "active" : ""} onClick={() => setTab("requests")}><Users size={17} />Pending requests{requests.length > 0 && <b>{requests.length}</b>}</button><button className={tab === "messages" ? "active" : ""} onClick={() => setTab("messages")}><MessageCircle size={17} />Messages{conversations.filter((item) => item.unread).length > 0 && <b>{conversations.filter((item) => item.unread).length}</b>}</button><footer><ShieldCheck size={15} /><p>Direct messages are private to conversation members and protected by Row Level Security.</p></footer></aside><section className="inbox-content">{error && <div className="native-inline-error">{error}</div>}{tab === "notifications" && <><header className="inbox-heading"><div><span>Updates</span><h2>Notifications</h2></div>{unreadCount > 0 && <button onClick={() => profileHub.markAllNotificationsRead(session.user.id).then(load)}><Check size={14} />Mark all read</button>}</header><div className="notification-list">{notifications.map((notification) => <button className={!notification.read_at ? "unread" : ""} key={notification.id} onClick={() => openNotification(notification)}><div>{notification.actor?.avatar_url ? <img src={notification.actor.avatar_url} alt="" /> : notification.notification_type === "MESSAGE" ? <MessageCircle size={17} /> : <Bell size={17} />}</div><section><strong>{notification.title}</strong><p>{notification.body}</p><span>{notification.actor?.display_name || "StackedIN"} · {formatMessageTime(notification.created_at)}</span></section>{!notification.read_at && <i />}</button>)}{!notifications.length && <div className="inbox-empty"><Bell size={26} /><h3>You are all caught up</h3><p>Network, publishing, and message activity appears here in realtime.</p></div>}</div></>}{tab === "requests" && <><header className="inbox-heading"><div><span>Your network</span><h2>Pending connection requests</h2></div></header><div className="request-list">{requests.map((request) => <article key={request.id}><button className="request-avatar" onClick={() => openProfile(request.requester_profile_id)}>{request.requester?.avatar_url ? <img src={request.requester.avatar_url} alt="" /> : String(request.requester?.display_name || "S").charAt(0)}</button><section><h3>{request.requester?.display_name || "StackedIN professional"}</h3><p>{request.requester?.headline || request.requester?.current_company || "Professional connection request"}</p><span>Requested {formatMessageTime(request.requested_at)}</span></section><footer><button disabled={Boolean(busy)} onClick={() => respond(request, "DECLINED")}>Decline</button><button disabled={Boolean(busy)} onClick={() => respond(request, "ACCEPTED")}><Check size={14} />Accept</button></footer></article>)}{!requests.length && <div className="inbox-empty"><Users size={26} /><h3>No pending requests</h3><p>Your professional graph is currently tidy.</p></div>}</div></>}{tab === "messages" && <div className="messaging-layout"><aside><header><div><span>Conversations</span><h2>Messages</h2></div><button className="new-message-button" onClick={() => setComposeOpen(true)}><Plus size={15} />New</button></header><label className="message-search"><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search messages" /></label>{filteredConversations.map((conversation) => <button className={`${conversation.id === selectedId ? "active" : ""} ${conversation.unread ? "unread" : ""}`} key={conversation.id} onClick={() => chooseConversation(conversation.id)}><div>{conversation.otherProfile?.avatar_url ? <img src={conversation.otherProfile.avatar_url} alt="" /> : String(conversation.otherProfile?.display_name || "S").charAt(0)}</div><section><strong>{conversation.otherProfile?.display_name || conversation.title || "Conversation"}</strong><p>{conversation.lastMessage?.body || "Start the conversation"}</p><span>{formatMessageTime(conversation.updatedAt)}</span></section></button>)}</aside><section className="message-thread">{selectedConversation ? <><header><button className="thread-profile-avatar" onClick={() => openProfile(selectedConversation.otherProfile?.id)}>{selectedConversation.otherProfile?.avatar_url ? <img src={selectedConversation.otherProfile.avatar_url} alt="" /> : String(selectedConversation.otherProfile?.display_name || "S").charAt(0)}</button><section><strong>{selectedConversation.otherProfile?.display_name || "StackedIN professional"}</strong><span>{selectedConversation.otherProfile?.headline || "Professional connection"}</span></section><button onClick={() => openProfile(selectedConversation.otherProfile?.id)}><UserRound size={15} />Profile</button></header><div className="message-list" ref={listRef}>{messages.map((item) => <article className={item.sender_profile_id === session.user.id ? "mine" : "theirs"} key={item.id}><div>{editing?.id === item.id ? <div className="message-edit"><textarea autoFocus value={editing.body} onChange={(event) => setEditing({ ...editing, body: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void saveEditedMessage(); } }} /><footer><button onClick={() => setEditing(null)}>Cancel</button><button disabled={busy === "edit"} onClick={saveEditedMessage}>Save</button></footer></div> : item.deleted_at ? <em>Message removed</em> : item.body}</div><span>{formatMessageTime(item.created_at)}{item.edited_at ? " · edited" : ""}{item.id === lastOwnMessageId && selectedConversation.otherLastReadAt && selectedConversation.otherLastReadAt >= item.created_at ? " · Seen" : ""}</span>{item.sender_profile_id === session.user.id && !item.deleted_at && editing?.id !== item.id && <aside><button aria-label="Edit message" onClick={() => setEditing({ id: item.id, body: item.body })}><PenTool size={12} /></button><button aria-label="Delete message" disabled={busy === `delete-${item.id}`} onClick={() => removeMessage(item.id)}><Trash2 size={12} /></button></aside>}</article>)}</div><form onSubmit={(event) => { event.preventDefault(); void sendMessage(); }}><textarea value={messageText} onChange={(event) => setMessageText(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void sendMessage(); } }} placeholder="Write a message… Enter to send · Shift+Enter for a new line" maxLength={8e3} /><button disabled={busy === "send" || !messageText.trim()}><Send size={16} /></button></form></> : <div className="inbox-empty"><MessageCircle size={28} /><h3>Select a conversation</h3><p>Start a private conversation with an accepted connection.</p><button onClick={() => setComposeOpen(true)}><Plus size={14} />New message</button></div>}</section></div>}</section></main>{composeOpen && <div className="profile-edit-overlay" onMouseDown={(event) => event.target === event.currentTarget && setComposeOpen(false)}><section className="new-message-dialog" role="dialog" aria-modal="true"><header><div><span>New message</span><h2>Choose a connection</h2></div><button onClick={() => setComposeOpen(false)}><X size={16} /></button></header><div>{contacts.map((contact) => <button key={contact.id} disabled={busy === "compose"} onClick={() => startConversation(contact.id)}><div>{contact.avatar_url ? <img src={contact.avatar_url} alt="" /> : String(contact.display_name || "S").charAt(0)}</div><section><strong>{contact.display_name}</strong><span>{contact.headline || contact.current_company || "StackedIN professional"}</span></section><MessageCircle size={15} /></button>)}{!contacts.length && <p>Accept a connection request before starting a direct message.</p>}</div></section></div>}</div>;
}

function FeedPeoplePanel({ people, busy, onAction, onOpenNetwork, onOpenProfile }) {
  return <section className="feed-people-card"><header><div><span>Your professional graph</span><h3>People worth knowing</h3></div><Users size={17} /></header><div className="feed-people-list">{people.map((person) => <article key={person.profile_id}><button className="feed-person-avatar" onClick={() => onOpenProfile(person.profile_id)}>{person.avatar_url ? <img src={person.avatar_url} alt="" /> : person.display_name.charAt(0).toUpperCase()}</button><section><div><button className="feed-person-name" onClick={() => onOpenProfile(person.profile_id)}>{person.display_name}</button><em>{person.degree}{person.degree === 1 ? "st" : person.degree === 2 ? "nd" : "rd"}</em></div><span>{person.headline || person.current_company || "StackedIN professional"}</span><small>{person.reason}</small><footer><button className={person.is_following ? "active" : ""} disabled={Boolean(busy)} onClick={() => onAction(person, "follow")}><UserRound size={12} />{person.is_following ? "Following" : "Follow"}</button><button className={person.is_subscribed ? "active" : ""} disabled={Boolean(busy)} onClick={() => onAction(person, "subscribe")}><BellRing size={12} />{person.is_subscribed ? "Subscribed" : "Subscribe"}</button></footer></section></article>)}{!people.length && <p>Complete your profile and add interests to unlock stronger people recommendations.</p>}</div><button className="feed-people-more" onClick={onOpenNetwork}>Explore your network <ArrowRight size={13} /></button></section>;
}
function FeedExperience({ session, openStudio, openNetwork, openSearch, openWrite, openProfile, openInbox, signOut }) {
  const [catalogue, setCatalogue] = useState({ posts: [] });
  const [nativeArticles, setNativeArticles] = useState([]);
  const [tenantContext, setTenantContext] = useState(null);
  const [feedPeople, setFeedPeople] = useState([]);
  const [networkSummary, setNetworkSummary] = useState({ connections: 0, followers: 0, following: 0, subscriptions: 0 });
  const [peopleBusy, setPeopleBusy] = useState("");
  const [search, setSearch] = useState("");
  const [liked, setLiked] = useState(() => new Set(JSON.parse(localStorage.getItem(`stackedin-liked-${session.user.id}`) || "[]")));
  const [saved, setSaved] = useState(() => new Set(JSON.parse(localStorage.getItem(`stackedin-saved-${session.user.id}`) || "[]")));
  const [toast, setToast] = useState("");
  useEffect(() => {
    fetch(`${DATA_URL}?v=${Date.now()}`, { cache: "no-store" }).then((response) => response.json()).then(setCatalogue).catch(() => setCatalogue({ posts: [] }));
  }, []);
  useEffect(() => {
    loadTenantContext(session.user.id).then(setTenantContext).catch(() => setTenantContext(null));
  }, [session.user.id]);
  const loadNativeFeed = useCallback(async () => {
    try {
      setNativeArticles(await nativePublishing.listFeed(30));
    } catch (nativeError) {
      if (!nativeError.message?.includes("content_blocks")) console.error(nativeError);
    }
  }, []);
  const loadFeedNetwork = useCallback(async (context) => {
    const tenantId = context?.tenant?.id;
    if (!tenantId) return;
    try {
      const [people, summary] = await Promise.all([professionalGraph.getFeedPeople(tenantId, 6), professionalGraph.getNetworkSummary(tenantId)]);
      setFeedPeople(people);
      setNetworkSummary(summary);
    } catch (networkError) {
      console.error(networkError);
    }
  }, []);
  useEffect(() => {
    loadNativeFeed();
    const channel = nativePublishing.subscribe(loadNativeFeed);
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadNativeFeed]);
  useEffect(() => {
    if (tenantContext) loadFeedNetwork(tenantContext);
  }, [tenantContext, loadFeedNetwork]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 2200);
    return () => clearTimeout(timer);
  }, [toast]);
  const posts = useMemo(() => [...catalogue.posts || []].sort((a, b) => (safeDate(b.publishedAt)?.getTime() || b.id) - (safeDate(a.publishedAt)?.getTime() || a.id)), [catalogue.posts]);
  const visible = useMemo(() => posts.filter((post) => `${post.title} ${post.description} ${post.pillar} ${(post.tags || []).join(" ")}`.toLowerCase().includes(search.toLowerCase())).slice(0, 30), [posts, search]);
  const visibleNative = useMemo(() => nativeArticles.filter((article) => `${article.title} ${article.description} ${(article.hashtags || []).join(" ")} ${(article.tags || []).join(" ")}`.toLowerCase().includes(search.toLowerCase())), [nativeArticles, search]);
  const recent = posts.slice(0, 10);
  const toggle = (type, url) => {
    const current = type === "liked" ? liked : saved;
    const next = new Set(current);
    next.has(url) ? next.delete(url) : next.add(url);
    localStorage.setItem(`stackedin-${type}-${session.user.id}`, JSON.stringify([...next]));
    type === "liked" ? setLiked(next) : setSaved(next);
  };
  const share = async (post) => {
    try {
      await navigator.clipboard.writeText(post.url);
      setToast("Article link copied.");
    } catch {
      window.open(post.url, "_blank", "noopener");
    }
  };
  const peopleAction = async (person, action) => {
    const tenantId = tenantContext?.tenant?.id;
    const profileId = tenantContext?.profile?.id;
    if (!tenantId || !profileId) return;
    setPeopleBusy(`${person.profile_id}:${action}`);
    try {
      if (action === "follow") person.is_following ? await professionalGraph.unfollow(tenantId, person.profile_id) : await professionalGraph.follow(tenantId, person.profile_id);
      if (action === "subscribe") await nativePublishing.setSubscribed(tenantId, profileId, person.profile_id, !person.is_subscribed);
      setToast(action === "follow" ? person.is_following ? "Unfollowed." : "Now following." : person.is_subscribed ? "Subscription removed." : "Subscribed to new posts.");
      await Promise.all([loadFeedNetwork(tenantContext), loadNativeFeed()]);
    } catch (actionError) {
      setToast(actionError.message || "Network action could not be completed.");
    } finally {
      setPeopleBusy("");
    }
  };
  const name = tenantContext?.profile?.display_name || session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split("@")[0] || "StackedIN member";
  const workspaceName = tenantContext?.tenant?.name || "Personal workspace";
  const initial = name.charAt(0).toUpperCase();
  const featureLinks = [{ label: "My profile", icon: UserRound, profileRoute: true }, { label: "Professional search", icon: Search, searchRoute: true }, { label: "People worth knowing", icon: Users, network: true }, ...NAV_ITEMS.map((item) => ({ label: item.label, icon: item.icon }))];
  return <div className="feed-page">
    <header className="feed-topbar"><button className="feed-logo" onClick={() => {
    window.location.hash = "";
  }}><img src={`${import.meta.env.BASE_URL}stackedin-icon.webp`} alt="StackedIN" /></button><label><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => {
    if (event.key === "Enter" && search.trim()) openSearch(search);
  }} placeholder="Search articles—press Enter for people…" /></label><nav><button className="active"><Home size={18} /><span>Home</span></button><button onClick={openNetwork}><Users size={18} /><span>Network</span></button><button onClick={() => openInbox()}><Bell size={18} /><span>Inbox</span></button><button onClick={openWrite}><PenTool size={18} /><span>Write</span></button><button onClick={openStudio}><Sparkles size={18} /><span>XStudio</span></button><button className="feed-avatar" onClick={() => openProfile()}><b>{initial}</b><span>Me</span></button></nav></header>
    <div className="feed-layout">
      <aside className="feed-left"><section className="feed-profile" onClick={() => openProfile()} onKeyDown={(event) => {
    if (event.key === "Enter") openProfile();
  }} role="button" tabIndex={0}><div className="feed-profile-cover" /><div className="feed-profile-avatar">{tenantContext?.profile?.avatar_url ? <img src={tenantContext.profile.avatar_url} alt="" /> : initial}</div><h3>{name}</h3><p>{tenantContext?.profile?.headline || session.user.email}</p><span>{tenantContext?.profile?.current_job_title || "Building useful systems, one idea at a time."}</span><div className="workspace-chip"><Layers3 size={12} /><strong>{workspaceName}</strong>{tenantContext?.role && <small>{tenantContext.role}</small>}</div><div className="feed-network-metrics"><b>{networkSummary.followers}</b><small>Followers</small><b>{networkSummary.connections}</b><small>Connections</small><b>{networkSummary.following}</b><small>Following</small><b>{networkSummary.subscriptions}</b><small>Subscribed</small></div></section><nav>{featureLinks.map(({ label, icon: Icon, network, searchRoute, profileRoute }) => <button key={label} onClick={() => profileRoute ? openProfile() : searchRoute ? openSearch("") : network ? openNetwork() : openStudio()}><Icon size={17} />{label}{network && networkSummary.connections > 0 ? <b>{networkSummary.connections}</b> : <ChevronRight size={14} />}</button>)}</nav><button className="open-studio-button" onClick={openStudio}><Sparkles size={16} />Open XStudio</button><button className="feed-signout" onClick={signOut}><LogOut size={15} />Sign out</button></aside>
      <main className="feed-stream"><FeedComposer session={session} tenantContext={tenantContext} onPublished={loadNativeFeed} openArticle={openWrite} onToast={setToast} /><div className="feed-sort"><span>Live from your professional knowledge network</span><button>Relevance + freshness <ChevronRight size={13} /></button></div>{visibleNative.map((article) => <NativeFeedCard key={article.id} article={article} tenantContext={tenantContext} onRefresh={loadNativeFeed} onNetworkRefresh={() => loadFeedNetwork(tenantContext)} onOpenProfile={openProfile} onToast={setToast} />)}{visible.length > 0 && <div className="external-feed-divider"><span>Connected knowledge references</span><p>External publications become native references when their source is connected in XStudio.</p></div>}{visible.map((post) => <FeedCard key={post.url} post={post} liked={liked.has(post.url)} saved={saved.has(post.url)} onLike={() => toggle("liked", post.url)} onSave={() => toggle("saved", post.url)} onShare={() => share(post)} />)}{!visibleNative.length && !visible.length && <div className="feed-empty"><Search size={28} /><h3>No articles found</h3><p>Try a broader topic or publish the first native StackedIN post.</p></div>}</main>
      <aside className="feed-right"><FeedPeoplePanel people={feedPeople} busy={peopleBusy} onAction={peopleAction} onOpenNetwork={openNetwork} onOpenProfile={openProfile} /><section className="recent-card"><header><div><span>Fresh from the stack</span><h3>Recent articles</h3></div><Rss size={17} /></header><div>{recent.map((post, index) => <button type="button" onClick={openStudio} key={post.url}><b>{String(index + 1).padStart(2, "0")}</b><div><strong>{post.title}</strong><span><PlatformIcon name={post.platform || "Substack"} size={10} />{post.platform || "Substack"} · {formatDate(post.publishedAt)}</span></div></button>)}</div><button onClick={openStudio}>Explore all articles <ArrowRight size={14} /></button></section><section className="code-card"><span>Code & collaboration</span><h3>Follow the builds</h3><a href="https://github.com/abhishekpandaOfficial" target="_blank" rel="noreferrer"><SiGithub size={22} /><div><strong>GitHub</strong><small>@abhishekpandaOfficial</small></div><ExternalLink size={14} /></a><a href="https://gitlab.com/abhishekpandaOfficial/" target="_blank" rel="noreferrer"><SiGitlab size={23} /><div><strong>GitLab</strong><small>@abhishekpandaOfficial</small></div><ExternalLink size={14} /></a></section><footer className="feed-mini-footer"><a href="#">About</a><a href="#">Privacy</a><a href="#">Terms</a><span>StackedIN © 2026</span></footer></aside>
    </div>{toast && <div className="toast"><CheckCircle2 size={16} />{toast}</div>}
  </div>;
}
function SearchExperience({ session, openFeed, openNetwork, openProfile, openStudio, signOut }) {
  const initialQuery = useRef(sessionStorage.getItem("stackedin-professional-search") || "");
  const autoSearchStarted = useRef(false);
  const [tenantContext, setTenantContext] = useState(null);
  const [query, setQuery] = useState(initialQuery.current);
  const [location, setLocation] = useState("");
  const [role, setRole] = useState("");
  const [minimumExperience, setMinimumExperience] = useState("");
  const [parsed, setParsed] = useState(null);
  const [results, setResults] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState("");
  const tenantId = tenantContext?.tenant?.id;
  const name = tenantContext?.profile?.display_name || session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "StackedIN member";
  const initial = name.charAt(0).toUpperCase();
  useEffect(() => {
    loadTenantContext(session.user.id).then(setTenantContext).catch(() => setError("Your workspace could not be loaded."));
  }, [session.user.id]);
  useEffect(() => {
    if (!toast) return void 0;
    const timer = setTimeout(() => setToast(""), 2400);
    return () => clearTimeout(timer);
  }, [toast]);
  const executeSearch = useCallback(async (currentTenantId, append = false) => {
    if (!query.trim() && !location.trim() && !role.trim()) {
      setError("Describe the professional, skill, or location you want to find.");
      return;
    }
    append ? setLoadingMore(true) : setLoading(true);
    setError("");
    try {
      const page = await profileSearch.search(currentTenantId, {
        query,
        location,
        role,
        minimumExperience: minimumExperience ? Number(minimumExperience) : null,
        limit: 10,
        cursor: append ? cursor : null
      });
      setParsed(page.query);
      setResults((current) => append ? [...current, ...page.results] : page.results);
      setCursor(page.nextCursor);
      setSearched(true);
      sessionStorage.setItem("stackedin-professional-search", query.trim());
    } catch (searchError) {
      console.error(searchError);
      setError(searchError.message?.includes("search_profiles") ? "Professional Search V1 is built, but its Phase 3 database migration has not been applied yet." : "Search could not be completed. Please try again.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [cursor, location, minimumExperience, query, role]);
  useEffect(() => {
    if (!tenantId || !initialQuery.current.trim() || autoSearchStarted.current) return;
    autoSearchStarted.current = true;
    executeSearch(tenantId);
  }, [executeSearch, tenantId]);
  const submit = (event) => {
    event.preventDefault();
    if (tenantId) executeSearch(tenantId);
  };
  const act = async (candidate, action) => {
    if (!tenantId) return;
    setBusy(`${candidate.profile_id}:${action}`);
    try {
      if (action === "connect") {
        await professionalGraph.sendConnectionRequest(tenantId, candidate.profile_id);
        setResults((current) => current.map((item) => item.profile_id === candidate.profile_id ? { ...item, is_connected: true } : item));
        setToast(`Connection request sent to ${candidate.display_name}.`);
      } else {
        await professionalGraph.follow(tenantId, candidate.profile_id);
        setToast(`Following ${candidate.display_name}.`);
      }
      await professionalGraph.recordInteraction({
        tenantId,
        entityType: "SEARCH_RESULT",
        entityId: candidate.profile_id,
        targetProfileId: candidate.profile_id,
        eventType: "SEARCH_RESULT_CLICK",
        metadata: { action }
      });
    } catch (actionError) {
      setToast(actionError.message || "The action could not be completed.");
    } finally {
      setBusy("");
    }
  };
  const intentChips = parsed ? [parsed.role, parsed.location, ...parsed.skills, ...parsed.topics, parsed.contentAuthorRequired ? "Publishes content" : null].filter(Boolean) : [];
  return <div className="feed-page search-page">
    <header className="feed-topbar"><button className="feed-logo" onClick={openFeed}><img src={`${import.meta.env.BASE_URL}stackedin-icon.webp`} alt="StackedIN" /></button><form className="global-search-form" onSubmit={submit}><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="AI architects in Bengaluru writing about RAG" /><button disabled={loading || !tenantId}>Search</button></form><nav><button onClick={openFeed}><Home size={18} /><span>Home</span></button><button onClick={openNetwork}><Users size={18} /><span>Network</span></button><button className="active"><Search size={18} /><span>Search</span></button><button className="feed-avatar" onClick={openProfile}><b>{initial}</b><span>Me</span></button></nav></header>
    <div className="search-layout">
      <aside className="search-filters"><section><span><SlidersHorizontal size={14} />Structured filters</span><label>Location<input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="India or Bengaluru" /></label><label>Professional role<input value={role} onChange={(event) => setRole(event.target.value)} placeholder="AI Architect" /></label><label>Minimum experience<select value={minimumExperience} onChange={(event) => setMinimumExperience(event.target.value)}><option value="">Any experience</option><option value="2">2+ years</option><option value="5">5+ years</option><option value="10">10+ years</option><option value="15">15+ years</option></select></label><button onClick={() => tenantId && executeSearch(tenantId)} disabled={loading || !tenantId}><Filter size={14} />Apply filters</button></section><button onClick={openFeed}><Home size={15} />Back to feed</button><button onClick={openStudio}><Sparkles size={15} />Open XStudio</button><button onClick={signOut}><LogOut size={15} />Sign out</button></aside>
      <main className="search-main"><header><span>Professional Search V1</span><h1>Find the signal,<br />skip the noise.</h1><p>Search by expertise, role, location, published knowledge, and professional proximity. Results explain why they earned their position.</p></header>
        {intentChips.length > 0 && <section className="intent-strip"><strong>Understood intent</strong><div>{intentChips.map((chip) => <span key={chip}>{chip}</span>)}</div></section>}
        {loading && <div className="network-state"><RefreshCw className="spin" size={24} /><h3>Mapping professional relevance…</h3><p>Lexical, skill, topic, and graph signals are being ranked together.</p></div>}
        {!loading && error && <div className="network-state network-error"><ShieldCheck size={25} /><h3>Search needs attention</h3><p>{error}</p></div>}
        {!loading && !error && !searched && <div className="search-welcome"><Search size={28} /><h2>Search like a human thinks.</h2><p>Try “senior Azure architects in India” or “people writing about Agentic AI.”</p><div>{["AI Architect Azure", ".NET developers with Kubernetes", "GraphRAG experts", "AI engineers in Bengaluru writing about RAG"].map((example) => <button key={example} onClick={() => setQuery(example)}>{example}<ArrowRight size={13} /></button>)}</div></div>}
        {!loading && !error && searched && !results.length && <div className="network-state"><Search size={27} /><h3>No strong professional matches yet.</h3><p>Try removing one filter or using a broader skill synonym. We would rather show zero results than invent relevance.</p></div>}
        {!loading && results.length > 0 && <section className="search-results"><div className="search-results-heading"><div><span>{results.length} professionals mapped</span><h2>Ranked by useful relevance</h2></div><small>Popularity is not a ranking shortcut.</small></div>{results.map((candidate) => <article className="search-result-card" key={candidate.profile_id}><div className="search-result-avatar">{candidate.avatar_url ? <img src={candidate.avatar_url} alt="" /> : candidate.display_name.charAt(0).toUpperCase()}</div><div className="search-result-body"><div className="search-result-title"><div><h3>{candidate.display_name}</h3><p>{candidate.headline || candidate.current_job_title || "StackedIN professional"}</p></div><span><Sparkles size={11} />{candidate.match_label}</span></div><div className="search-result-meta">{candidate.current_company && <span><BriefcaseBusiness size={12} />{candidate.current_company}</span>}{(candidate.location || candidate.country) && <span><MapPin size={12} />{[candidate.location, candidate.country].filter(Boolean).join(", ")}</span>}{candidate.years_experience != null && <span>{candidate.years_experience}+ years</span>}</div>{candidate.key_skills?.length > 0 && <div className="search-skills">{candidate.key_skills.map((skill) => <span className={candidate.matched_terms?.includes(skill) ? "matched" : ""} key={skill}>{skill}</span>)}</div>}<div className="search-reasons">{(candidate.reasons || []).slice(0, 4).map((reason) => <span key={reason}><CheckCircle2 size={12} />{reason}</span>)}</div></div><footer><button className="connect" disabled={Boolean(busy) || candidate.is_connected} onClick={() => act(candidate, "connect")}>{busy === `${candidate.profile_id}:connect` ? <RefreshCw className="spin" size={14} /> : candidate.is_connected ? <CheckCircle2 size={14} /> : <Users size={14} />}{candidate.is_connected ? "Connected" : "Connect"}</button><button disabled={Boolean(busy)} onClick={() => act(candidate, "follow")}><UserRound size={14} />Follow</button></footer></article>)}{cursor && <button className="load-more-search" onClick={() => tenantId && executeSearch(tenantId, true)} disabled={loadingMore}>{loadingMore ? <RefreshCw className="spin" size={15} /> : <ArrowRight size={15} />}Load more relevant people</button>}</section>}
      </main>
      <aside className="search-insight"><section><BrainCircuit size={19} /><span>Phase 3 ranking</span><h3>Words + evidence + graph.</h3><p>Full-text and trigram relevance meet verified skill, topic, article, freshness, and professional-network signals.</p></section><section><ShieldCheck size={19} /><span>Privacy boundary</span><h3>Tenant authorization first.</h3><p>Private, blocked, muted, suspended, and non-searchable profiles never enter the ranking pool.</p></section><section><Zap size={19} /><span>Always available</span><h3>No AI dependency.</h3><p>This deterministic search works even when embedding or language-model services are offline.</p></section></aside>
    </div>{toast && <div className="toast"><CheckCircle2 size={16} />{toast}</div>}
  </div>;
}
function NetworkExperience({ session, openFeed, openSearch, openProfile, openStudio, signOut }) {
  const [networkSearch, setNetworkSearch] = useState("");
  const [tenantContext, setTenantContext] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [following, setFollowing] = useState(/* @__PURE__ */ new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [toast, setToast] = useState("");
  const tenantId = tenantContext?.tenant?.id;
  const name = tenantContext?.profile?.display_name || session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "StackedIN member";
  const initial = name.charAt(0).toUpperCase();
  const loadRecommendations = useCallback(async (currentTenantId) => {
    setLoading(true);
    setError("");
    try {
      setRecommendations(await professionalGraph.getPeopleRecommendations(currentTenantId, 8));
    } catch (loadError) {
      console.error(loadError);
      setError(loadError.message?.includes("get_people_recommendations") ? "People recommendations are ready in the application, but the Phase 2 database migration has not been applied yet." : "Recommendations could not be loaded. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    loadTenantContext(session.user.id).then((context) => {
      setTenantContext(context);
      if (context?.tenant?.id) loadRecommendations(context.tenant.id);
      else {
        setLoading(false);
        setError("Your personal workspace is still being prepared.");
      }
    }).catch(() => {
      setLoading(false);
      setError("Your workspace could not be loaded.");
    });
  }, [loadRecommendations, session.user.id]);
  useEffect(() => {
    if (!toast) return void 0;
    const timer = setTimeout(() => setToast(""), 2400);
    return () => clearTimeout(timer);
  }, [toast]);
  const removeCandidate = (candidateId) => setRecommendations((current) => current.filter((item) => item.candidate_profile_id !== candidateId));
  const act = async (candidate, action) => {
    if (!tenantId) return;
    setBusy(`${candidate.candidate_profile_id}:${action}`);
    try {
      if (action === "connect") {
        await professionalGraph.sendConnectionRequest(tenantId, candidate.candidate_profile_id);
        await professionalGraph.recordPeopleOutcome(tenantId, candidate.candidate_profile_id, "CONNECTION_REQUEST");
        removeCandidate(candidate.candidate_profile_id);
        setToast(`Connection request sent to ${candidate.display_name}.`);
      } else if (action === "follow") {
        await professionalGraph.follow(tenantId, candidate.candidate_profile_id);
        await professionalGraph.recordPeopleOutcome(tenantId, candidate.candidate_profile_id, "FOLLOW");
        setFollowing((current) => new Set(current).add(candidate.candidate_profile_id));
        setToast(`Following ${candidate.display_name}.`);
      } else {
        await professionalGraph.recordPeopleOutcome(tenantId, candidate.candidate_profile_id, action === "dismiss" ? "DISMISS" : "NOT_RELEVANT");
        removeCandidate(candidate.candidate_profile_id);
        setToast(action === "dismiss" ? "Suggestion dismissed." : "Your recommendations will adapt.");
      }
    } catch (actionError) {
      setToast(actionError.message || "The action could not be completed.");
    } finally {
      setBusy("");
    }
  };
  return <div className="feed-page network-page">
    <header className="feed-topbar"><button className="feed-logo" onClick={() => {
    window.location.hash = "";
  }}><img src={`${import.meta.env.BASE_URL}stackedin-icon.webp`} alt="StackedIN" /></button><label><Search size={17} /><input value={networkSearch} onChange={(event) => setNetworkSearch(event.target.value)} onKeyDown={(event) => {
    if (event.key === "Enter" && networkSearch.trim()) openSearch(networkSearch);
  }} placeholder="Search people, skills, topics…" /></label><nav><button onClick={openFeed}><Home size={18} /><span>Home</span></button><button className="active"><Users size={18} /><span>Network</span></button><button onClick={() => openSearch("")}><Search size={18} /><span>Search</span></button><button className="feed-avatar" onClick={openProfile}><b>{initial}</b><span>Me</span></button></nav></header>
    <div className="network-layout">
      <aside className="network-sidebar"><section className="feed-profile" onClick={() => openProfile()} role="button" tabIndex={0}><div className="feed-profile-cover" /><div className="feed-profile-avatar">{initial}</div><h3>{name}</h3><p>{session.user.email}</p><span>Recommendations shaped by your professional graph.</span><div className="workspace-chip"><Layers3 size={12} /><strong>{tenantContext?.tenant?.name || "Personal workspace"}</strong><small>{tenantContext?.role || "member"}</small></div></section><button onClick={openFeed}><Home size={16} />Back to feed</button><button onClick={openStudio}><Sparkles size={16} />Open XStudio</button><button onClick={signOut}><LogOut size={15} />Sign out</button></aside>
      <main className="network-main"><header><span>Professional knowledge graph</span><h1>People worth knowing</h1><p>Fewer suggestions. Better reasons. Every candidate passes privacy, relationship, and negative-feedback filters before appearing here.</p></header>
        {loading && <div className="network-state"><RefreshCw className="spin" size={24} /><h3>Finding useful professional overlap…</h3></div>}
        {!loading && error && <div className="network-state network-error"><ShieldCheck size={25} /><h3>Recommendations are not available yet</h3><p>{error}</p>{tenantId && <button onClick={() => loadRecommendations(tenantId)}>Try again</button>}</div>}
        {!loading && !error && !recommendations.length && <div className="network-state"><Users size={28} /><h3>Your next useful connection is still taking shape.</h3><p>Add skills and interests, or return as more professionals join StackedIN.</p><button onClick={openStudio}>Build your professional signal</button></div>}
        {!loading && !error && recommendations.length > 0 && <section className="people-grid">{recommendations.map((candidate) => {
    const candidateInitial = candidate.display_name?.charAt(0).toUpperCase() || "S";
    return <article className="people-card" key={candidate.candidate_profile_id}><button className="people-dismiss" aria-label={`Dismiss ${candidate.display_name}`} onClick={() => act(candidate, "dismiss")} disabled={Boolean(busy)}><X size={15} /></button><div className="people-avatar">{candidate.avatar_url ? <img src={candidate.avatar_url} alt="" /> : candidateInitial}</div><div className="people-match"><Sparkles size={12} />{candidate.relevance_label}</div><h2>{candidate.display_name}</h2><p>{candidate.headline || "StackedIN professional"}</p><span>{[candidate.current_company, candidate.location].filter(Boolean).join(" \xB7 ") || "Building a professional knowledge graph"}</span><div className="people-reasons"><strong>Why this recommendation?</strong>{(candidate.reasons || []).slice(0, 4).map((reason) => <div key={reason}><CheckCircle2 size={12} />{reason}</div>)}</div><footer><button className="connect" disabled={Boolean(busy)} onClick={() => act(candidate, "connect")}>{busy === `${candidate.candidate_profile_id}:connect` ? <RefreshCw className="spin" size={14} /> : <Users size={14} />}Connect</button><button disabled={Boolean(busy) || following.has(candidate.candidate_profile_id)} onClick={() => act(candidate, "follow")}>{following.has(candidate.candidate_profile_id) ? <CheckCircle2 size={14} /> : <UserRound size={14} />}{following.has(candidate.candidate_profile_id) ? "Following" : "Follow"}</button></footer><button className="not-relevant" onClick={() => act(candidate, "not-relevant")} disabled={Boolean(busy)}>Not relevant</button></article>;
  })}</section>}
      </main>
      <aside className="network-insight"><section><BrainCircuit size={19} /><span>How ranking works</span><h3>Relevance before popularity.</h3><p>Shared expertise, professional interests, career fit, useful adjacency, and mutual connections matter more than follower count.</p></section><section><ShieldCheck size={19} /><span>Your controls</span><h3>Negative feedback is real data.</h3><p>Dismissals, “not relevant,” mutes, and blocks immediately change what can appear again.</p></section><section><Zap size={19} /><span>Exploration</span><h3>Small, controlled discovery.</h3><p>A narrow exploration slot prevents an echo chamber without turning your network into random roulette.</p></section></aside>
    </div>{toast && <div className="toast"><CheckCircle2 size={16} />{toast}</div>}
  </div>;
}
function SourceConnectionPanel({ onImported }) {
  const [context, setContext] = useState(null);
  const [sources, setSources] = useState([]);
  const [provider, setProvider] = useState("SUBSTACK");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const tenant = await loadTenantContext(data.user.id);
    setContext(tenant);
    try {
      setSources(await nativePublishing.listSources());
    } catch {
      setSources([]);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  const connect = async (event) => {
    event.preventDefault();
    if (!context?.tenant?.id || !context?.profile?.id) return;
    setBusy(true);
    setMessage("");
    try {
      const source = await nativePublishing.connectPublicSource(context.tenant.id, context.profile.id, provider, url);
      if (provider === "LINKEDIN") setMessage("LinkedIn is connected for secure sharing. Automatic import will activate only after approved OAuth API access is configured.");
      else {
        const count = await nativePublishing.synchronizeSource(source);
        setMessage(`${count} ${provider.toLowerCase()} posts synchronized into your StackedIN feed.`);
        onImported?.();
      }
      setUrl("");
      await load();
    } catch (sourceError) {
      setMessage(sourceError.message || "Source could not be connected.");
    } finally {
      setBusy(false);
    }
  };
  const synchronize = async (source) => {
    setBusy(true);
    setMessage("");
    try {
      const count = await nativePublishing.synchronizeSource(source);
      setMessage(`${count} posts synchronized from ${source.provider}.`);
      await load();
      onImported?.();
    } catch (syncError) {
      setMessage(syncError.message || "Source synchronization failed.");
      await load();
    } finally {
      setBusy(false);
    }
  };
  const disconnect = async (source) => {
    setBusy(true);
    setMessage("");
    try {
      await nativePublishing.disconnectSource(source.id);
      setMessage(`${source.provider} source disconnected. Existing imported references remain in your library.`);
      await load();
    } catch (disconnectError) {
      setMessage(disconnectError.message || "Source could not be disconnected.");
    } finally {
      setBusy(false);
    }
  };
  return <section className="source-connection-panel xstudio-source-panel"><div><span>XStudio source engine</span><h3>Connect, verify, and synchronize</h3><p>Public Substack, Medium, Hashnode, and RSS feeds import into StackedIN as internal reference articles. LinkedIn stays share-only until its approved OAuth publishing API is connected.</p></div><form onSubmit={connect}><select value={provider} onChange={(event) => setProvider(event.target.value)}><option>SUBSTACK</option><option>MEDIUM</option><option>HASHNODE</option><option>LINKEDIN</option><option>RSS</option></select><input required type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://your-publication-or-profile" /><button disabled={busy || !context}>{busy ? <RefreshCw className="spin" size={14} /> : <Plus size={14} />}Connect & sync</button></form>{message && <div className="source-message">{message}</div>}<div className="connected-source-list">{sources.map((source) => <article key={source.id}><div><PlatformIcon name={source.provider === "SUBSTACK" ? "Substack" : source.provider === "MEDIUM" ? "Medium" : source.provider === "HASHNODE" ? "Hashnode" : "LinkedIn"} size={18} /></div><section><strong>{source.provider}</strong><span>{source.profile_url}</span><small>{source.last_synced_at ? `${source.last_post_count || 0} posts \xB7 synced ${formatDate(source.last_synced_at)}` : source.last_error || "Waiting for first synchronization"}</small></section><em className={`source-status status-${source.status.toLowerCase()}`}>{source.status.replace("_", " ")}</em><footer>{source.capabilities?.import && <button disabled={busy} onClick={() => synchronize(source)}><RefreshCw size={12} />Sync now</button>}<button disabled={busy} onClick={() => disconnect(source)}><Trash2 size={12} />Disconnect</button></footer></article>)}{!sources.length && <p>No sources connected yet. Your first sync is one URL away.</p>}</div></section>;
}
function CMSOperationsView({ view, articles, jobs, onWrite, error }) {
  const openArticle = (articleId) => {
    sessionStorage.setItem("xstudio-editor-article", articleId);
    onWrite();
  };
  const startArticle = () => {
    sessionStorage.removeItem("xstudio-editor-article");
    onWrite();
  };
  const counts = {
    draft: articles.filter((item) => item.status === "draft").length,
    scheduled: articles.filter((item) => item.status === "scheduled").length,
    published: articles.filter((item) => item.status === "published").length
  };
  if (view === "cms") return <>
    <section className="cms-hero"><div><span>XStudio CMS</span><h2>One editorial system.<br />Every destination.</h2><p>Build structured content, preview it, preserve every revision, and distribute it without surrendering platform credentials.</p></div><button onClick={startArticle}><PenTool size={16} />Create content</button></section>
    {error && <div className="error-banner"><X size={16} />{error}</div>}
    <section className="metric-grid"><MetricCard label="Drafts" value={counts.draft} note="Autosaved workspace content" icon={FileText} accent="slate" /><MetricCard label="Scheduled" value={counts.scheduled} note="Waiting in the native queue" icon={CalendarDays} accent="amber" /><MetricCard label="Published" value={counts.published} note="Live StackedIN content" icon={Globe2} accent="lime" /><MetricCard label="Delivery jobs" value={jobs.length} note="Native and handoff destinations" icon={Send} accent="cyan" /></section>
    <section className="panel cms-content-table"><SectionHeading eyebrow="Editorial library" title={`${articles.length} native CMS items`} action={<button className="text-button" onClick={startArticle}>New article <Plus size={14} /></button>} /><div>{articles.map(article => <button key={article.id} onClick={() => openArticle(article.id)}><span className={`cms-status-dot ${article.status}`} /><section><strong>{article.title || "Untitled draft"}</strong><small>{article.pillar || "Unassigned pillar"}{article.series ? ` · ${article.series}` : ""}</small></section><em className={article.status}>{article.status}</em><span>{formatSyncTime(article.updated_at)}</span><PenTool size={14} /></button>)}{!articles.length && <div className="empty-state"><PenTool /><h3>The canvas is open</h3><p>Create your first XStudio draft.</p><button className="button primary" onClick={startArticle}>Start writing</button></div>}</div></section>
  </>;
  if (view === "calendar") {
    const scheduled = articles.filter(item => item.status === "scheduled").sort((a, b) => new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime());
    return <><SectionHeading eyebrow="Editorial cadence" title="Content calendar" action={<button className="button primary" onClick={startArticle}><Plus size={14} />Schedule content</button>} /><section className="calendar-board"><header><div><CalendarDays size={22} /><span><strong>Upcoming schedule</strong><small>Times use the reader’s local timezone</small></span></div><b>{scheduled.length}</b></header><div>{scheduled.map(article => <button key={article.id} onClick={() => openArticle(article.id)}><time><strong>{new Date(article.scheduled_for).toLocaleDateString("en", { day: "2-digit" })}</strong><span>{new Date(article.scheduled_for).toLocaleDateString("en", { month: "short" })}</span></time><section><h3>{article.title}</h3><p>{article.description || "No description yet"}</p><span>{formatSyncTime(article.scheduled_for)} · {(article.distribution_targets || []).join(" · ")}</span></section><ChevronRight size={16} /></button>)}{!scheduled.length && <div className="empty-state"><CalendarDays /><h3>No scheduled content</h3><p>Choose a future time in the XStudio editor to build your publishing cadence.</p></div>}</div></section></>;
  }
  return <><SectionHeading eyebrow="Delivery operations" title="Distribution queue" action={<button className="button primary" onClick={startArticle}><PenTool size={14} />Prepare content</button>} /><div className="security-note"><ShieldCheck size={18} /><div><strong>Provider-safe distribution</strong><span>StackedIN is native. External jobs are marked as secure handoffs until an approved OAuth connector is active.</span></div></div><section className="panel distribution-table"><header><span>Article</span><span>Destination</span><span>Mode</span><span>Status</span><span>Schedule</span></header>{jobs.map(job => { const article = articles.find(item => item.id === job.article_id); return <button key={job.id} onClick={() => openArticle(job.article_id)}><strong>{article?.title || "CMS article"}</strong><span>{job.platform}</span><span>{job.delivery_mode}</span><em className={job.status.toLowerCase()}>{job.status.replaceAll("_", " ")}</em><span>{job.scheduled_for ? formatSyncTime(job.scheduled_for) : "On save"}</span></button>; })}{!jobs.length && <div className="empty-state"><Send /><h3>No delivery jobs yet</h3><p>Select destinations in an article’s Distribution panel.</p></div>}</section></>;
}
function Dashboard({ onExit, onWrite, session }) {
  const [catalogue, setCatalogue] = useState({ posts: [], source: "", lastSyncedAt: null });
  const [ownedImports, setOwnedImports] = useState([]);
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
  const [cmsArticles, setCmsArticles] = useState([]);
  const [distributionJobs, setDistributionJobs] = useState([]);
  const [cmsError, setCmsError] = useState("");
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
      setLoading(false);
      setSyncing(false);
    }
  }, []);
  const fetchOwnedImports = useCallback(async () => {
    try {
      setOwnedImports(await nativePublishing.listOwnedImports());
    } catch (importError) {
      if (!importError.message?.includes("import_publication_batch")) console.error(importError);
    }
  }, []);
  useEffect(() => {
    fetchCatalogue();
  }, [fetchCatalogue]);
  useEffect(() => {
    fetchOwnedImports();
  }, [fetchOwnedImports]);
  const fetchCMS = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const context = await loadTenantContext(session.user.id);
      const [nativeArticles, queue] = await Promise.all([nativePublishing.listCMSArticles(context.tenant.id), nativePublishing.listDistributionJobs(context.tenant.id)]);
      setCmsArticles(nativeArticles);
      setDistributionJobs(queue);
      setCmsError("");
    } catch (cmsLoadError) {
      setCmsError(`${cmsLoadError.message || "CMS data is unavailable."} Apply migration 009 if needed.`);
    }
  }, [session?.user?.id]);
  useEffect(() => {
    fetchCMS();
    const channel = nativePublishing.subscribe(fetchCMS);
    return () => { supabase.removeChannel(channel); };
  }, [fetchCMS]);
  useEffect(() => {
    if (!toast) return void 0;
    const timer = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(timer);
  }, [toast]);
  const posts = useMemo(() => {
    const merged = new Map(catalogue.posts.map((post) => [post.url, post]));
    ownedImports.forEach((article) => {
      if (!article.external_url) return;
      merged.set(article.external_url, { id: article.id, title: article.title, description: article.description, url: article.external_url, publishedAt: article.published_at, platform: article.source_provider ? article.source_provider.charAt(0) + article.source_provider.slice(1).toLowerCase() : "RSS", pillar: article.pillar || "Imported Knowledge", series: article.series || "Connected Sources", tags: article.tags || article.hashtags || [], coverImage: article.cover_image_url, status: "Published" });
    });
    return [...merged.values()].map((post) => ({ ...post, views: Number(metrics[slugOf(post.url)]?.views ?? post.views ?? 0), shares: Number(metrics[slugOf(post.url)]?.shares ?? post.shares ?? 0) }));
  }, [catalogue.posts, metrics, ownedImports]);
  const pillars = useMemo(() => groupBy(posts, "pillar"), [posts]);
  const seriesGroups = useMemo(() => groupBy(posts, "series"), [posts]);
  const pillarNames = useMemo(() => Object.keys(pillars).sort(), [pillars]);
  const seriesNames = useMemo(() => Object.keys(seriesGroups).sort(), [seriesGroups]);
  const platformNames = useMemo(() => [...new Set(posts.map((post) => post.platform || "Substack"))].sort(), [posts]);
  const toneFor = (name) => PILLAR_TONES[Math.max(0, pillarNames.indexOf(name)) % PILLAR_TONES.length];
  const totals = useMemo(() => ({
    published: posts.filter((post) => post.status !== "Draft").length,
    views: posts.reduce((sum, post) => sum + (post.views || 0), 0),
    shares: posts.reduce((sum, post) => sum + (post.shares || 0), 0)
  }), [posts]);
  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    return posts.filter((post) => {
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
  const openModule = (name) => {
    setPillar(name);
    setSeries("");
    setSearch("");
    setView("library");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const openSeries = (name) => {
    setSeries(name);
    setPillar("");
    setSearch("");
    setView("library");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const clearFilters = () => {
    setSearch("");
    setPillar("");
    setSeries("");
    setPlatform("");
    setSort("index");
  };
  const navTitle = NAV_ITEMS.find((item) => item.id === view)?.label || "Overview";
  const importMetrics = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCSV(String(reader.result || ""));
      let matched = 0;
      const next = { ...metrics };
      rows.forEach((row) => {
        const title = (row.title || row.post_title || row.article_title || "").toLowerCase();
        const url = row.url || row.post_url || "";
        const match = posts.find((post) => url && slugOf(url) === slugOf(post.url) || title && post.title.toLowerCase().includes(title));
        if (!match) return;
        next[slugOf(match.url)] = {
          views: Number(String(row.views || row.total_views || row.view_count || 0).replace(/,/g, "")) || 0,
          shares: Number(String(row.shares || row.total_shares || row.share_count || 0).replace(/,/g, "")) || 0,
          importedAt: (/* @__PURE__ */ new Date()).toISOString()
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
      <button className="studio-brand brand-button" onClick={onExit}><img className="studio-brand__mark" src={`${import.meta.env.BASE_URL}stackcraft-studio-logo.jpg`} alt="XStudio" /><div><strong>XStudio</strong><span>StackedIN publishing studio</span></div></button>
      <nav aria-label="Studio navigation">{NAV_ITEMS.map((item) => {
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
          <button className="button primary" onClick={() => { sessionStorage.removeItem("xstudio-editor-article"); onWrite(); }}><PenTool size={15} />Open CMS editor</button>
        </div>
      </header>
      <div className="mobile-nav" aria-label="Mobile navigation">{NAV_ITEMS.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)}>{item.label}</button>)}</div>
      {error && <div className="error-banner"><X size={17} />{error}<button onClick={() => fetchCatalogue()}>Retry</button></div>}
      {loading ? <div className="loading-state"><RefreshCw className="spin" /><p>Building your publishing map…</p></div> : <div className="view-frame">
        {["cms", "calendar", "distribution"].includes(view) && <CMSOperationsView view={view} articles={cmsArticles} jobs={distributionJobs} onWrite={onWrite} error={cmsError} />}
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
              <div className="pillar-bars">{Object.entries(pillars).sort((a, b) => b[1].length - a[1].length).map(([name, items]) => <button key={name} onClick={() => openModule(name)}><span className={`pillar-swatch tone-${toneFor(name)}`} /><div><strong>{name}</strong><span>{new Set(items.map((item) => item.series)).size} series</span></div><div className="bar"><i className={`tone-${toneFor(name)}`} style={{ width: `${items.length / posts.length * 100}%` }} /></div><em>{items.length}</em></button>)}</div>
            </div>
            <div className="panel latest-panel">
              <SectionHeading eyebrow="Momentum" title="Recently added" action={<button className="text-button" onClick={() => setView("library")}>View all <ChevronRight size={15} /></button>} />
              <div className="latest-list">{latestPosts.map((post) => <a href={post.url} target="_blank" rel="noreferrer" key={post.url}><span className={`tone-${toneFor(post.pillar)}`}>{post.code || "NEW"}</span><div><strong>{post.title}</strong><small>{post.pillar} · {formatDate(post.publishedAt)}</small></div><ArrowUpRight size={15} /></a>)}</div>
            </div>
          </section>
        </>}
        {view === "platforms" && <>
          <SectionHeading eyebrow="Publishing launchpad" title="Write securely on every platform" />
          <div className="security-note"><CheckCircle2 size={18} /><div><strong>Your passwords never touch XStudio.</strong><span>Public feeds import through verified URLs; external writing buttons hand authentication back to the official platform.</span></div></div>
          <SourceConnectionPanel onImported={fetchOwnedImports} />
          <section className="platform-grid">{PLATFORMS.map((item) => {
    const count = posts.filter((post) => (post.platform || "Substack") === item.name).length;
    return <article className="platform-card" key={item.name} style={{ "--platform-color": item.color }}>
              <div className="platform-card__head"><div className="platform-logo"><PlatformIcon name={item.name} size={25} /></div><span className="verified-chip"><CheckCircle2 size={12} />Official handoff</span></div>
              <h3>{item.name}</h3><a className="platform-handle" href={item.profile} target="_blank" rel="noreferrer">{item.handle}<ExternalLink size={12} /></a>
              <div className="platform-stats"><div><strong>{count}</strong><span>tracked posts</span></div><div><strong>{item.name === "LinkedIn" ? "Secure" : "6 hr"}</strong><span>{item.feed}</span></div></div>
              <div className="platform-actions"><a className="button primary" href={item.editor} target="_blank" rel="noreferrer"><PlatformIcon name={item.name} size={15} />Write on {item.name}</a><a className="button secondary" href={item.profile} target="_blank" rel="noreferrer">View profile</a></div>
            </article>;
  })}</section>
          <div className="panel platform-help"><SectionHeading eyebrow="How it works" title="One studio, provider-managed security" /><p>XStudio indexes public feeds and opens official editors without storing provider passwords. LinkedIn automatic import remains capability-gated until approved OAuth API access exists.</p></div>
        </>}
        {view === "library" && <section className="panel library-panel">
          <SectionHeading eyebrow="Master catalogue" title={`${filtered.length} of ${posts.length} articles`} action={<button className="text-button" onClick={clearFilters}>Clear filters <X size={14} /></button>} />
          <div className="filterbar">
            <label className="searchbox"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title, topic, tag…" /></label>
            <label><Filter size={14} /><select value={pillar} onChange={(event) => setPillar(event.target.value)}><option value="">All pillars</option>{pillarNames.map((name) => <option key={name}>{name}</option>)}</select></label>
            <label><ListFilter size={14} /><select value={series} onChange={(event) => setSeries(event.target.value)}><option value="">All series</option>{seriesNames.map((name) => <option key={name}>{name}</option>)}</select></label>
            <label><Share2 size={14} /><select value={platform} onChange={(event) => setPlatform(event.target.value)}><option value="">All platforms</option>{platformNames.map((name) => <option key={name}>{name}</option>)}</select></label>
            <select aria-label="Sort posts" value={sort} onChange={(event) => setSort(event.target.value)}><option value="index">Series order</option><option value="newest">Newest first</option><option value="title">Title A–Z</option><option value="views">Most viewed</option></select>
          </div>
          <div className="post-list">{filtered.map((post) => <PostRow key={post.url} post={post} tone={toneFor(post.pillar)} />)}{!filtered.length && <div className="empty-state"><BookOpen /><h3>No matching articles</h3><p>Try removing a filter or using a broader search.</p></div>}</div>
        </section>}
        {view === "modules" && <>
          <SectionHeading eyebrow="Knowledge domains" title={`${pillarNames.length} modular content pillars`} />
          <section className="module-grid">{Object.entries(pillars).sort((a, b) => b[1].length - a[1].length).map(([name, items]) => {
    const moduleSeries = [...new Set(items.map((item) => item.series))];
    const tags = [...new Set(items.flatMap((item) => item.tags || []))].slice(0, 5);
    return <button className="module-card" key={name} onClick={() => openModule(name)}><div className={`module-card__mark tone-${toneFor(name)}`}><Layers3 /></div><div className="module-card__count">{items.length}<span>articles</span></div><h3>{name}</h3><p>{moduleSeries.length} connected series building one coherent knowledge domain.</p><div className="tag-line">{tags.map((tag) => <span key={tag}>{tag}</span>)}</div><footer><span>{moduleSeries.join(" \xB7 ")}</span><ChevronRight size={17} /></footer></button>;
  })}</section>
        </>}
        {view === "series" && <section className="panel series-panel">
          <SectionHeading eyebrow="Learning paths" title={`${seriesNames.length} structured series`} />
          <div className="series-list">{Object.entries(seriesGroups).sort((a, b) => b[1].length - a[1].length).map(([name, items], index) => <button key={name} onClick={() => openSeries(name)}><div className="series-rank">{String(index + 1).padStart(2, "0")}</div><div className="series-body"><span>{items[0]?.pillar}</span><h3>{name}</h3><p>{items.map((item) => item.code).filter(Boolean).slice(0, 6).join(" \xB7 ")}{items.length > 6 ? ` \xB7 +${items.length - 6}` : ""}</p></div><div className="series-count"><strong>{items.length}</strong><span>posts</span></div><ChevronRight size={18} /></button>)}</div>
        </section>}
        {view === "analytics" && <>
          <section className="metric-grid analytics-metrics">
            <MetricCard label="Article views" value={compactNumber.format(totals.views)} note="From your imported platform CSV" icon={BarChart3} accent="violet" />
            <MetricCard label="Shares" value={compactNumber.format(totals.shares)} note="From your imported platform CSV" icon={Share2} accent="cyan" />
            <MetricCard label="Measured posts" value={posts.filter((post) => post.views || post.shares).length} note={`Out of ${posts.length} published posts`} icon={CheckCircle2} accent="lime" />
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
              {[...posts].sort((a, b) => b.views - a.views).slice(0, 8).map((post, index) => <div className="performance-row" key={post.url}><span>{index + 1}</span><div><strong>{post.title}</strong><i><b style={{ width: `${totals.views ? post.views / Math.max(...posts.map((item) => item.views), 1) * 100 : 0}%` }} /></i></div><em>{compactNumber.format(post.views)}</em></div>)}
            </div>
          </section>
        </>}
      </div>}
      <footer className="site-footer"><span>XStudio · The connected publishing engine inside StackedIN</span><span><CalendarDays size={13} /> Public sources sync on demand into your native feed</span></footer>
    </main>
    {toast && <div className="toast"><CheckCircle2 size={16} />{toast}</div>}
  </div>;
}
function App() {
  const [route, setRoute] = useState(() => window.location.hash.replace("#", "") || "home");
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setAuthReady(true);
      if (nextSession && ["home", "login"].includes(window.location.hash.replace("#", "") || "home")) window.location.hash = "feed";
      if (event === "SIGNED_OUT") window.location.hash = "";
    });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    const onHashChange = () => setRoute(window.location.hash.replace("#", "") || "home");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  const navigate = (next) => {
    window.location.hash = next;
    setRoute(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const openSearch = (query) => {
    sessionStorage.setItem("stackedin-professional-search", query || "");
    navigate("search");
  };
  const openProfile = (profileId) => {
    const target = typeof profileId === "string" && /^[0-9a-f-]{36}$/i.test(profileId) ? profileId : session?.user?.id;
    navigate(target && target !== session?.user?.id ? `profile-${target}` : "profile");
  };
  const openInbox = (conversationId) => {
    if (conversationId) sessionStorage.setItem("stackedin-inbox-conversation", conversationId);
    else sessionStorage.removeItem("stackedin-inbox-conversation");
    navigate("inbox");
  };
  const openStudio = () => navigate(session ? "studio" : "login");
  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("home");
  };
  if (!authReady) return <div className="auth-loading"><img src={`${import.meta.env.BASE_URL}stackedin-icon.webp`} alt="StackedIN" /><RefreshCw className="spin" /></div>;
  const protectedRoute = ["feed", "network", "search", "profile", "inbox", "write", "studio"].includes(route) || route.startsWith("article-") || route.startsWith("profile-");
  if (route === "login" || protectedRoute && !session) return <AuthView onBack={() => navigate("home")} />;
  if ((route === "feed" || route.startsWith("article-")) && session) return <FeedExperience session={session} openStudio={() => navigate("studio")} openNetwork={() => navigate("network")} openSearch={openSearch} openWrite={() => navigate("write")} openProfile={openProfile} openInbox={openInbox} signOut={signOut} />;
  if (route === "network" && session) return <NetworkExperience session={session} openFeed={() => navigate("feed")} openSearch={openSearch} openProfile={openProfile} openStudio={() => navigate("studio")} signOut={signOut} />;
  if (route === "search" && session) return <SearchExperience session={session} openFeed={() => navigate("feed")} openNetwork={() => navigate("network")} openProfile={openProfile} openStudio={() => navigate("studio")} signOut={signOut} />;
  if ((route === "profile" || route.startsWith("profile-")) && session) return <ProfileExperience session={session} targetProfileId={route.startsWith("profile-") ? route.slice(8) : session.user.id} openFeed={() => navigate("feed")} openWrite={() => navigate("write")} openInbox={openInbox} openStudio={() => navigate("studio")} signOut={signOut} />;
  if (route === "inbox" && session) return <MessagingExperience session={session} initialConversationId={sessionStorage.getItem("stackedin-inbox-conversation") || ""} openFeed={() => navigate("feed")} openProfile={openProfile} openWrite={() => navigate("write")} openStudio={() => navigate("studio")} />;
  if (route === "write" && session) return <WriteExperience session={session} openFeed={() => navigate("feed")} openProfile={openProfile} openStudio={() => navigate("studio")} />;
  if (route === "studio" && session) return <Dashboard session={session} onExit={() => navigate("feed")} onWrite={() => navigate("write")} />;
  return <MarketingLanding openStudio={openStudio} />;
}
export {
  App as default
};
