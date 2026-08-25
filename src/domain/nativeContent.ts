export type NativeContentType = "POST" | "ARTICLE";
export type NativeReaction = "LIKE" | "LOVE" | "CELEBRATE" | "INSIGHTFUL" | "SUPPORT" | "CURIOUS";
export type ContentBlockType = "paragraph" | "heading" | "subheading" | "quote" | "code" | "image" | "divider";

export interface ContentBlock {
  id: string;
  type: ContentBlockType;
  text?: string;
  code?: string;
  language?: string;
  url?: string;
  alt?: string;
  caption?: string;
}

export interface NativeAuthor {
  id: string;
  slug: string | null;
  display_name: string | null;
  headline: string | null;
  avatar_url: string | null;
}

export interface NativeArticle {
  id: string;
  tenant_id: string;
  author_id: string;
  title: string;
  description: string;
  content_type: NativeContentType;
  content_blocks: ContentBlock[];
  hashtags: string[];
  tags: string[];
  cover_image_url: string | null;
  reading_minutes: number;
  reaction_count: number;
  comment_count: number;
  share_count: number;
  restack_count: number;
  published_at: string;
  source_type: string;
  source_provider: string | null;
  external_url: string | null;
  author: NativeAuthor | null;
  viewerReaction?: NativeReaction | null;
  reactionSummary?: Partial<Record<NativeReaction, number>>;
  viewerSaved?: boolean;
  viewerRestacked?: boolean;
  viewerRestackThoughts?: string | null;
  viewerFollowingAuthor?: boolean;
  viewerSubscribedAuthor?: boolean;
}

export interface ArticleComment {
  id: string;
  article_id: string;
  author_profile_id: string;
  parent_comment_id: string | null;
  body: string;
  status: "ACTIVE" | "EDITED" | "DELETED" | "MODERATED";
  created_at: string;
  author: Pick<NativeAuthor, "id" | "display_name" | "avatar_url" | "headline"> | null;
}

export function normalizeHashtags(input: string | string[]): string[] {
  const values = Array.isArray(input) ? input : input.split(/[\s,]+/);
  return [...new Set(values.map(value => value.trim().replace(/^#+/, "").replace(/[^a-zA-Z0-9_.-]/g, "")).filter(Boolean))].slice(0, 20);
}

export function validateContentBlocks(blocks: ContentBlock[]): string[] {
  const errors: string[] = [];
  if (!Array.isArray(blocks) || blocks.length === 0) errors.push("Add at least one content block.");
  if (blocks.length > 250) errors.push("An article can contain at most 250 blocks.");
  blocks.forEach((block, index) => {
    if (!block.id || !block.type) errors.push(`Block ${index + 1} is malformed.`);
    if (["paragraph", "heading", "subheading", "quote"].includes(block.type) && !block.text?.trim()) errors.push(`Block ${index + 1} needs text.`);
    if (block.type === "code" && !block.code?.trim()) errors.push(`Code block ${index + 1} is empty.`);
    if (block.type === "image" && !/^https:\/\//i.test(block.url ?? "")) errors.push(`Image block ${index + 1} needs a secure URL.`);
  });
  return errors;
}
