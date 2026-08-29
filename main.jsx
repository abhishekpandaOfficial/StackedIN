import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import Dashboard from "./substack_bw_dashboard.jsx";
import CareerOSLanding from "./src/careeros/CareerOSLanding.jsx";
import CareerOSWorkspace from "./src/careeros/CareerOSWorkspace.jsx";
import "./stackcraft-nav.css";

const route = window.location.pathname.replace(/^\/+|\/+$/g, "").toLowerCase();
const careerLandingRoutes = new Set(["craft", "stackcraft", "careeros", "career-os", "career"]);
const careerWorkspaceRoutes = new Set([
  "craft/app",
  "craft/workspace",
  "stackcraft/app",
  "stackcraft/workspace",
  "careeros/app",
  "careeros/workspace",
  "career-os/app",
  "career/app",
]);

const legacyLandingRoutes = new Set(["stackcraft", "careeros", "career-os", "career"]);
const legacyWorkspaceRoutes = new Set(["stackcraft/app", "stackcraft/workspace", "careeros/app", "careeros/workspace", "career-os/app", "career/app"]);
if (legacyLandingRoutes.has(route)) window.history.replaceState({}, "", "/Craft");
if (legacyWorkspaceRoutes.has(route)) window.history.replaceState({}, "", "/Craft/app");

function setFavicon(href) {
  let icon = document.querySelector('link[rel="icon"]');
  if (!icon) {
    icon = document.createElement("link");
    icon.rel = "icon";
    document.head.appendChild(icon);
  }
  icon.type = "image/svg+xml";
  icon.href = href;

  let touch = document.querySelector('link[rel="apple-touch-icon"]');
  if (!touch) {
    touch = document.createElement("link");
    touch.rel = "apple-touch-icon";
    document.head.appendChild(touch);
  }
  touch.href = "/stackcraft-mark.svg";
}

function StackCraftRouteMeta() {
  useEffect(() => {
    if (!careerLandingRoutes.has(route) && !careerWorkspaceRoutes.has(route)) return;
    document.title = careerWorkspaceRoutes.has(route)
      ? "StackCraft Dashboard | StackedIN"
      : "StackCraft — AI Career Operating System | StackedIN";
    document.querySelector('meta[name="description"]')?.setAttribute(
      "content",
      "StackCraft is the private AI career operating system inside StackedIN for global job discovery, matching, applications, workflows, mobility intelligence, and AEON interview preparation.",
    );
    setFavicon("/stackcraft-favicon.svg");
  }, []);
  return null;
}

function StackCraftNavLink() {
  useEffect(() => {
    let activeHeader = null;

    const install = () => {
      const header = document.querySelector(".marketing-nav");
      const nav = header?.querySelector('nav[aria-label="Marketing navigation"]');
      const xstudioButton = header?.querySelector(".nav-cta");
      if (!header || !nav || !xstudioButton) return false;

      activeHeader = header;
      header.classList.add("marketing-nav--persistent");

      let navButton = nav.querySelector('[data-stackcraft-nav="true"]');
      if (!navButton) {
        navButton = document.createElement("button");
        navButton.type = "button";
        navButton.dataset.stackcraftNav = "true";
        navButton.textContent = "Craft";
        navButton.title = "Explore StackCraft";
        navButton.setAttribute("aria-label", "Explore StackCraft career operating system");
        navButton.addEventListener("click", () => window.location.assign("/Craft"));
        nav.appendChild(navButton);
      }

      let stackCraftButton = header.querySelector('[data-stackcraft-cta="true"]');
      if (!stackCraftButton) {
        stackCraftButton = document.createElement("button");
        stackCraftButton.type = "button";
        stackCraftButton.dataset.stackcraftCta = "true";
        stackCraftButton.className = "nav-stackcraft-cta";
        stackCraftButton.title = "Open StackCraft dashboard";
        stackCraftButton.setAttribute("aria-label", "Open StackCraft dashboard using your StackedIN session");

        const icon = document.createElement("img");
        icon.className = "nav-stackcraft-cta__icon";
        icon.src = "/stackcraft-mark.svg";
        icon.alt = "";
        icon.setAttribute("aria-hidden", "true");

        const label = document.createElement("span");
        label.className = "nav-stackcraft-cta__label";
        label.textContent = "Open StackCraft";

        stackCraftButton.append(icon, label);
        stackCraftButton.addEventListener("click", () => window.location.assign("/Craft/app"));
        header.insertBefore(stackCraftButton, xstudioButton);
      }

      return true;
    };

    install();
    const observer = new MutationObserver(() => install());
    observer.observe(document.getElementById("root") || document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      document.querySelector('[data-stackcraft-nav="true"]')?.remove();
      document.querySelector('[data-stackcraft-cta="true"]')?.remove();
      activeHeader?.classList.remove("marketing-nav--persistent");
    };
  }, []);

  return null;
}

function StackCraftBrandingBridge() {
  useEffect(() => {
    const rewriteText = root => {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      for (const node of nodes) {
        if (node.nodeValue?.includes("CareerOS")) node.nodeValue = node.nodeValue.replaceAll("CareerOS", "StackCraft");
      }
    };

    const installBrandAssets = () => {
      for (const mark of document.querySelectorAll(".cos-logo > span, .careeros-brand__mark")) {
        mark.textContent = "";
        mark.classList.add("stackcraft-brand-mark");
      }
    };

    rewriteText(document.body);
    installBrandAssets();
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.TEXT_NODE) {
            if (node.nodeValue?.includes("CareerOS")) node.nodeValue = node.nodeValue.replaceAll("CareerOS", "StackCraft");
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            rewriteText(node);
          }
        }
      }
      installBrandAssets();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <StackCraftRouteMeta />
    {careerWorkspaceRoutes.has(route)
      ? <><CareerOSWorkspace /><StackCraftBrandingBridge /></>
      : careerLandingRoutes.has(route)
        ? <><CareerOSLanding /><StackCraftBrandingBridge /></>
        : <><Dashboard /><StackCraftNavLink /></>}
  </React.StrictMode>,
);
