export const STACKCRAFT_WORKFLOW_STEPS = [
  { id:"cv", kind:"candidate_cv", label:"Load profile CV", detail:"Resolve this tenant/user master CV and reviewed Candidate Evidence Graph." },
  { id:"targets", kind:"career_policy", label:"Load career policy", detail:"Target countries, roles, salary floor, visa and relocation rules." },
  { id:"sources", kind:"source_discovery", label:"Discover job sources", detail:"Run enabled authorized connectors and public company hiring sources." },
  { id:"normalize", kind:"normalize", label:"Normalize & deduplicate", detail:"Convert source records into the canonical StackCraft job schema and remove duplicates." },
  { id:"freshness", kind:"freshness", label:"Freshness gate", detail:"Prioritize newly published/discovered opportunities and reject stale records by policy." },
  { id:"match", kind:"match", label:"CV ↔ job match", detail:"Score requirements against verified CV evidence and target-role policy." },
  { id:"visa", kind:"visa_check", label:"Visa / sponsorship", detail:"Evaluate sponsorship signals and mobility constraints without making immigration guarantees." },
  { id:"salary", kind:"salary_check", label:"Salary gate", detail:"Compare disclosed compensation against the candidate market floor when available." },
  { id:"approval", kind:"request_approval", label:"Human approval", detail:"Present qualified jobs for review before any submission-sensitive action." },
  { id:"prepare", kind:"prepare_application", label:"Prepare application", detail:"Prepare the grounded CV/application package from verified evidence." },
];

export const STACKCRAFT_WORKFLOW_EDGES = [
  ["cv","targets"],["targets","sources"],["sources","normalize"],["normalize","freshness"],["freshness","match"],
  ["match","visa"],["match","salary"],["visa","approval"],["salary","approval"],["approval","prepare"],
].map(([source,target],index)=>({id:`sc-e${index+1}`,source,target}));

export const STACKCRAFT_SOURCE_CATALOG = [
  { key:"greenhouse", label:"Greenhouse", mode:"Public ATS", discovery:true },
  { key:"lever", label:"Lever", mode:"Public ATS", discovery:true },
  { key:"ashby", label:"Ashby", mode:"Public ATS", discovery:true },
  { key:"company_careers", label:"Company Careers", mode:"Public / authorized", discovery:true },
  { key:"linkedin", label:"LinkedIn", mode:"Approved partner / export", discovery:false },
  { key:"naukri", label:"Naukri", mode:"Authorized import / integration", discovery:false },
];

export function workflowStatus(status?:string){
  const value=(status||"PENDING").toUpperCase();
  if(["SUCCEEDED","SUCCESS","COMPLETED"].includes(value)) return "succeeded";
  if(["FAILED","ERROR"].includes(value)) return "failed";
  if(["RUNNING","STARTED"].includes(value)) return "running";
  if(["WAITING_APPROVAL","WAITING","BLOCKED"].includes(value)) return "waiting_approval";
  return "pending";
}
