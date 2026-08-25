import { NEGATIVE_SIGNAL_MULTIPLIERS, PEOPLE_RANKING_V1, type PeopleRankingFeature } from "../config/ranking";

export type PeopleFeatureVector = Record<PeopleRankingFeature, number> & {
  impressionCount: number;
  dismissed: boolean;
  notRelevant: boolean;
};

export interface PeopleRankResult {
  score: number;
  label: "Strong match" | "Relevant" | "Suggested";
}

const clamp = (value: number): number => Math.max(0, Math.min(1, value));

export function rankPerson(features: PeopleFeatureVector): PeopleRankResult {
  const positive = Object.entries(PEOPLE_RANKING_V1).reduce(
    (total, [name, weight]) => total + clamp(features[name as PeopleRankingFeature]) * weight,
    0,
  );
  const fatigue = Math.min(Math.max(features.impressionCount, 0) * 0.08, 0.60);
  const explicitPenalty = features.notRelevant
    ? NEGATIVE_SIGNAL_MULTIPLIERS.not_interested
    : features.dismissed
      ? NEGATIVE_SIGNAL_MULTIPLIERS.dismiss
      : 0;
  const score = clamp(positive - fatigue - explicitPenalty);
  return { score, label: score >= 0.65 ? "Strong match" : score >= 0.42 ? "Relevant" : "Suggested" };
}
