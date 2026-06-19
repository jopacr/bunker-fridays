// Venue desk API. Everything here sits behind requireAdmin (real accounts +
// optional TOTP; replaces the prototype's PIN). Mutations are audited.
// Server re-validates everything the prototype validated client-side:
// slot collisions at write time, auto-decline windows, two-step deletes.

import express from "express";
import { requireAdmin } from "../auth/sessions.js";
import {
  snapshot, getRecConfig, setRecConfig, getKb, setKb,
  upsertArtist, getArtist, deleteArtist, reassignArtistRefs, updateRequest, getRequest,
  upsertNight, addDraft, listDrafts, addPing,
  addRecPass, clearRecPasses, purgePastRecPasses, audit, q, uid,
} from "../services/store.js";
import {
  planConfirmation, suggestFridays, takenSlots, nightScore, writersNight,
  entriesFor, hasPlayed, isLocal, SLOT_TIMES,
} from "../lib/rules.js";
import { confirmEmailDraft, declineEmailDraft, timeChangeEmailDraft, removalEmailDraft, outreachEmailDraft, outreachShortText } from "../lib/drafts.js";
import { runRecommendations } from "../lib/recommend.js";
import { todayISO, fmtLong, fridaysAhead, iso } from "../lib/dates.js";
import { sendEmail, mailerEnabled } from "../services/mailer.js";
import { config } from "../config.js";
import { pushToArtist, pushToVenue } from "../services/push.js";
import { sendSms, confirmSmsBody, smsEnabled } from "../services/sms.js";

export const adminRoutes = express.Router();
adminRoutes.use(requireAdmin);

const DECLINE_REASONS = ["slot-filled", "conflict", "not-now"];

function publicSnap(snap) {
  return snap; // desk sees everything; shape matches the prototype's state
}

/* ---------- full desk state ---------- */
adminRoutes.post("/push/subscribe", async (req, res) => {
  const sub = req.body?.subscription;
  if (!sub || !sub.endpoint) return res.status(400).json({ error: "Invalid subscription." });
  const id = uid();
  await q("INSERT INTO venue_push_subscriptions (id, subscription) VALUES ($1, $2) ON CONFLICT DO NOTHING", [id, JSON.stringify(sub)]);
  res.json({ ok: true });
});

adminRoutes.get("/state", async (_req, res) => {
  const [snap, drafts, recConfig, escalations, kb] = await Promise.all([
    snapshot(), listDrafts(), getRecConfig(),
    q("SELECT * FROM escalations ORDER BY ts DESC LIMIT 200"),
    getKb(),
  ]);
  res.json({
    ...publicSnap(snap),
    drafts,
    recConfig,
    kb,
    escalations: escalations.map((e) => ({ id: e.id, question: e.question, contact: e.contact, summary: e.summary, resolved: !!e.resolved, ts: e.ts })),
    today: todayISO(),
  });
});

