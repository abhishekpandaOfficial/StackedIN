import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, BrainCircuit, FileText, Image, LoaderCircle, Paperclip, PenTool, Plus, Send, Sparkles, UserRoundPlus, Video, X } from "lucide-react";
import { NativePublishingService } from "../services/nativePublishing.ts";
import { scoreWritingSignals } from "../domain/writingSignals.js";
import { supabase } from "../../supabase.js";
import AIScoreDialog from "./AIScoreDialog.jsx";
import SocialAccountManager, { ProviderIcon, SOCIAL_PROVIDERS } from "./SocialAccountManager.jsx";

const publishing = new NativePublishingService(supabase);
const EXTERNALS = Object.keys(SOCIAL_PROVIDERS);
const hashtagPattern = /(?:^|\s)#([a-zA-Z0-9_.-]+)/g;

export default function FeedComposer({ session, tenantContext, onPublished, openArticle, onToast }) {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [mentions, setMentions] = useState([]);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionResults, setMentionResults] = useState([]);
  const [poll, setPoll] = useState(null);
  const [destinations, setDestinations] = useState(["STACKEDIN"]);
  const [accounts, setAccounts] = useState([]);
  const [managerOpen, setManagerOpen] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [aiAssistOpen, setAiAssistOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiProvider, setAiProvider] = useState("openai");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const fileInput = useRef(null);
  const writingInput = useRef(null);
  const name = tenantContext?.profile?.display_name || session.user.email?.split("@")[0] || "StackedIN member";
  const score = useMemo(() => scoreWritingSignals(body), [body]);
  const hashtags = useMemo(() => [...body.matchAll(hashtagPattern)].map(match => match[1]), [body]);
  const limitWarnings = destinations.filter(provider => SOCIAL_PROVIDERS[provider]?.maxText && body.length > SOCIAL_PROVIDERS[provider].maxText).map(provider => `${SOCIAL_PROVIDERS[provider].label}: ${body.length}/${SOCIAL_PROVIDERS[provider].maxText}`);

  const loadAccounts = async () => {
    try { setAccounts(await publishing.listSocialAccounts()); } catch { setAccounts([]); }
  };
  useEffect(() => { if (open) void loadAccounts(); }, [open]);
  useEffect(() => {
    const cursor = writingInput.current?.selectionStart ?? body.length;
    const token = body.slice(0, cursor).match(/(?:^|\s)@([a-zA-Z0-9_.-]{1,40})$/)?.[1] || "";
    setMentionQuery(token);
    if (!token) return void setMentionResults([]);
    const timer = setTimeout(() => publishing.searchMentions(token).then(setMentionResults).catch(() => setMentionResults([])), 180);
    return () => clearTimeout(timer);
  }, [body]);

  const chooseFile = mode => {
    if (!fileInput.current) return;
    fileInput.current.accept = mode === "image" ? "image/*" : mode === "video" ? "video/mp4,video/webm" : ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt";
    fileInput.current.click();
  };
  const launch = mode => {
    if (mode === "article") return openArticle();
    setOpen(true);
    if (mode === "poll") setPoll({ question: "", options: ["", ""], duration: 24 });
    if (["image", "video", "document"].includes(mode)) setTimeout(() => chooseFile(mode), 0);
  };
  const upload = async event => {
    const files = [...(event.target.files || [])].slice(0, 6 - attachments.length);
    if (!files.length) return;
    setBusy("upload"); setError("");
    try {
      const uploaded = await Promise.all(files.map(async file => ({
        id: crypto.randomUUID(), name: file.name,
        type: file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : "document",
        url: await publishing.uploadAttachment(session.user.id, file),
      })));
      setAttachments(current => [...current, ...uploaded]);
    } catch (uploadError) { setError(uploadError.message); }
    finally { setBusy(""); event.target.value = ""; }
  };
  const addMention = profile => {
    const replacement = `@${profile.slug || String(profile.display_name || "member").replace(/\s+/g, "")}`;
    const cursor = writingInput.current?.selectionStart ?? body.length;
    const before = body.slice(0, cursor).replace(new RegExp(`@${mentionQuery}$`), `${replacement} `);
    setBody(`${before}${body.slice(cursor)}`);
    setMentions(current => current.some(item => item.id === profile.id) ? current : [...current, profile]);
    setMentionResults([]);
  };
  const toggleDestination = provider => {
    if (!accounts.some(account => account.provider === provider)) return setManagerOpen(true);
    setDestinations(current => current.includes(provider) ? current.filter(item => item !== provider) : [...current, provider]);
  };
  const publish = async () => {
    if (!tenantContext?.tenant?.id || !body.trim()) return;
    if (poll && (!poll.question.trim() || poll.options.filter(value => value.trim()).length < 2)) return setError("Add a poll question and at least two choices.");
    setBusy("publish"); setError("");
    try {
      const blocks = [{ id: crypto.randomUUID(), type: "paragraph", text: body.trim() }, ...attachments.map(item => item.type === "image"
        ? { id: item.id, type: "image", url: item.url, alt: item.name, caption: item.name }
        : item.type === "video" ? { id: item.id, type: "video", url: item.url, caption: item.name }
          : { id: item.id, type: "button", label: `Open ${item.name}`, url: item.url })];
      const article = await publishing.publishFeedPost({ tenantId: tenantContext.tenant.id, body, blocks, hashtags, mentions: mentions.map(item => item.id), distribution: destinations, writingScore: score });
      if (poll) await publishing.createPoll(article.id, poll.question, poll.options, Number(poll.duration));
      setOpen(false); setBody(""); setAttachments([]); setMentions([]); setPoll(null); setDestinations(["STACKEDIN"]);
      onToast?.(destinations.length > 1 ? "Published on StackedIN. External delivery packages are in XStudio." : "Post published to your network.");
      await onPublished?.();
    } catch (publishError) { setError(publishError.message || "The post could not be published."); }
    finally { setBusy(""); }
  };
  const runAIAssist = async () => {
    if (!aiPrompt.trim()) return;
    setBusy("ai"); setError("");
    try {
      const { data } = await supabase.auth.getSession();
      const response = await fetch("/api/ai-writing", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${data.session?.access_token || ""}` },
        body: JSON.stringify({ provider: aiProvider, prompt: aiPrompt, currentText: body }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "AI writing assistance is unavailable.");
      setBody(payload.text || body);
      setAiAssistOpen(false);
      onToast?.(`${aiProvider === "openai" ? "OpenAI" : "Claude"} draft added. Review it in your own voice before publishing.`);
    } catch (assistError) { setError(assistError.message); }
    finally { setBusy(""); }
  };

  return <>
    <section className="feed-composer unified-composer">
      <div className="feed-composer-row"><div>{tenantContext?.profile?.avatar_url ? <img src={tenantContext.profile.avatar_url} alt="" /> : name.charAt(0).toUpperCase()}</div><button onClick={() => launch("post")}>Share your insight or achievement…</button></div>
      <footer><button onClick={() => launch("image")}><Image size={17} />Photo</button><button onClick={() => launch("document")}><FileText size={17} />Document</button><button onClick={() => launch("video")}><Video size={17} />Video</button><button onClick={() => launch("poll")}><BarChart3 size={17} />Poll</button><button onClick={() => launch("article")}><PenTool size={17} />Article</button></footer>
    </section>
    <input ref={fileInput} hidden type="file" multiple onChange={upload} />
    {open && <div className="post-composer-backdrop" onMouseDown={event => event.target === event.currentTarget && !busy && setOpen(false)}>
      <section className="post-composer-dialog" role="dialog" aria-modal="true" aria-labelledby="post-composer-title">
        <header><div><span>StackedIN post</span><h2 id="post-composer-title">Create a post</h2></div><button onClick={() => setOpen(false)}><X size={18} /></button></header>
        <div className="post-composer-author"><div>{name.charAt(0).toUpperCase()}</div><span><strong>{name}</strong><small>Publishing to your professional network</small></span></div>
        <div className="post-composer-writing">
          <textarea ref={writingInput} autoFocus value={body} onChange={event => setBody(event.target.value)} maxLength={5000} placeholder="What do you want to talk about? Use @ to mention someone and # to create a hashtag." />
          {mentionResults.length > 0 && <div className="mention-suggestions">{mentionResults.map(profile => <button key={profile.id} onClick={() => addMention(profile)}><div>{profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : String(profile.display_name || "S").charAt(0)}</div><span><strong>{profile.display_name || "StackedIN member"}</strong><small>{profile.headline || `@${profile.slug}`}</small></span><UserRoundPlus size={14} /></button>)}</div>}
          <div className="composer-token-row">{mentions.map(person => <b key={person.id}>@{person.slug || person.display_name}</b>)}{hashtags.map(tag => <b key={tag}>#{tag}</b>)}</div>
        </div>
        {attachments.length > 0 && <div className="composer-attachments">{attachments.map(item => <article key={item.id}>{item.type === "image" ? <img src={item.url} alt="" /> : item.type === "video" ? <Video size={24} /> : <FileText size={24} />}<span><strong>{item.name}</strong><small>{item.type}</small></span><button onClick={() => setAttachments(current => current.filter(value => value.id !== item.id))}><X size={14} /></button></article>)}</div>}
        {poll && <section className="composer-poll"><header><BarChart3 size={15} /><strong>Poll</strong><button onClick={() => setPoll(null)}><X size={14} /></button></header><input value={poll.question} onChange={event => setPoll({ ...poll, question: event.target.value })} maxLength={280} placeholder="Ask a useful question" />{poll.options.map((option, index) => <div key={index}><input value={option} onChange={event => setPoll({ ...poll, options: poll.options.map((value, optionIndex) => optionIndex === index ? event.target.value : value) })} maxLength={140} placeholder={`Option ${index + 1}`} />{poll.options.length > 2 && <button onClick={() => setPoll({ ...poll, options: poll.options.filter((_, optionIndex) => optionIndex !== index) })}><X size={13} /></button>}</div>)}{poll.options.length < 4 && <button className="add-poll-option" onClick={() => setPoll({ ...poll, options: [...poll.options, ""] })}><Plus size={13} />Add option</button>}<label>Poll duration<select value={poll.duration} onChange={event => setPoll({ ...poll, duration: Number(event.target.value) })}><option value={24}>1 day</option><option value={72}>3 days</option><option value={168}>7 days</option></select></label></section>}
        <div className="composer-tools"><button onClick={() => chooseFile("image")}><Image size={16} />Photo</button><button onClick={() => chooseFile("document")}><Paperclip size={16} />Document</button><button onClick={() => chooseFile("video")}><Video size={16} />Video</button><button onClick={() => setPoll(poll || { question: "", options: ["", ""], duration: 24 })}><BarChart3 size={16} />Poll</button><button onClick={() => setAiAssistOpen(value => !value)}><Sparkles size={16} />AI assist</button><button onClick={() => setScoreOpen(true)}><BrainCircuit size={16} />AI signal</button></div>
        {aiAssistOpen && <section className="composer-ai-assist"><header><div><Sparkles size={15} /><span><strong>AI writing assistant</strong><small>Keys stay in Vercel—never in this browser.</small></span></div><select value={aiProvider} onChange={event => setAiProvider(event.target.value)}><option value="openai">OpenAI</option><option value="anthropic">Claude</option></select></header><textarea value={aiPrompt} onChange={event => setAiPrompt(event.target.value)} maxLength={2000} placeholder="Describe the post, tone, audience, facts, and outcome. The assistant will draft; you remain the editor." /><button disabled={!aiPrompt.trim() || busy === "ai"} onClick={runAIAssist}>{busy === "ai" ? <LoaderCircle className="spin" size={14} /> : <Sparkles size={14} />}Generate draft</button></section>}
        <section className="composer-distribution"><header><div><Send size={15} /><span><strong>Write once, publish anywhere</strong><small>StackedIN publishes now. Connected APIs deliver directly; other destinations receive a safe handoff package.</small></span></div><button onClick={() => setManagerOpen(true)}>Manage accounts</button></header><div><button className="selected" disabled><img src={`${import.meta.env.BASE_URL}stackedin-icon.webp`} alt="" />StackedIN</button>{EXTERNALS.map(provider => <button className={destinations.includes(provider) ? "selected" : ""} key={provider} onClick={() => toggleDestination(provider)} title={SOCIAL_PROVIDERS[provider].maxText ? `Conservative text limit: ${SOCIAL_PROVIDERS[provider].maxText}` : "Long-form destination"}><ProviderIcon provider={provider} size={15} />{SOCIAL_PROVIDERS[provider].label}{!accounts.some(account => account.provider === provider) && <i>Connect</i>}</button>)}</div>{limitWarnings.length > 0 && <p className="composer-limit-warning">Shorten or adapt before direct delivery: {limitWarnings.join(" · ")}. XStudio keeps the full StackedIN version.</p>}</section>
        {error && <div className="composer-error">{error}</div>}
        <footer className="post-composer-footer"><span>{body.length}/5000 · {score.confidence} signal confidence</span><button disabled={!body.trim() || Boolean(busy)} onClick={publish}>{busy === "publish" ? <LoaderCircle className="spin" size={15} /> : <Send size={15} />}Publish</button></footer>
      </section>
    </div>}
    {managerOpen && <SocialAccountManager tenantId={tenantContext?.tenant?.id} onClose={() => setManagerOpen(false)} onChange={loadAccounts} />}
    {scoreOpen && <AIScoreDialog score={score} onClose={() => setScoreOpen(false)} />}
  </>;
}
