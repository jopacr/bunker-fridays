// Public + artist routes. POST /requests is the server-authoritative gate for
// the canon (§4): field validation, set-type gating, writers attestation,
// per-night max, 28-day cooldown, originals cap, closed nights, Turnstile.
import { Router } from "express";
import { uid, tx } from "../db.js";
import { todayISO, fridaysAhead, fmtLong } from "../lib/dates.js";
import {
  entriesFor, writersNight, takenSlots, nightScore, validateRequestFields,
  checkSubmission, MAX_PHOTOS, EVENT_TYPES, isLocal,
} from "../lib/rules.js";
import {
  snapshot, getKb, insertRequest, upsertArtist, findArtistByEmail, getRequest,
  updateRequest, pingsFor, audit, q,
} from "../services/store.js";
import { verifyTurnstile } from "../services/turnstile.js";
import { CORE_FACTS, INFO_EMAIL } from "../lib/knowledge.js";
import { chat } from "../services/chatbot.js";
import { requireArtist } from "../auth/sessions.js";
import { publicArtist } from "../auth/artistAuth.js";
import { r2Enabled, presignPhotoUpload } from "../services/r2.js";
import { pushEnabled, publicKey } from "../services/push.js";
import { config } from "../config.js";

export const publicRoutes = Router();

/* ---------- calendar & info ---------- */
publicRoutes.get("/calendar", async (req, res) => {
  const snap = await snapshot();
  const today = todayISO();
  const days = Math.min(Number(req.query.days) || 90, 400);
  const nights = fridaysAhead(days).map((dISO) => {
    const { entries, closed } = entriesFor(snap, dISO);
    const writers = writersNight(snap, dISO);
    return {
      dateISO: dISO, label: fmtLong(dISO), writers, closed,
      // Public view: names + status only, no emails/notes
      entries: entries.map((e) => ({ name: e.name, setType: e.setType, status: e.status, slotTime: e.slotTime || null, manual: !!e.manual })),
      takenSlots: [...takenSlots(snap, dISO)],
      originalsTaken: entries.filter((e) => e.status === "confirmed" && e.setType === "single-originals").length,
    };
  });
  res.json({ today, nights });
});

publicRoutes.get("/info", async (_req, res) => {
  res.json({
    coreFacts: CORE_FACTS,
    kb: await getKb(),
    infoEmail: INFO_EMAIL,
    turnstileSiteKey: config.turnstileSiteKey || null,
    pushPublicKey: pushEnabled() ? publicKey() : null,
    photoUploads: r2Enabled(),
  });
});

/* ---------- request submission ---------- */
publicRoutes.post("/requests", async (req, res) => {
  const f = req.body || {};
  const today = todayISO();

  const ts = await verifyTurnstile(f.turnstileToken, req.ip);
  if (!ts.ok) return res.status(403).json({ error: "We couldn't verify you're human. Refresh and try again." });

  const dateISO = String(f.date || "");
  const snap = await snapshot();
  const writers = writersNight(snap, dateISO);
  const setType = writers ? "writers-round" : f.setType;

  const fields = validateRequestFields({ ...f, setType }, writers);
  if (!fields.ok) return res.status(400).json({ error: "Still needed", missing: fields.missing });

  // Resolve artist identity: session wins; otherwise match by email; otherwise new.
  let artistId = req.artistId || null;
  if (!artistId) {
    const existing = await findArtistByEmail(String(f.email).trim());
    artistId = existing ? existing.id : uid();
  }

  const gate = checkSubmission(snap, { artistId, email: String(f.email).trim(), dateISO, setType }, today);
  if (!gate.ok) return res.status(409).json({ error: gate.message, code: gate.code });

  const photos = Array.isArray(f.photos) ? f.photos.filter((p) => typeof p === "string" && p.startsWith("https://")).slice(0, MAX_PHOTOS) : [];

  await tx(async (run) => {
    await upsertArtist(artistId, {
      name: String(f.name).trim(), contactMethod: f.contactMethod || "Email",
      email: String(f.email).trim(), phone: String(f.phone || "").trim(),
      instagram: String(f.instagram || "").trim(), facebook: String(f.facebook || "").trim(),
      genre: String(f.genre).trim(), originalsSets: String(f.originalsSets), coversSets: String(f.coversSets),
      city: String(f.city).trim(), links: String(f.links || "").trim(), bio: String(f.bio).trim(),
      etransferEmail: String(f.etransferEmail || "").trim(),
      bookingPref: f.bookingPref,
      account: !!req.artistId || undefined,
      ...(photos.length ? { photos } : {}),
      source: "app request",
    }, run);
    await insertRequest({
      id: uid(), artistId, date: dateISO,
      eventType: writers ? EVENT_TYPES.WRITERS : EVENT_TYPES.FRIDAY,
      name: String(f.name).trim(), email: String(f.email).trim(), city: String(f.city).trim(),
      setType, bookingPref: f.bookingPref, slotPref: f.slotPref || "any",
      recording: f.recording || "none", notes: String(f.notes || "").trim(),
      guest: !req.artistId, status: "pending", source: "app",
    }, run);
  });
  await audit(req.artistId ? `artist:${artistId}` : "guest", "request.submitted", "request", null, { dateISO, setType });
  res.json({ ok: true, message: "Request sent. It shows as pending until the venue reviews it." });
});

/* ---------- artist self-service ---------- */
publicRoutes.get("/me/requests", requireArtist, async (req, res) => {
  const snap = await snapshot();
  const mine = snap.requests.filter((r) => r.artistId === req.artistId);
  res.json({ requests: mine, today: todayISO() });
});

