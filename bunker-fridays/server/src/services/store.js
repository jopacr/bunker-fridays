// Data access. Rules and the recommender operate on a camelCase snapshot
// identical in shape to the prototype's state; this module is the SQL boundary.
// The dataset is venue-scale (hundreds of rows), so snapshot loads are cheap.

import { q, tx, uid } from "../db.js";

/* ---------- row mappers ---------- */
export function artistFromRow(r) {
  return {
    id: r.id, name: r.name, stageName: r.stage_name || "", email: r.email || "", phone: r.phone || "",
    contactMethod: r.contact_method || "", instagram: r.instagram || "", facebook: r.facebook || "",
    genre: r.genre || "", originalsSets: r.originals_sets ?? "", coversSets: r.covers_sets ?? "",
    city: r.city || "", links: r.links || "", bio: r.bio || "",
    etransferEmail: r.etransfer_email || "",
    bookingPref: r.booking_pref || null,
    talentScore: r.talent_score, drawScore: r.draw_score,
    adminNotes: r.admin_notes || "",
    unavailableDates: r.unavailable_dates || [],
    blackouts: r.blackouts || [],
    importedLastPlayed: r.imported_last_played || "",
    lastCompanions: r.last_companions || [],
    account: !!r.account, emailVerified: !!r.email_verified, hasPassword: !!r.pw_hash,
    source: r.source || "", photos: r.photos || [], local: !!r.is_local,
    updated: r.updated,
  };
}

const ARTIST_COLS = {
  name: "name", stageName: "stage_name", email: "email", phone: "phone", contactMethod: "contact_method",
  instagram: "instagram", facebook: "facebook", genre: "genre",
  originalsSets: "originals_sets", coversSets: "covers_sets", city: "city",
  links: "links", bio: "bio", etransferEmail: "etransfer_email",
  bookingPref: "booking_pref", talentScore: "talent_score", drawScore: "draw_score",
  adminNotes: "admin_notes", unavailableDates: "unavailable_dates", blackouts: "blackouts",
  importedLastPlayed: "imported_last_played", lastCompanions: "last_companions",
  account: "account", source: "source", photos: "photos", local: "is_local",
};

export function requestFromRow(r) {
  return {
    id: r.id, artistId: r.artist_id, date: r.date, eventType: r.event_type,
    name: r.name, email: r.email || "", city: r.city || "",
    setType: r.set_type, bookingPref: r.booking_pref, slotPref: r.slot_pref,
    slotTime: r.slot_time, recording: r.recording, notes: r.notes || "",
    guest: !!r.guest, status: r.status, declineReason: r.decline_reason,
    auto: !!r.auto, autoReason: r.auto_reason || "",
    cancelledBy: r.cancelled_by, source: r.source, ts: r.ts,
  };
}

export function nightFromRow(r) {
  return { closed: !!r.closed, writersOverride: r.writers_override, slots: r.manual_slots || [], note: r.note || "" };
}

export function draftFromRow(r) {
  return { id: r.id, to: r.to_email, subject: r.subject, body: r.body, kind: r.kind, label: r.label, reqId: r.req_id || null, sent: !!r.sent, ts: r.ts };
}

/* ---------- snapshot ---------- */
export async function snapshot() {
  const [artistRows, requestRows, nightRows, passRows, kbRow] = await Promise.all([
    q("SELECT * FROM artists"),
    q("SELECT * FROM requests ORDER BY ts DESC"),
    q("SELECT * FROM nights"),
    q("SELECT * FROM rec_passes"),
    q("SELECT * FROM venue_kb WHERE id = 1"),
  ]);
  const artists = {};
  artistRows.forEach((r) => { artists[r.id] = artistFromRow(r); });
  const nights = {};
  nightRows.forEach((r) => { nights[r.date] = nightFromRow(r); });
  const recPasses = {};
  passRows.forEach((r) => { recPasses[`${r.artist_id}|${r.date}`] = r.ts; });
  return {
    artists,
    requests: requestRows.map(requestFromRow),
    nights,
    recPasses,
    localCities: kbRow[0]?.local_cities || null,
  };
}