/* ---------- inbox: decide / change time / cancel ---------- */
adminRoutes.post("/requests/:id/decide", async (req, res) => {
  const { status, slot, declineReason } = req.body || {};
  const id = req.params.id;
  const snap = await snapshot();
  const target = snap.requests.find((r) => r.id === id);
  if (!target) return res.status(404).json({ error: "Request not found." });
  if (target.status !== "pending") return res.status(409).json({ error: "That request was already decided." });

  if (status === "approved") {
    const plan = planConfirmation(snap, id, slot || null);
    if (!plan.ok) return res.status(409).json({ error: plan.message, code: plan.code });
    await updateRequest(id, { status: "approved", slotTime: plan.slotTime });
    for (const rid of plan.autoDecline) {
      await updateRequest(rid, { status: "declined", auto: true, autoReason: plan.autoReason });
    }
    const artist = target.artistId ? snap.artists[target.artistId] : null;
    const d = confirmEmailDraft({ ...target, slotTime: plan.slotTime }, artist);
    const draft = await addDraft({ to: target.email, subject: d.subject, body: d.body, kind: "confirmation", label: `Confirmation · ${target.name} · ${fmtLong(target.date)}`, reqId: id });
    await audit(req.adminEmail, "request.approve", "request", id, { slot: plan.slotTime, autoDeclined: plan.autoDecline.length });

    // Push notification to artist (silent if not subscribed or push not configured)
    pushToArtist(target.artistId, {
      title: "You're confirmed at The Bunker",
      body: `${fmtLong(target.date)}${plan.slotTime ? ` · ${plan.slotTime}` : ""}. Check your email for details.`,
      tag: "booking-confirmed",
    }).catch(() => {});

    // SMS to artist if they have a phone number and Twilio is configured
    const phone = artist?.phone || target.phone || "";
    if (phone && smsEnabled()) {
      sendSms(phone, confirmSmsBody(target.name, fmtLong(target.date), plan.slotTime, config.infoEmail)).catch(() => {});
    }

    return res.json({ ok: true, autoDeclined: plan.autoDecline.length, draft });
  }

  if (status === "declined") {
    const reason = DECLINE_REASONS.includes(declineReason) ? declineReason : "not-now";
    await updateRequest(id, { status: "declined", declineReason: reason });
    const suggestions = target.date ? suggestFridays(snap, target.date, target.setType, 3, todayISO()) : suggestFridays(snap, null, target.setType, 3, todayISO());
    const d = declineEmailDraft(reason, target, suggestions);
    const draft = await addDraft({ to: target.email, subject: d.subject, body: d.body, kind: "follow-up", label: `Follow-up · ${target.name} · ${target.date ? fmtLong(target.date) : "inquiry"}`, reqId: id });
    await audit(req.adminEmail, "request.decline", "request", id, { reason });
    pushToArtist(target.artistId, {
      title: "Update on your Bunker request",
      body: `${target.date ? fmtLong(target.date) : "Your request"}: not this time, but check the app for other open Fridays.`,
      tag: "request-declined",
    }).catch(() => {});
    return res.json({ ok: true, draft });
  }

  res.status(400).json({ error: "status must be approved or declined." });
});

adminRoutes.delete("/requests/:id", async (req, res) => {
  const id = req.params.id;
  await q("DELETE FROM drafts WHERE req_id = $1", [id]);
  await q("DELETE FROM requests WHERE id = $1", [id]);
  await audit(req.adminEmail, "request.delete", "request", id, {});
  res.json({ ok: true });
});

adminRoutes.post("/requests/:id/time", async (req, res) => {
  const { slot } = req.body || {};
  const id = req.params.id;
  if (!SLOT_TIMES.includes(slot)) return res.status(400).json({ error: "Pick a slot time." });
  const snap = await snapshot();
  const target = snap.requests.find((r) => r.id === id);
  if (!target || target.status !== "approved") return res.status(404).json({ error: "Confirmed booking not found." });
  if (slot !== target.slotTime && takenSlots(snap, target.date).has(slot)) {
    return res.status(409).json({ error: `The ${slot} set is already confirmed for that night.` });
  }
  const oldSlot = target.slotTime;
  await updateRequest(id, { slotTime: slot });
  const d = timeChangeEmailDraft({ ...target, slotTime: slot }, oldSlot);
  const draft = await addDraft({ to: target.email, subject: d.subject, body: d.body, kind: "follow-up", label: `Time change · ${target.name} · ${fmtLong(target.date)}`, reqId: id });
  await audit(req.adminEmail, "request.time", "request", id, { from: oldSlot, to: slot });
  res.json({ ok: true, draft });
});

adminRoutes.post("/requests/:id/cancel", async (req, res) => {
  const id = req.params.id;
  const reason = (req.body && req.body.reason) || "";
  const snap = await snapshot();
  const target = snap.requests.find((r) => r.id === id);
  if (!target || target.status !== "approved") return res.status(404).json({ error: "Confirmed booking not found." });
  await updateRequest(id, { status: "cancelled", cancelledBy: "venue", cancelledAt: new Date().toISOString() });
  await audit(req.adminEmail, "request.cancel", "request", id, {});
  // Draft an explanation email so the venue can tell the artist (nothing sends
  // until the venue clicks). Only when we actually have an address for them.
  let draft = null;
  if (target.email) {
    const d = removalEmailDraft(target, reason);
    draft = await addDraft({ to: target.email, subject: d.subject, body: d.body, kind: "follow-up", label: `Removal · ${target.name} · ${fmtLong(target.date)}`, reqId: id });
  }
  pushToArtist(target.artistId, {
    title: "Your Bunker set was released",
    body: `${fmtLong(target.date)}${target.slotTime ? ` · ${target.slotTime}` : ""} is no longer booked. Check your email and reach out for another date.`,
    tag: "booking-cancelled",
  }).catch(() => {});
  res.json({ ok: true, draft });
});

