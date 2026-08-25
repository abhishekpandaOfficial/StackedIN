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

export interface FeedPerson {
  profile_id: string;
  display_name: string;
  headline: string | null;
  avatar_url: string | null;
  current_company: string | null;
  degree: 1 | 2 | 3;
  reason: string;
  is_following: boolean;
  is_subscribed: boolean;
  connection_id: string | null;
}

export interface NetworkSummary {
  connections: number;
  followers: number;
  following: number;
  subscriptions: number;
}

export function connectionDegree(connectionId: string | null, mutualConnectionCount: number): 1 | 2 | 3 {
  if (connectionId) return 1;
  return mutualConnectionCount > 0 ? 2 : 3;
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

  async getFeedPeople(tenantId: string, limit = 6): Promise<FeedPerson[]> {
    const viewerId = await this.currentUserId();
    const [connectionResult, recommendationResult] = await Promise.all([
      this.client.from("connections")
        .select("id,requester_profile_id,addressee_profile_id")
        .eq("tenant_id", tenantId)
        .eq("status", "ACCEPTED")
        .or(`requester_profile_id.eq.${viewerId},addressee_profile_id.eq.${viewerId}`)
        .limit(limit),
      this.getPeopleRecommendations(tenantId, limit),
    ]);
    if (connectionResult.error) throw new Error(connectionResult.error.message);
    const direct = connectionResult.data ?? [];
    const directIds = direct.map(item => item.requester_profile_id === viewerId ? item.addressee_profile_id : item.requester_profile_id);
    const candidateIds = [...new Set([...directIds, ...recommendationResult.map(item => item.candidate_profile_id)])].slice(0, limit * 2);
    if (!candidateIds.length) return [];
    const [profileResult, followResult, subscriptionResult] = await Promise.all([
      this.client.from("profiles").select("id,display_name,headline,avatar_url,current_company").in("id", candidateIds),
      this.client.from("follows").select("followed_profile_id").eq("tenant_id", tenantId).eq("follower_profile_id", viewerId).in("followed_profile_id", candidateIds),
      this.client.from("profile_subscriptions").select("creator_profile_id").eq("tenant_id", tenantId).eq("subscriber_profile_id", viewerId).in("creator_profile_id", candidateIds),
    ]);
    if (profileResult.error) throw new Error(profileResult.error.message);
    const profiles = new Map((profileResult.data ?? []).map(profile => [profile.id, profile]));
    const followed = new Set((followResult.data ?? []).map(item => item.followed_profile_id));
    const subscribed = new Set((subscriptionResult.data ?? []).map(item => item.creator_profile_id));
    const directMap = new Map(direct.map(item => [item.requester_profile_id === viewerId ? item.addressee_profile_id : item.requester_profile_id, item.id]));
    const recommendationMap = new Map(recommendationResult.map(item => [item.candidate_profile_id, item]));
    return candidateIds.map(profileId => {
      const profile = profiles.get(profileId);
      const recommendation = recommendationMap.get(profileId);
      const connectionId = directMap.get(profileId) ?? null;
      if (!profile) return null;
      const degree = connectionDegree(connectionId, recommendation?.mutual_connection_count ?? 0);
      return {
        profile_id: profileId,
        display_name: profile.display_name || "StackedIN member",
        headline: profile.headline,
        avatar_url: profile.avatar_url,
        current_company: profile.current_company,
        degree,
        reason: connectionId ? "Connected professional" : recommendation?.reasons?.[0] || (degree === 2 ? "Mutual professional network" : "Similar knowledge interests"),
        is_following: followed.has(profileId),
        is_subscribed: subscribed.has(profileId),
        connection_id: connectionId,
      };
    }).filter((person): person is FeedPerson => Boolean(person)).slice(0, limit);
  }

  async getNetworkSummary(tenantId: string): Promise<NetworkSummary> {
    const viewerId = await this.currentUserId();
    const [connections, followers, following, subscriptions] = await Promise.all([
      this.client.from("connections").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "ACCEPTED").or(`requester_profile_id.eq.${viewerId},addressee_profile_id.eq.${viewerId}`),
      this.client.from("follows").select("followed_profile_id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("followed_profile_id", viewerId),
      this.client.from("follows").select("follower_profile_id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("follower_profile_id", viewerId),
      this.client.from("profile_subscriptions").select("creator_profile_id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("subscriber_profile_id", viewerId),
    ]);
    return { connections: connections.count ?? 0, followers: followers.count ?? 0, following: following.count ?? 0, subscriptions: subscriptions.count ?? 0 };
  }

  async removeConnectionWithProfile(tenantId: string, targetProfileId: string): Promise<void> {
    const viewerId = await this.currentUserId();
    const { data, error } = await this.client.from("connections")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("status", "ACCEPTED")
      .or(`and(requester_profile_id.eq.${viewerId},addressee_profile_id.eq.${targetProfileId}),and(requester_profile_id.eq.${targetProfileId},addressee_profile_id.eq.${viewerId})`)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data?.id) await this.removeConnection(data.id);
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