export async function getRecConfig() {
  const [r] = await q("SELECT * FROM rec_config WHERE id = 1");
  return {
    daysSincePlayed: r.days_since_played, localBonus: r.local_bonus,
    newArtistBonus: r.new_artist_bonus, newOriginalsBonus: r.new_originals_bonus,
    recencyPenalty: r.recency_penalty,
  };
}

export async function setRecConfig(c) {
  await q(
    `UPDATE rec_config SET days_since_played=$1, local_bonus=$2, new_artist_bonus=$3, new_originals_bonus=$4, recency_penalty=$5 WHERE id=1`,
    [c.daysSincePlayed, c.localBonus, c.newArtistBonus, c.newOriginalsBonus, c.recencyPenalty]
  );
}

export async function getKb() {
  const [r] = await q("SELECT text FROM venue_kb WHERE id = 1");
  return r?.text || "";
}
export async function setKb(text) {
  await q("UPDATE venue_kb SET text = $1 WHERE id = 1", [text]);
}

/* ---------- artists ---------- */
export async function upsertArtist(id, fields, run = q) {
  const cols = [], vals = [];
  for (const [k, col] of Object.entries(ARTIST_COLS)) {
    if (!(k in fields) || fields[k] === undefined) continue;
    let v = fields[k];
    if (["unavailableDates", "blackouts", "lastCompanions", "photos"].includes(k)) v = JSON.stringify(v || []);
    cols.push(col); vals.push(v);
  }
  if (!cols.length) return id;
  // Update in place if the artist already exists; only insert a fresh row otherwise.
  // (A blanket INSERT ... ON CONFLICT fails NOT NULL/CHECK on partial updates, because
  // Postgres validates the proposed insert row before resolving the conflict.)
  const existing = await run("SELECT 1 FROM artists WHERE id = $1", [id]);
  if (existing.length) {
    const sets = cols.map((c, j) => `${c} = $${j + 2}`);
    await run(`UPDATE artists SET ${sets.join(", ")}, updated = now() WHERE id = $1`, [id, ...vals]);
  } else {
    await run(
      `INSERT INTO artists (id, ${cols.join(",")}, updated) VALUES ($1, ${cols.map((_, j) => `$${j + 2}`).join(",")}, now())`,
      [id, ...vals]
    );
  }
  return id;
}

export async function findArtistByEmail(email) {
  const rows = await q("SELECT * FROM artists WHERE lower(email) = lower($1) LIMIT 1", [email]);
  return rows[0] ? artistFromRow(rows[0]) : null;
}

export async function getArtist(id) {
  const rows = await q("SELECT * FROM artists WHERE id = $1", [id]);
  return rows[0] ? artistFromRow(rows[0]) : null;
}

export async function deleteArtist(id) {
  // Two-step delete is enforced at the route/UI level; history (requests) is retained
  // via ON DELETE SET NULL. Pings and rec_passes cascade.
  await q("DELETE FROM artists WHERE id = $1", [id]);
}

// Move all references (requests, pings, rec passes) from one artist to another.
// Used by the merge tool before deleting the merged-away record.
export async function reassignArtistRefs(fromId, toId) {
  await q("UPDATE requests SET artist_id = $1 WHERE artist_id = $2", [toId, fromId]);
  await q("UPDATE pings SET artist_id = $1 WHERE artist_id = $2", [toId, fromId]);
  // Keep target's existing passes; move only dates it doesn't already have. The
  // rest disappear with the source record (rec passes auto-purge anyway).
  await q("UPDATE rec_passes SET artist_id = $1 WHERE artist_id = $2 AND date NOT IN (SELECT date FROM rec_passes WHERE artist_id = $1)", [toId, fromId]);
}