publicRoutes.post("/me/requests/:id/cancel", requireArtist, async (req, res) => {
  const r = await getRequest(req.params.id);
  if (!r || r.artistId !== req.artistId) return res.status(404).json({ error: "Request not found." });
  const today = todayISO();
  if (!((r.status === "pending" || r.status === "approved") && r.date >= today)) {
    return res.status(409).json({ error: "That request can't be cancelled." });
  }
  await updateRequest(r.id, { status: "cancelled", cancelledBy: "artist" });
  await audit(`artist:${req.artistId}`, "request.cancelled", "request", r.id);
  res.json({ ok: true, message: "Request cancelled. The night is open again." });
});

publicRoutes.get("/me/profile", requireArtist, async (req, res) => {
  const snap = await snapshot();
  res.json({ artist: publicArtist(snap.artists[req.artistId]) || null });
});

// A signed-in artist edits their own profile. Email (the login identity),
// scores, notes, and account flags are NOT editable here.
const PROFILE_FIELDS = ["name", "stageName", "contactMethod", "phone", "instagram", "facebook", "genre", "originalsSets", "coversSets", "city", "links", "bio", "etransferEmail", "bookingPref"];
publicRoutes.post("/me/profile", requireArtist, async (req, res) => {
  const f = req.body || {};
  const fields = {};
  for (const k of PROFILE_FIELDS) {
    if (!(k in f)) continue;
    let v = f[k];
    if (typeof v === "string") v = v.trim();
    // booking_pref has a CHECK (single|rotation|null); an empty choice means "leave unset"
    if (k === "bookingPref" && !v) continue;
    fields[k] = v;
  }
  if ("name" in fields && !fields.name) return res.status(400).json({ error: "Name can't be empty." });
  if (fields.bookingPref && !["single", "rotation"].includes(fields.bookingPref)) {
    return res.status(400).json({ error: "Booking preference must be single or rotation." });
  }
  if (fields.etransferEmail && !fields.etransferEmail.includes("@")) {
    return res.status(400).json({ error: "Enter a valid e-transfer email, or leave it blank." });
  }
  await upsertArtist(req.artistId, fields);
  const snap = await snapshot();
  res.json({ ok: true, artist: publicArtist(snap.artists[req.artistId]) });
});

/* Blackouts (§4): self-serve, with reason. */
publicRoutes.post("/me/blackouts", requireArtist, async (req, res) => {
  const { date, reason } = req.body || {};
  const today = todayISO();
  if (!date || date < today) return res.status(400).json({ error: "Pick a future date." });
  if (!["stratford", "other"].includes(reason)) return res.status(400).json({ error: "Pick a reason." });
  const snap = await snapshot();
  const a = snap.artists[req.artistId];
  const next = [...(a.blackouts || []), { date, reason }].sort((x, y) => x.date.localeCompare(y.date));
  await upsertArtist(req.artistId, { blackouts: next });
  res.json({
    ok: true, blackouts: next,
    message: reason === "stratford"
      ? "Got it. We won't reach out for that date, or for 2 weeks either side, since you're playing locally."
      : "Got it. We won't reach out for that date.",
  });
});

publicRoutes.delete("/me/blackouts", requireArtist, async (req, res) => {
  const { date, reason } = req.body || {};
  const snap = await snapshot();
  const a = snap.artists[req.artistId];
  const next = (a.blackouts || []).filter((b) => !(b.date === date && b.reason === reason));
  await upsertArtist(req.artistId, { blackouts: next });
  res.json({ ok: true, blackouts: next });
});

/* Pings */
publicRoutes.get("/me/pings", requireArtist, async (req, res) => {
  res.json({ pings: await pingsFor(req.artistId) });
});
publicRoutes.post("/me/pings/:id/read", requireArtist, async (req, res) => {
  await q("UPDATE pings SET read = TRUE WHERE id = $1 AND artist_id = $2", [req.params.id, req.artistId]);
  res.json({ ok: true });
});

/* Push subscription */
publicRoutes.post("/me/push/subscribe", requireArtist, async (req, res) => {
  const sub = req.body?.subscription;
  if (!sub?.endpoint) return res.status(400).json({ error: "Bad subscription." });
  await q(
    `INSERT INTO push_subscriptions (id, artist_id, subscription) VALUES ($1,$2,$3)
     ON CONFLICT ((subscription->>'endpoint')) DO UPDATE SET artist_id = $2, subscription = $3`,
    [uid(), req.artistId, JSON.stringify(sub)]
  );
  res.json({ ok: true });
});

/* Photo upload presign (R2, full resolution) */
publicRoutes.post("/me/photos/presign", requireArtist, async (req, res) => {
  if (!r2Enabled()) return res.status(503).json({ error: "Photo uploads aren't configured yet." });
  const contentType = ["image/jpeg", "image/png", "image/webp"].includes(req.body?.contentType) ? req.body.contentType : "image/jpeg";
  res.json(presignPhotoUpload(req.artistId, contentType));
});
publicRoutes.post("/me/photos", requireArtist, async (req, res) => {
  const urls = (req.body?.photos || []).filter((p) => typeof p === "string" && p.startsWith("https://")).slice(0, MAX_PHOTOS);
  await upsertArtist(req.artistId, { photos: urls });
  res.json({ ok: true, photos: urls });
});

/* ---------- chatbot ---------- */
publicRoutes.post("/chat", async (req, res) => {
  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-12) : [];
  if (!history.length) return res.status(400).json({ error: "Nothing to answer." });
  let contact = null;
  if (req.artistId) {
    const snap = await snapshot();
    const a = snap.artists[req.artistId];
    if (a) contact = `${a.name} <${a.email}>`;
  }
  res.json(await chat({ history, contact }));
});
