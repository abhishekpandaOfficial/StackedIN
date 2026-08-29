import { ArrowRight, Check, ShieldCheck, Sparkles } from "lucide-react";
import { KageLandingPage } from "@designcodeio/threeui";
import "@designcodeio/threeui/style.css";
import "./careeros.css";

const benefits = [
  "Private multi-tenant career workspace",
  "Country, visa, salary and role intelligence",
  "Manual, human-in-the-loop and agentic modes",
  "StackCraft + AEON interview preparation",
];

export default function CareerOSLanding() {
  const navigate = (path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
    window.location.reload();
  };
  const openStackedIn = () => navigate("/");
  const openStackCraft = () => navigate("/Craft/app");

  return (
    <main className="careeros-landing">
      <header className="careeros-nav" aria-label="StackCraft navigation">
        <button className="careeros-brand" type="button" onClick={openStackedIn}>
          <span className="careeros-brand__mark">S</span>
          <span><strong>StackCraft</strong><small>by StackedIN</small></span>
        </button>
        <div className="careeros-nav__actions">
          <span className="careeros-secure"><ShieldCheck size={15} /> Private by design</span>
          <button className="careeros-ghost" type="button" onClick={openStackedIn}>StackedIN</button>
          <button className="careeros-primary" type="button" onClick={openStackCraft}>Start 24-hour audit <ArrowRight size={16} /></button>
        </div>
      </header>

      <section className="careeros-hero" aria-label="StackCraft global career agent">
        <div className="shader-frame" aria-hidden="true">
          <KageLandingPage headingFont="onest" bodyFont="onest" headingWeight="400" bodyWeight="300" primaryColor="#e0231c" headingSize={46} bodySize={17} headingLetterSpacing={-0.012} />
        </div>
        <div className="careeros-hero__scrim" />
        <div className="careeros-hero__content">
          <div className="careeros-kicker"><Sparkles size={15} /> StackedIN Premium</div>
          <h1>Your career should have an operating system.</h1>
          <p>StackCraft continuously discovers, qualifies and prepares global opportunities around your verified CV, technical stack, salary, target countries and relocation preferences.</p>
          <div className="careeros-hero__actions">
            <button className="careeros-primary careeros-primary--large" type="button" onClick={openStackCraft}>Start free for 24 hours <ArrowRight size={17} /></button>
            <a className="careeros-secondary" href="#how-it-works">See how the agent works</a>
          </div>
          <div className="careeros-proof" aria-label="StackCraft capabilities">{benefits.map(benefit => <span key={benefit}><Check size={14} /> {benefit}</span>)}</div>
        </div>
      </section>

      <section className="careeros-intro" id="how-it-works">
        <div><span className="careeros-eyebrow">01 · Candidate intelligence</span><h2>One private career graph. Every decision grounded in evidence.</h2></div>
        <p>Upload or sync your CV, verify your experience and skills, select countries and roles, define salary and relocation constraints, then choose how much control the agent receives.</p>
      </section>

      <section className="careeros-flow" aria-label="StackCraft workflow">
        {["Profile", "Discover", "Visa", "Match", "Salary", "Tailor", "Approve", "Apply", "Track", "AEON"].map((step, index) => <article key={step}><span>{String(index + 1).padStart(2, "0")}</span><strong>{step}</strong></article>)}
      </section>

      <section className="careeros-audit" id="career-audit">
        <div><span className="careeros-eyebrow">24-hour Global Career Audit</span><h2>See what StackCraft understands before you subscribe.</h2><p>Get candidate profiling, country intelligence, job matching, visa and salary analysis, one tailored CV and an AEON readiness assessment.</p></div>
        <div className="careeros-price-card">
          <span>StackedIN Premium</span><strong>₹500 <small>/ month</small></strong><p>or ₹5,000 billed annually.</p>
          <button type="button" onClick={openStackCraft}>Create StackCraft workspace <ArrowRight size={16} /></button>
          <small>24-hour audit first. Autonomous submission remains disabled during the audit.</small>
        </div>
      </section>
    </main>
  );
}
