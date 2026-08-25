import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

export interface ProfileBundle {
  profile: Record<string, unknown>;
  experiences: Array<Record<string, unknown>>;
  education: Array<Record<string, unknown>>;
  projects: Array<Record<string, unknown>>;
  achievements: Array<Record<string, unknown>>;
  links: Array<Record<string, unknown>>;
  activities: Array<Record<string, unknown>>;
  relationship: { connectionId: string | null; connectionStatus: string | null; isFollowing: boolean; isSubscribed: boolean };
  counts: { followers: number; connections: number; publications: number };
}

export interface InboxConversation {
  id: string;
  title: string;
  otherProfile: Record<string, unknown> | null;
  lastMessage: Record<string, unknown> | null;
  updatedAt: string;
  unread: boolean;
}

export class ProfileHubService {
  constructor(private readonly client: SupabaseClient) {}

  async loadProfile(profileId: string, tenantId: string, viewerId: string): Promise<ProfileBundle> {
    const profileFields = "id,slug,username,display_name,headline,about,bio,location,country,industry,current_company,current_job_title,years_experience,avatar_url,banner_url,profile_completeness,quality_score,website_url,github_url,gitlab_url,linkedin_url,medium_url,hashnode_url,featured_skills,featured_badges,created_at,updated_at";
    const [profileResult, experiences, education, projects, achievements, links, activities, connectionResult, followResult, subscriptionResult, countsResult] = await Promise.all([
      this.client.from("profiles").select(profileFields).eq("id", profileId).single(),
      this.client.from("profile_experiences").select("*").eq("profile_id", profileId).order("currently_working", { ascending: false }).order("start_date", { ascending: false }),
      this.client.from("profile_education").select("*").eq("profile_id", profileId).order("start_date", { ascending: false }),
      this.client.from("profile_projects").select("*").eq("profile_id", profileId).order("display_order").order("created_at", { ascending: false }),
      this.client.from("profile_achievements").select("*").eq("profile_id", profileId).order("issued_on", { ascending: false }),
      this.client.from("profile_links").select("*").eq("profile_id", profileId).order("display_order"),
      this.client.from("articles").select("id,title,description,content_type,published_at,reaction_count,comment_count,restack_count,hashtags,status").eq("author_id", profileId).eq("status", "published").order("published_at", { ascending: false }).limit(30),
      viewerId === profileId ? Promise.resolve({ data: [], error: null }) : this.client.from("connections").select("id,status,requester_profile_id,addressee_profile_id").eq("tenant_id", tenantId).or(`and(requester_profile_id.eq.${viewerId},addressee_profile_id.eq.${profileId}),and(requester_profile_id.eq.${profileId},addressee_profile_id.eq.${viewerId})`).in("status", ["PENDING", "ACCEPTED"]).limit(1),
      this.client.from("follows").select("followed_profile_id").eq("tenant_id", tenantId).eq("follower_profile_id", viewerId).eq("followed_profile_id", profileId).limit(1),
      this.client.from("profile_subscriptions").select("creator_profile_id").eq("tenant_id", tenantId).eq("subscriber_profile_id", viewerId).eq("creator_profile_id", profileId).limit(1),
      this.client.rpc("get_profile_counts", { requested_profile_id: profileId }).single(),
    ]);
    const failed = [profileResult, experiences, education, projects, achievements, links, activities, connectionResult, followResult, subscriptionResult, countsResult].map(result => result.error).find(Boolean);
    if (failed) throw new Error(failed.message);
    const connection = connectionResult.data?.[0] ?? null;
    const counts = (countsResult.data ?? {}) as { follower_count?: number | string; connection_count?: number | string; publication_count?: number | string };
    return {
      profile: profileResult.data as Record<string, unknown>,
      experiences: experiences.data ?? [], education: education.data ?? [], projects: projects.data ?? [], achievements: achievements.data ?? [], links: links.data ?? [], activities: activities.data ?? [],
      relationship: { connectionId: connection?.id ?? null, connectionStatus: connection?.status ?? null, isFollowing: Boolean(followResult.data?.length), isSubscribed: Boolean(subscriptionResult.data?.length) },
      counts: { followers: Number(counts.follower_count ?? 0), connections: Number(counts.connection_count ?? 0), publications: Number(counts.publication_count ?? activities.data?.length ?? 0) },
    };
  }

  async updateProfile(profileId: string, changes: Record<string, unknown>): Promise<void> {
    const { error } = await this.client.from("profiles").update(changes).eq("id", profileId);
    if (error) throw new Error(error.message);
  }

