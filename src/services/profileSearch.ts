import type { SupabaseClient } from "@supabase/supabase-js";
import { parseProfileQuery, type ParsedProfileQuery } from "../search/queryParser";

export interface ProfileSearchCursor {
  score: number;
  profileId: string;
}

export interface ProfileSearchResult {
  profile_id: string;
  slug: string;
  display_name: string;
  headline: string | null;
  avatar_url: string | null;
  location: string | null;
  country: string | null;
  current_company: string | null;
  current_job_title: string | null;
  years_experience: number | null;
  key_skills: string[];
  matched_terms: string[];
  match_label: "Strong match" | "Relevant" | "Suggested";
  rank_score: number;
  reasons: string[];
  is_connected: boolean;
}

export interface ProfileSearchPage {
  query: ParsedProfileQuery;
  results: ProfileSearchResult[];
  nextCursor: ProfileSearchCursor | null;
}

export interface ProfileSearchOptions {
  query: string;
  location?: string;
  role?: string;
  skills?: string[];
  topics?: string[];
  minimumExperience?: number | null;
  limit?: number;
  cursor?: ProfileSearchCursor | null;
}

export class ProfileSearchService {
  constructor(private readonly client: SupabaseClient) {}

  async search(tenantId: string, options: ProfileSearchOptions): Promise<ProfileSearchPage> {
    const parsed = parseProfileQuery(options.query);
    const pageSize = Math.max(1, Math.min(options.limit ?? 12, 24));
    const skills = [...new Set([...(parsed.skills ?? []), ...(options.skills ?? [])])];
    const topics = [...new Set([...(parsed.topics ?? []), ...(options.topics ?? [])])];
    const { data, error } = await this.client.rpc("search_profiles", {
      requested_tenant_id: tenantId,
      search_query: parsed.normalizedQuery,
      location_filter: options.location?.trim() || parsed.location,
      role_filter: options.role?.trim() || parsed.role,
      skill_filters: skills,
      topic_filters: topics,
      content_author_required: parsed.contentAuthorRequired,
      minimum_experience: options.minimumExperience ?? null,
      result_limit: pageSize + 1,
      after_score: options.cursor?.score ?? null,
      after_profile_id: options.cursor?.profileId ?? null,
    });
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as ProfileSearchResult[];
    const hasMore = rows.length > pageSize;
    const results = rows.slice(0, pageSize);
    const last = results.at(-1);
    const nextCursor = hasMore && last ? { score: Number(last.rank_score), profileId: last.profile_id } : null;

    if (results.length) {
      // Search remains available even if privacy-preserving analytics are
      // temporarily unavailable; telemetry must never break retrieval.
      void this.client.rpc("record_profile_search_impressions", {
        requested_tenant_id: tenantId,
        search_query: parsed.normalizedQuery,
        result_profile_ids: results.map(result => result.profile_id),
      });
    }

    return { query: parsed, results, nextCursor };
  }
}
