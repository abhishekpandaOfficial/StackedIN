import { useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, Globe2, LoaderCircle, PlugZap, ShieldCheck, Trash2, X } from "lucide-react";
import { SiHashnode, SiInstagram, SiMedium, SiSubstack, SiThreads, SiX } from "@icons-pack/react-simple-icons";
import { NativePublishingService } from "../services/nativePublishing.ts";
import { supabase } from "../../supabase.js";

export const SOCIAL_PROVIDERS = {
  SUBSTACK: { label: "Substack", icon: SiSubstack, docs: "https://support.substack.com/hc/en-us/sections/360004398252-Publishing", method: "Official editor handoff", maxText: null },
  MEDIUM: { label: "Medium", icon: SiMedium, docs: "https://help.medium.com/hc/en-us/sections/360001768028-Writing-and-publishing", method: "Official editor handoff", maxText: null },
  HASHNODE: { label: "Hashnode", icon: SiHashnode, docs: "https://apidocs.hashnode.com/", method: "Token/API capable", maxText: null },
  LINKEDIN: { label: "LinkedIn", icon: null, docs: "https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api", method: "Approved OAuth application", maxText: 3000 },
  INSTAGRAM: { label: "Instagram", icon: SiInstagram, docs: "https://developers.facebook.com/documentation/instagram-platform/content-publishing", method: "Meta OAuth + professional account", maxText: 2200 },
  X: { label: "X", icon: SiX, docs: "https://docs.x.com/x-api/posts/create-post", method: "X OAuth 2.0", maxText: 280 },
  THREADS: { label: "Threads", icon: SiThreads, docs: "https://developers.facebook.com/documentation/threads/posts", method: "Meta Threads OAuth", maxText: 500 },
};

const publishing = new NativePublishingService(supabase);

function ProviderIcon({ provider, size = 18 }) {
  const Icon = SOCIAL_PROVIDERS[provider]?.icon;
  return Icon ? <Icon size={size} /> : <span className="linkedin-glyph" aria-hidden="true">in</span>;
}

export default function SocialAccountManager({ tenantId, onClose, onChange }) {
  const [accounts, setAccounts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ handle: "", profileUrl: "" });
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const load = async () => {
    try { setAccounts(await publishing.listSocialAccounts()); } catch (loadError) { setError(loadError.message); }
  };
  useEffect(() => { void load(); }, []);
  const save = async event => {
    event.preventDefault();
    setBusy(editing);
    setError("");
    try {
      await publishing.configureSocialHandoff(tenantId, editing, form.handle, form.profileUrl);
      setEditing(null);
      setForm({ handle: "", profileUrl: "" });
      await load();
      onChange?.();
    } catch (saveError) { setError(saveError.message); } finally { setBusy(""); }
  };
  const disconnect = async account => {
    setBusy(account.provider);
    try { await publishing.disconnectSocialAccount(account.id); await load(); onChange?.(); }
    catch (disconnectError) { setError(disconnectError.message); } finally { setBusy(""); }
  };
  return <div className="social-manager-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="social-manager" role="dialog" aria-modal="true" aria-labelledby="social-manager-title">
      <header><div><Globe2 size={20} /><span><small>Publishing identity</small><h2 id="social-manager-title">Manage social accounts</h2></span></div><button onClick={onClose} aria-label="Close social account manager"><X size={18} /></button></header>
      <div className="social-security-note"><ShieldCheck size={17} /><p>Passwords and API keys never belong in the browser. OAuth credentials and provider tokens must be stored server-side; a handoff connection opens the platform’s official editor safely.</p></div>
      {error && <div className="social-manager-error">{error}</div>}
      <div className="social-account-grid">{Object.entries(SOCIAL_PROVIDERS).map(([provider, meta]) => {
        const account = accounts.find(item => item.provider === provider);
        const connected = account?.status === "CONNECTED";
        const ready = connected || account?.status === "HANDOFF_READY";
        return <article key={provider} className={ready ? "ready" : ""}><div className="social-provider-icon"><ProviderIcon provider={provider} /></div><section><strong>{meta.label}</strong><span>{account?.handle || meta.method}</span><small>{connected ? "Direct publishing connected" : ready ? "Official-editor handoff ready" : "Connection required"}</small></section><em className={connected ? "connected" : ready ? "handoff" : "missing"}>{connected ? <CheckCircle2 size={12} /> : <PlugZap size={12} />}{connected ? "Connected" : ready ? "Handoff" : "Set up"}</em><footer><a href={meta.docs} target="_blank" rel="noreferrer">Official setup <ExternalLink size={11} /></a>{account ? <button disabled={Boolean(busy)} onClick={() => disconnect(account)}><Trash2 size={12} />Disconnect</button> : <button onClick={() => { setEditing(provider); setForm({ handle: "", profileUrl: "" }); }}><PlugZap size={12} />Connect</button>}</footer></article>;
      })}</div>
      {editing && <form className="social-handoff-form" onSubmit={save}><header><div><ProviderIcon provider={editing} /><span><strong>Connect {SOCIAL_PROVIDERS[editing].label}</strong><small>Save the official profile and enable safe editor handoff.</small></span></div><button type="button" onClick={() => setEditing(null)}><X size={14} /></button></header><label>Account handle<input value={form.handle} onChange={event => setForm({ ...form, handle: event.target.value })} placeholder="@yourhandle" /></label><label>Official HTTPS profile URL<input required type="url" value={form.profileUrl} onChange={event => setForm({ ...form, profileUrl: event.target.value })} placeholder="https://…" /></label><footer><button type="button" onClick={() => setEditing(null)}>Cancel</button><button disabled={Boolean(busy)}>{busy ? <LoaderCircle className="spin" size={14} /> : <CheckCircle2 size={14} />}Save connection</button></footer></form>}
      <footer className="social-manager-footer"><p>Direct one-click API publishing activates only when the platform approves the app and its OAuth credentials are configured on the server.</p><button onClick={onClose}>Done</button></footer>
    </section>
  </div>;
}

export { ProviderIcon };
