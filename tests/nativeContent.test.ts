import { describe, expect, it, vi } from "vitest";
import { normalizeHashtags, validateContentBlocks } from "../src/domain/nativeContent";
import { NativePublishingService } from "../src/services/nativePublishing";

describe("native content validation", () => {
  it("normalizes and deduplicates hashtags", () => {
    expect(normalizeHashtags("#AgenticAI, Azure  #AgenticAI system-design!"))
      .toEqual(["AgenticAI", "Azure", "system-design"]);
  });

  it("accepts safe rich blocks", () => {
    expect(validateContentBlocks([
      { id: "1", type: "heading", text: "Architecture" },
      { id: "2", type: "paragraph", text: "Useful context" },
      { id: "3", type: "code", code: "const useful = true;", language: "typescript" },
      { id: "4", type: "image", url: "https://example.com/diagram.webp", caption: "System view" },
    ])).toEqual([]);
  });

  it("rejects empty text, code, and insecure image blocks", () => {
    const errors = validateContentBlocks([
      { id: "1", type: "paragraph", text: "" },
      { id: "2", type: "code", code: "" },
      { id: "3", type: "image", url: "javascript:alert(1)" },
    ]);
    expect(errors).toHaveLength(3);
  });
});

describe("native publishing service", () => {
  it("sends normalized blocks and hashtags through the guarded save RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: "article-1" }, error: null });
    const service = new NativePublishingService({ rpc } as never);
    await service.save({
      tenantId: "tenant-1",
      title: "Agentic Systems",
      description: "A useful guide",
      contentType: "ARTICLE",
      blocks: [{ id: "b1", type: "paragraph", text: "Useful content" }],
      hashtags: "#AgenticAI #Azure #AgenticAI",
      status: "published",
    });
    expect(rpc).toHaveBeenCalledWith("save_native_article", expect.objectContaining({
      requested_tenant_id: "tenant-1",
      requested_hashtags: ["AgenticAI", "Azure"],
      requested_status: "published",
    }));
  });

  it("toggles all supported reactions through the guarded RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {}, error: null });
    const service = new NativePublishingService({ rpc } as never);
    await service.react("article-1", "INSIGHTFUL");
    expect(rpc).toHaveBeenCalledWith("react_to_article", { requested_article_id: "article-1", requested_reaction: "INSIGHTFUL" });
  });
});

