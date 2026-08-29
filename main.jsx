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

function StackCraftNavLink() {
  useEffect(() => {
    const header = document.querySelector(".marketing-nav");
    const nav = header?.querySelector('nav[aria-label="Marketing navigation"]');
    const xstudioButton = header?.querySelector(".nav-cta");
    if (!header || !nav || !xstudioButton) return undefined;

    let navButton = nav.querySelector('[data-stackcraft-nav="true"]');
    if (!navButton) {
      navButton = document.createElement("button");
      navButton.type = "button";
      navButton.dataset.stackcraftNav = "true";
      navButton.textContent = "Craft";
      navButton.title = "Open StackCraft";
      navButton.setAttribute("aria-label", "Open StackCraft career operating system");
      navButton.addEventListener("click", () => window.location.assign("/Craft"));
      nav.appendChild(navButton);
    }

    let stackCraftButton = header.querySelector('[data-stackcraft-cta="true"]');
    if (!stackCraftButton) {
      stackCraftButton = document.createElement("button");
      stackCraftButton.type = "button";
      stackCraftButton.dataset.stackcraftCta = "true";
      stackCraftButton.className = "nav-stackcraft-cta";
      stackCraftButton.title = "Open StackCraft";
      stackCraftButton.setAttribute("aria-label", "Open StackCraft career operating system");

      const icon = document.createElement("span");
      icon.className = "nav-stackcraft-cta__icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = "S";

      const label = document.createElement("span");
      label.className = "nav-stackcraft-cta__label";
      label.textContent = "Open StackCraft";

      stackCraftButton.append(icon, label);
      stackCraftButton.addEventListener("click", () => window.location.assign("/Craft"));
      header.insertBefore(stackCraftButton, xstudioButton);
    }

    header.classList.add("marketing-nav--persistent");

    return () => {
      navButton?.remove();
      stackCraftButton?.remove();
      header.classList.remove("marketing-nav--persistent");
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

    rewriteText(document.body);
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
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return null;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {careerWorkspaceRoutes.has(route)
      ? <><CareerOSWorkspace /><StackCraftBrandingBridge /></>
      : careerLandingRoutes.has(route)
        ? <CareerOSLanding />
        : <><Dashboard /><StackCraftNavLink /></>}
  </React.StrictMode>,
);
