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
