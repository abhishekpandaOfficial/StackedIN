import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve("supabase/migrations/202608250002_professional_graph_foundation.sql"), "utf8");

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
});
