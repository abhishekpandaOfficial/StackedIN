import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConnectionStatus, InteractionInput } from "../domain/professionalGraph";

interface ConnectionRecord {
  id: string;
  tenant_id: string;
  requester_profile_id: string;
  addressee_profile_id: string;
  status: ConnectionStatus;
  requested_at: string;
  responded_at: string | null;
  cooldown_until: string | null;
}

export interface PeopleRecommendation {
  candidate_profile_id: string;
  slug: string;
  display_name: string;
  headline: string | null;
  avatar_url: string | null;
  location: string | null;
  current_company: string | null;
  relevance_label: "Strong match" | "Relevant" | "Suggested";
  rank_score: number;
  reasons: string[];
  shared_skill_count: number;
  shared_topic_count: number;
  mutual_connection_count: number;
}

function unwrap<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error("The server returned no data.");
  return data;
}

export class ProfessionalGraphService {
  constructor(private readonly client: SupabaseClient) {}

  private async currentUserId(): Promise<string> {
    const { data, error } = await this.client.auth.getUser();
    if (error || !data.user) throw new Error(error?.message ?? "Authentication is required.");
    return data.user.id;
  }

  async sendConnectionRequest(tenantId: string, targetProfileId: string): Promise<ConnectionRecord> {
    const { data, error } = await this.client.rpc("send_connection_request", {
      requested_tenant_id: tenantId,
      target_profile_id: targetProfileId,
    }).single<ConnectionRecord>();
    return unwrap(data, error);
  }

  async respondToConnection(connectionId: string, decision: "ACCEPTED" | "DECLINED"): Promise<ConnectionRecord> {
    const { data, error } = await this.client.rpc("respond_to_connection", {
      connection_id: connectionId,
      decision,
    }).single<ConnectionRecord>();
    return unwrap(data, error);
  }

  async cancelConnectionRequest(connectionId: string): Promise<ConnectionRecord> {
    const { data, error } = await this.client.rpc("cancel_connection_request", { connection_id: connectionId }).single<ConnectionRecord>();
    return unwrap(data, error);
  }

  async removeConnection(connectionId: string): Promise<ConnectionRecord> {
    const { data, error } = await this.client.rpc("remove_connection", { connection_id: connectionId }).single<ConnectionRecord>();
    return unwrap(data, error);
  }

  async getPeopleRecommendations(tenantId: string, limit = 8): Promise<PeopleRecommendation[]> {
    const { data, error } = await this.client.rpc("get_people_recommendations", {
      requested_tenant_id: tenantId,
      result_limit: Math.max(1, Math.min(limit, 20)),
    });
    if (error) throw new Error(error.message);
    const recommendations = (data ?? []) as PeopleRecommendation[];
    if (recommendations.length) {
      const { error: impressionError } = await this.client.rpc("record_people_recommendation_impressions", {
        requested_tenant_id: tenantId,
        candidate_profile_ids: recommendations.map(item => item.candidate_profile_id),
      });
      if (impressionError) throw new Error(impressionError.message);
    }
    return recommendations;
  }

  async recordPeopleOutcome(
    tenantId: string,
    candidateProfileId: string,
    outcome: "CLICK" | "PROFILE_VIEW" | "FOLLOW" | "CONNECTION_REQUEST" | "DISMISS" | "NOT_RELEVANT" | "BLOCK",
  ): Promise<void> {
    const { error } = await this.client.rpc("record_people_recommendation_outcome", {
      requested_tenant_id: tenantId,
      candidate_profile_id: candidateProfileId,
      outcome,
    });
    if (error) throw new Error(error.message);
  }

  async follow(tenantId: string, followedProfileId: string): Promise<void> {
    const actorProfileId = await this.currentUserId();
    const { error } = await this.client.from("follows").upsert({ tenant_id: tenantId, follower_profile_id: actorProfileId, followed_profile_id: followedProfileId });
    if (error) throw new Error(error.message);
  }

  async unfollow(tenantId: string, followedProfileId: string): Promise<void> {
    const actorProfileId = await this.currentUserId();
    const { error } = await this.client.from("follows").delete().match({ tenant_id: tenantId, follower_profile_id: actorProfileId, followed_profile_id: followedProfileId });
    if (error) throw new Error(error.message);
  }

  async recordInteraction(input: InteractionInput): Promise<void> {
    const actorProfileId = await this.currentUserId();
    const { error } = await this.client.from("user_interactions").insert({
      tenant_id: input.tenantId,
      actor_profile_id: actorProfileId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      target_profile_id: input.targetProfileId ?? null,
      event_type: input.eventType,
      weight: input.weight ?? 1,
      metadata: input.metadata ?? {},
    });
    if (error) throw new Error(error.message);
  }
}
