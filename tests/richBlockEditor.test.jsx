import { describe, expect, it } from "vitest";
import { filterBlockTools, parseSlashCommand } from "../src/components/RichBlockEditor";

describe("XStudio slash commands", () => {
  it("opens only for a leading slash command", () => {
    expect(parseSlashCommand("/")).toBe("");
    expect(parseSlashCommand("/heading")).toBe("heading");
    expect(parseSlashCommand("A sentence / with a slash")).toBeNull();
    expect(parseSlashCommand("/heading\nMore text")).toBeNull();
  });

  it("finds blocks by label, shortcut, and related keywords", () => {
    expect(filterBlockTools("head").map(tool => tool.type)).toEqual(["heading", "subheading"]);
    expect(filterBlockTools("photo").map(tool => tool.type)).toEqual(["image"]);
    expect(filterBlockTools("task").map(tool => tool.type)).toEqual(["checklist"]);
  });
});
