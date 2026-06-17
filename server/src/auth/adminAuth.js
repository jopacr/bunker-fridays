// Venue desk auth (§9): real admin accounts replacing the prototype PIN,
// password + TOTP 2FA. Passkeys (WebAuthn) are the documented next step.
import { Router } from "express";
import { q, uid } from "../db.js";
import { hashPassword, verifyPassword } from "./passwords.js";
import { generateSecret, verifyTotp, otpauthUrl } from "./totp.js";
import { createSession, destroySession, setCookie, clearCookie, rateLimited, requireAdmin } from "./sessions.js";
import { audit } from "../services/store.js";

export const adminAuth = Router();

adminAuth.post("/login", async (req, res) => {
  const em = String(req.body?.email || "").trim().toLowerCase();
  const pw = String(req.body?.password || "");
  const totp = String(req.body?.totp || "");
  if (await rateLimited(`admin:${em}`) || await rateLimited(`admin:${req.ip}`)) {
    return res.status(429).json({ error: "Too many attempts. Try again in a few minutes." });
  }
  const [user] = await q("SELECT * FROM admin_users WHERE lower(email) = $1", [em]);
  if (!user || !(await verifyPassword(pw, user.pw_hash))) {
    return res.status(401).json({ error: "Wrong email or password." });
  }
  if (user.totp_secret) {
    if (!totp) return res.status(401).json({ error: "Enter your 6-digit authenticator code.", code: "totp-required" });
    if (!verifyTotp(user.totp_secret, totp)) return res.status(401).json({ error: "Wrong authenticator code." });
  }
  const { token, days } = await createSession("admin", user.id);
  setCookie(res, "bunker_admin", token, days);
  await audit(user.id, "admin.login", "admin_user", user.id);
  res.json({ ok: true, admin: { id: user.id, email: user.email, name: user.name, totpEnrolled: !!user.totp_secret } });
});

adminAuth.post("/logout", async (req, res) => {
  await destroySession(req.cookies?.bunker_admin);
  clearCookie(res, "bunker_admin");
  res.json({ ok: true });
});

adminAuth.get("/me", requireAdmin, async (req, res) => {
  const [user] = await q("SELECT id, email, name, totp_secret FROM admin_users WHERE id = $1", [req.adminId]);
  res.json({ admin: { id: user.id, email: user.email, name: user.name, totpEnrolled: !!user.totp_secret } });
});

/* TOTP enrollment: start returns the otpauth URL (scan in an authenticator app),
   confirm requires a valid code before the secret is activated. */
adminAuth.post("/totp/start", requireAdmin, async (req, res) => {
  // The candidate secret round-trips through the authenticated admin session:
  // shown as a QR client-side, then posted back to /totp/confirm with a valid
  // code before it's activated. Nothing is persisted until the code checks out.
  const secret = generateSecret();
  const [user] = await q("SELECT email FROM admin_users WHERE id = $1", [req.adminId]);
  res.json({ secret, otpauth: otpauthUrl(secret, user.email) });
});

adminAuth.post("/totp/confirm", requireAdmin, async (req, res) => {
  const { secret, code } = req.body || {};
  if (!verifyTotp(secret, code)) return res.status(400).json({ error: "Code doesn't match. Check your authenticator app and try again." });
  await q("UPDATE admin_users SET totp_secret = $1 WHERE id = $2", [secret, req.adminId]);
  await audit(req.adminId, "admin.totp-enrolled", "admin_user", req.adminId);
  res.json({ ok: true, message: "Two-factor is on. You'll need a code every sign-in from now on." });
});

/* Change password (knows current) */
adminAuth.post("/password", requireAdmin, async (req, res) => {
  const { current, next } = req.body || {};
  if (String(next || "").length < 10) return res.status(400).json({ error: "New password must be at least 10 characters." });
  const [user] = await q("SELECT pw_hash FROM admin_users WHERE id = $1", [req.adminId]);
  if (!(await verifyPassword(current || "", user.pw_hash))) return res.status(401).json({ error: "Current password is wrong." });
  await q("UPDATE admin_users SET pw_hash = $1 WHERE id = $2", [await hashPassword(next), req.adminId]);
  await q("DELETE FROM sessions WHERE kind = 'admin' AND subject_id = $1", [req.adminId]);
  await audit(req.adminId, "admin.password-changed", "admin_user", req.adminId);
  res.json({ ok: true, message: "Password changed. Sign in again." });
});