  async uploadProfileImage(profileId: string, file: File, kind: "avatar" | "banner"): Promise<string> {
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) throw new Error("Choose a JPG, PNG, WebP, or GIF under 10 MB.");
    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "webp";
    const path = `${profileId}/${kind}-${crypto.randomUUID()}.${extension}`;
    const { error } = await this.client.storage.from("profile-media").upload(path, file, { upsert: false, cacheControl: "31536000" });
    if (error) throw new Error(error.message);
    return this.client.storage.from("profile-media").getPublicUrl(path).data.publicUrl;
  }

  async saveRecord(table: "profile_experiences" | "profile_education" | "profile_projects" | "profile_achievements" | "profile_links", tenantId: string, profileId: string, record: Record<string, unknown>): Promise<void> {
    const { id, ...changes } = record;
    const payload = { ...changes, tenant_id: tenantId, profile_id: profileId };
    const { error } = id ? await this.client.from(table).update(payload).eq("id", id).eq("profile_id", profileId) : await this.client.from(table).insert(payload);
    if (error) throw new Error(error.message);
  }

  async deleteRecord(table: "profile_experiences" | "profile_education" | "profile_projects" | "profile_achievements" | "profile_links", profileId: string, recordId: string): Promise<void> {
    const { error } = await this.client.from(table).delete().eq("id", recordId).eq("profile_id", profileId);
    if (error) throw new Error(error.message);
  }

  async listPendingRequests(): Promise<Array<Record<string, unknown>>> {
    const { data: userData } = await this.client.auth.getUser(); const userId = userData.user?.id;
    if (!userId) return [];
    const { data, error } = await this.client.from("connections").select("id,tenant_id,requester_profile_id,requested_at").eq("addressee_profile_id", userId).eq("status", "PENDING").order("requested_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = [...new Set((data ?? []).map(item => item.requester_profile_id))];
    const profiles = ids.length ? await this.client.from("profiles").select("id,display_name,headline,avatar_url,current_company").in("id", ids) : { data: [] };
    const byId = new Map((profiles.data ?? []).map(profile => [profile.id, profile]));
    return (data ?? []).map(request => ({ ...request, requester: byId.get(request.requester_profile_id) ?? null }));
  }

  async listNotifications(limit = 50): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await this.client.from("notifications").select("id,tenant_id,recipient_profile_id,actor_profile_id,notification_type,entity_type,entity_id,title,body,read_at,created_at,actor:profiles!notifications_actor_profile_id_fkey(id,display_name,headline,avatar_url)").order("created_at", { ascending: false }).limit(limit);
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async markNotificationRead(notificationId: string): Promise<void> {
    const { error } = await this.client.rpc("mark_notifications_read", { requested_notification_id: notificationId });
    if (error) throw new Error(error.message);
  }

  async markAllNotificationsRead(profileId: string): Promise<void> {
    void profileId;
    const { error } = await this.client.rpc("mark_notifications_read", { requested_notification_id: null });
    if (error) throw new Error(error.message);
  }

  async startConversation(tenantId: string, targetProfileId: string): Promise<string> {
    const { data, error } = await this.client.rpc("start_direct_conversation", { requested_tenant_id: tenantId, target_profile_id: targetProfileId });
    if (error) throw new Error(error.message);
    return data as string;
  }

  async listConversations(profileId: string): Promise<InboxConversation[]> {
    const memberships = await this.client.from("conversation_members").select("conversation_id,last_read_at").eq("profile_id", profileId);
    if (memberships.error) throw new Error(memberships.error.message);
    const ids = (memberships.data ?? []).map(item => item.conversation_id); if (!ids.length) return [];
    const [conversations, members, messages] = await Promise.all([
      this.client.from("conversations").select("id,title,conversation_type,updated_at").in("id", ids).order("updated_at", { ascending: false }),
      this.client.from("conversation_members").select("conversation_id,profile_id,profile:profiles!conversation_members_profile_id_fkey(id,display_name,headline,avatar_url)").in("conversation_id", ids).neq("profile_id", profileId),
      this.client.from("messages").select("id,conversation_id,sender_profile_id,body,created_at,deleted_at").in("conversation_id", ids).order("created_at", { ascending: false }),
    ]);
    const otherByConversation = new Map<string, Record<string, unknown> | null>((members.data ?? []).map(item => {
      const joinedProfile = Array.isArray(item.profile) ? item.profile[0] ?? null : item.profile;
      return [item.conversation_id, joinedProfile as Record<string, unknown> | null];
    }));
    const lastByConversation = new Map<string, Record<string, unknown>>();
    (messages.data ?? []).forEach(message => { if (!lastByConversation.has(message.conversation_id)) lastByConversation.set(message.conversation_id, message); });
    const readByConversation = new Map((memberships.data ?? []).map(item => [item.conversation_id, item.last_read_at]));
    return (conversations.data ?? []).map(conversation => {
      const lastMessage = lastByConversation.get(conversation.id) ?? null; const lastRead = readByConversation.get(conversation.id);
      return { id: conversation.id, title: conversation.title, otherProfile: otherByConversation.get(conversation.id) ?? null, lastMessage, updatedAt: conversation.updated_at, unread: Boolean(lastMessage && lastMessage.sender_profile_id !== profileId && (!lastRead || String(lastMessage.created_at) > String(lastRead))) };
    });
  }

  async listMessages(conversationId: string): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await this.client.from("messages").select("id,conversation_id,sender_profile_id,body,reply_to_message_id,edited_at,deleted_at,created_at,sender:profiles!messages_sender_profile_id_fkey(id,display_name,avatar_url)").eq("conversation_id", conversationId).order("created_at");
    if (error) throw new Error(error.message); return data ?? [];
  }

  async sendMessage(conversationId: string, senderProfileId: string, body: string): Promise<void> {
    const { error } = await this.client.from("messages").insert({ conversation_id: conversationId, sender_profile_id: senderProfileId, body: body.trim() });
    if (error) throw new Error(error.message);
  }

  async markConversationRead(conversationId: string, profileId: string): Promise<void> {
    void profileId;
    const { error } = await this.client.rpc("mark_conversation_read", { requested_conversation_id: conversationId });
    if (error) throw new Error(error.message);
  }

  subscribe(profileId: string, onChange: () => void): RealtimeChannel {
    return this.client.channel(`stackedin-profile-hub-${profileId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `recipient_profile_id=eq.${profileId}` }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "connections" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "profile_experiences", filter: `profile_id=eq.${profileId}` }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "profile_projects", filter: `profile_id=eq.${profileId}` }, onChange)
      .subscribe();
  }
}
