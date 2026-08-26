import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(resolve("substack_bw_dashboard.jsx"), "utf8");

describe("premium profile menu contract", () => {
  it.each([
    "View complete profile",
    "Edit profile",
    "Feed preferences",
    "Account & security",
    "Open XStudio",
    "Inbox & requests",
    "Help & shortcuts",
    "Sign out",
  ])("includes the %s destination", label => {
    expect(appSource).toContain(label);
  });

  it("keeps preferences private to the signed-in account", () => {
    expect(appSource).toContain("`stackedin-feed-preferences:${session.user.id}`");
  });

  it("opens the focused profile editor from the menu", () => {
    expect(appSource).toContain('sessionStorage.setItem("stackedin-profile-edit-section", "about")');
    expect(appSource).toContain('sessionStorage.removeItem("stackedin-profile-edit-section")');
  });

  it("supports keyboard and outside-click dismissal", () => {
    expect(appSource).toContain('event.key === "Escape"');
    expect(appSource).toContain('document.addEventListener("mousedown", close)');
  });
});
