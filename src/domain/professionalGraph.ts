export type TenantRole = "owner" | "admin" | "editor" | "member";
export type ProfileVisibility = "public" | "tenant" | "private";
export type AccountStatus = "active" | "suspended" | "deleted";
export type ConnectionStatus = "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED" | "REMOVED";
export type SkillSource =
  | "MANUAL"
  | "PROFILE_IMPORT"
  | "ARTICLE_ANALYSIS"
  | "PROJECT_ANALYSIS"
  | "GITHUB"
  | "RESUME"
  | "ADMIN"
  | "AI_INFERRED";

export type InteractionEvent =
  | "PROFILE_IMPRESSION"
  | "PROFILE_VIEW"
  | "SEARCH_RESULT_IMPRESSION"
  | "SEARCH_RESULT_CLICK"
  | "POST_IMPRESSION"
  | "POST_OPEN"
  | "POST_READ"
  | "POST_LIKE"
  | "POST_SAVE"
  | "POST_SHARE"
  | "POST_COMMENT"
  | "FOLLOW"
  | "UNFOLLOW"
  | "CONNECTION_IMPRESSION"
  | "CONNECTION_REQUEST"
  | "CONNECTION_ACCEPTED"
  | "CONNECTION_DISMISSED"
  | "NOT_INTERESTED"
  | "HIDE_POST"
  | "HIDE_AUTHOR"
  | "MUTE_AUTHOR"
  | "MUTE_TOPIC"
  | "BLOCK_USER";

export interface ProfessionalProfile {
  id: string;
  slug: string;
  displayName: string;
  headline: string | null;
  location: string | null;
  currentCompany: string | null;
  currentRole: string | null;
  visibility: ProfileVisibility;
  searchable: boolean;
  recommendable: boolean;
  accountStatus: AccountStatus;
  qualityScore: number;
}

export interface InteractionInput {
  tenantId: string;
  entityType: "PROFILE" | "POST" | "ARTICLE" | "TOPIC" | "COMMUNITY" | "PROJECT" | "RECOMMENDATION" | "SEARCH_RESULT";
  entityId: string;
  eventType: InteractionEvent;
  targetProfileId?: string;
  weight?: number;
  metadata?: Record<string, unknown>;
}

export interface CandidateEligibility {
  candidateId: string;
  viewerId: string;
  accountStatus: AccountStatus;
  profileVisibility: ProfileVisibility;
  searchable: boolean;
  recommendable: boolean;
  blocked: boolean;
  muted: boolean;
  existingConnection: boolean;
  pendingConnection: boolean;
  declinedCooldownUntil?: string | null;
}

export type CandidateRejectionReason =
  | "SELF"
  | "BLOCKED"
  | "MUTED"
  | "EXISTING_CONNECTION"
  | "PENDING_CONNECTION"
  | "DECLINED_COOLDOWN"
  | "UNAVAILABLE_PROFILE"
  | "PRIVATE_PROFILE";

export function candidateRejectionReason(candidate: CandidateEligibility, now = new Date()): CandidateRejectionReason | null {
  if (candidate.candidateId === candidate.viewerId) return "SELF";
  if (candidate.blocked) return "BLOCKED";
  if (candidate.muted) return "MUTED";
  if (candidate.existingConnection) return "EXISTING_CONNECTION";
  if (candidate.pendingConnection) return "PENDING_CONNECTION";
  if (candidate.declinedCooldownUntil && new Date(candidate.declinedCooldownUntil) > now) return "DECLINED_COOLDOWN";
  if (candidate.accountStatus !== "active" || !candidate.searchable || !candidate.recommendable) return "UNAVAILABLE_PROFILE";
  if (candidate.profileVisibility !== "public") return "PRIVATE_PROFILE";
  return null;
}
