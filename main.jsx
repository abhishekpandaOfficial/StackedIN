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

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {careerWorkspaceRoutes.has(route)
      ? <CareerOSWorkspace />
      : careerLandingRoutes.has(route)
        ? <CareerOSLanding />
        : <><Dashboard /><StackCraftNavLink /></>}
  </React.StrictMode>,
);
