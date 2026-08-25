import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve("supabase/migrations/202608250002_professional_graph_foundation.sql"), "utf8");
const peopleMigration = readFileSync(resolve("supabase/migrations/202608250003_people_recommendations_v1.sql"), "utf8");
const searchMigration = readFileSync(resolve("supabase/migrations/202608250004_profile_search_v1.sql"), "utf8");
const publishingMigration = readFileSync(resolve("supabase/migrations/202608250005_native_publishing_realtime.sql"), "utf8");

describe("professional graph migration contract", () => {
  it.each([
    "create extension if not exists vector",
    "create table if not exists public.skills",
    "create table if not exists public.topics",
    "create table if not exists public.profile_skills",
    "create table if not exists public.profile_interests",
    "create table if not exists public.connections",
    "create table if not exists public.follows",
    "create table if not exists public.blocks",
    "create table if not exists public.mutes",
    "create table if not exists public.user_interactions",
    "create table if not exists public.recommendation_events",
    "create table if not exists public.embedding_jobs",
    "create table if not exists public.ranking_configs",
    "create table if not exists public.feature_flags",
  ])("contains %s", requiredStatement => {
    expect(migration.toLowerCase()).toContain(requiredStatement);
  });

  it("enables RLS on every tenant or user-sensitive Phase 1 table", () => {
    const protectedTables = [
      "profile_skills", "profile_interests", "connections", "follows", "blocks", "mutes",
      "user_interactions", "recommendation_events", "profile_intelligence", "embedding_jobs",
      "ranking_configs", "feature_flags",
    ];
    for (const table of protectedTables) {
      expect(migration).toContain(`alter table public.${table} enable row level security;`);
    }
  });

  it("keeps relationship state changes behind authenticated RPCs", () => {
    expect(migration).toContain("revoke insert, update, delete on public.connections from anon, authenticated;");
    expect(migration).toContain("grant execute on function public.send_connection_request(uuid, uuid) to authenticated;");
    expect(migration).toContain("grant execute on function public.respond_to_connection(uuid, text) to authenticated;");
  });

  it("does not collect or embed private messages", () => {
    expect(migration.toLowerCase()).not.toContain("private_message");
    expect(migration.toLowerCase()).not.toContain("password");
  });

  it("avoids the reserved CURRENT_ROLE identifier", () => {
    expect(migration).toContain("add column if not exists current_job_title text");
    expect(migration).not.toMatch(/add column if not exists current_role\b/);
  });

  it("maintains search vectors with triggers instead of fragile generated columns", () => {
    expect(migration).toContain("create or replace function public.set_profile_search_document()");
    expect(migration).toContain("create trigger profiles_set_search_document");
    expect(migration).toContain("create or replace function public.set_article_search_document()");
    expect(migration).toContain("create trigger articles_set_search_document");
    expect(migration).not.toMatch(/search_document\s+tsvector\s+generated always/i);
  });
});

describe("people recommendations V1 migration contract", () => {
  it("provides guarded retrieval and feedback functions", () => {
    expect(peopleMigration).toContain("create or replace function public.get_people_recommendations");
    expect(peopleMigration).toContain("create or replace function public.record_people_recommendation_impressions");
    expect(peopleMigration).toContain("create or replace function public.record_people_recommendation_outcome");
  });

  it.each(["candidate.id <> a.viewer_id", "public.blocks", "public.mutes", "c.status in ('PENDING','ACCEPTED')", "c.cooldown_until > now()", "candidate.account_status = 'active'"])(
    "enforces eligibility rule %s",
    rule => expect(peopleMigration).toContain(rule),
  );

  it("keeps recommendation functions unavailable to anonymous clients", () => {
    expect(peopleMigration).toContain("revoke all on function public.get_people_recommendations(uuid, integer) from public;");
    expect(peopleMigration).toContain("grant execute on function public.get_people_recommendations(uuid, integer) to authenticated;");
  });

  it("fails clearly when Phase 1 has not been installed", () => {
    expect(peopleMigration).toContain("to_regclass('public.ranking_configs') is null");
    expect(peopleMigration).toContain("Run 202608250002_professional_graph_foundation.sql successfully");
  });
});

