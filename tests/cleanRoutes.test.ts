import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../substack_bw_dashboard.jsx", import.meta.url), "utf8");
const mainSource = readFileSync(new URL("../main.jsx", import.meta.url), "utf8");
const stackCraftLanding = readFileSync(new URL("../src/careeros/CareerOSLanding.jsx", import.meta.url), "utf8");
const vercelConfig = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));

describe("clean application routes", () => {
  it("does not navigate existing application views through hash assignments", () => {
    expect(appSource).not.toContain("window.location.hash =");
    expect(appSource).not.toContain('href="#');
    expect(appSource).toContain("window.history.pushState");
    expect(appSource).toContain('window.addEventListener("popstate"');
  });

  it("keeps a guarded one-time legacy hash translator", () => {
    expect(appSource).toContain("legacyRouteFromHash");
    expect(appSource).toContain('hash.includes("access_token=")');
    expect(appSource).toContain('hash.includes("refresh_token=")');
  });

  it("routes StackCraft landing and private workspace without breaking legacy CareerOS URLs", () => {
    expect(mainSource).toContain('"craft"');
    expect(mainSource).toContain('"craft/app"');
    expect(mainSource).toContain('"careeros"');
    expect(mainSource).toContain('"careeros/app"');
    expect(mainSource).toContain("<CareerOSLanding />");
    expect(mainSource).toContain("<CareerOSWorkspace />");
    expect(mainSource).toContain('button.textContent = "Craft"');
    expect(mainSource).toContain('window.location.assign("/Craft")');
    expect(stackCraftLanding).toContain("<strong>StackCraft</strong>");
    expect(stackCraftLanding).toContain('navigate("/Craft/app")');
  });

  it("rewrites every first-class Vercel view to the SPA entry", () => {
    const sources = vercelConfig.rewrites.map((rewrite: { source: string }) => rewrite.source);
    expect(sources).toEqual(expect.arrayContaining([
      "/feed",
      "/feed/:path*",
      "/network",
      "/search",
      "/profile",
      "/profile/:path*",
      "/inbox",
      "/write",
      "/studio",
      "/login",
      "/article/:path*",
      "/Craft",
      "/Craft/:path*",
      "/craft",
      "/craft/:path*",
      "/stackcraft",
      "/stackcraft/:path*",
      "/careeros",
      "/careeros/:path*",
      "/career-os",
      "/career-os/:path*",
      "/career",
      "/career/:path*",
    ]));
    expect(vercelConfig.rewrites.every((rewrite: { destination: string }) => rewrite.destination === "/")).toBe(true);
  });
});
