import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboard = readFileSync(new URL("../substack_bw_dashboard.jsx", import.meta.url), "utf8");
const publishing = readFileSync(new URL("../src/services/nativePublishing.ts", import.meta.url), "utf8");
const syncApi = readFileSync(new URL("../api/xstudio-sync.mjs", import.meta.url), "utf8");

describe("verified external publication sources", () => {
  it("verifies a public feed before persisting and importing it", () => {
    expect(dashboard).toContain("verifyPublicSource(provider, url)");
    expect(publishing).toContain("verifiedPayload ?? await this.verifyPublicSource");
    expect(syncApi).toContain("verified: true");
    expect(syncApi).toContain("no public articles were found");
  });

  it("surfaces provider identity and the canonical external destination", () => {
    expect(dashboard).toContain("provider-identity-chip");
    expect(dashboard).toContain("Read the complete article on");
    expect(dashboard).toContain('href={externalUrl} target="_blank"');
  });
});

describe("ownership-aware feed controls", () => {
  it("keeps external references hideable without offering native editing", () => {
    expect(dashboard).toContain('isExternal ? "Hide from StackedIN" : "Hide post"');
    expect(dashboard).toContain("isOwnPost && !isExternal");
  });

  it("routes native owner edits into XStudio and uses recoverable Trash", () => {
    expect(dashboard).toContain("sessionStorage.setItem(editorArticleKey(session.user.id), article.id)");
    expect(dashboard).toContain("nativePublishing.trashCMSArticle(article.id)");
    expect(dashboard).toContain("Moved to XStudio Trash");
  });
});
