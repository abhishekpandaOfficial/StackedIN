export type PeopleRankingFeature =
  | "professional_similarity"
  | "shared_skills"
  | "shared_topics"
  | "mutual_connections"
  | "content_similarity"
  | "career_relevance"
  | "company_overlap"
  | "community_overlap"
  | "location_relevance"
  | "network_quality"
  | "freshness"
  | "exploration_bonus";

export const PEOPLE_RANKING_V1: Readonly<Record<PeopleRankingFeature, number>> = Object.freeze({
  professional_similarity: 0.20,
  shared_skills: 0.15,
  shared_topics: 0.14,
  mutual_connections: 0.12,
  content_similarity: 0.10,
  career_relevance: 0.08,
  company_overlap: 0.06,
  community_overlap: 0.04,
  location_relevance: 0.03,
  network_quality: 0.03,
  freshness: 0.03,
  exploration_bonus: 0.02,
});

export const NEGATIVE_SIGNAL_MULTIPLIERS = Object.freeze({
  weak_inferred_positive: 0.25,
  repeated_ignore: 0.45,
  dismiss: 0.70,
  not_interested: 1.25,
  block: 10,
});

export function normalizedWeightTotal(weights: Readonly<Record<string, number>>): number {
  return Object.values(weights).reduce((total, weight) => total + weight, 0);
}
