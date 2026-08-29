import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import Dashboard from "./substack_bw_dashboard.jsx";
import CareerOSLanding from "./src/careeros/CareerOSLanding.jsx";
import CareerOSWorkspace from "./src/careeros/CareerOSWorkspace.jsx";

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
    const nav = document.querySelector('.marketing-nav nav[aria-label="Marketing navigation"]');
    if (!nav || nav.querySelector('[data-stackcraft-nav="true"]')) return undefined;

    const button = document.createElement("button");
    button.type = "button";
    button.dataset.stackcraftNav = "true";
    button.textContent = "Craft";
    button.title = "Open StackCraft";
    button.setAttribute("aria-label", "Open StackCraft career operating system");
    button.addEventListener("click", () => {
      window.location.assign("/Craft");
    });
    nav.appendChild(button);

    return () => button.remove();
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