/* ---------- calendar: nights ---------- */
adminRoutes.post("/nights/:date/closed", async (req, res) => {
  const date = req.params.date;
  const snap = await snapshot();
  const cur = snap.nights[date];
  await upsertNight(date, { closed: !(cur?.closed) });
  await audit(req.adminEmail, "night.closed", "night", date, { closed: !(cur?.closed) });
  res.json({ ok: true, closed: !(cur?.closed) });
});

adminRoutes.post("/nights/:date/writers", async (req, res) => {
  const date = req.params.date;
  const { writersOverride } = req.body || {}; // true | false | null
  await upsertNight(date, { writersOverride: writersOverride === null ? null : !!writersOverride });
  await audit(req.adminEmail, "night.writers", "night", date, { writersOverride });
  res.json({ ok: true });
});

adminRoutes.post("/nights/:date/manual", async (req, res) => {
  const date = req.params.date;
  const { name, setType, status, slotTime } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: "Name required." });
  const snap = await snapshot();
  if (slotTime && status === "confirmed" && takenSlots(snap, date).has(slotTime)) {
    return res.status(409).json({ error: `The ${slotTime} set is already confirmed for that night.` });
  }
  const slots = [...(snap.nights[date]?.slots || []), {
    name: name.trim(),
    setType: ["covers", "originals", "writers-round"].includes(setType) ? setType : "covers",
    status: ["confirmed", "pencilled"].includes(status) ? status : "confirmed",
    slotTime: SLOT_TIMES.includes(slotTime) ? slotTime : null,
    source: "website inquiry",
  }];
  await upsertNight(date, { slots });
  await audit(req.adminEmail, "night.manual.add", "night", date, { name: name.trim() });
  res.json({ ok: true, slots });
});

adminRoutes.delete("/nights/:date/manual/:idx", async (req, res) => {
  const date = req.params.date;
  const idx = parseInt(req.params.idx, 10);
  const snap = await snapshot();
  const cur = snap.nights[date]?.slots || [];
  if (!(idx >= 0 && idx < cur.length)) return res.status(404).json({ error: "Entry not found." });
  const removed = cur[idx];
  await upsertNight(date, { slots: cur.filter((_, i) => i !== idx) });
  await audit(req.adminEmail, "night.manual.remove", "night", date, { name: removed.name });
  res.json({ ok: true });
});

// Apply one or two time changes (a move, or a swap on a full night).
// App-request artists get a heads-up draft; manual entries just move.
adminRoutes.post("/nights/:date/times", async (req, res) => {
  const date = req.params.date;
  const changes = Array.isArray(req.body?.changes) ? req.body.changes : [];
  if (!changes.length) return res.status(400).json({ error: "No changes given." });
  const snap = await snapshot();
  const drafts = [];
  let nightSlots = snap.nights[date]?.slots || null;
  for (const ch of changes) {
    const slot = ch.slot;
    if (!SLOT_TIMES.includes(slot)) continue;
    if (ch.reqId) {
      const t = snap.requests.find((r) => r.id === ch.reqId);
      if (!t || t.status !== "approved" || t.date !== date) continue;
      const oldSlot = t.slotTime;
      await updateRequest(ch.reqId, { slotTime: slot });
      t.slotTime = slot;
      const d = timeChangeEmailDraft({ ...t, slotTime: slot }, oldSlot);
      drafts.push(await addDraft({ to: t.email, subject: d.subject, body: d.body, kind: "follow-up", label: `Time change · ${t.name} · ${fmtLong(t.date)}`, reqId: ch.reqId }));
    } else if (ch.name && nightSlots) {
      const idx = nightSlots.findIndex((ms) => ms.name === ch.name && (ms.slotTime || null) === (ch.fromSlot || null));
      if (idx >= 0) nightSlots = nightSlots.map((s, i) => (i === idx ? { ...s, slotTime: slot } : s));
    }
  }
  if (nightSlots) await upsertNight(date, { slots: nightSlots });
  await audit(req.adminEmail, "night.times", "night", date, { changes: changes.length });
  res.json({ ok: true, drafts });
});

