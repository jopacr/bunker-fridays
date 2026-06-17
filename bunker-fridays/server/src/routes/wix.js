// Wix bridge (§7): performer-inquiry form on Wix → Wix Automations webhook →
// this endpoint → pending request in the Inbox (event_type tagged) + artist
// upsert by email. Authenticated by a shared secret header set in the
// Automation's webhook config (WIX_WEBHOOK_SECRET).

import express from "express";
import { config } from "../config.js";
import { snapshot, upsertArtist, findArtistByEmail, insertRequest, audit, uid, tx } from "../services/store.js";

export const wixRoutes = express.Router();

const pick = (body, ...keys) => {
  for (const k of keys) {
    const v = body[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
};
const num = (v) => {
  const n = parseInt(String(v ?? "").replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
};

wixRoutes.post("/api/integrations/wix", async (req, res) => {
  if (!config.wixWebhookSecret) return res.status(503).json({ error: "Wix bridge not configured." });
  const given = req.headers["x-wix-secret"] || req.headers["x-webhook-secret"] || req.query.secret;
  if (given !== config.wixWebhookSecret) return res.status(401).json({ error: "Bad secret." });

  // Wix Automations webhooks send the form's fields flat or under data/submission.
  const body = { ...(req.body?.data || {}), ...(req.body?.submission || {}), ...(req.body || {}) };

  const name = pick(body, "performerGroupName", "performer_group_name", "name", "performerName", "groupName");
  const email = pick(body, "email", "emailAddress", "email_address").toLowerCase();
  if (!name || !email) return res.status(400).json({ error: "Name and email are required." });

  const contactMethod = pick(body, "bestContactMethod", "best_contact_method", "contactMethod") || "email";
  const phone = pick(body, "phone", "phoneNumber", "phone_number");
  const instagram = pick(body, "instagram", "instagramHandle");
  const facebook = pick(body, "facebook", "facebookPage");
  const performanceType = pick(body, "performanceType", "performance_type");
  const genre = pick(body, "genre");
  const originalsSets = num(pick(body, "originalSets", "numOriginalSets", "original_sets", "#OriginalSets"));
  const coversSets = num(pick(body, "coverSets", "numCoverSets", "cover_sets", "#CoverSets"));
  const links = pick(body, "sampleLinks", "sample_links", "links");
  const bio = pick(body, "bio");
  const notes = pick(body, "notes", "anythingElse", "message");

  const existing = await findArtistByEmail(email);
  const artistId = existing?.id || uid();

  await tx(async (run) => {
    await upsertArtist(artistId, {
      name, email,
      phone: phone || existing?.phone,
      contactMethod: ["email", "phone", "text", "instagram", "facebook"].includes(contactMethod.toLowerCase()) ? contactMethod.toLowerCase() : "email",
      instagram: instagram || existing?.instagram,
      facebook: facebook || existing?.facebook,
      genre: genre || existing?.genre,
      originalsSets: originalsSets || existing?.originalsSets || 0,
      coversSets: coversSets || existing?.coversSets || 0,
      links: links || existing?.links,
      bio: bio || existing?.bio,
      source: existing?.source || "wix",
    }, run);

    const wantsOriginals = /original/i.test(performanceType) || (originalsSets > 0 && coversSets === 0);
    await insertRequest({
      id: uid(),
      artistId,
      name, email,
      date: null, // Wix inquiries arrive undated; the desk follows up with open Fridays
      eventType: "friday",
      setType: wantsOriginals ? "single-originals" : "covers",
      slotPref: "any",
      bookingPref: null,
      recording: "none",
      notes: [performanceType && `Performance type: ${performanceType}`, notes].filter(Boolean).join("\n"),
      guest: !existing?.account,
      status: "pending",
      source: "wix",
    }, run);
  });

  await audit("wix-webhook", "request.wix", "artist", artistId, { name, email });
  res.json({ ok: true });
});
