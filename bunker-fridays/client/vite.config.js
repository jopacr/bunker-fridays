import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, the API runs on :8080 and Vite serves the client on :5173,
// proxying /api through so cookies share an origin. In production the
// Express server serves the built client and the API from one origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:8080", changeOrigin: true },
    },
  },
  build: { outDir: "dist", sourcemap: false },
});
