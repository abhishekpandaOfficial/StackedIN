import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import type { ArticleComment, ContentBlock, NativeArticle, NativeContentType, NativeReaction } from "../domain/nativeContent";
import { normalizeHashtags, validateContentBlocks } from "../domain/nativeContent";

export interface SaveNativeArticleInput {
  tenantId: string;
  articleId?: string | null;
  title: string;
  description: string;
  contentType: NativeContentType;
  blocks: ContentBlock[];
  tags?: string[];
  hashtags?: string[] | string;
  coverImageUrl?: string | null;
  status: "draft" | "published";
}

export type CMSStatus = "draft" | "scheduled" | "published" | "archived";
export type DistributionPlatform = "STACKEDIN" | "SUBSTACK" | "MEDIUM" | "HASHNODE" | "LINKEDIN";

export interface CMSDistributionTarget {
  platform: DistributionPlatform;
  enabled: boolean;
  title?: string;
  excerpt?: string;
  tags?: string[];
}

export interface SaveCMSArticleInput extends Omit<SaveNativeArticleInput, "status"> {
  pillar?: string;
  series?: string;
  slug?: string;
  status: Exclude<CMSStatus, "archived">;
  scheduledFor?: string | null;
  seo?: {
    title?: string;
    description?: string;
    canonicalUrl?: string;
    socialImageUrl?: string;
  };
  distribution?: CMSDistributionTarget[];
  metadata?: Record<string, unknown>;
}

export interface CMSArticle extends NativeArticle {
  status: CMSStatus;
  slug: string | null;
  seo_title: string | null;
  seo_description: string | null;
  canonical_url: string | null;
  social_image_url: string | null;
  scheduled_for: string | null;
  first_published_at: string | null;
  editor_metadata: Record<string, unknown>;
  distribution_targets: DistributionPlatform[];
  updated_at: string;
}

export interface ArticleRevision {
  id: string;
  article_id: string;
  revision_no: number;
  title: string;
  description: string;
  content_blocks: ContentBlock[];
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DistributionJob {
  id: string;
  article_id: string;
  platform: DistributionPlatform;
  status: "PENDING" | "PROCESSING" | "PUBLISHED" | "HANDOFF_READY" | "REQUIRES_CONNECTION" | "FAILED" | "CANCELLED";
  delivery_mode: "NATIVE" | "API" | "HANDOFF";
  scheduled_for: string | null;
  platform_title: string | null;
  platform_excerpt: string | null;
  platform_tags: string[];
  external_post_url: string | null;
  last_error: string | null;
  published_at: string | null;
  updated_at: string;
}

export interface PublicationSource {
  id: string;
  provider: "SUBSTACK" | "MEDIUM" | "HASHNODE" | "LINKEDIN" | "RSS";
  profile_url: string;
  feed_url: string | null;
  handle: string | null;
  status: "PENDING" | "ACTIVE" | "PAUSED" | "ERROR" | "REAUTH_REQUIRED";
  capabilities: { import?: boolean; direct_publish?: boolean; share?: boolean };
  last_synced_at: string | null;
  last_error: string | null;
  last_post_count?: number;
  last_sync_source?: string | null;
}

export class NativePublishingService {
  constructor(private readonly client: SupabaseClient) {}

