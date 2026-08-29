import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const evidenceMigration = readFileSync(resolve("supabase/migrations/202608290016_career_evidence_graph.sql"), "utf8");
const trustMigration = readFileSync(resolve("supabase/migrations/202608290017_careeros_trust_boundary.sql"), "utf8");
const service = readFileSync(resolve("src/services/careerOS.ts"), "utf8");

describe("CareerOS candidate evidence graph", () => {
  it("models provenance, verification and evidence relationships", () => {
    expect(evidenceMigration).toContain("public.career_evidence_items");
    expect(evidenceMigration).toContain("public.career_evidence_links");
    expect(evidenceMigration).toContain("source_type in ('USER','CV','STACKEDIN_PROFILE','AGENT')");
    expect(evidenceMigration).toContain("verification_status in ('UNVERIFIED','USER_CONFIRMED','SYSTEM_VERIFIED','REJECTED')");
    expect(evidenceMigration).toContain("relation_type in ('SUPPORTS','DERIVED_FROM','USED_AT','RESULTED_IN','PART_OF','RELATED_TO')");
  });

  it("queues uploaded CVs for asynchronous extraction rather than pretending extraction happened in-browser", () => {
    expect(evidenceMigration).toContain("public.career_ingestion_jobs");
    expect(evidenceMigration).toContain("status in ('QUEUED','RUNNING','NEEDS_REVIEW','COMPLETED','FAILED','CANCELLED')");
    expect(service).toContain('.from("career_ingestion_jobs")');
    expect(service).toContain('status: "QUEUED"');
    expect(service).not.toMatch(/openai|anthropic|gemini|claude/i);
  });

  it("keeps trusted outputs read-only to browser users", () => {
    expect(trustMigration).toContain('revoke insert, update, delete on table public.career_job_matches from authenticated');
    expect(trustMigration).toContain('revoke insert, update, delete on table public.aeon_sessions from authenticated');
    expect(trustMigration).toContain('revoke update, delete on table public.career_ingestion_jobs from authenticated');
    expect(trustMigration).toContain('revoke insert, update, delete on table public.career_evidence_links from authenticated');
  });

  it("allows candidates to review evidence without rewriting provenance", () => {
    expect(trustMigration).toContain("grant update (verification_status) on table public.career_evidence_items to authenticated");
    expect(service).toContain("reviewEvidence");
    expect(service).toContain("verification_status: status");
  });
});
