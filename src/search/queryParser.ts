export interface ParsedProfileQuery {
  rawQuery: string;
  normalizedQuery: string;
  role: string | null;
  seniority: "Junior" | "Mid-level" | "Senior" | "Lead" | "Principal" | "Staff" | null;
  location: string | null;
  skills: string[];
  topics: string[];
  contentAuthorRequired: boolean;
}

interface CanonicalTerm {
  canonical: string;
  aliases: readonly string[];
}

const SKILLS: readonly CanonicalTerm[] = [
  { canonical: ".NET", aliases: [".net", "dotnet", "c#"] },
  { canonical: "Azure", aliases: ["azure", "azure ai"] },
  { canonical: "AWS", aliases: ["aws", "amazon web services"] },
  { canonical: "Google Cloud", aliases: ["gcp", "google cloud"] },
  { canonical: "Kubernetes", aliases: ["kubernetes", "k8s", "aks", "eks", "gke"] },
  { canonical: "Python", aliases: ["python"] },
  { canonical: "PyTorch", aliases: ["pytorch"] },
  { canonical: "Machine Learning", aliases: ["machine learning", "ml engineer", "ml engineering"] },
  { canonical: "RAG", aliases: ["rag", "retrieval augmented generation", "graphrag"] },
  { canonical: "LLMs", aliases: ["llm", "llms", "large language model"] },
  { canonical: "Agentic AI", aliases: ["agentic ai", "ai agents", "multi-agent"] },
  { canonical: "React", aliases: ["react", "reactjs"] },
  { canonical: "PostgreSQL", aliases: ["postgres", "postgresql"] },
];

const ROLE_PATTERNS: readonly [RegExp, string][] = [
  [/\b(?:ai|artificial intelligence) architect(?:s)?\b/i, "AI Architect"],
  [/\bazure architect(?:s)?\b/i, "Azure Architect"],
  [/\bsolution architect(?:s)?\b/i, "Solution Architect"],
  [/\bsoftware architect(?:s)?\b/i, "Software Architect"],
  [/\bmachine learning engineer(?:s)?\b|\bml engineer(?:s)?\b/i, "Machine Learning Engineer"],
  [/\bai engineer(?:s)?\b/i, "AI Engineer"],
  [/\bplatform engineer(?:s)?\b/i, "Platform Engineer"],
  [/\bdata engineer(?:s)?\b/i, "Data Engineer"],
  [/(?:\.net|\bdotnet)\s+developer(?:s)?\b/i, ".NET Developer"],
  [/\bdeveloper(?:s)?\b/i, "Developer"],
  [/\bfounder(?:s)?\b/i, "Founder"],
];

const SENIORITY: readonly [RegExp, ParsedProfileQuery["seniority"]][] = [
  [/\bprincipal\b/i, "Principal"],
  [/\bstaff\b/i, "Staff"],
  [/\blead\b/i, "Lead"],
  [/\bsenior\b|\bsr\.?\b/i, "Senior"],
  [/\bmid(?:-level)?\b/i, "Mid-level"],
  [/\bjunior\b|\bjr\.?\b/i, "Junior"],
];

const normalize = (value: string): string => value.trim().replace(/\s+/g, " ").slice(0, 200);

function containsAlias(query: string, alias: string): boolean {
  const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(query);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function parseProfileQuery(input: string): ParsedProfileQuery {
  const normalizedQuery = normalize(input);
  const role = ROLE_PATTERNS.find(([pattern]) => pattern.test(normalizedQuery))?.[1] ?? null;
  const seniority = SENIORITY.find(([pattern]) => pattern.test(normalizedQuery))?.[1] ?? null;
  const locationMatch = normalizedQuery.match(
    /\b(?:in|near|from|based in)\s+([a-z][a-z .'-]{1,80}?)(?=\s+(?:who|with|working|writing|building|and|that)\b|$)/i,
  );
  const location = locationMatch?.[1]?.trim().replace(/[,.]+$/, "") || null;
  const skills = unique(SKILLS.filter(term => term.aliases.some(alias => containsAlias(normalizedQuery, alias))).map(term => term.canonical));
  const topicMatch = normalizedQuery.match(/\b(?:write|writes|writing|publish|publishes|about|expert(?:s)? in)\s+(?:deeply\s+)?(?:about\s+)?(.+?)(?=\s+(?:in|near|from|with)\b|$)/i);
  const topicText = topicMatch?.[1]?.trim() ?? "";
  const topics = unique(
    SKILLS.filter(term => term.aliases.some(alias => containsAlias(topicText, alias))).map(term => term.canonical),
  );

  return {
    rawQuery: input,
    normalizedQuery,
    role: seniority && role ? `${seniority} ${role}` : role,
    seniority,
    location,
    skills,
    topics,
    contentAuthorRequired: /\b(write|writes|writing|publish|publishes|author|articles?)\b/i.test(normalizedQuery),
  };
}