  async listFeed(limit = 30): Promise<NativeArticle[]> {
    const { data, error } = await this.client
      .from("articles")
      .select("id,tenant_id,author_id,title,description,content_type,content_blocks,hashtags,tags,cover_image_url,reading_minutes,reaction_count,comment_count,share_count,restack_count,published_at,source_type,source_provider,external_url,author:profiles!articles_author_profile_fk(id,slug,display_name,headline,avatar_url)")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(Math.max(1, Math.min(limit, 60)));
    if (error) throw new Error(error.message);
    const articles = (data ?? []) as unknown as NativeArticle[];
    if (!articles.length) return [];
    const { data: authData } = await this.client.auth.getUser();
    const viewerId = authData.user?.id;
    const articleIds = articles.map(article => article.id);
    const authorIds = [...new Set(articles.map(article => article.author_id))];
    const [reactionResult, saveResult, restackResult, preferenceResult, followResult, subscriptionResult] = await Promise.all([
      this.client.from("article_reactions").select("article_id,reaction_type,profile_id").in("article_id", articleIds),
      viewerId ? this.client.from("article_saves").select("article_id").eq("profile_id", viewerId).in("article_id", articleIds) : Promise.resolve({ data: [] }),
      viewerId ? this.client.from("article_restacks").select("article_id,thoughts").eq("profile_id", viewerId).in("article_id", articleIds) : Promise.resolve({ data: [] }),
      viewerId ? this.client.from("article_preferences").select("article_id,preference").eq("profile_id", viewerId).in("article_id", articleIds) : Promise.resolve({ data: [] }),
      viewerId ? this.client.from("follows").select("followed_profile_id").eq("follower_profile_id", viewerId).in("followed_profile_id", authorIds) : Promise.resolve({ data: [] }),
      viewerId ? this.client.from("profile_subscriptions").select("creator_profile_id").eq("subscriber_profile_id", viewerId).in("creator_profile_id", authorIds) : Promise.resolve({ data: [] }),
    ]);
    const reactions = reactionResult.data ?? [];
    const ownReactions = new Map((reactions ?? []).filter(item => item.profile_id === viewerId).map(item => [item.article_id, item.reaction_type as NativeReaction]));
    const summaries = new Map<string, Partial<Record<NativeReaction, number>>>();
    (reactions ?? []).forEach(item => {
      const summary = summaries.get(item.article_id) ?? {};
      const reaction = item.reaction_type as NativeReaction;
      summary[reaction] = (summary[reaction] ?? 0) + 1;
      summaries.set(item.article_id, summary);
    });
    const saves = new Set((saveResult.data ?? []).map(item => item.article_id));
    const restacks = new Map((restackResult.data ?? []).map(item => [item.article_id, item.thoughts]));
    const hidden = new Set((preferenceResult.data ?? []).map(item => item.article_id));
    const followed = new Set((followResult.data ?? []).map(item => item.followed_profile_id));
    const subscribed = new Set((subscriptionResult.data ?? []).map(item => item.creator_profile_id));
    return articles
      .filter(article => !hidden.has(article.id))
      .map(article => ({
        ...article,
        viewerReaction: ownReactions.get(article.id) ?? null,
        reactionSummary: summaries.get(article.id) ?? {},
        viewerSaved: saves.has(article.id),
        viewerRestacked: restacks.has(article.id),
        viewerRestackThoughts: restacks.get(article.id) ?? null,
        viewerFollowingAuthor: followed.has(article.author_id),
        viewerSubscribedAuthor: subscribed.has(article.author_id),
      }));
  }

  async save(input: SaveNativeArticleInput): Promise<NativeArticle> {
    const errors = input.status === "published" ? validateContentBlocks(input.blocks) : [];
    if (errors.length) throw new Error(errors[0]);
    const { data, error } = await this.client.rpc("save_native_article", {
      requested_tenant_id: input.tenantId,
      requested_article_id: input.articleId ?? null,
      requested_title: input.title.trim() || (input.status === "draft" ? "Untitled draft" : input.title),
      requested_description: input.description,
      requested_content_type: input.contentType,
      requested_blocks: input.blocks,
      requested_tags: input.tags ?? [],
      requested_hashtags: normalizeHashtags(input.hashtags ?? []),
      requested_cover_image_url: input.coverImageUrl ?? null,
      requested_status: input.status,
    });
    if (error) throw new Error(error.message);
    return data as NativeArticle;
  }

