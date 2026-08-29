import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("../substack_bw_dashboard.jsx", import.meta.url), "utf8");
const mainSource = readFileSync(new URL("../main.jsx", import.meta.url), "utf8");
const stackCraftLanding = readFileSync(new URL("../src/careeros/CareerOSLanding.jsx", import.meta.url), "utf8");
const stackCraftStyles = readFileSync(new URL("../src/careeros/careeros.css", import.meta.url), "utf8");
const stackCraftNavStyles = readFileSync(new URL("../stackcraft-nav.css", import.meta.url), "utf8");
const assetCopySource = readFileSync(new URL("../scripts/copy-threeui-assets.mjs", import.meta.url), "utf8");
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

  it("keeps only the StackCraft capsule and aligns it with XStudio", () => {
    expect(mainSource).toContain('label.textContent = "Open StackCraft"');
    expect(mainSource).toContain('window.location.assign("/Craft/app")');
    expect(mainSource).not.toContain('navButton.textContent = "Craft"');
    expect(mainSource).toContain('actions.className = "marketing-product-actions"');
    expect(mainSource).toContain('xstudioButton.classList.add("nav-xstudio-capsule")');
    expect(mainSource).toContain('header.classList.add("marketing-nav--persistent")');
    expect(mainSource).toContain('icon.src = "/stackcraft-mark.svg"');
    expect(mainSource).toContain('setFavicon("/stackcraft-favicon.svg")');
    expect(stackCraftNavStyles).toContain("position:fixed!important");
    expect(stackCraftNavStyles).toContain(".marketing-product-actions");
    expect(stackCraftNavStyles).toContain(".nav-xstudio-capsule");
  });

  it("integrates the exact configured ThreeUI Sylva Living Green hero on StackedIN", () => {
    expect(mainSource).toContain('import { SylvaHero } from "@designcodeio/threeui"');
    expect(mainSource).toContain('import "@designcodeio/threeui/style.css"');
    expect(mainSource).toContain('<SylvaHero');
    expect(mainSource).toContain('variant="living-green"');
    expect(mainSource).toContain('headingFont="lexend"');
    expect(mainSource).toContain('bodyFont="lexend"');
    expect(mainSource).toContain('headingWeight="300"');
    expect(mainSource).toContain('bodyWeight="300"');
    expect(mainSource).toContain('primaryColor="#ffffff"');
    expect(mainSource).toContain('headingSize={63}');
    expect(mainSource).toContain('bodySize={16.5}');
    expect(mainSource).toContain('headingLetterSpacing={-0.006}');
    expect(assetCopySource).toContain('landing-pages/inner-green-3d.html');
    expect(assetCopySource).toContain('69c3694bd63f44ef9f007ebe4dac57a83e4402e0cdf6b54dd10b96dd4f05e197');
  });

  it("uses the authored text-free Temple Night renderer behind StackCraft", () => {
    expect(stackCraftLanding).toContain('import { TempleNightScene } from "@designcodeio/threeui"');
    expect(stackCraftLanding).toContain('<TempleNightScene variant="temple-night"');
    expect(stackCraftLanding).not.toContain("<KageLandingPage");
    expect(stackCraftStyles).toContain(".shader-frame--temple .temple-night-scene");
    expect(stackCraftStyles).toContain(".shader-frame--temple .temple-night-canvas");
  });

  it("routes StackCraft landing and private workspace without breaking legacy CareerOS URLs", () => {
    expect(mainSource).toContain('"craft"');
    expect(mainSource).toContain('"craft/app"');
    expect(mainSource).toContain('"careeros"');
    expect(mainSource).toContain('"careeros/app"');
    expect(mainSource).toContain("<CareerOSLanding />");
    expect(mainSource).toContain("<CareerOSWorkspace />");
    expect(stackCraftLanding).toContain("<strong>StackCraft</strong>");
    expect(stackCraftLanding).toContain('navigate("/Craft/app")');
  });

  it("rewrites every first-class Vercel view to the SPA entry", () => {
    const sources = vercelConfig.rewrites.map((rewrite: { source: string }) => rewrite.source);
    expect(sources).toEqual(expect.arrayContaining([
      "/feed", "/feed/:path*", "/network", "/search", "/profile", "/profile/:path*", "/inbox", "/write", "/studio", "/login", "/article/:path*", "/Craft", "/Craft/:path*", "/craft", "/craft/:path*", "/stackcraft", "/stackcraft/:path*", "/careeros", "/careeros/:path*", "/career-os", "/career-os/:path*", "/career", "/career/:path*",
    ]));
    expect(vercelConfig.rewrites.every((rewrite: { destination: string }) => rewrite.destination === "/")).toBe(true);
  });
});
