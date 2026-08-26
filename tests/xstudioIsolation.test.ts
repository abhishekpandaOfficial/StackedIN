import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(resolve("substack_bw_dashboard.jsx"), "utf8");
const editorSource = readFileSync(resolve("src/components/XStudioEditor.jsx"), "utf8");
const publishingSource = readFileSync(resolve("src/services/nativePublishing.ts"), "utf8");

describe("feed navigation contract", () => {
  it.each(["following", "subscribed", "saved"])("routes the %s feed independently", mode => {
    expect(appSource).toContain(`mode: "${mode}"`);
    expect(appSource).toContain('route.startsWith("feed/")');
  });

  it("does not map the feed feature list to XStudio navigation items", () => {
    const featureList = appSource.slice(appSource.indexOf("const featureLinks = ["), appSource.indexOf("const feedModeCopy"));
    expect(featureList).not.toContain("NAV_ITEMS.map");
    expect(featureList).not.toContain("openStudio");
  });
});

describe("XStudio account isolation contract", () => {
  it("scopes browser recovery and selected-article state to the signed-in user", () => {
    expect(editorSource).toContain("`xstudio-editor-article:${userId}`");
    expect(editorSource).toContain("`${RECOVERY_KEY}:${userId}`");
    expect(appSource).toContain("`${METRICS_KEY}:${userId}`");
  });

  it("filters CMS content and jobs by their owning profile", () => {
    expect(publishingSource).toContain('.eq("tenant_id", tenantId).eq("author_id", authorId).eq("source_type", "USER")');
    expect(publishingSource).toContain('if (requestedBy) query = query.eq("requested_by", requestedBy)');
  });

  it("does not expose one creator's platform handles as every tenant's accounts", () => {
    const platforms = appSource.slice(appSource.indexOf("const PLATFORMS"), appSource.indexOf("const PILLAR_TONES"));
    expect(platforms).not.toMatch(/pandaabhishek|official\.abhishekpanda|iamabhishekpanda/i);
  });
});
