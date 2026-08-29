import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const mainSource = readFileSync(new URL("../main.jsx", import.meta.url), "utf8");

describe("StackCraft brand assets", () => {
  it("ships dedicated mark, wordmark, and favicon assets", () => {
    expect(existsSync(new URL("../public/stackcraft-mark.svg", import.meta.url))).toBe(true);
    expect(existsSync(new URL("../public/stackcraft-wordmark.svg", import.meta.url))).toBe(true);
    expect(existsSync(new URL("../public/stackcraft-favicon.svg", import.meta.url))).toBe(true);
  });

  it("switches browser metadata on StackCraft routes", () => {
    expect(mainSource).toContain("StackCraft Dashboard | StackedIN");
    expect(mainSource).toContain("StackCraft — AI Career Operating System | StackedIN");
    expect(mainSource).toContain("/stackcraft-favicon.svg");
  });
});