/* ---------- requests ---------- */
export async function insertRequest(r, run = q) {
  const id = r.id || uid();
  await run(
    `INSERT INTO requests (id, artist_id, date, event_type, name, email, city, set_type, slot_pref, slot_time, booking_pref, recording, notes, guest, status, source)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
    [id, r.artistId, r.date, r.eventType, r.name, r.email, r.city, r.setType, r.slotPref || "any", r.slotTime || null, r.bookingPref, r.recording || "none", r.notes || "", !!r.guest, r.status || "pending", r.source || "app"]
  );
  return id;
}

export async function updateRequest(id, fields, run = q) {
  const map = {
    status: "status", slotTime: "slot_time", declineReason: "decline_reason",
    auto: "auto", autoReason: "auto_reason", cancelledBy: "cancelled_by",
  };
  const sets = [], vals = [];
  let i = 1;
  for (const [k, col] of Object.entries(map)) {
    if (!(k in fields)) continue;
    sets.push(`${col} = $${i++}`); vals.push(fields[k]);
  }
  if (fields.cancelledBy) sets.push("cancelled_at = now()");
  if (!sets.length) return;
  vals.push(id);
  await run(`UPDATE requests SET ${sets.join(",")} WHERE id = $${i}`, vals);
}

export async function getRequest(id) {
  const rows = await q("SELECT * FROM requests WHERE id = $1", [id]);
  return rows[0] ? requestFromRow(rows[0]) : null;
}

/* ---------- nights ---------- */
export async function upsertNight(date, fields, run = q) {
  const cur = (await run("SELECT * FROM nights WHERE date = $1", [date]))[0];
  const next = {
    closed: fields.closed ?? cur?.closed ?? false,
    writers_override: "writersOverride" in fields ? fields.writersOverride : cur?.writers_override ?? null,
    manual_slots: JSON.stringify(fields.slots ?? cur?.manual_slots ?? []),
    note: fields.note ?? cur?.note ?? null,
  };
  await run(
    `INSERT INTO nights (date, closed, writers_override, manual_slots, note, updated)
     VALUES ($1,$2,$3,$4,$5, now())
     ON CONFLICT (date) DO UPDATE SET closed=$2, writers_override=$3, manual_slots=$4, note=$5, updated=now()`,
    [date, next.closed, next.writers_override, next.manual_slots, next.note]
  );
}

/* ---------- drafts ---------- */
export async function addDraft({ to, subject, body, kind, label, reqId }) {
  const id = uid();
  await q(
    "INSERT INTO drafts (id, to_email, subject, body, kind, label, req_id) VALUES ($1,$2,$3,$4,$5,$6,$7)",
    [id, to || null, subject, body, kind, label || null, reqId || null]
  );
  // UI cap: archive everything past the 50 most recent (retained in DB)
  await q(`UPDATE drafts SET archived = TRUE WHERE archived = FALSE AND id NOT IN
           (SELECT id FROM drafts WHERE archived = FALSE ORDER BY ts DESC LIMIT 50)`);
  const [row] = await q("SELECT * FROM drafts WHERE id = $1", [id]);
  return draftFromRow(row);
}

export async function listDrafts() {
  return (await q("SELECT * FROM drafts WHERE archived = FALSE ORDER BY ts DESC LIMIT 50")).map(draftFromRow);
}

/* ---------- pings ---------- */
export async function addPing(artistId, message, dateISO) {
  const id = uid();
  await q("INSERT INTO pings (id, artist_id, message, date_iso) VALUES ($1,$2,$3,$4)", [id, artistId, message, dateISO || null]);
  return id;
}

export async function pingsFor(artistId) {
  return (await q("SELECT * FROM pings WHERE artist_id = $1 ORDER BY ts DESC", [artistId]))
    .map((r) => ({ id: r.id, msg: r.message, dateISO: r.date_iso, read: !!r.read, ts: r.ts }));
}

/* ---------- escalations ---------- */
export async function addEscalation({ question, contact, summary }) {
  const id = uid();
  await q("INSERT INTO escalations (id, question, contact, summary) VALUES ($1,$2,$3,$4)", [id, question, contact || null, summary || null]);
  return id;
}

/* ---------- rec passes ---------- */
export async function addRecPass(artistId, date) {
  await q("INSERT INTO rec_passes (artist_id, date) VALUES ($1,$2) ON CONFLICT DO NOTHING", [artistId, date]);
}
export async function clearRecPasses(artistId) {
  await q("DELETE FROM rec_passes WHERE artist_id = $1", [artistId]);
}
export async function purgePastRecPasses(today) {
  await q("DELETE FROM rec_passes WHERE date < $1", [today]); // auto-purge once the date passes
}

/* ---------- audit ---------- */
export async function audit(actor, action, entity, entityId, detail) {
  await q("INSERT INTO audit_log (actor, action, entity, entity_id, detail) VALUES ($1,$2,$3,$4,$5)",
    [actor, action, entity || null, entityId || null, detail ? JSON.stringify(detail) : null]);
}

export { uid, tx, q };
