import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft, CalendarClock, Check, ChevronRight, Clock3, Copy, Eye, FileText,
  Globe2, History, ImagePlus, Library, LoaderCircle, Monitor, PanelRight, PenTool,
  Plus, Save, Search, Send, Settings2, ShieldCheck, Smartphone, Sparkles, Undo2, X, Zap,
} from "lucide-react";
import { SiHashnode, SiMedium, SiSubstack } from "@icons-pack/react-simple-icons";
import { supabase } from "../../supabase.js";
import { loadTenantContext } from "../../tenant.js";
import { NativePublishingService } from "../services/nativePublishing.ts";
import { ContentBlocks, createContentBlock, RichBlockEditor } from "./RichBlockEditor.jsx";

const publishing = new NativePublishingService(supabase);
const LinkedInIcon = ({ size = 16 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5.4 7.7H1.8V22h3.6V7.7ZM3.6 2A2.1 2.1 0 1 0 3.6 6.2 2.1 2.1 0 0 0 3.6 2Zm18.6 11.8c0-4.3-2.3-6.3-5.4-6.3-2.5 0-3.6 1.4-4.2 2.3V7.7H9V22h3.6v-7.1c0-1.9.4-3.8 2.8-3.8 2.4 0 2.4 2.2 2.4 3.9v7h3.6l.8-8.2Z" /></svg>;
const RECOVERY_KEY = "xstudio-cms-recovery-v1";
const EDITORS = {
  SUBSTACK: "https://substack.com/home/post/p-redirect",
  MEDIUM: "https://medium.com/new-story",
  HASHNODE: "https://hashnode.com/draft/new",
  LINKEDIN: "https://www.linkedin.com/article/new/",
};
const PLATFORM_META = {
  STACKEDIN: { label: "StackedIN", mode: "Native", icon: Sparkles },
  SUBSTACK: { label: "Substack", mode: "Secure handoff", icon: SiSubstack },
  MEDIUM: { label: "Medium", mode: "Secure handoff", icon: SiMedium },
  HASHNODE: { label: "Hashnode", mode: "Secure handoff", icon: SiHashnode },
  LINKEDIN: { label: "LinkedIn", mode: "Secure handoff", icon: LinkedInIcon },
};

const slugify = value => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
const splitValues = value => [...new Set(String(value || "").split(/[\s,]+/).map(item => item.trim().replace(/^#/, "")).filter(Boolean))].slice(0, 20);
const formatMoment = value => value ? new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Never";
const emptyDraft = () => ({
  id: null,
  title: "",
  description: "",
  contentType: "ARTICLE",
  blocks: [createContentBlock("paragraph")],
  tags: "",
  hashtags: "",
  pillar: "",
  series: "",
  coverImageUrl: "",
  slug: "",
  seoTitle: "",
  seoDescription: "",
  canonicalUrl: "",
  socialImageUrl: "",
  scheduledFor: "",
  targets: { STACKEDIN: true, SUBSTACK: false, MEDIUM: false, HASHNODE: false, LINKEDIN: false },
  platformOverrides: {},
});

function articleToDraft(article) {
  const targets = { STACKEDIN: true, SUBSTACK: false, MEDIUM: false, HASHNODE: false, LINKEDIN: false };
  (article.distribution_targets || []).forEach(platform => { targets[platform] = true; });
  return {
    id: article.id,
    title: article.title || "",
    description: article.description || "",
    contentType: article.content_type || "ARTICLE",
    blocks: article.content_blocks?.length ? article.content_blocks : [createContentBlock("paragraph")],
    tags: (article.tags || []).join(", "),
    hashtags: (article.hashtags || []).map(tag => `#${tag}`).join(" "),
    pillar: article.pillar || "",
    series: article.series || "",
    coverImageUrl: article.cover_image_url || "",
    slug: article.slug || "",
    seoTitle: article.seo_title || "",
    seoDescription: article.seo_description || "",
    canonicalUrl: article.canonical_url || "",
    socialImageUrl: article.social_image_url || "",
    scheduledFor: article.scheduled_for ? new Date(article.scheduled_for).toISOString().slice(0, 16) : "",
    targets,
    platformOverrides: article.editor_metadata?.platformOverrides || {},
  };
}

function blockPlainText(block) {
  if (block.type === "code") return block.code || "";
  if (["bullet_list", "numbered_list", "checklist"].includes(block.type)) return (block.items || []).map(item => item.text).join(" ");
  if (block.type === "table") return (block.rows || []).flat().join(" ");
  return block.text || block.caption || block.label || "";
}

function toMarkdown(draft) {
  const body = draft.blocks.map(block => {
    if (block.type === "heading") return `## ${block.text}`;
    if (block.type === "subheading") return `### ${block.text}`;
    if (block.type === "quote") return `> ${block.text}`;
    if (block.type === "code") return `\`\`\`${block.language || ""}\n${block.code || ""}\n\`\`\``;
    if (block.type === "image") return `![${block.alt || block.caption || "Image"}](${block.url || ""})${block.caption ? `\n_${block.caption}_` : ""}`;
    if (block.type === "video") return `[${block.caption || "Media"}](${block.url || ""})`;
    if (block.type === "bullet_list") return (block.items || []).map(item => `- ${item.text}`).join("\n");
    if (block.type === "numbered_list") return (block.items || []).map((item, index) => `${index + 1}. ${item.text}`).join("\n");
    if (block.type === "checklist") return (block.items || []).map(item => `- [${item.checked ? "x" : " "}] ${item.text}`).join("\n");
    if (block.type === "callout") return `> **${block.tone || "Note"}:** ${block.text}`;
    if (block.type === "table") return (block.rows || []).map((row, index) => `${row.map(cell => `| ${cell} `).join("")}|${index === 0 ? `\n${row.map(() => "| --- ").join("")}|` : ""}`).join("\n");
    if (block.type === "button") return `[${block.label || "Open"}](${block.url || ""})`;
    if (block.type === "divider") return "---";
    return block.text || "";
  }).filter(Boolean).join("\n\n");
  return `# ${draft.title || "Untitled"}\n\n${draft.description ? `${draft.description}\n\n` : ""}${body}\n\n${splitValues(draft.hashtags).map(tag => `#${tag}`).join(" ")}`.trim();
}

function PlatformIcon({ platform, size = 16 }) {
  const Icon = PLATFORM_META[platform].icon;
  return <Icon size={size} />;
}

export default function XStudioEditor({ session, openFeed, openProfile, openStudio }) {
  const [context, setContext] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [articles, setArticles] = useState([]);
  const [revisions, setRevisions] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [sideTab, setSideTab] = useState("publish");
  const [mode, setMode] = useState("edit");
  const [device, setDevice] = useState("desktop");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saveState, setSaveState] = useState("Saved locally");
  const initialized = useRef(false);
  const saveTimer = useRef(null);

  const patchDraft = useCallback(patch => setDraft(current => ({ ...current, ...(typeof patch === "function" ? patch(current) : patch) })), []);
  const loadLibrary = useCallback(async tenantId => {
    const items = await publishing.listCMSArticles(tenantId);
    setArticles(items);
    return items;
  }, []);
  const loadArticle = useCallback(async articleId => {
    setBusy("loading");
    setError("");
    try {
      const [article, articleRevisions, distributionJobs] = await Promise.all([
        publishing.getCMSArticle(articleId), publishing.listRevisions(articleId), publishing.listDistributionJobs(context?.tenant?.id || "", articleId),
      ]);
      setDraft(articleToDraft(article));
      setRevisions(articleRevisions);
      setJobs(distributionJobs);
      sessionStorage.setItem("xstudio-editor-article", articleId);
      localStorage.setItem(RECOVERY_KEY, JSON.stringify(articleToDraft(article)));
      setSaveState(`Saved ${formatMoment(article.updated_at)}`);
    } catch (loadError) {
      setError(loadError.message || "This article could not be loaded.");
    } finally {
      setBusy("");
    }
  }, [context?.tenant?.id]);

  useEffect(() => {
    let active = true;
    loadTenantContext(session.user.id).then(async loaded => {
      if (!active) return;
      setContext(loaded);
      try {
        const items = await loadLibrary(loaded.tenant.id);
        const requestedId = sessionStorage.getItem("xstudio-editor-article");
        const requested = items.find(item => item.id === requestedId);
        if (requested) {
          setDraft(articleToDraft(requested));
          const [history, queue] = await Promise.all([publishing.listRevisions(requested.id), publishing.listDistributionJobs(loaded.tenant.id, requested.id)]);
          setRevisions(history);
          setJobs(queue);
        } else {
          try {
            const recovered = JSON.parse(localStorage.getItem(RECOVERY_KEY) || "null");
            if (recovered && !recovered.id) setDraft({ ...emptyDraft(), ...recovered });
          } catch { /* Ignore an invalid local recovery snapshot. */ }
        }
      } catch (loadError) {
        setError(`${loadError.message || "XStudio data is unavailable."} Apply migration 009 if it has not been installed yet.`);
      } finally {
        initialized.current = true;
      }
    }).catch(() => setError("Your publishing workspace could not be loaded."));
    return () => { active = false; };
  }, [loadLibrary, session.user.id]);

  useEffect(() => {
    if (!initialized.current) return;
    localStorage.setItem(RECOVERY_KEY, JSON.stringify(draft));
    setSaveState("Unsaved changes");
    clearTimeout(saveTimer.current);
    if (!context?.tenant?.id || (!draft.title.trim() && !draft.blocks.some(block => blockPlainText(block).trim()))) return;
    saveTimer.current = setTimeout(() => void persist("draft", true), 2200);
    return () => clearTimeout(saveTimer.current);
  // persist intentionally uses the latest draft snapshot from this effect.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, context?.tenant?.id]);

  useEffect(() => {
    const shortcut = event => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") { event.preventDefault(); void persist("draft"); }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "p") { event.preventDefault(); setMode(current => current === "preview" ? "edit" : "preview"); }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, context]);

  const wordCount = useMemo(() => `${draft.title} ${draft.description} ${draft.blocks.map(blockPlainText).join(" ")}`.trim().split(/\s+/).filter(Boolean).length, [draft]);
  const readingMinutes = Math.max(1, Math.ceil(wordCount / 220));
  const filteredArticles = useMemo(() => articles.filter(article => `${article.title} ${article.status}`.toLowerCase().includes(query.toLowerCase())), [articles, query]);
  const selectedTargets = Object.entries(draft.targets).filter(([, enabled]) => enabled).map(([platform]) => platform);

  async function persist(status = "draft", automatic = false) {
    if (!context?.tenant?.id || busy && !automatic) return null;
    if (status !== "draft" && !draft.title.trim()) { setError("Add a title before publishing or scheduling."); return null; }
    setBusy(automatic ? "autosave" : status);
    setError("");
    if (automatic) setSaveState("Autosaving…");
    try {
      const saved = await publishing.saveCMS({
        tenantId: context.tenant.id,
        articleId: draft.id,
        title: draft.title,
        description: draft.description,
        contentType: draft.contentType,
        blocks: draft.blocks,
        tags: splitValues(draft.tags),
        hashtags: splitValues(draft.hashtags),
        coverImageUrl: draft.coverImageUrl || null,
        pillar: draft.pillar,
        series: draft.series,
        slug: draft.slug || slugify(draft.title),
        seo: { title: draft.seoTitle, description: draft.seoDescription, canonicalUrl: draft.canonicalUrl, socialImageUrl: draft.socialImageUrl },
        status,
        scheduledFor: status === "scheduled" ? new Date(draft.scheduledFor).toISOString() : null,
        distribution: Object.entries(draft.targets).map(([platform, enabled]) => ({ platform, enabled, ...(draft.platformOverrides[platform] || {}) })),
        metadata: { platformOverrides: draft.platformOverrides, editorVersion: "XSTUDIO_BLOCKS_V2", devicePreview: device, autosave: automatic },
      });
      const next = articleToDraft(saved);
      setDraft(current => current.id === saved.id && current.slug === (saved.slug || current.slug)
        ? current
        : { ...current, id: saved.id, slug: saved.slug || current.slug });
      sessionStorage.setItem("xstudio-editor-article", saved.id);
      localStorage.setItem(RECOVERY_KEY, JSON.stringify(next));
      setSaveState(`Saved ${new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date())}`);
      const [items, history, queue] = await Promise.all([loadLibrary(context.tenant.id), publishing.listRevisions(saved.id), publishing.listDistributionJobs(context.tenant.id, saved.id)]);
      setArticles(items);
      setRevisions(history);
      setJobs(queue);
      if (!automatic) setNotice(status === "published" ? "Published to the StackedIN feed." : status === "scheduled" ? "Scheduled and added to the publishing queue." : "Draft saved with a new revision.");
      return saved;
    } catch (saveError) {
      setError(saveError.message || "XStudio could not save this article.");
      setSaveState("Stored in local recovery");
      return null;
    } finally {
      setBusy("");
    }
  }

  const newDraft = () => {
    sessionStorage.removeItem("xstudio-editor-article");
    localStorage.removeItem(RECOVERY_KEY);
    setDraft(emptyDraft());
    setRevisions([]);
    setJobs([]);
    setMode("edit");
    setNotice("");
    setError("");
  };
  const uploadImage = file => publishing.uploadImage(session.user.id, file);
  const copyPackage = async platform => {
    await navigator.clipboard.writeText(toMarkdown({ ...draft, ...(draft.platformOverrides[platform] || {}) }));
    setNotice(`${PLATFORM_META[platform].label} publishing package copied. Paste it into the official editor.`);
  };
  const restore = async revisionId => {
    setBusy("restore");
    try {
      const restored = await publishing.restoreRevision(revisionId);
      setDraft(articleToDraft(restored));
      setNotice("Revision restored as the current draft.");
      await loadArticle(restored.id);
    } catch (restoreError) { setError(restoreError.message); } finally { setBusy(""); }
  };
  const chooseArticle = article => { void loadArticle(article.id); setMode("edit"); };
  const statusLabel = articles.find(article => article.id === draft.id)?.status || "draft";

  return <div className="xstudio-editor-page">
    <header className="xstudio-editor-topbar">
      <div><button onClick={openStudio}><ArrowLeft size={16} />XStudio</button><span className="xstudio-editor-logo"><img src={`${import.meta.env.BASE_URL}stackedin-icon.webp`} alt="" /><b>XStudio</b><em>CMS</em></span></div>
      <section><span className={`save-state ${saveState === "Unsaved changes" ? "dirty" : ""}`}>{busy === "autosave" ? <LoaderCircle className="spin" size={13} /> : <Check size={13} />}{saveState}</span><button className={mode === "edit" ? "active" : ""} onClick={() => setMode("edit")}><PenTool size={14} />Edit</button><button className={mode === "preview" ? "active" : ""} onClick={() => setMode("preview")}><Eye size={14} />Preview</button><button onClick={() => void persist("draft")} disabled={Boolean(busy)}><Save size={14} />Save</button><button className="publish" onClick={() => { setSideTab("publish"); }}><Send size={14} />Publish</button></section>
    </header>
    <main className="xstudio-cms-shell">
      <aside className="xstudio-content-rail">
        <header><div><span>Content workspace</span><h2>Library</h2></div><button onClick={newDraft} title="New article"><Plus size={16} /></button></header>
        <label><Search size={14} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search drafts" /></label>
        <div className="content-rail-filters"><button className="active">All <b>{articles.length}</b></button><button>Drafts <b>{articles.filter(item => item.status === "draft").length}</b></button><button>Queue <b>{articles.filter(item => item.status === "scheduled").length}</b></button></div>
        <div className="content-rail-list">{filteredArticles.map(article => <button className={article.id === draft.id ? "active" : ""} key={article.id} onClick={() => chooseArticle(article)}><span className={`content-status ${article.status}`} /><section><strong>{article.title || "Untitled draft"}</strong><small>{article.status} · {formatMoment(article.updated_at)}</small></section><ChevronRight size={13} /></button>)}{!filteredArticles.length && <div className="content-rail-empty"><FileText size={22} /><p>Your first draft starts here.</p></div>}</div>
        <footer><button onClick={openFeed}><Globe2 size={14} />View live feed</button><button onClick={openProfile}><Library size={14} />My profile</button></footer>
      </aside>

      <section className={`xstudio-editor-workspace ${mode} ${device}`}>
        <header className="editor-document-bar"><div><span className={`document-status ${statusLabel}`}>{statusLabel}</span><small>{wordCount} words · {readingMinutes} min read</small></div>{mode === "preview" && <div><button className={device === "desktop" ? "active" : ""} onClick={() => setDevice("desktop")}><Monitor size={14} /></button><button className={device === "mobile" ? "active" : ""} onClick={() => setDevice("mobile")}><Smartphone size={14} /></button></div>}</header>
        {mode === "edit" ? <div className="xstudio-document-canvas">
          <input className="xstudio-document-title" value={draft.title} onChange={event => patchDraft({ title: event.target.value, slug: draft.slug || slugify(event.target.value) })} placeholder="Untitled masterpiece" maxLength={240} />
          <textarea className="xstudio-document-deck" value={draft.description} onChange={event => patchDraft({ description: event.target.value })} placeholder="Give readers a crisp promise: what will they learn or be able to do?" maxLength={1000} />
          {draft.coverImageUrl && <div className="xstudio-cover-preview"><img src={draft.coverImageUrl} alt="Cover preview" /><button onClick={() => patchDraft({ coverImageUrl: "" })}><X size={14} /></button></div>}
          <RichBlockEditor blocks={draft.blocks} onChange={blocks => patchDraft({ blocks })} onUploadImage={uploadImage} />
        </div> : <article className="xstudio-live-preview"><header>{draft.coverImageUrl && <img src={draft.coverImageUrl} alt="" />}<span>{draft.pillar || "StackedIN Knowledge"}{draft.series ? ` · ${draft.series}` : ""}</span><h1>{draft.title || "Untitled draft"}</h1><p>{draft.description}</p><footer><b>{context?.profile?.display_name || session.user.email?.split("@")[0]}</b><span>{readingMinutes} min read · {selectedTargets.length} destination{selectedTargets.length === 1 ? "" : "s"}</span></footer></header><div className="preview-hashtags">{splitValues(draft.hashtags).map(tag => <b key={tag}>#{tag}</b>)}</div><ContentBlocks blocks={draft.blocks} /></article>}
      </section>

      <aside className="xstudio-settings-rail">
        <nav>{[["publish", Send], ["details", Settings2], ["seo", Search], ["distribution", Globe2], ["history", History]].map(([id, Icon]) => <button key={id} className={sideTab === id ? "active" : ""} onClick={() => setSideTab(id)} title={id}><Icon size={16} /><span>{id}</span></button>)}</nav>
        <div className="xstudio-settings-panel">
          {sideTab === "publish" && <><header><span>Workflow</span><h3>Publish</h3><p>Choose when this version becomes visible.</p></header><div className="publish-actions"><button disabled={Boolean(busy)} onClick={() => void persist("draft")}><Save size={15} /><span><strong>Save draft</strong><small>Create a restorable revision</small></span></button><button className="primary" disabled={Boolean(busy)} onClick={() => void persist("published")}><Zap size={15} /><span><strong>Publish now</strong><small>Live in the StackedIN feed</small></span></button></div><label className="schedule-field"><CalendarClock size={15} /><span>Schedule date and time</span><input type="datetime-local" value={draft.scheduledFor} min={new Date(Date.now() + 60000).toISOString().slice(0, 16)} onChange={event => patchDraft({ scheduledFor: event.target.value })} /></label><button className="schedule-button" disabled={Boolean(busy) || !draft.scheduledFor} onClick={() => void persist("scheduled")}><Clock3 size={14} />Add to schedule</button><div className="timezone-note"><Globe2 size={13} />Your browser timezone: {Intl.DateTimeFormat().resolvedOptions().timeZone}</div></>}
          {sideTab === "details" && <><header><span>Structure</span><h3>Content details</h3><p>Organise the work for discovery and reuse.</p></header><label>Format<select value={draft.contentType} onChange={event => patchDraft({ contentType: event.target.value })}><option value="ARTICLE">Long-form article</option><option value="POST">Professional post</option></select></label><label>Content pillar<input value={draft.pillar} onChange={event => patchDraft({ pillar: event.target.value })} placeholder="Machine Learning" /></label><label>Series<input value={draft.series} onChange={event => patchDraft({ series: event.target.value })} placeholder="100 Days of ML" /></label><label>Tags<input value={draft.tags} onChange={event => patchDraft({ tags: event.target.value })} placeholder="AI, Architecture, MLOps" /><small>{splitValues(draft.tags).length}/20 tags</small></label><label>Hashtags<input value={draft.hashtags} onChange={event => patchDraft({ hashtags: event.target.value })} placeholder="#AI #Architecture" /><small>{splitValues(draft.hashtags).length}/20 hashtags</small></label><label>Cover image URL<div className="url-field"><ImagePlus size={14} /><input type="url" value={draft.coverImageUrl} onChange={event => patchDraft({ coverImageUrl: event.target.value })} placeholder="https://…" /></div></label></>}
          {sideTab === "seo" && <><header><span>Discovery</span><h3>SEO & social</h3><p>Control how the article appears in search and shares.</p></header><label>URL slug<input value={draft.slug} onChange={event => patchDraft({ slug: slugify(event.target.value) })} placeholder="article-slug" /><small>/article/{draft.slug || "your-slug"}</small></label><label>SEO title<input value={draft.seoTitle} onChange={event => patchDraft({ seoTitle: event.target.value })} maxLength={70} placeholder={draft.title || "Search title"} /><small>{draft.seoTitle.length}/70</small></label><label>Meta description<textarea value={draft.seoDescription} onChange={event => patchDraft({ seoDescription: event.target.value })} maxLength={160} placeholder={draft.description || "Search description"} /><small>{draft.seoDescription.length}/160</small></label><label>Canonical URL<input type="url" value={draft.canonicalUrl} onChange={event => patchDraft({ canonicalUrl: event.target.value })} placeholder="https://…" /></label><label>Social image URL<input type="url" value={draft.socialImageUrl} onChange={event => patchDraft({ socialImageUrl: event.target.value })} placeholder="https://…" /></label><div className="search-snippet"><span>stackedin.app › article › {draft.slug || "draft"}</span><strong>{draft.seoTitle || draft.title || "Your article title"}</strong><p>{draft.seoDescription || draft.description || "Your search description will appear here."}</p></div></>}
          {sideTab === "distribution" && <><header><span>Write once</span><h3>Distribution</h3><p>StackedIN is native. Other destinations use an official-editor handoff until an approved API connector is active.</p></header><div className="distribution-targets">{Object.entries(PLATFORM_META).map(([platform, meta]) => <article className={draft.targets[platform] ? "selected" : ""} key={platform}><label><input type="checkbox" checked={Boolean(draft.targets[platform])} disabled={platform === "STACKEDIN"} onChange={event => patchDraft(current => ({ targets: { ...current.targets, [platform]: event.target.checked } }))} /><PlatformIcon platform={platform} /><span><strong>{meta.label}</strong><small>{meta.mode}</small></span></label>{draft.targets[platform] && platform !== "STACKEDIN" && <footer><button onClick={() => void copyPackage(platform)}><Copy size={12} />Copy package</button><a href={EDITORS[platform]} target="_blank" rel="noreferrer"><Send size={12} />Official editor</a></footer>}</article>)}</div><div className="distribution-trust"><ShieldCheck size={15} /><p>XStudio never asks for platform passwords. API connectors will use provider OAuth and server-side secrets.</p></div>{jobs.length > 0 && <div className="article-job-list"><strong>Current delivery status</strong>{jobs.map(job => <div key={job.id}><PlatformIcon platform={job.platform} size={13} /><span>{PLATFORM_META[job.platform]?.label || job.platform}</span><b className={job.status.toLowerCase()}>{job.status.replaceAll("_", " ")}</b></div>)}</div>}</>}
          {sideTab === "history" && <><header><span>Version control</span><h3>Revision history</h3><p>Every manual save, schedule, and publication creates a restorable snapshot.</p></header><div className="revision-list">{revisions.map(revision => <article key={revision.id}><div><History size={14} /><span><strong>Version {revision.revision_no}</strong><small>{formatMoment(revision.created_at)}</small></span></div><button disabled={Boolean(busy)} onClick={() => void restore(revision.id)}><Undo2 size={12} />Restore</button></article>)}{!revisions.length && <div className="settings-empty"><History size={22} /><p>Save the draft to create its first revision.</p></div>}</div></>}
        </div>
      </aside>
    </main>
    {(error || notice) && <div className={`xstudio-editor-toast ${error ? "error" : "success"}`}>{error ? <X size={15} /> : <Check size={15} />}<span>{error || notice}</span><button onClick={() => { setError(""); setNotice(""); }}><X size={13} /></button></div>}
  </div>;
}
