import React from "react";
import { createRoot } from "react-dom/client";
import Dashboard from "./substack_bw_dashboard.jsx";
import CareerOSLanding from "./src/careeros/CareerOSLanding.jsx";

const route = window.location.pathname.replace(/^\/+|\/+$/g, "").toLowerCase();
const isCareerOS = route === "careeros" || route === "career-os" || route === "career";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isCareerOS ? <CareerOSLanding /> : <Dashboard />}
  </React.StrictMode>,
);