describe("profile search V1 migration contract", () => {
  it("parenthesizes computed arrays before applying slices", () => {
    expect(searchMigration).not.toContain("coalesce(array_agg(skill_name order by confidence desc), '{}'::text[])[1:5]");
    expect(searchMigration).toContain("(coalesce(array_agg(skill_name order by confidence desc), '{}'::text[]))[1:5]");
  });

  it("provides guarded search and privacy-preserving impression RPCs", () => {
    expect(searchMigration).toContain("create or replace function public.search_profiles");
    expect(searchMigration).toContain("create or replace function public.record_profile_search_impressions");
    expect(searchMigration).toContain("public.is_tenant_member(requested_tenant_id)");
    expect(searchMigration).toContain("encode(digest(lower(trim(coalesce(search_query, ''))), 'sha256'), 'hex')");
    expect(searchMigration).not.toContain("'raw_query'");
  });

  it.each([
    "candidate.account_status = 'active'",
    "candidate.profile_visibility = 'public'",
    "candidate.searchable",
    "public.blocks",
    "public.mutes",
  ])("enforces search eligibility rule %s", rule => {
    expect(searchMigration).toContain(rule);
  });

  it("uses score and profile ID keyset pagination", () => {
    expect(searchMigration).toContain("s.computed_score < after_score");
    expect(searchMigration).toContain("s.id > after_profile_id");
    expect(searchMigration.toLowerCase()).not.toContain(" offset ");
  });

  it("keeps Phase 3 deterministic and leaves vectors to Phase 4", () => {
    expect(searchMigration).toContain("websearch_to_tsquery");
    expect(searchMigration).toContain("similarity(");
    expect(searchMigration).not.toContain("<=>");
  });

  it("denies anonymous execution", () => {
    expect(searchMigration).toContain("revoke all on function public.search_profiles");
    expect(searchMigration).toContain("grant execute on function public.search_profiles");
  });
});

describe("native publishing and realtime migration contract", () => {
  it("parenthesizes computed arrays before applying slices", () => {
    expect(publishingMigration).not.toContain("coalesce(requested_tags, '{}'::text[])[1:20]");
    expect(publishingMigration).not.toContain("coalesce(requested_hashtags, '{}'::text[])[1:20]");
    expect(publishingMigration).toContain("(coalesce(requested_tags, '{}'::text[]))[1:20]");
  });

  it.each([
    "create table if not exists public.article_reactions",
    "create table if not exists public.article_comments",
    "create table if not exists public.article_shares",
    "create table if not exists public.publication_sources",
    "create or replace function public.save_native_article",
    "create or replace function public.react_to_article",
    "create or replace function public.add_article_comment",
  ])("contains %s", statement => expect(publishingMigration.toLowerCase()).toContain(statement));

  it("stores safe blocks instead of arbitrary HTML", () => {
    expect(publishingMigration).toContain("content_blocks jsonb");
    expect(publishingMigration).toContain("block->>'type' not in ('paragraph','heading','subheading','quote','code','image','divider')");
    expect(publishingMigration).not.toContain("body_html");
  });

  it("supports six explicit reaction types", () => {
    for (const reaction of ["LIKE", "LOVE", "CELEBRATE", "INSIGHTFUL", "SUPPORT", "CURIOUS"]) {
      expect(publishingMigration).toContain(`'${reaction}'`);
    }
  });

  it("protects native writes with authenticated RPCs and RLS", () => {
    expect(publishingMigration).toContain("public.has_tenant_role(requested_tenant_id");
    expect(publishingMigration).toContain("alter table public.article_reactions enable row level security");
    expect(publishingMigration).toContain("alter table public.article_comments enable row level security");
    expect(publishingMigration).toContain("revoke all on function public.save_native_article");
    expect(publishingMigration).toContain("grant execute on function public.save_native_article");
  });

  it("never stores connector secrets in publication sources", () => {
    const sourceTable = publishingMigration.slice(
      publishingMigration.indexOf("create table if not exists public.publication_sources"),
      publishingMigration.indexOf("create index if not exists article_reactions_tenant_article_idx"),
    );
    expect(sourceTable).not.toMatch(/password|access_token|refresh_token|client_secret/i);
  });
});