  async saveCMS(input: SaveCMSArticleInput): Promise<CMSArticle> {
    const errors = input.status === "draft" ? [] : validateContentBlocks(input.blocks);
    if (errors.length) throw new Error(errors[0]);
    if (input.status === "scheduled" && (!input.scheduledFor || new Date(input.scheduledFor).getTime() <= Date.now())) {
      throw new Error("Choose a schedule time in the future.");
    }
    const distribution = (input.distribution ?? [{ platform: "STACKEDIN" as const, enabled: true }])
      .filter(target => target.enabled)
      .map(target => ({
        platform: target.platform,
        title: target.title?.trim() || null,
        excerpt: target.excerpt?.trim() || null,
        tags: normalizeHashtags(target.tags ?? []),
      }));
    if (!distribution.some(target => target.platform === "STACKEDIN")) {
      distribution.unshift({ platform: "STACKEDIN", title: null, excerpt: null, tags: [] });
    }
    const { data, error } = await this.client.rpc("save_cms_article", {
      requested_tenant_id: input.tenantId,
      requested_article_id: input.articleId ?? null,
      requested_title: input.title.trim() || "Untitled draft",
      requested_description: input.description,
      requested_content_type: input.contentType,
      requested_blocks: input.blocks,
      requested_tags: normalizeHashtags(input.tags ?? []),
      requested_hashtags: normalizeHashtags(input.hashtags ?? []),
      requested_cover_image_url: input.coverImageUrl ?? null,
      requested_pillar: input.pillar?.trim() || null,
      requested_series: input.series?.trim() || null,
      requested_slug: input.slug?.trim() || null,
      requested_seo: input.seo ?? {},
      requested_status: input.status,
      requested_scheduled_for: input.scheduledFor ?? null,
      requested_distribution: distribution,
      requested_editor_metadata: input.metadata ?? {},
    });
    if (error) throw new Error(error.message);
    return data as CMSArticle;
  }

  async listCMSArticles(tenantId: string): Promise<CMSArticle[]> {
    const { data, error } = await this.client.from("articles")
      .select("id,tenant_id,author_id,title,description,content_type,content_blocks,hashtags,tags,pillar,series,cover_image_url,reading_minutes,reaction_count,comment_count,share_count,restack_count,published_at,source_type,source_provider,external_url,status,slug,seo_title,seo_description,canonical_url,social_image_url,scheduled_for,first_published_at,editor_metadata,distribution_targets,updated_at")
      .eq("tenant_id", tenantId).eq("source_type", "USER").order("updated_at", { ascending: false }).limit(250);
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as CMSArticle[];
  }

  async getCMSArticle(articleId: string): Promise<CMSArticle> {
    const { data, error } = await this.client.from("articles")
      .select("id,tenant_id,author_id,title,description,content_type,content_blocks,hashtags,tags,pillar,series,cover_image_url,reading_minutes,reaction_count,comment_count,share_count,restack_count,published_at,source_type,source_provider,external_url,status,slug,seo_title,seo_description,canonical_url,social_image_url,scheduled_for,first_published_at,editor_metadata,distribution_targets,updated_at")
      .eq("id", articleId).single();
    if (error) throw new Error(error.message);
    return data as unknown as CMSArticle;
  }

  async listRevisions(articleId: string): Promise<ArticleRevision[]> {
    const { data, error } = await this.client.from("article_revisions")
      .select("id,article_id,revision_no,title,description,content_blocks,metadata,created_at")
      .eq("article_id", articleId).order("revision_no", { ascending: false }).limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as ArticleRevision[];
  }

  async restoreRevision(revisionId: string): Promise<CMSArticle> {
    const { data, error } = await this.client.rpc("restore_article_revision", { requested_revision_id: revisionId });
    if (error) throw new Error(error.message);
    return data as CMSArticle;
  }

  async listDistributionJobs(tenantId: string, articleId?: string): Promise<DistributionJob[]> {
    let query = this.client.from("distribution_jobs")
      .select("id,article_id,platform,status,delivery_mode,scheduled_for,platform_title,platform_excerpt,platform_tags,external_post_url,last_error,published_at,updated_at")
      .eq("tenant_id", tenantId).order("updated_at", { ascending: false }).limit(250);
    if (articleId) query = query.eq("article_id", articleId);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []) as DistributionJob[];
  }

