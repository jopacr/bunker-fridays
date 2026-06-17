// Artist accounts (§4 Accounts, §9): email + password, verified email at signup,
// bcrypt hashing, rate-limited logins, reset by email. Existing no-password
// records are claimable at signup via the verification email.
import { Router } from "express";
import { randomBytes } from "crypto";
import { q, uid } from "../db.js";
import { config } from "../config.js";
import { hashPassword, verifyPassword } from "./passwords.js";
import { createSession, destroySession, setCookie, clearCookie, rateLimited, requireArtist } from "./sessions.js";
import { findArtistByEmail, getArtist, upsertArtist, audit } from "../services/store.js";
import { sendAuthEmail } from "../services/mailer.js";

export const artistAuth = Router();

async function issueEmailToken(artistId, purpose) {
  const token = randomBytes(24).toString("base64url");
  await q("INSERT INTO email_tokens (token, artist_id, purpose, expires) VALUES ($1,$2,$3, now() + interval '2 days')",
    [token, artistId, purpose]);
  return token;
}

/* Create account. If the email matches an existing record without a password,
   this is the claim flow: the verification email proves ownership before the
   account (and its history) becomes usable. */
artistAuth.post("/signup", async (req, res) => {
  const { name, email, password } = req.body || {};
  const em = String(email || "").trim().toLowerCase();
  if (!em.includes("@") || !password) return res.status(400).json({ error: "Email and password needed." });
  if (!String(name || "").trim()) return res.status(400).json({ error: "Name needed." });
  if (String(password).length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
  if (await rateLimited(`signup:${req.ip}`)) return res.status(429).json({ error: "Too many attempts. Try again in a few minutes." });

  let rec = await findArtistByEmail(em);
  if (rec && rec.hasPassword) return res.status(409).json({ error: "That email already has an account. Sign in instead." });

  const pwHash = await hashPassword(password);
  const id = rec ? rec.id : uid();
  await upsertArtist(id, rec
    ? { name: rec.name || String(name).trim(), account: true }
    : { name: String(name).trim(), email: em, account: true, source: "app account" });
  await q("UPDATE artists SET pw_hash = $1, email_verified = FALSE, updated = now() WHERE id = $2", [pwHash, id]);

  const token = await issueEmailToken(id, "verify");
  const link = `${config.baseUrl}/api/auth/verify?token=${token}`;
  const mail = await sendAuthEmail(em, "Verify your Bunker Fridays account", [
    `Hi ${String(name).trim()},`, "",
    rec ? "We found your existing artist record at The Bunker. Confirm this email to claim it and finish setting up your account:" :
      "Confirm your email to finish setting up your Bunker Fridays account:",
    link, "",
    "If you didn't request this, you can ignore this email.",
    "The Bunker Performance Lounge",
  ]);

  await audit(`artist:${id}`, rec ? "account.claim-started" : "account.signup", "artist", id);
  res.json({
    ok: true,
    verifyEmailSent: mail.ok,
    // Local/dev convenience when no mailer is configured; never set in production.
    ...(mail.ok ? {} : { devVerifyLink: link }),
    message: mail.ok
      ? "Check your email to verify your account, then sign in."
      : "Email sending isn't configured; use the verification link returned to complete signup.",
  });
});

artistAuth.get("/verify", async (req, res) => {
  const rows = await q("SELECT * FROM email_tokens WHERE token = $1 AND purpose = 'verify' AND NOT used AND expires > now()", [req.query.token || ""]);
  if (!rows[0]) return res.status(400).send("That verification link is invalid or expired. Sign up again to get a new one.");
  await q("UPDATE email_tokens SET used = TRUE WHERE token = $1", [rows[0].token]);
  await q("UPDATE artists SET email_verified = TRUE, account = TRUE, updated = now() WHERE id = $1", [rows[0].artist_id]);
  await audit(`artist:${rows[0].artist_id}`, "account.verified", "artist", rows[0].artist_id);
  res.redirect("/?verified=1");
});

artistAuth.post("/login", async (req, res) => {
  const em = String(req.body?.email || "").trim().toLowerCase();
  const pw = String(req.body?.password || "");
  if (!em || !pw) return res.status(400).json({ error: "Email and password needed." });
  if (await rateLimited(`login:${em}`) || await rateLimited(`login:${req.ip}`)) {
    return res.status(429).json({ error: "Too many attempts. Try again in a few minutes." });
  }
  const rec = await findArtistByEmail(em);
  if (!rec) return res.status(404).json({ error: "No account with that email. Create one below.", code: "no-account" });
  if (!rec.hasPassword) return res.status(409).json({ error: "We have your info but no password yet. Use Create account to set one and claim it.", code: "claimable" });
  const rows = await q("SELECT pw_hash, email_verified FROM artists WHERE id = $1", [rec.id]);
  if (!(await verifyPassword(pw, rows[0].pw_hash))) return res.status(401).json({ error: "Wrong password." });
  if (!rows[0].email_verified) return res.status(403).json({ error: "Please verify your email first; check your inbox for the link.", code: "unverified" });

  const { token, days } = await createSession("artist", rec.id);
  setCookie(res, "bunker_artist", token, days);
  res.json({ ok: true, session: { artistId: rec.id, name: rec.name, email: rec.email } });
});

artistAuth.post("/logout", async (req, res) => {
  await destroySession(req.cookies?.bunker_artist);
  clearCookie(res, "bunker_artist");
  res.json({ ok: true });
});

artistAuth.post("/reset/request", async (req, res) => {
  const em = String(req.body?.email || "").trim().toLowerCase();
  if (await rateLimited(`reset:${req.ip}`)) return res.status(429).json({ error: "Too many attempts." });
  const rec = await findArtistByEmail(em);
  // Same response either way; no account enumeration.
  if (rec && rec.hasPassword) {
    const token = await issueEmailToken(rec.id, "reset");
    await sendAuthEmail(em, "Reset your Bunker Fridays password", [
      `Hi ${rec.name},`, "",
      "Someone (hopefully you) asked to reset your Bunker Fridays password. Use this link within 48 hours:",
      `${config.baseUrl}/?reset=${token}`, "",
      "If this wasn't you, ignore this email and your password stays as it is.",
      "The Bunker Performance Lounge",
    ]);
  }
  res.json({ ok: true, message: "If that email has an account, a reset link is on the way." });
});

artistAuth.post("/reset/complete", async (req, res) => {
  const { token, password } = req.body || {};
  if (String(password || "").length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
  const rows = await q("SELECT * FROM email_tokens WHERE token = $1 AND purpose = 'reset' AND NOT used AND expires > now()", [token || ""]);
  if (!rows[0]) return res.status(400).json({ error: "That reset link is invalid or expired." });
  await q("UPDATE email_tokens SET used = TRUE WHERE token = $1", [rows[0].token]);
  await q("UPDATE artists SET pw_hash = $1, email_verified = TRUE, updated = now() WHERE id = $2",
    [await hashPassword(password), rows[0].artist_id]);
  await q("DELETE FROM sessions WHERE kind = 'artist' AND subject_id = $1", [rows[0].artist_id]);
  res.json({ ok: true, message: "Password updated. Sign in with the new one." });
});

artistAuth.get("/me", requireArtist, async (req, res) => {
  const a = await getArtist(req.artistId);
  if (!a) return res.status(404).json({ error: "Account not found." });
  res.json({ session: { artistId: a.id, name: a.name, email: a.email }, artist: publicArtist(a) });
});

/** Artist-facing view of their own record (no pw hash, no admin notes/scores). */
export function publicArtist(a) {
  if (!a) return null;
  const { adminNotes, talentScore, drawScore, hasPassword, ...rest } = a;
  return rest;
}
