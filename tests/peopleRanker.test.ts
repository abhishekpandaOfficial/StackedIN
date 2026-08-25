import { describe, expect, it } from "vitest";
import { rankPerson, type PeopleFeatureVector } from "../src/recommendation/peopleRanker";

const baseline: PeopleFeatureVector = {
  professional_similarity: 0.8,
  shared_skills: 0.8,
  shared_topics: 0.7,
  mutual_connections: 0.6,
  content_similarity: 0.7,
  career_relevance: 0.8,
  company_overlap: 0,
  community_overlap: 0,
  location_relevance: 1,
  network_quality: 0.8,
  freshness: 0.9,
  exploration_bonus: 0.2,
  impressionCount: 0,
  dismissed: false,
  notRelevant: false,
};

describe("people recommendation ranking", () => {
  it("produces an explainable qualitative label", () => {
    const result = rankPerson(baseline);
    expect(result.score).toBeGreaterThan(0.6);
    expect(["Strong match", "Relevant"]).toContain(result.label);
  });

  it("penalizes repeatedly ignored recommendations", () => {
    expect(rankPerson({ ...baseline, impressionCount: 5 }).score).toBeLessThan(rankPerson(baseline).score);
  });

  it("makes explicit negative feedback dominate positive similarity", () => {
    expect(rankPerson({ ...baseline, notRelevant: true }).score).toBe(0);
    expect(rankPerson({ ...baseline, dismissed: true }).score).toBeLessThan(0.1);
  });

  it("clamps malformed feature inputs", () => {
    expect(rankPerson({ ...baseline, shared_skills: 99, freshness: -10 }).score).toBeLessThanOrEqual(1);
  });
});
