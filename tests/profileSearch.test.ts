import { describe, expect, it, vi } from "vitest";
import { parseProfileQuery } from "../src/search/queryParser";
import { ProfileSearchService } from "../src/services/profileSearch";

describe("deterministic professional query parsing", () => {
  it("extracts role, seniority, location, skills, and publishing intent", () => {
    const parsed = parseProfileQuery("senior AI architects in Bengaluru writing about RAG");
    expect(parsed.role).toBe("Senior AI Architect");
    expect(parsed.seniority).toBe("Senior");
    expect(parsed.location).toBe("Bengaluru");
    expect(parsed.skills).toContain("RAG");
    expect(parsed.topics).toContain("RAG");
    expect(parsed.contentAuthorRequired).toBe(true);
  });

  it("preserves exact technical tokens", () => {
    const parsed = parseProfileQuery(".NET developers working with Azure and Kubernetes");
    expect(parsed.role).toBe(".NET Developer");
    expect(parsed.skills).toEqual(expect.arrayContaining([".NET", "Azure", "Kubernetes"]));
  });

  it("normalizes whitespace and caps untrusted query length", () => {
    const parsed = parseProfileQuery(`  AI    Architect ${"x".repeat(300)} `);
    expect(parsed.normalizedQuery.length).toBe(200);
    expect(parsed.normalizedQuery).not.toContain("  ");
  });
});

describe("profile search service", () => {
  it("uses limit-plus-one keyset pagination and returns the next cursor", async () => {
    const searchRows = [
      { profile_id: "1", rank_score: 0.81, reasons: [], key_skills: [], matched_terms: [] },
      { profile_id: "2", rank_score: 0.71, reasons: [], key_skills: [], matched_terms: [] },
      { profile_id: "3", rank_score: 0.61, reasons: [], key_skills: [], matched_terms: [] },
    ];
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: searchRows, error: null })
      .mockResolvedValueOnce({ data: 2, error: null });
    const service = new ProfileSearchService({ rpc } as never);
    const page = await service.search("tenant-1", { query: "AI Architect Azure", limit: 2 });

    expect(rpc).toHaveBeenNthCalledWith(1, "search_profiles", expect.objectContaining({ result_limit: 3 }));
    expect(page.results).toHaveLength(2);
    expect(page.nextCursor).toEqual({ score: 0.71, profileId: "2" });
  });

  it("requires published evidence for writing-intent queries", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const service = new ProfileSearchService({ rpc } as never);
    await service.search("tenant-1", { query: "people writing about Agentic AI" });
    expect(rpc).toHaveBeenCalledWith("search_profiles", expect.objectContaining({
      content_author_required: true,
      topic_filters: expect.arrayContaining(["Agentic AI"]),
    }));
  });

  it("passes an existing cursor without OFFSET pagination", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [], error: null });
    const service = new ProfileSearchService({ rpc } as never);
    await service.search("tenant-1", { query: "RAG", cursor: { score: 0.44, profileId: "profile-9" } });
    expect(rpc).toHaveBeenCalledWith("search_profiles", expect.objectContaining({
      after_score: 0.44,
      after_profile_id: "profile-9",
    }));
  });
});
