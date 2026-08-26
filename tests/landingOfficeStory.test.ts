import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const landing = readFileSync(new URL("../substack_bw_dashboard.jsx", import.meta.url), "utf8");

describe("StackedIN office story", () => {
  it("uses the dedicated office scene instead of the previous stock-photo rail", () => {
    expect(landing).toContain("stackedin-office-story.webp");
    expect(landing).toContain('className="office-story-copy"');
    expect(landing.indexOf('className="office-story-shell"')).toBeLessThan(landing.indexOf('className="office-story-copy"'));
    expect(landing).toContain("Built around the way");
    expect(landing).not.toContain("office-moment office-moment-focus");
    expect(landing).not.toContain("office-live-signal");
    expect(landing).not.toContain("photo-1515879218367-8466d910aaa4");
    expect(landing).not.toContain("photo-1522071820081-009f0129c71c");
    expect(landing).not.toContain("photo-1497366811353-6870744d04b2");
  });

  it("ships the optimized local image asset", () => {
    expect(existsSync(new URL("../public/stackedin-office-story.webp", import.meta.url))).toBe(true);
  });
});
