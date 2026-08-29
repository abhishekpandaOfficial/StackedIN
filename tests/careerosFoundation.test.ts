import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve("supabase/migrations/202608290015_careeros_foundation.sql"), "utf8");

describe("CareerOS foundation migration", () => {
  it.each([
    "create table if not exists public.career_profiles",
    "create table if not exists public.career_target_countries",
    "create table if not exists public.career_target_roles",
    "create table if not exists public.career_skills",
    "create table if not exists public.career_documents",
    "create table if not exists public.career_workflows",
    "create table if not exists public.career_workflow_runs",
    "create table if not exists public.career_jobs",
    "create table if not exists public.career_job_matches",
    "create table if not exists public.career_applications",
    "create table if not exists public.career_application_events",
    "create table if not exists public.career_consents",
    "create table if not exists public.career_subscriptions",
    "create table if not exists public.career_usage_events",
    "create table if not exists public.aeon_sessions",
  ])("contains %s", statement => expect(migration.toLowerCase()).toContain(statement));

  it("binds every private CareerOS table to the authenticated user as well as the tenant", () => {
    expect(migration).toContain("user_id = auth.uid() and public.is_tenant_member(tenant_id)");
    expect(migration).toContain("Career owner manages career_profiles");
    expect(migration).toContain("Career owner manages career_applications");
    expect(migration).toContain("Career owner reads usage");
  });

  it("keeps application history append-only", () => {
    expect(migration).toContain("Career owner reads application events");
    expect(migration).toContain("Career owner adds application events");
    expect(migration).not.toContain("Career owner manages career_application_events");
  });

  it("creates the 24-hour audit and paid plan vocabulary without granting client-side paid upgrades", () => {
    expect(migration).toContain("now() + interval '24 hours'");
    expect(migration).toContain("plan in ('TRIAL','MONTHLY','ANNUAL')");
    expect(migration).toContain("plan = 'TRIAL'");
    expect(migration).not.toContain("Career owner manages career_subscriptions");
  });

  it("keeps CV storage private to the exact authenticated user", () => {
    expect(migration).toContain("'career-documents'");
    expect(migration).toContain("false,\n  15728640");
    expect(migration).toContain("(storage.foldername(name))[1] = auth.uid()::text");
  });

  it("supports manual, human-in-the-loop, and autonomous policy modes", () => {
    expect(migration).toContain("agent_mode in ('MANUAL','HITL','AUTONOMOUS')");
    expect(migration).toContain("application_mode in ('MANUAL','HITL','AUTONOMOUS')");
    expect(migration).toContain("'AUTONOMOUS_APPLICATION'");
  });

  it("never stores job-site passwords or raw external credentials", () => {
    expect(migration).not.toMatch(/password|refresh_token|access_token|client_secret/i);
  });
});