/* ---------- artists ---------- */
const ARTIST_EDIT_FIELDS = [
  "name", "stageName", "email", "phone", "contactMethod", "instagram", "facebook", "genre",
  "originalsSets", "coversSets", "city", "links", "bio", "etransferEmail",
  "bookingPref", "talentScore", "drawScore", "adminNotes", "unavailableDates",
  "blackouts", "importedLastPlayed", "lastCompanions", "photos", "local",
];

adminRoutes.put("/artists/:id", async (req, res) => {
  const a = await getArtist(req.params.id);
  if (!a) return res.status(404).json({ error: "Artist not found." });
  const fields = {};
  for (const k of ARTIST_EDIT_FIELDS) if (k in (req.body || {})) fields[k] = req.body[k];
  // Scores: 0..3 or null (tap-same-clears handled client-side, null is valid here)
  for (const k of ["talentScore", "drawScore"]) {
    if (k in fields && fields[k] !== null) {
      const n = Number(fields[k]);
      if (!(Number.isInteger(n) && n >= 0 && n <= 3)) return res.status(400).json({ error: `${k} must be 0 to 3 or null.` });
      fields[k] = n;
    }
  }
  if ("bookingPref" in fields && fields.bookingPref !== null && !["single", "rotation"].includes(fields.bookingPref)) {
    return res.status(400).json({ error: "bookingPref must be single, rotation, or null." });
  }
  const updated = await upsertArtist(req.params.id, fields);
  await audit(req.adminEmail, "artist.update", "artist", req.params.id, { fields: Object.keys(fields) });
  res.json({ ok: true, artist: updated });
});

// Merge two artist records into one. Used when an imported booking-doc artist
// and a self-made account turn out to be the same person. Requests, pings, and
// rec passes follow into the kept record; profile/score fields are coalesced
// (kept record wins where it has a value, otherwise the other fills it in).
adminRoutes.post("/artists/merge", async (req, res) => {
  const { keepId, mergeId } = req.body || {};
  if (!keepId || !mergeId || keepId === mergeId) return res.status(400).json({ error: "Pick two different artists to merge." });
  let keep = await getArtist(keepId);
  let gone = await getArtist(mergeId);
  if (!keep || !gone) return res.status(404).json({ error: "One of those artists no longer exists." });
  // Always keep the record that has a login, so the artist can still sign in.
  let swapped = false;
  if (gone.hasPassword && !keep.hasPassword) { const t = keep; keep = gone; gone = t; swapped = true; }
  if (keep.hasPassword && gone.hasPassword) return res.status(400).json({ error: "Both records have their own login. Have one artist sign in to confirm which account to keep before merging." });

  const pick = (a, b) => (a !== undefined && a !== null && String(a).trim() !== "" ? a : b);
  const dedupe = (arr) => Array.from(new Set(arr.filter(Boolean)));
  const blackouts = [...(keep.blackouts || []), ...(gone.blackouts || [])];
  const seen = new Set();
  const mergedBlackouts = blackouts.filter((b) => { const k = `${b.date}|${b.reason || ""}`; if (seen.has(k)) return false; seen.add(k); return true; });

  const merged = {
    name: pick(keep.name, gone.name),
    stageName: pick(keep.stageName, gone.stageName),
    email: pick(keep.email, gone.email),
    phone: pick(keep.phone, gone.phone),
    contactMethod: pick(keep.contactMethod, gone.contactMethod),
    instagram: pick(keep.instagram, gone.instagram),
    facebook: pick(keep.facebook, gone.facebook),
    genre: pick(keep.genre, gone.genre),
    originalsSets: pick(keep.originalsSets, gone.originalsSets),
    coversSets: pick(keep.coversSets, gone.coversSets),
    city: pick(keep.city, gone.city),
    links: pick(keep.links, gone.links),
    bio: pick(keep.bio, gone.bio),
    etransferEmail: pick(keep.etransferEmail, gone.etransferEmail),
    bookingPref: keep.bookingPref || gone.bookingPref || null,
    talentScore: keep.talentScore ?? gone.talentScore ?? null,
    drawScore: keep.drawScore ?? gone.drawScore ?? null,
    adminNotes: [keep.adminNotes, gone.adminNotes].filter(Boolean).join("\n").trim(),
    importedLastPlayed: [keep.importedLastPlayed, gone.importedLastPlayed].filter(Boolean).sort().pop() || null,
    local: !!(keep.local || gone.local),
    account: !!(keep.account || gone.account),
    photos: dedupe([...(keep.photos || []), ...(gone.photos || [])]).slice(0, 4),
    unavailableDates: dedupe([...(keep.unavailableDates || []), ...(gone.unavailableDates || [])]),
    lastCompanions: dedupe([...(keep.lastCompanions || []), ...(gone.lastCompanions || [])]),
    blackouts: mergedBlackouts,
  };

  await reassignArtistRefs(gone.id, keep.id);
  await upsertArtist(keep.id, merged);
  await deleteArtist(gone.id);
  await audit(req.adminEmail, "artist.merge", "artist", keep.id, { mergedAway: gone.id, swapped });
  res.json({ ok: true, keptId: keep.id, keptName: merged.name });
});

