import { describe, expect, it } from "vitest";
import { scoreWritingSignals } from "../src/domain/writingSignals.js";

describe("writing signal scoring", () => {
  it("always produces complementary bounded scores", () => {
    const result = scoreWritingSignals("I shipped this yesterday. It broke twice—but the third deploy held. 42 users tried it.");
    expect(result.aiScore + result.humanScore).toBe(100);
    expect(result.aiScore).toBeGreaterThanOrEqual(5);
    expect(result.aiScore).toBeLessThanOrEqual(95);
  });

  it("does not claim high confidence for short posts", () => {
    const result = scoreWritingSignals("A tiny post.");
    expect(result.confidence).toBe("very low");
    expect(result.disclaimer).toContain("not proof");
  });

  it("surfaces formulaic language as an explainable signal", () => {
    const result = scoreWritingSignals("In today's rapidly evolving landscape, it is important to note this comprehensive guide. Moreover, let's explore how to unlock the potential. In conclusion, this is a game-changer.");
    expect(result.signals.some(signal => /formulaic transitions/.test(signal))).toBe(true);
    expect(result.aiScore).toBeGreaterThan(result.humanScore);
  });
});
