import { Check, Circle, Clock3, FileText, Loader2, PlugZap, X } from "lucide-react";
import { STACKCRAFT_SOURCE_CATALOG, STACKCRAFT_WORKFLOW_STEPS, workflowStatus } from "./workflowModel.ts";

const iconFor=(status)=>status==="succeeded"?<Check size={14}/>:status==="failed"?<X size={14}/>:status==="running"?<Loader2 className="sc-spin" size={14}/>:status==="waiting_approval"?<Clock3 size={14}/>:<Circle size={12}/>;

export default function WorkflowExecutionPanel({documents=[],connections=[],events=[],run}){
  const latest=new Map();
  events.forEach(event=>latest.set(event.node_id||event.node_type,event));
  const cv=documents.find(d=>d.document_type==="MASTER_CV")||documents[0];
  const sourceState=new Map((connections||[]).map(c=>[(c.source||c.provider||c.source_key||"").toLowerCase(),c]));
  return <div className="sc-execution-grid">
    <section className="sc-card sc-execution-card">
      <div className="sc-card-title"><div><FileText size={16}/><strong>Execution trace</strong></div><span>{run?.status||"READY"}</span></div>
      <div className="sc-step-list">{STACKCRAFT_WORKFLOW_STEPS.map((step,index)=>{const event=latest.get(step.id)||latest.get(step.kind);const tone=workflowStatus(event?.status);return <article className={`sc-step ${tone}`} key={step.id}><div className="sc-step-rail"><span>{iconFor(tone)}</span>{index<STACKCRAFT_WORKFLOW_STEPS.length-1?<i/>:null}</div><div><small>STEP {String(index+1).padStart(2,"0")} · {step.kind.replaceAll("_"," ")}</small><strong>{step.label}</strong><p>{event?.message||step.detail}</p>{step.id==="cv"?<em>{cv?`${cv.file_name} · ${new Date(cv.created_at).toLocaleDateString()}`:"No master CV is available for this profile."}</em>:null}{event?.details&&Object.keys(event.details).length?<code>{JSON.stringify(event.details)}</code>:null}</div><b>{tone.replaceAll("_"," ")}</b></article>})}</div>
    </section>
    <section className="sc-card sc-connectors-card">
      <div className="sc-card-title"><div><PlugZap size={16}/><strong>Job discovery connectors</strong></div><span>execution-aware</span></div>
      <div className="sc-connectors">{STACKCRAFT_SOURCE_CATALOG.map(source=>{const connection=sourceState.get(source.key);const sourceEvents=events.filter(e=>String(e.details?.source||e.details?.provider||"").toLowerCase()===source.key);const executed=sourceEvents.at(-1);const tone=executed?workflowStatus(executed.status):connection?"connected":source.discovery?"available":"restricted";return <article key={source.key} className={`sc-connector ${tone}`}><span>{source.label.slice(0,2).toUpperCase()}</span><div><strong>{source.label}</strong><small>{source.mode}</small><p>{executed?executed.message:connection?"Connected to this StackCraft profile.":source.discovery?"Available for discovery when the runtime connector is enabled.":"Requires approved/authorized access; credentials are never scraped."}</p></div><b>{executed?workflowStatus(executed.status):connection?"connected":source.discovery?"available":"not connected"}</b></article>})}</div>
    </section>
  </div>
}
