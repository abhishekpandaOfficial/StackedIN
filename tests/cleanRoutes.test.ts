import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../substack_bw_dashboard.jsx", import.meta.url), "utf8");
const vercelConfig = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));

describe("clean application routes", () => {
  it("does not navigate application views through hash assignments", () => {
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
    ]));
    expect(vercelConfig.rewrites.every((rewrite: { destination: string }) => rewrite.destination === "/")).toBe(true);
  });
});
