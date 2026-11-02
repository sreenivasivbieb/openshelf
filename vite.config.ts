import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dashboard (web/) build. In production the server serves dist/web from the same origin.
export default defineConfig({
  root: "web",
  plugins: [react()],
  build: { outDir: "../dist/web", emptyOutDir: true },
  server: {
    port: 5173,
    proxy: {
      "/admin": "http://localhost:8787",
      "/m": "http://localhost:8787",
      "/health": "http://localhost:8787",
    },
  },
});