adminRoutes.post("/artists", async (req, res) => {
  const fields = {};
  for (const k of ARTIST_EDIT_FIELDS) if (k in (req.body || {})) fields[k] = req.body[k];
  if (!fields.name?.trim()) return res.status(400).json({ error: "Name required." });
  const id = uid();
  const artist = await upsertArtist(id, { ...fields, source: "venue" });
  await audit(req.adminEmail, "artist.create", "artist", id, { name: fields.name });
  res.json({ ok: true, artist });
});

adminRoutes.delete("/artists/:id", async (req, res) => {
  const a = await getArtist(req.params.id);
  if (!a) return res.status(404).json({ error: "Artist not found." });
  await deleteArtist(req.params.id); // request history retained, FK set null
  await audit(req.adminEmail, "artist.delete", "artist", req.params.id, { name: a.name });
  res.json({ ok: true });
});

adminRoutes.post("/artists/:id/clear-passes", async (req, res) => {
  await clearRecPasses(req.params.id);
  await audit(req.adminEmail, "artist.clearPasses", "artist", req.params.id, {});
  res.json({ ok: true });
});

/* ---------- drafts ---------- */
adminRoutes.post("/drafts/:id/sent", async (req, res) => {
  const sent = !!req.body?.sent;
  await q("UPDATE drafts SET sent = $2 WHERE id = $1", [req.params.id, sent]);
  res.json({ ok: true });
});

adminRoutes.delete("/drafts/:id", async (req, res) => {
  await q("DELETE FROM drafts WHERE id = $1", [req.params.id]);
  await audit(req.adminEmail, "draft.delete", "draft", req.params.id, {});
  res.json({ ok: true });
});

// THE only path that sends email to an artist, and only on this explicit click.
adminRoutes.post("/drafts/:id/send", async (req, res) => {
  if (!mailerEnabled()) return res.status(503).json({ error: "Email sending isn't configured. Use Copy or Open in Mail." });
  const [row] = await q("SELECT * FROM drafts WHERE id = $1", [req.params.id]);
  if (!row) return res.status(404).json({ error: "Draft not found." });
  const r = await sendEmail({ to: row.to_email, subject: row.subject, text: row.body });
  if (!r.ok) return res.status(502).json({ error: r.error || "Send failed." });
  await q("UPDATE drafts SET sent = TRUE WHERE id = $1", [req.params.id]);
  await audit(req.adminEmail, "draft.send", "draft", req.params.id, { to: row.to_email });
  res.json({ ok: true });
});

/* ---------- recommendations ---------- */
adminRoutes.post("/recommend/run", async (req, res) => {
  const weeks = Math.min(Math.max(parseInt(req.body?.weeks, 10) || 6, 1), 16);
  const today = todayISO();
  await purgePastRecPasses(today);
  const [snap, cfg] = await Promise.all([snapshot(), getRecConfig()]);
  res.json({ nights: runRecommendations(snap, cfg, weeks, today) });
});

adminRoutes.post("/recommend/pass", async (req, res) => {
  const { artistId, name, date, weeks } = req.body || {};
  if (!date) return res.status(400).json({ error: "date required." });
  let aid = artistId;
  if (!aid && name) {
    const [row] = await q("SELECT id FROM artists WHERE lower(name) = lower($1)", [name]);
    aid = row?.id;
  }
  if (!aid) return res.status(404).json({ error: "Artist not found." });
  await addRecPass(aid, date);
  await audit(req.adminEmail, "recommend.pass", "artist", aid, { date });
  // Re-run so the slot refills immediately with the next-best pick.
  const today = todayISO();
  const [snap, cfg] = await Promise.all([snapshot(), getRecConfig()]);
  res.json({ ok: true, nights: runRecommendations(snap, cfg, Math.min(Math.max(parseInt(weeks, 10) || 6, 1), 16), today) });
});

