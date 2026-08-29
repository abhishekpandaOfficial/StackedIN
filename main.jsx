import React from "react";
import { createRoot } from "react-dom/client";
import Dashboard from "./substack_bw_dashboard.jsx";
import CareerOSLanding from "./src/careeros/CareerOSLanding.jsx";
import CareerOSWorkspace from "./src/careeros/CareerOSWorkspace.jsx";

const route = window.location.pathname.replace(/^\/+|\/+$/g, "").toLowerCase();
const careerLandingRoutes = new Set(["careeros", "career-os", "career"]);
const careerWorkspaceRoutes = new Set([
  "careeros/app",
  "careeros/workspace",
  "career-os/app",
  "career/app",
]);

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {careerWorkspaceRoutes.has(route)
      ? <CareerOSWorkspace />
      : careerLandingRoutes.has(route)
        ? <CareerOSLanding />
        : <Dashboard />}
  </React.StrictMode>,
);
