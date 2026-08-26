import { BrainCircuit, ShieldCheck, Sparkles, X } from "lucide-react";

export default function AIScoreDialog({ score, onClose }) {
  if (!score) return null;
  return <div className="ai-score-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="ai-score-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-score-title">
      <header><div><BrainCircuit size={20} /><span><small>Writing signal</small><h2 id="ai-score-title">AI & human likelihood</h2></span></div><button onClick={onClose} aria-label="Close writing score"><X size={17} /></button></header>
      <div className="ai-score-bars">
        <article><span><b>Human signal</b><strong>{score.humanScore}%</strong></span><div><i className="human" style={{ width: `${score.humanScore}%` }} /></div></article>
        <article><span><b>AI signal</b><strong>{score.aiScore}%</strong></span><div><i className="ai" style={{ width: `${score.aiScore}%` }} /></div></article>
      </div>
      <div className="ai-score-confidence"><ShieldCheck size={15} /><span><b>{score.confidence} confidence</b><small>{score.confidencePercent}% signal confidence · {score.method}</small></span></div>
      {score.signals?.length > 0 && <section className="ai-score-signals"><span><Sparkles size={13} />Observed signals</span><div>{score.signals.map(signal => <b key={signal}>{signal}</b>)}</div></section>}
      <p>{score.disclaimer}</p>
    </section>
  </div>;
}