  async uploadImage(userId: string, file: File): Promise<string> {
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) throw new Error("Choose a JPG, PNG, WebP, or GIF under 10 MB.");
    const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "webp";
    const path = `${userId}/${crypto.randomUUID()}.${extension}`;
    const { error } = await this.client.storage.from("article-media").upload(path, file, { cacheControl: "31536000", upsert: false });
    if (error) throw new Error(error.message);
    return this.client.storage.from("article-media").getPublicUrl(path).data.publicUrl;
  }

  async react(articleId: string, reaction: NativeReaction | null): Promise<void> {
    const { error } = await this.client.rpc("react_to_article", { requested_article_id: articleId, requested_reaction: reaction });
    if (error) throw new Error(error.message);
  }

  async listComments(articleId: string): Promise<ArticleComment[]> {
    const { data, error } = await this.client
      .from("article_comments")
      .select("id,article_id,author_profile_id,parent_comment_id,body,status,created_at,author:profiles!article_comments_author_profile_id_fkey(id,display_name,avatar_url,headline)")
      .eq("article_id", articleId)
      .neq("status", "DELETED")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as ArticleComment[];
  }

  async comment(articleId: string, body: string, parentId: string | null = null): Promise<ArticleComment> {
    const { data, error } = await this.client.rpc("add_article_comment", {
      requested_article_id: articleId,
      requested_parent_id: parentId,
      requested_body: body,
    });
    if (error) throw new Error(error.message);
    return data as ArticleComment;
  }

  async recordShare(tenantId: string, profileId: string, articleId: string, destination: string): Promise<void> {
    const { error } = await this.client.from("article_shares").insert({ tenant_id: tenantId, profile_id: profileId, article_id: articleId, destination });
    if (error) throw new Error(error.message);
  }

  async setSaved(tenantId: string, profileId: string, articleId: string, saved: boolean): Promise<void> {
    const query = this.client.from("article_saves");
    const { error } = saved
      ? await query.upsert({ tenant_id: tenantId, profile_id: profileId, article_id: articleId })
      : await query.delete().match({ profile_id: profileId, article_id: articleId });
    if (error) throw new Error(error.message);
  }

  async restack(tenantId: string, profileId: string, articleId: string, thoughts: string | null): Promise<void> {
    const normalizedThoughts = thoughts?.trim() || null;
    if (normalizedThoughts && normalizedThoughts.length > 1200) throw new Error("Restack thoughts must be 1,200 characters or fewer.");
    const { error } = await this.client.from("article_restacks").upsert({
      tenant_id: tenantId,
      profile_id: profileId,
      article_id: articleId,
      thoughts: normalizedThoughts,
    }, { onConflict: "article_id,profile_id" });
    if (error) throw new Error(error.message);
  }

  async removeRestack(profileId: string, articleId: string): Promise<void> {
    const { error } = await this.client.from("article_restacks").delete().match({ profile_id: profileId, article_id: articleId });
    if (error) throw new Error(error.message);
  }

  async setFeedPreference(tenantId: string, profileId: string, articleId: string, preference: "HIDDEN" | "NOT_INTERESTED"): Promise<void> {
    const { error } = await this.client.from("article_preferences").upsert({ tenant_id: tenantId, profile_id: profileId, article_id: articleId, preference }, { onConflict: "article_id,profile_id" });
    if (error) throw new Error(error.message);
  }

  async reportArticle(tenantId: string, profileId: string, articleId: string, reason: "SPAM" | "HARASSMENT" | "MISINFORMATION" | "COPYRIGHT" | "OTHER", details = ""): Promise<void> {
    const { error } = await this.client.from("article_reports").upsert({
      tenant_id: tenantId,
      reporter_profile_id: profileId,
      article_id: articleId,
      reason,
      details: details.slice(0, 2000),
    }, { onConflict: "article_id,reporter_profile_id", ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }

  async setSubscribed(tenantId: string, subscriberProfileId: string, creatorProfileId: string, subscribed: boolean): Promise<void> {
    if (subscriberProfileId === creatorProfileId) return;
    const query = this.client.from("profile_subscriptions");
    const { error } = subscribed
      ? await query.upsert({ tenant_id: tenantId, subscriber_profile_id: subscriberProfileId, creator_profile_id: creatorProfileId, delivery_mode: "IN_APP" })
      : await query.delete().match({ tenant_id: tenantId, subscriber_profile_id: subscriberProfileId, creator_profile_id: creatorProfileId });
    if (error) throw new Error(error.message);
  }

  async listSources(): Promise<PublicationSource[]> {
    const { data, error } = await this.client.from("publication_sources")
      .select("id,provider,profile_url,feed_url,handle,status,capabilities,last_synced_at,last_error,last_post_count,last_sync_source")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as PublicationSource[];
  }

  async connectPublicSource(tenantId: string, ownerProfileId: string, provider: PublicationSource["provider"], profileUrl: string): Promise<PublicationSource> {
    let url: URL;
    try { url = new URL(profileUrl); } catch { throw new Error("Enter a complete HTTPS profile or publication URL."); }
    if (url.protocol !== "https:") throw new Error("Publication sources must use HTTPS.");
    const linkedin = provider === "LINKEDIN";
    const { data, error } = await this.client.from("publication_sources").upsert({
      tenant_id: tenantId,
      owner_profile_id: ownerProfileId,
      provider,
      profile_url: url.toString(),
      status: linkedin ? "REAUTH_REQUIRED" : "PENDING",
      import_mode: "REFERENCE",
      capabilities: { import: !linkedin, direct_publish: false, share: true },
      last_error: linkedin ? "Approved LinkedIn OAuth API access is required for automatic import." : null,
    }, { onConflict: "tenant_id,owner_profile_id,provider,profile_url" }).select("id,provider,profile_url,feed_url,handle,status,capabilities,last_synced_at,last_error,last_post_count,last_sync_source").single();
    if (error) throw new Error(error.message);
    return data as PublicationSource;
  }

  async synchronizeSource(source: PublicationSource): Promise<number> {
    if (source.provider === "LINKEDIN") throw new Error("LinkedIn synchronization requires approved OAuth API access.");
    const { data: sessionData } = await this.client.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) throw new Error("Your session expired. Sign in again before synchronizing.");
    const response = await fetch("/api/xstudio-sync", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ provider: source.provider, profileUrl: source.profile_url }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      await this.client.from("publication_sources").update({ status: "ERROR", last_error: payload.error || "Public source synchronization failed" }).eq("id", source.id);
      throw new Error(payload.error || "Public source synchronization failed");
    }
    const { data, error } = await this.client.rpc("import_publication_batch", { requested_source_id: source.id, requested_posts: payload.posts ?? [], requested_sync_source: payload.syncSource ?? "PUBLIC_FEED" });
    if (error) throw new Error(error.message);
    await this.client.from("publication_sources").update({ feed_url: payload.feedUrl || null }).eq("id", source.id);
    return Number(data || 0);
  }

  async disconnectSource(sourceId: string): Promise<void> {
    const { error } = await this.client.from("publication_sources").delete().eq("id", sourceId);
    if (error) throw new Error(error.message);
  }

  async listOwnedImports(): Promise<NativeArticle[]> {
    const { data: authData } = await this.client.auth.getUser(); const profileId = authData.user?.id;
    if (!profileId) return [];
    const { data, error } = await this.client.from("articles")
      .select("id,tenant_id,author_id,title,description,content_type,content_blocks,hashtags,tags,pillar,series,cover_image_url,reading_minutes,reaction_count,comment_count,share_count,restack_count,published_at,source_type,source_provider,external_url")
      .eq("author_id", profileId).neq("source_type", "USER").eq("status", "published").order("published_at", { ascending: false }).limit(250);
    if (error) throw new Error(error.message);
    return (data ?? []) as NativeArticle[];
  }

  subscribe(onChange: () => void): RealtimeChannel {
    return this.client.channel("stackedin-native-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "articles" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "article_reactions" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "article_comments" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "article_saves" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "article_restacks" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "article_preferences" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "profile_subscriptions" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "follows" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "connections" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "article_revisions" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "distribution_jobs" }, onChange)
      .subscribe();
  }
}
