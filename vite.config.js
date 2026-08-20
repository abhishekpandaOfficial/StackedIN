import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_ACTIONS ? "/substack_dashboard/" : "/",
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8787",
    },
  },
});
