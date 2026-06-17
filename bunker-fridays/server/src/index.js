// Bunker Fridays server. Run migrations first (npm run migrate) or set
// MIGRATE_ON_BOOT=true (the Railway default in railway.json).

import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config, bootReport } from "./config.js";
import { artistSession } from "./auth/sessions.js";
import { artistAuth } from "./auth/artistAuth.js";
import { adminAuth } from "./auth/adminAuth.js";
import { publicRoutes } from "./routes/public.js";
import { adminRoutes } from "./routes/admin.js";
import { wixRoutes } from "./routes/wix.js";
import { workbookRoutes } from "./routes/workbook.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.set("trust proxy", 1); // Railway/Cloudflare sit in front
app.use(express.json({ limit: "1mb" }));

// Tiny cookie parser; we only ever read two simple cookies.
app.use((req, _res, next) => {
  req.cookies = {};
  const raw = req.headers.cookie;
  if (raw) for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i > 0) req.cookies[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  next();
});

// Security headers (§9). The app is also embedded on bunkerstratford.com.
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Content-Security-Policy", "frame-ancestors 'self' https://*.bunkerstratford.com https://*.wixsite.com");
  next();
});

app.use(artistSession);

// Express 4 doesn't forward errors thrown by async handlers to the error
// middleware, which leaves the request hanging. Wrap every route handler so a
// rejected promise becomes next(err) and hits the JSON error handler below.
function hardenRouter(router) {
  for (const layer of router.stack || []) {
    const stack = layer.route ? layer.route.stack : [layer];
    for (const s of stack) {
      const orig = s.handle;
      if (typeof orig !== "function" || orig.length >= 4) continue; // skip error middleware
      s.handle = function (req, res, next) {
        try {
          const out = orig.call(this, req, res, next);
          if (out && typeof out.catch === "function") out.catch(next);
          return out;
        } catch (e) { next(e); }
      };
    }
  }
}
[artistAuth, adminAuth, workbookRoutes, adminRoutes, wixRoutes, publicRoutes].forEach(hardenRouter);

app.use("/api/auth", artistAuth);
app.use("/api/admin/auth", adminAuth);
app.use("/api/admin/workbook", workbookRoutes);
app.use("/api/admin", adminRoutes);
app.use(wixRoutes); // POST /api/integrations/wix
app.use("/api", publicRoutes);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Static client (Vite build) + SPA fallback + service worker scope
const clientDist = path.resolve(__dirname, "../../client/dist");
app.use(express.static(clientDist, { index: "index.html", maxAge: "1h", setHeaders: (res, p) => {
  if (p.endsWith("sw.js") || p.endsWith(".webmanifest") || p.endsWith("index.html")) res.setHeader("Cache-Control", "no-cache");
}}));
app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(clientDist, "index.html"), (err) => { if (err) res.status(404).end(); }));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Something went sideways on our end. Try again in a moment." });
});

async function boot() {
  // A booking system the venue relies on should never go fully dark because of
  // one bad request. Log and keep serving rather than exiting on a stray error.
  process.on("unhandledRejection", (err) => console.error("unhandledRejection:", err));
  process.on("uncaughtException", (err) => console.error("uncaughtException:", err));
  if (process.env.MIGRATE_ON_BOOT === "true") {
    const { migrate } = await import("./migrate.js");
    await migrate();
  }
  app.listen(config.port, () => {
    console.log(`Bunker Fridays listening on :${config.port}`);
    const off = bootReport();
    if (off.length) console.log("Not configured (degrades gracefully):\n  - " + off.join("\n  - "));
  });
}
boot();
