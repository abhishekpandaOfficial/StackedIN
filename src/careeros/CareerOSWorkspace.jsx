import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bot,
  BriefcaseBusiness,
  Check,
  Clock3,
  FileText,
  Globe2,
  Loader2,
  LockKeyhole,
  MessageCircle,
  Mic2,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  Upload,
  UserRound,
  Workflow,
} from "lucide-react";
import { supabase } from "../../supabase.js";
import { loadTenantContext } from "../../tenant.js";
import { CareerOSService } from "../services/careerOS.ts";
import "./careeros-workspace.css";

const service = new CareerOSService(supabase);

const COUNTRY_OPTIONS = [
  { code: "DE", flag: "🇩🇪", name: "Germany", currency: "EUR" },
  { code: "IE", flag: "🇮🇪", name: "Ireland", currency: "EUR" },
  { code: "NL", flag: "🇳🇱", name: "Netherlands", currency: "EUR" },
  { code: "AE", flag: "🇦🇪", name: "UAE", currency: "AED" },
  { code: "GB", flag: "🇬🇧", name: "United Kingdom", currency: "GBP" },
  { code: "SG", flag: "🇸🇬", name: "Singapore", currency: "SGD" },
  { code: "AU", flag: "🇦🇺", name: "Australia", currency: "AUD" },
  { code: "CA", flag: "🇨🇦", name: "Canada", currency: "CAD" },
];

const DEFAULT_ROLES = [
  "Enterprise AI Solution Architect",
  "GenAI Solution Architect",
  "Agentic AI Architect",
  "Principal AI Engineer",
  "Staff AI Engineer",
  "Lead AI Engineer",
  "AI Platform Architect",
];

const EMPTY_FORM = {
  current_title: "",
  current_company: "",
  current_country_code: "IN",
  current_salary: "",
  current_currency: "INR",
  years_experience: "",
  notice_period_days: "",
  relocation_open: true,
  sponsorship_required: true,
  remote_preference: "HYBRID_OK",
  agent_mode: "HITL",
  match_threshold: 82,
  auto_prepare_threshold: 90,
};

function navigate(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  window.location.reload();
}

function trialLabel(subscription) {
  if (!subscription) return "Not started";
  if (subscription.plan !== "TRIAL") return subscription.plan === "ANNUAL" ? "Annual" : "Monthly";
  const expiry = new Date(subscription.trial_expires_at);
  if (Number.isNaN(expiry.getTime())) return "24-hour audit";
  const remaining = expiry.getTime() - Date.now();
  if (remaining <= 0) return "Audit expired";
  const hours = Math.max(1, Math.ceil(remaining / 3_600_000));
  return `${hours}h audit remaining`;
}

function Metric({ icon: Icon, label, value, note }) {
  return (
    <article className="cos-metric">
      <span className="cos-metric__icon"><Icon size={17} /></span>
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{note}</small>
    </article>
  );
}

function AgentModeCard({ value, selected, title, description, badge, disabled, onSelect }) {
  return (
    <button
      type="button"
      className={`cos-mode${selected ? " is-selected" : ""}`}
      disabled={disabled}
      onClick={() => onSelect(value)}
    >
      <span className="cos-mode__top"><Bot size={18} /><em>{badge}</em></span>
      <strong>{title}</strong>
      <small>{description}</small>
      {selected ? <span className="cos-mode__selected"><Check size={13} /> Selected</span> : null}
    </button>
  );
}

