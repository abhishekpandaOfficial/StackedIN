import { describe, expect, it } from "vitest";
import { candidateRejectionReason, type CandidateEligibility } from "../src/domain/professionalGraph";
import { NEGATIVE_SIGNAL_MULTIPLIERS, PEOPLE_RANKING_V1, normalizedWeightTotal } from "../src/config/ranking";
import { connectionDegree } from "../src/services/professionalGraph";

const eligible: CandidateEligibility = {
  candidateId: "candidate",
  viewerId: "viewer",
  accountStatus: "active",
  profileVisibility: "public",
  searchable: true,
  recommendable: true,
  blocked: false,
  muted: false,
  existingConnection: false,
  pendingConnection: false,
};

describe("candidate eligibility", () => {
  it("allows a valid public candidate", () => {
    expect(candidateRejectionReason(eligible)).toBeNull();
  });

  it.each([
    [{ candidateId: "viewer" }, "SELF"],
    [{ blocked: true }, "BLOCKED"],
    [{ muted: true }, "MUTED"],
    [{ existingConnection: true }, "EXISTING_CONNECTION"],
    [{ pendingConnection: true }, "PENDING_CONNECTION"],
    [{ accountStatus: "suspended" }, "UNAVAILABLE_PROFILE"],
    [{ profileVisibility: "private" }, "PRIVATE_PROFILE"],
  ] as const)("rejects %j as %s", (change, reason) => {
    expect(candidateRejectionReason({ ...eligible, ...change })).toBe(reason);
  });

  it("enforces a declined recommendation cooldown", () => {
    expect(candidateRejectionReason({ ...eligible, declinedCooldownUntil: "2026-09-01T00:00:00Z" }, new Date("2026-08-25T00:00:00Z"))).toBe("DECLINED_COOLDOWN");
  });
});

describe("ranking configuration", () => {
  it("keeps positive people-ranking weights normalized", () => {
    expect(normalizedWeightTotal(PEOPLE_RANKING_V1)).toBeCloseTo(1, 10);
  });

  it("makes explicit negative feedback stronger than weak inferred positives", () => {
    expect(NEGATIVE_SIGNAL_MULTIPLIERS.not_interested).toBeGreaterThan(NEGATIVE_SIGNAL_MULTIPLIERS.weak_inferred_positive);
    expect(NEGATIVE_SIGNAL_MULTIPLIERS.block).toBeGreaterThan(NEGATIVE_SIGNAL_MULTIPLIERS.not_interested);
  });
});

describe("feed connection degrees", () => {
  it("labels accepted connections as first degree", () => {
    expect(connectionDegree("connection-1", 0)).toBe(1);
  });

  it("labels mutual-network recommendations as second degree", () => {
    expect(connectionDegree(null, 3)).toBe(2);
  });

  it("labels interest-based discovery without mutuals as third degree", () => {
    expect(connectionDegree(null, 0)).toBe(3);
  });
});
