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

  it("validates portable CMS blocks", () => {
    expect(validateContentBlocks([
      { id: "1", type: "bullet_list", items: [{ id: "i1", text: "One useful point" }] },
      { id: "2", type: "checklist", items: [{ id: "i2", text: "Ship safely", checked: true }] },
      { id: "3", type: "callout", text: "Remember the reader", tone: "idea" },
      { id: "4", type: "table", rows: [["Stage", "Owner"], ["Review", "Editor"]] },
      { id: "5", type: "button", label: "Read the source", url: "https://example.com/source" },
      { id: "6", type: "video", url: "https://example.com/demo.mp4" },
    ])).toEqual([]);
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

  it("saves scheduling, SEO, and honest distribution through the CMS RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: "article-1" }, error: null });
    const service = new NativePublishingService({ rpc } as never);
    const scheduledFor = new Date(Date.now() + 60_000).toISOString();
    await service.saveCMS({
      tenantId: "tenant-1",
      title: "Portable knowledge",
      description: "Write once and distribute deliberately.",
      contentType: "ARTICLE",
      blocks: [{ id: "b1", type: "paragraph", text: "Useful content" }],
      status: "scheduled",
      scheduledFor,
      seo: { title: "Portable knowledge" },
      distribution: [{ platform: "MEDIUM", enabled: true }],
    });
    expect(rpc).toHaveBeenCalledWith("save_cms_article", expect.objectContaining({
      requested_status: "scheduled",
      requested_scheduled_for: scheduledFor,
      requested_distribution: expect.arrayContaining([
        expect.objectContaining({ platform: "STACKEDIN" }),
        expect.objectContaining({ platform: "MEDIUM" }),
      ]),
    }));
  });

  it("moves CMS articles to recoverable Trash and restores them through guarded RPCs", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: "article-1", status: "archived" }, error: null });
    const service = new NativePublishingService({ rpc } as never);
    await service.trashCMSArticle("article-1");
    await service.restoreCMSArticle("article-1");
    expect(rpc).toHaveBeenNthCalledWith(1, "trash_cms_article", { requested_article_id: "article-1" });
    expect(rpc).toHaveBeenNthCalledWith(2, "restore_cms_article", { requested_article_id: "article-1" });
  });
});