export default function CareerOSWorkspace() {
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [user, setUser] = useState(null);
  const [tenant, setTenant] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [activeView, setActiveView] = useState("overview");
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedCountries, setSelectedCountries] = useState([]);
  const [roles, setRoles] = useState(DEFAULT_ROLES.slice(0, 5));
  const [roleDraft, setRoleDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [autonomousConsent, setAutonomousConsent] = useState(false);

  const refresh = async (resolvedTenant = tenant, resolvedUser = user) => {
    if (!resolvedTenant?.id || !resolvedUser?.id) return;
    const data = await service.loadDashboard(resolvedTenant.id, resolvedUser.id);
    setDashboard(data);
    if (data.profile) {
      setForm(current => ({
        ...current,
        ...Object.fromEntries(Object.entries(data.profile).filter(([, value]) => value !== null)),
        current_salary: data.profile.current_salary ?? "",
        years_experience: data.profile.years_experience ?? "",
        notice_period_days: data.profile.notice_period_days ?? "",
      }));
    }
    if (data.countries.length) {
      setSelectedCountries(data.countries.map(country => ({
        country_code: country.country_code,
        priority: Number(country.priority ?? 50),
        minimum_salary: country.minimum_salary ?? "",
        currency: country.currency ?? COUNTRY_OPTIONS.find(option => option.code === country.country_code)?.currency ?? null,
        visa_required: country.visa_required !== false,
        relocation_required: country.relocation_required !== false,
        enabled: country.enabled !== false,
      })));
    }
    if (data.roles.length) setRoles(data.roles.map(role => String(role.role_name)));
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!authData.user) {
          if (active) setStatus("signed-out");
          return;
        }
        const context = await loadTenantContext(authData.user.id);
        if (!context?.tenant) throw new Error("Your private StackedIN workspace is not ready yet.");
        if (!active) return;
        setUser(authData.user);
        setTenant(context.tenant);
        await service.ensureCareerProfile(context.tenant.id, authData.user.id);
        await service.ensureTrial(context.tenant.id, authData.user.id);
        if (!active) return;
        await refresh(context.tenant, authData.user);
        if (active) setStatus("ready");
      } catch (caught) {
        if (!active) return;
        const message = caught instanceof Error ? caught.message : "CareerOS could not start.";
        setError(message.includes("career_") || message.includes("schema cache")
          ? "CareerOS database migration 015 has not been applied to Supabase yet. Apply it before opening the workspace."
          : message);
        setStatus("error");
      }
    })();
    return () => { active = false; };
  }, []);

  const applications = dashboard?.applications ?? [];
  const matches = dashboard?.matches ?? [];
  const subscription = dashboard?.subscription ?? null;
  const highMatches = matches.filter(match => Number(match.overall_score) >= 90).length;
  const interviews = applications.filter(application => application.status === "INTERVIEW").length;
  const submitted = applications.filter(application => ["SUBMITTED", "VIEWED", "RECRUITER_CONTACT", "INTERVIEW", "OFFER", "REJECTED"].includes(application.status)).length;
  const isTrial = subscription?.plan === "TRIAL";
  const trialExpired = isTrial && new Date(subscription.trial_expires_at).getTime() <= Date.now();

  const countryMap = useMemo(() => new Map(selectedCountries.map(country => [country.country_code, country])), [selectedCountries]);

  const toggleCountry = option => {
    setSelectedCountries(current => {
      const exists = current.some(country => country.country_code === option.code);
      if (exists) return current.filter(country => country.country_code !== option.code);
      return [...current, {
        country_code: option.code,
        priority: 50,
        minimum_salary: "",
        currency: option.currency,
        visa_required: true,
        relocation_required: true,
        enabled: true,
      }];
    });
  };

  const updateCountry = (code, changes) => {
    setSelectedCountries(current => current.map(country => country.country_code === code ? { ...country, ...changes } : country));
  };

  const addRole = () => {
    const next = roleDraft.trim();
    if (!next || roles.some(role => role.toLowerCase() === next.toLowerCase())) return;
    setRoles(current => [...current, next].slice(0, 20));
    setRoleDraft("");
  };

  const saveProfile = async () => {
    if (!tenant?.id || !user?.id) return;
    if (form.agent_mode === "AUTONOMOUS" && !autonomousConsent) {
      setError("Confirm autonomous-application authorization before selecting Autonomous mode.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await service.saveProfile(tenant.id, user.id, {
        ...form,
        current_salary: form.current_salary === "" ? null : Number(form.current_salary),
        years_experience: form.years_experience === "" ? null : Number(form.years_experience),
        notice_period_days: form.notice_period_days === "" ? null : Number(form.notice_period_days),
        profile_status: "VERIFIED",
      });
      await service.replaceTargetCountries(tenant.id, user.id, selectedCountries.map(country => ({
        ...country,
        minimum_salary: country.minimum_salary === "" ? null : Number(country.minimum_salary),
      })));
      await service.replaceTargetRoles(tenant.id, user.id, roles);
      await service.recordConsent(tenant.id, user.id, "PROFILE_ACCURACY", true);
      await service.recordConsent(tenant.id, user.id, "DOCUMENT_GENERATION", true);
      if (form.agent_mode === "AUTONOMOUS") {
        await service.recordConsent(tenant.id, user.id, "AUTONOMOUS_APPLICATION", true);
      }
      await refresh();
      setNotice("Career policy saved. Your private workspace is ready for the discovery engine.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save CareerOS settings.");
    } finally {
      setSaving(false);
    }
  };

  const uploadCV = async event => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !tenant?.id || !user?.id) return;
    setUploading(true);
    setError("");
    try {
      await service.uploadMasterCV(tenant.id, user.id, file);
      setNotice(`${file.name} is now stored in your private CareerOS document vault.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "CV upload failed.");
    } finally {
      setUploading(false);
    }
  };

  if (status === "loading") {
    return <main className="cos-state"><Loader2 className="cos-spin" size={28} /><strong>Starting your private CareerOS workspace…</strong><span>Loading tenant boundary, career profile, and 24-hour audit.</span></main>;
  }

  if (status === "signed-out") {
    return (
      <main className="cos-state">
        <LockKeyhole size={34} />
        <strong>Sign in to create your private CareerOS workspace.</strong>
        <span>CareerOS uses your existing StackedIN identity. No separate account is created.</span>
        <button type="button" onClick={() => navigate("/login")}>Continue to StackedIN sign in <ArrowRight size={16} /></button>
        <button className="cos-link-button" type="button" onClick={() => navigate("/careeros")}><ArrowLeft size={14} /> Back to CareerOS</button>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="cos-state">
        <ShieldCheck size={34} />
        <strong>CareerOS foundation needs attention.</strong>
        <span>{error}</span>
        <button type="button" onClick={() => window.location.reload()}>Retry</button>
        <button className="cos-link-button" type="button" onClick={() => navigate("/careeros")}><ArrowLeft size={14} /> Back to landing</button>
      </main>
    );
  }

  return (
    <main className="cos-app">
      <aside className="cos-sidebar">
        <button className="cos-logo" type="button" onClick={() => navigate("/careeros")}><span>S</span><div><strong>CareerOS</strong><small>by StackedIN</small></div></button>
        <nav aria-label="CareerOS workspace">
          {[
            ["overview", Activity, "Overview"],
            ["profile", UserRound, "Career profile"],
            ["targets", Globe2, "Countries & roles"],
            ["applications", BriefcaseBusiness, "Applications"],
            ["workflows", Workflow, "Workflows"],
            ["aeon", Mic2, "AEON"],
          ].map(([id, Icon, label]) => (
            <button key={id} className={activeView === id ? "is-active" : ""} type="button" onClick={() => setActiveView(id)}><Icon size={17} /> {label}</button>
          ))}
        </nav>
        <div className="cos-sidebar__bottom">
          <div className="cos-plan"><Sparkles size={15} /><div><strong>{trialLabel(subscription)}</strong><small>{subscription?.plan === "TRIAL" ? "StackedIN Premium audit" : "StackedIN Premium"}</small></div></div>
          <button type="button" onClick={() => navigate("/")}><ArrowLeft size={15} /> StackedIN</button>
        </div>
      </aside>

      <section className="cos-main">
        <header className="cos-topbar">
          <div><small>Private workspace</small><strong>{tenant?.name || "CareerOS"}</strong></div>
          <div className="cos-topbar__right"><span><LockKeyhole size={13} /> User-isolated</span><button type="button" onClick={() => setActiveView("profile")}><Settings2 size={15} /> Settings</button></div>
        </header>

        {error ? <div className="cos-alert cos-alert--error">{error}<button type="button" onClick={() => setError("")}>×</button></div> : null}
        {notice ? <div className="cos-alert cos-alert--success"><Check size={15} /> {notice}<button type="button" onClick={() => setNotice("")}>×</button></div> : null}
        {trialExpired ? <div className="cos-alert cos-alert--warning">Your 24-hour Career Audit has expired. Discovery and autonomous execution remain locked until StackedIN Premium is activated.</div> : null}

        {activeView === "overview" ? (
          <div className="cos-page">
            <div className="cos-page__heading"><div><span>Career command center</span><h1>Move from searching to operating.</h1><p>CareerOS will use only your verified evidence and configured policy when the discovery and execution workers are connected.</p></div><button className="cos-primary" type="button" onClick={() => setActiveView("profile")}>Complete career policy <ArrowRight size={16} /></button></div>
            <section className="cos-metrics">
              <Metric icon={Sparkles} label="High-match jobs" value={highMatches} note="90+ match score" />
              <Metric icon={BriefcaseBusiness} label="Applications" value={submitted} note="submitted or beyond" />
              <Metric icon={Mic2} label="Interviews" value={interviews} note="active interview stage" />
              <Metric icon={Clock3} label="Plan" value={subscription?.plan || "TRIAL"} note={trialLabel(subscription)} />
            </section>
            <section className="cos-grid-2">
              <article className="cos-panel">
                <div className="cos-panel__title"><div><span>Target markets</span><h2>Your country policy</h2></div><button type="button" onClick={() => setActiveView("targets")}>Edit</button></div>
                <div className="cos-country-summary">
                  {selectedCountries.length ? selectedCountries.sort((a, b) => b.priority - a.priority).map(country => {
                    const option = COUNTRY_OPTIONS.find(item => item.code === country.country_code);
                    return <div key={country.country_code}><span>{option?.flag || "🌍"}</span><div><strong>{option?.name || country.country_code}</strong><small>Priority {country.priority} · {country.visa_required ? "sponsorship needed" : "visa flexible"}</small></div><em>{country.minimum_salary ? `${country.currency || ""} ${Number(country.minimum_salary).toLocaleString()}` : "No floor"}</em></div>;
                  }) : <p className="cos-empty">Choose your target countries to create the first discovery policy.</p>}
                </div>
              </article>
              <article className="cos-panel">
                <div className="cos-panel__title"><div><span>Agent control</span><h2>{String(form.agent_mode).replace("HITL", "Human in loop")}</h2></div><Bot size={20} /></div>
                <div className="cos-agent-status"><span className="cos-pulse" /><div><strong>{form.agent_mode === "MANUAL" ? "Recommendation only" : form.agent_mode === "HITL" ? "Prepare, then ask you" : "Autonomous within policy"}</strong><small>{isTrial ? "Auto-submission stays disabled during the 24-hour audit." : "Execution still stops on ambiguous legal, salary, or work-authorization questions."}</small></div></div>
                <div className="cos-threshold"><span>Match threshold</span><strong>{form.match_threshold}%</strong><progress max="100" value={form.match_threshold} /></div>
              </article>
            </section>
            <section className="cos-panel">
              <div className="cos-panel__title"><div><span>Recent activity</span><h2>Application timeline</h2></div><button type="button" onClick={() => setActiveView("applications")}>View history</button></div>
              {applications.length ? <div className="cos-application-list">{applications.slice(0, 6).map(application => <div key={application.id}><span className={`cos-status cos-status--${String(application.status).toLowerCase()}`}>{application.status}</span><div><strong>{application.job?.role_title || "Role"}</strong><small>{application.job?.company_name || "Company"} · {application.job?.country_code || ""}</small></div><em>{new Date(application.last_status_at).toLocaleDateString()}</em></div>)}</div> : <p className="cos-empty">No applications yet. The history ledger is ready; discovery comes next.</p>}
            </section>
          </div>
        ) : null}

        {activeView === "profile" ? (
          <div className="cos-page cos-page--narrow">
            <div className="cos-page__heading"><div><span>Candidate intelligence</span><h1>Build your verified career profile.</h1><p>Salary, CV, mobility and automation settings are private CareerOS data and are never exposed on your public StackedIN profile.</p></div></div>
            <section className="cos-panel cos-form-panel">
              <div className="cos-panel__title"><div><span>Current position</span><h2>Career baseline</h2></div><UserRound size={20} /></div>
              <div className="cos-form-grid">
                <label><span>Current title</span><input value={form.current_title} onChange={e => setForm({ ...form, current_title: e.target.value })} placeholder="e.g. AI Solution Architect" /></label>
                <label><span>Current company</span><input value={form.current_company} onChange={e => setForm({ ...form, current_company: e.target.value })} placeholder="Company" /></label>
                <label><span>Current country</span><input maxLength="2" value={form.current_country_code} onChange={e => setForm({ ...form, current_country_code: e.target.value.toUpperCase() })} placeholder="IN" /></label>
                <label><span>Years of experience</span><input type="number" min="0" max="80" step="0.5" value={form.years_experience} onChange={e => setForm({ ...form, years_experience: e.target.value })} /></label>
                <label><span>Current annual compensation</span><input type="number" min="0" value={form.current_salary} onChange={e => setForm({ ...form, current_salary: e.target.value })} placeholder="3600000" /></label>
                <label><span>Currency</span><input maxLength="3" value={form.current_currency} onChange={e => setForm({ ...form, current_currency: e.target.value.toUpperCase() })} placeholder="INR" /></label>
                <label><span>Notice period (days)</span><input type="number" min="0" max="730" value={form.notice_period_days} onChange={e => setForm({ ...form, notice_period_days: e.target.value })} /></label>
                <label><span>Work preference</span><select value={form.remote_preference} onChange={e => setForm({ ...form, remote_preference: e.target.value })}><option value="ONSITE">On-site</option><option value="HYBRID_OK">Hybrid OK</option><option value="REMOTE_ONLY">Remote only</option><option value="ANY">Any</option></select></label>
              </div>
              <div className="cos-check-row"><label><input type="checkbox" checked={form.relocation_open} onChange={e => setForm({ ...form, relocation_open: e.target.checked })} /> Open to international relocation</label><label><input type="checkbox" checked={form.sponsorship_required} onChange={e => setForm({ ...form, sponsorship_required: e.target.checked })} /> Employer sponsorship required</label></div>
            </section>

            <section className="cos-panel">
              <div className="cos-panel__title"><div><span>Evidence vault</span><h2>Master CV</h2></div><FileText size={20} /></div>
              <label className="cos-upload"><input type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={uploadCV} disabled={uploading} /><span>{uploading ? <Loader2 className="cos-spin" size={20} /> : <Upload size={20} />}</span><div><strong>{uploading ? "Uploading…" : "Upload master CV"}</strong><small>Private PDF, DOCX or TXT · maximum 15 MB</small></div></label>
            </section>

            <section className="cos-panel">
              <div className="cos-panel__title"><div><span>Execution policy</span><h2>Choose how much control the agent receives.</h2></div><Bot size={20} /></div>
              <div className="cos-modes">
                <AgentModeCard value="MANUAL" selected={form.agent_mode === "MANUAL"} title="Manual" badge="Safest" description="Discover, score and prepare. You submit every application yourself." onSelect={value => setForm({ ...form, agent_mode: value })} />
                <AgentModeCard value="HITL" selected={form.agent_mode === "HITL"} title="Human in the loop" badge="Default" description="CareerOS prepares the application and waits for your approval before submission." onSelect={value => setForm({ ...form, agent_mode: value })} />
                <AgentModeCard value="AUTONOMOUS" selected={form.agent_mode === "AUTONOMOUS"} title="Autonomous" badge={isTrial ? "Locked in trial" : "Advanced"} description="Apply only when your rules, evidence, confidence and supported source all permit it." disabled={isTrial} onSelect={value => setForm({ ...form, agent_mode: value })} />
              </div>
              {form.agent_mode === "AUTONOMOUS" ? <label className="cos-consent"><input type="checkbox" checked={autonomousConsent} onChange={e => setAutonomousConsent(e.target.checked)} /><span>I explicitly authorize CareerOS to submit supported applications on my behalf within my saved rules. I remain responsible for the accuracy of my verified profile and understand that employment, compensation, sponsorship and visa outcomes are not guaranteed.</span></label> : null}
              <div className="cos-sliders"><label><span>Minimum job match <strong>{form.match_threshold}%</strong></span><input type="range" min="60" max="100" value={form.match_threshold} onChange={e => setForm({ ...form, match_threshold: Number(e.target.value) })} /></label><label><span>Auto-prepare at <strong>{form.auto_prepare_threshold}%</strong></span><input type="range" min="70" max="100" value={form.auto_prepare_threshold} onChange={e => setForm({ ...form, auto_prepare_threshold: Number(e.target.value) })} /></label></div>
            </section>
            <button className="cos-primary cos-save" type="button" disabled={saving} onClick={saveProfile}>{saving ? <Loader2 className="cos-spin" size={16} /> : <Save size={16} />} Save verified career policy</button>
          </div>
        ) : null}

        {activeView === "targets" ? (
          <div className="cos-page cos-page--narrow">
            <div className="cos-page__heading"><div><span>Global mobility policy</span><h1>Tell CareerOS where the next chapter can happen.</h1><p>Country priorities, compensation floors and sponsorship requirements drive discovery and hard-block unsuitable roles.</p></div></div>
            <section className="cos-panel">
              <div className="cos-panel__title"><div><span>Target countries</span><h2>Select and prioritize markets</h2></div><Globe2 size={20} /></div>
              <div className="cos-country-picker">{COUNTRY_OPTIONS.map(option => { const selected = countryMap.has(option.code); const item = countryMap.get(option.code); return <article key={option.code} className={selected ? "is-selected" : ""}><button type="button" onClick={() => toggleCountry(option)}><span>{option.flag}</span><div><strong>{option.name}</strong><small>{option.code} · {option.currency}</small></div><em>{selected ? "✓" : "+"}</em></button>{selected ? <div className="cos-country-config"><label>Priority<input type="number" min="0" max="100" value={item.priority} onChange={e => updateCountry(option.code, { priority: Number(e.target.value) })} /></label><label>Minimum salary<input type="number" min="0" value={item.minimum_salary} onChange={e => updateCountry(option.code, { minimum_salary: e.target.value })} placeholder="Optional" /></label><label className="cos-inline-check"><input type="checkbox" checked={item.visa_required} onChange={e => updateCountry(option.code, { visa_required: e.target.checked })} /> Sponsorship required</label></div> : null}</article>; })}</div>
            </section>
            <section className="cos-panel">
              <div className="cos-panel__title"><div><span>Target roles</span><h2>Roles the discovery agent should pursue</h2></div><BriefcaseBusiness size={20} /></div>
              <div className="cos-role-entry"><input value={roleDraft} onChange={e => setRoleDraft(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addRole(); } }} placeholder="Add a target role" /><button type="button" onClick={addRole}>Add</button></div>
              <div className="cos-role-tags">{roles.map(role => <span key={role}>{role}<button type="button" aria-label={`Remove ${role}`} onClick={() => setRoles(current => current.filter(item => item !== role))}>×</button></span>)}</div>
            </section>
            <button className="cos-primary cos-save" type="button" disabled={saving} onClick={saveProfile}>{saving ? <Loader2 className="cos-spin" size={16} /> : <Save size={16} />} Save targets</button>
          </div>
        ) : null}

        {activeView === "applications" ? (
          <div className="cos-page">
            <div className="cos-page__heading"><div><span>Immutable career history</span><h1>Every application, date and outcome.</h1><p>Application events are stored as a private append-only timeline so daily, weekly, monthly and all-time analytics can be derived without rewriting history.</p></div></div>
            <section className="cos-panel">
              <div className="cos-panel__title"><div><span>History</span><h2>{applications.length} tracked applications</h2></div><BarChart3 size={20} /></div>
              {applications.length ? <div className="cos-app-table"><div className="cos-app-table__head"><span>Company / role</span><span>Country</span><span>Match</span><span>Status</span><span>Updated</span></div>{applications.map(application => <div key={application.id}><span><strong>{application.job?.company_name || "Company"}</strong><small>{application.job?.role_title || "Role"}</small></span><span>{application.job?.country_code || "—"}</span><span>{application.match?.overall_score ? `${application.match.overall_score}%` : "—"}</span><span className={`cos-status cos-status--${String(application.status).toLowerCase()}`}>{application.status}</span><span>{new Date(application.last_status_at).toLocaleString()}</span></div>)}</div> : <p className="cos-empty">No application events yet. This view will populate as CareerOS discovers and prepares opportunities.</p>}
            </section>
          </div>
        ) : null}

        {activeView === "workflows" ? (
          <div className="cos-page cos-page--narrow"><div className="cos-page__heading"><div><span>Workflow OS</span><h1>Your agent policy becomes an executable graph.</h1><p>The secure data model and workflow records are ready. The next implementation phase connects the drag-and-drop canvas to Temporal and LangGraph workers.</p></div></div><section className="cos-workflow-preview"><div><span>Every 2 hours</span></div><i>→</i><div><span>Find jobs</span></div><i>→</i><div><span>Visa + salary</span></div><i>→</i><div><span>Match ≥ {form.match_threshold}</span></div><i>→</i><div><span>{form.agent_mode}</span></div><i>→</i><div><span>WhatsApp</span></div></section><div className="cos-coming"><Workflow size={24} /><strong>Visual workflow builder is the next build slice.</strong><span>Definitions are already versioned in `career_workflows`; no agent execution is enabled from this placeholder.</span></div></div>
        ) : null}

        {activeView === "aeon" ? (
          <div className="cos-page cos-page--narrow"><div className="cos-page__heading"><div><span>AEON Interview Agent OS</span><h1>Prepare from the exact job, evidence and interview stage.</h1><p>AEON shares your private CareerOS candidate identity, not a separate profile. Readiness sessions and scorecards are already isolated per user.</p></div></div><section className="cos-aeon-hero"><div className="cos-aeon-orb"><Mic2 size={34} /></div><div><span>AEON readiness</span><h2>{dashboard?.aeonSessions?.[0]?.readiness_score ?? "—"}{dashboard?.aeonSessions?.[0]?.readiness_score != null ? "/100" : ""}</h2><p>{dashboard?.aeonSessions?.length ? "Continue from your latest private interview session." : "Your first role-specific readiness assessment will unlock when the AEON engine is connected."}</p></div></section><div className="cos-coming"><MessageCircle size={24} /><strong>AEON engine comes after CareerOS discovery + application tracking.</strong><span>The session model is in place now so interview outcomes can feed the same career learning loop later.</span></div></div>
        ) : null}
      </section>
    </main>
  );
}