// Accepting a pick only drafts outreach; nothing books until the artist responds.
adminRoutes.post("/recommend/outreach", async (req, res) => {
  const { artistId, name, email, date, slotLabel, slotType, ping } = req.body || {};
  if (!date) return res.status(400).json({ error: "date required." });
  const snap = await snapshot();
  const writers = writersNight(snap, date);
  const artistName = name || (artistId && snap.artists[artistId]?.name) || "there";
  const dateLabel = fmtLong(date);
  const out = { ok: true };

  if (email) {
    const d = outreachEmailDraft(artistName, dateLabel, slotLabel || null, slotType || "covers", writers);
    out.draft = await addDraft({ to: email, subject: d.subject, body: d.body, kind: "follow-up", label: `Outreach · ${artistName} · ${dateLabel}` });
  }
  out.smsText = outreachShortText(artistName, dateLabel, slotLabel || null, slotType || "covers", writers);

  if (ping && artistId && snap.artists[artistId]) {
    const message = `We'd love to have you play ${dateLabel}${slotLabel ? ` (${slotLabel} set)` : ""}. Tap below to request the date and we'll confirm you right away.`;
    out.ping = await addPing(artistId, message, date);
    await pushToArtist(artistId, {
      title: "The Bunker wants you on a bill",
      body: `${dateLabel}${slotLabel ? ` · ${slotLabel} set` : ""}. Open the app to request the date.`,
      data: { dateISO: date },
    });
    const phone = snap.artists[artistId]?.phone || "";
    if (phone && smsEnabled()) {
      sendSms(phone, outreachShortText(artistName, dateLabel, slotLabel || null, slotType || "covers", writers)).catch(() => {});
    }
  }
  await audit(req.adminEmail, "recommend.outreach", "artist", artistId || artistName, { date });
  res.json(out);
});

adminRoutes.get("/recconfig", async (_req, res) => res.json(await getRecConfig()));
adminRoutes.put("/recconfig", async (req, res) => {
  const cur = await getRecConfig();
  const next = { ...cur };
  for (const k of Object.keys(cur)) {
    if (k in (req.body || {})) {
      const n = Number(req.body[k]);
      if (!Number.isFinite(n) || n < 0) return res.status(400).json({ error: `${k} must be a non-negative number.` });
      next[k] = n;
    }
  }
  await setRecConfig(next);
  await audit(req.adminEmail, "recconfig.update", "config", "rec", next);
  res.json({ ok: true, recConfig: next });
});

/* ---------- knowledge base + escalations ---------- */
adminRoutes.put("/kb", async (req, res) => {
  const text = String(req.body?.text ?? "");
  await setKb(text);
  await audit(req.adminEmail, "kb.update", "config", "kb", { length: text.length });
  res.json({ ok: true });
});

adminRoutes.put("/local-cities", async (req, res) => {
  const cities = Array.isArray(req.body?.cities) ? req.body.cities.map((c) => String(c).toLowerCase().trim()).filter(Boolean) : null;
  await q("UPDATE venue_kb SET local_cities = $1 WHERE id = 1", [cities ? JSON.stringify(cities) : null]);
  await audit(req.adminEmail, "localCities.update", "config", "cities", { count: cities?.length ?? "default" });
  res.json({ ok: true });
});

adminRoutes.post("/escalations/:id/resolved", async (req, res) => {
  await q("UPDATE escalations SET resolved = $2 WHERE id = $1", [req.params.id, !!req.body?.resolved]);
  res.json({ ok: true });
});

/* ---------- audit log ---------- */
adminRoutes.get("/audit", async (_req, res) => {
  const rows = await q("SELECT * FROM audit_log ORDER BY ts DESC LIMIT 200");
  res.json({ entries: rows.map((r) => ({ id: r.id, actor: r.actor, action: r.action, entity: r.entity, entityId: r.entity_id, detail: r.detail, ts: r.ts })) });
});
