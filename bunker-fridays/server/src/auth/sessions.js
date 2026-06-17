// Sessions (§9): random 256-bit tokens stored hashed, httpOnly cookies with expiry.
import { createHash, randomBytes } from "crypto";
import { q } from "../db.js";
import { config } from "../config.js";

const hashToken = (t) => createHash("sha256").update(t).digest("hex");

export async function createSession(kind, subjectId) {
  const token = randomBytes(32).toString("base64url");
  const days = config.sessionDays[kind];
  await q("INSERT INTO sessions (token, kind, subject_id, expires) VALUES ($1,$2,$3, now() + ($4 || ' days')::interval)",
    [hashToken(token), kind, subjectId, String(days)]);
  return { token, days };
}

export async function destroySession(token) {
  if (token) await q("DELETE FROM sessions WHERE token = $1", [hashToken(token)]);
}

export async function lookupSession(token) {
  if (!token) return null;
  const rows = await q("SELECT * FROM sessions WHERE token = $1 AND expires > now()", [hashToken(token)]);
  return rows[0] || null;
}

export function setCookie(res, name, token, days) {
  res.cookie(name, token, {
    httpOnly: true, sameSite: "lax", secure: config.cookieSecure,
    maxAge: days * 86400000, path: "/",
  });
}

export function clearCookie(res, name) {
  res.clearCookie(name, { path: "/" });
}

/* ---- middleware ---- */
export async function artistSession(req, _res, next) {
  try {
    const s = await lookupSession(req.cookies?.bunker_artist);
    if (s && s.kind === "artist") req.artistId = s.subject_id;
  } catch (e) { /* fall through unauthenticated */ }
  next();
}

export function requireArtist(req, res, next) {
  if (!req.artistId) return res.status(401).json({ error: "Sign in first." });
  next();
}

export async function requireAdmin(req, res, next) {
  try {
    const s = await lookupSession(req.cookies?.bunker_admin);
    if (s && s.kind === "admin") {
      req.adminId = s.subject_id;
      const [u] = await q("SELECT email FROM admin_users WHERE id = $1", [s.subject_id]);
      req.adminEmail = u?.email || "admin";
      return next();
    }
  } catch (e) { /* fall through */ }
  return res.status(401).json({ error: "Admin sign-in required." });
}

/* ---- login rate limiting (§9): max 10 attempts per key per 15 minutes ---- */
export async function rateLimited(key, max = 10, windowMin = 15) {
  await q("DELETE FROM login_attempts WHERE ts < now() - interval '1 day'");
  const [{ count }] = await q(
    "SELECT count(*)::int AS count FROM login_attempts WHERE key = $1 AND ts > now() - ($2 || ' minutes')::interval",
    [key, String(windowMin)]
  );
  if (count >= max) return true;
  await q("INSERT INTO login_attempts (key) VALUES ($1)", [key]);
  return false;
}
