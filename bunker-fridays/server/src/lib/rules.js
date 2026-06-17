// The canon (spec §4) as pure functions over a state snapshot:
//   snap = { artists: {id: artist}, requests: [request], nights: {dateISO: night}, localCities? }
// Field names are the prototype's camelCase; the store layer maps to/from SQL.
// Every function takes `today` (YYYY-MM-DD) explicitly so tests are deterministic.

import { parseISO, addDays, daysBetween, isLastFridayOfMonth, fridaysAhead, fmtLong } from "./dates.js";

export const MAX_PER_NIGHT = 2;
export const AUTO_DECLINE_DAYS = 28;
export const SLOT_TIMES = ["8PM", "9PM", "10PM"];
export const MAX_PHOTOS = 4;

export const EVENT_TYPES = { FRIDAY: "friday", WRITERS: "writers-round", SNL: "snl" };

export const SET_LABELS = {
  "single-originals": "Originals set ($50 guarantee)",
  covers: "Covers set",
  "writers-round": "Writers Round",
  other: "Set",
};

/* Towns within roughly a 20-minute drive of Stratford. Configurable: a non-null
   localCities list on the snapshot (venue_kb.local_cities) replaces this default. */
export const DEFAULT_LOCAL_CITIES = ["stratford", "sebringville", "shakespeare", "tavistock", "mitchell", "milverton", "st. marys", "st marys", "new hamburg", "gads hill", "gadshill", "st. pauls", "st pauls", "avonton", "amulree", "wartburg", "harmony", "fullarton", "rostock", "brunner"];

export function isLocal(city, localCities) {
  if (!city) return false;
  const c = city.toLowerCase();
  return (localCities || DEFAULT_LOCAL_CITIES).some((l) => c.includes(l));
}

/** Writers Round: last Friday of the month by default, per-night override wins everywhere. */
export function writersNight(snap, dISO) {
  const ov = snap.nights[dISO];
  if (ov && typeof ov.writersOverride === "boolean") return ov.writersOverride;
  return isLastFridayOfMonth(dISO);
}

/** Manual slots + live app requests for a night. */
export function entriesFor(snap, dateISO) {
  const ov = snap.nights[dateISO] || {};
  const manual = (ov.slots || []).map((s) => ({ ...s, manual: true }));
  const reqs = snap.requests
    .filter((r) => r.date === dateISO && (r.status === "pending" || r.status === "approved"))
    .map((r) => ({ name: r.name, setType: r.setType, status: r.status === "approved" ? "confirmed" : "pending", slotTime: r.slotTime || null, reqId: r.id }));
  return { entries: [...manual, ...reqs], closed: !!ov.closed, note: ov.note || "" };
}

export function takenSlots(snap, dateISO) {
  const { entries } = entriesFor(snap, dateISO);
  const s = new Set();
  entries.forEach((e) => { if (e.status === "confirmed" && e.slotTime) s.add(e.slotTime); });
  return s;
}

export function perNightCount(snap, artistId, email, dateISO) {
  return snap.requests.filter((r) =>
    (r.artistId === artistId || (email && r.email && r.email.toLowerCase() === email.toLowerCase())) &&
    (r.status === "pending" || r.status === "approved") &&
    r.date === dateISO
  ).length;
}

/** Returns the blocking confirmed date if dateISO falls within AUTO_DECLINE_DAYS of a
    confirmed booking on EITHER side (we space an artist's sets ~4 weeks apart). A second
    set on the SAME night is allowed (diff 0), so only non-zero gaps inside the window block. */
export function cooldownBlock(snap, artistId, email, dateISO) {
  const hit = snap.requests.find((r) => {
    if (r.status !== "approved" || !r.date) return false;
    if (!(r.artistId === artistId || (email && r.email && r.email.toLowerCase() === email.toLowerCase()))) return false;
    const diff = Math.abs(daysBetween(dateISO, r.date));
    return diff > 0 && diff <= AUTO_DECLINE_DAYS;
  });
  return hit ? hit.date : null;
}

export function hasPlayed(snap, artistId, today) {
  if (snap.artists[artistId]?.importedLastPlayed) return true;
  // A confirmed date (past OR future) means they're no longer a new inquiry.
  return snap.requests.some((r) => r.artistId === artistId && r.status === "approved" && r.date);
}

/* An artist is local when their city is within ~20 min of Stratford, or (for
   imported artists whose real city we don't have) when the workbook flagged them. */
export function artistIsLocal(a, localCities) {
  if (a && a.city && String(a.city).trim()) return isLocal(a.city, localCities);
  return !!(a && a.local);
}

/** Effective unavailability: imported dates + self-set blackouts.
    A Stratford-gig blackout blocks 14 days either side at the Bunker; "other" blocks the date. */
export function artistUnavailableOn(a, dISO) {
  if ((a.unavailableDates || []).includes(dISO)) return true;
  for (const b of (a.blackouts || [])) {
    if (b.reason === "stratford") {
      if (Math.abs(daysBetween(dISO, b.date)) <= 14) return true;
    } else if (b.date === dISO) return true;
  }
  return false;
}

/** Up to n upcoming open Fridays for follow-up email suggestions, filtered to the artist's set type. */
export function suggestFridays(snap, excludeISO, setType, n = 3, today) {
  const out = [];
  for (const dISO of fridaysAhead(120, today ? parseISO(today) : undefined)) {
    if (dISO === excludeISO) continue;
    const { entries, closed } = entriesFor(snap, dISO);
    if (closed) continue;
    const confirmed = entries.filter((e) => e.status === "confirmed");
    if (confirmed.length >= 3) continue;
    const writers = writersNight(snap, dISO);
    if (setType === "single-originals" && !writers) {
      const origs = confirmed.filter((e) => e.setType === "single-originals").length;
      if (origs >= 2) continue;
    }
    if (setType === "covers" && writers) continue;
    out.push({ dateISO: dISO, label: fmtLong(dISO), writers });
    if (out.length >= n) break;
  }
  return out;
}

/* ---------- request validation (server-authoritative) ----------
   All fields required except: sample links, notes, photos, and non-chosen
   contact handles; the chosen contact method's field becomes required.
   Returns { ok, missing[] } for field-level issues. */
export function validateRequestFields(f, writers) {
  const m = [];
  const noOriginals = String(f.originalsSets ?? "").trim() === "0";
  const noCovers = String(f.coversSets ?? "").trim() === "0";
  if (!String(f.name || "").trim()) m.push("performer or group name");
  if (!String(f.email || "").trim() || !String(f.email).includes("@")) m.push("email");
  if ((f.contactMethod === "Phone" || f.contactMethod === "Text") && !String(f.phone || "").trim()) m.push("phone (your chosen contact method)");
  if (f.contactMethod === "Instagram" && !String(f.instagram || "").trim()) m.push("Instagram handle (your chosen contact method)");
  if (f.contactMethod === "Facebook" && !String(f.facebook || "").trim()) m.push("Facebook handle (your chosen contact method)");
  if (!String(f.genre || "").trim()) m.push("genre");
  if (String(f.originalsSets ?? "").trim() === "") m.push("# of original sets");
  if (String(f.coversSets ?? "").trim() === "") m.push("# of cover sets");
  if (!String(f.city || "").trim()) m.push("home city");
  if (!String(f.bio || "").trim()) m.push("biography");
  if (!writers && !f.setType) m.push("set type");
  if (!writers && f.setType === "single-originals" && noOriginals) m.push("an available set type (you listed 0 original sets)");
  if (!writers && f.setType === "covers" && noCovers) m.push("an available set type (you listed 0 cover sets)");
  if (!writers && noOriginals && noCovers) m.push("at least 1 original or cover set in your counts");
  if (writers && noOriginals) m.push("original material (Writers Round is originals only, but you listed 0 original sets)");
  if (!["single", "rotation"].includes(f.bookingPref)) m.push("booking preference (single or rotation)");
  if (writers && !f.songsReady) m.push("12 to 15 originals confirmation");
  if (String(f.etransferEmail || "").trim() && !String(f.etransferEmail).includes("@")) m.push("a valid e-transfer email");
  if (!["any", ...SLOT_TIMES].includes(f.slotPref || "any")) m.push("a valid slot preference");
  if (!["none", "board-tape", "full-tracks"].includes(f.recording || "none")) m.push("a valid recording option");
  return { ok: m.length === 0, missing: m };
}

/** Full submission gate. Returns { ok } or { ok: false, code, message }. */
export function checkSubmission(snap, { artistId, email, dateISO, setType }, today) {
  if (!dateISO || parseISO(dateISO).getUTCDay() !== 5) {
    return { ok: false, code: "not-friday", message: "Friday Night Sessions run on Fridays. Pick a Friday." };
  }
  if (dateISO < today) return { ok: false, code: "past", message: "That date has already passed." };
  const { closed, entries } = entriesFor(snap, dateISO);
  if (closed) return { ok: false, code: "closed", message: "That night is closed. Pick another Friday." };
  const writers = writersNight(snap, dateISO);
  if (writers && setType !== "writers-round") {
    return { ok: false, code: "writers-night", message: "That Friday is a Writers Round (originals only)." };
  }
  if (!writers && setType === "writers-round") {
    return { ok: false, code: "not-writers", message: "That Friday is a standard session, not a Writers Round." };
  }
  if (!writers && setType === "single-originals") {
    const origs = entries.filter((e) => e.status === "confirmed" && e.setType === "single-originals").length;
    if (origs >= 2) return { ok: false, code: "originals-full", message: "Both originals slots are taken that night. A covers set is still open." };
  }
  if (perNightCount(snap, artistId, email, dateISO) >= MAX_PER_NIGHT) {
    return { ok: false, code: "per-night", message: `You already have ${MAX_PER_NIGHT} active requests for this night, which is the maximum. Other Fridays are open.` };
  }
  const blockDate = cooldownBlock(snap, artistId, email, dateISO);
  if (blockDate) {
    if (dateISO < blockDate) {
      return { ok: false, code: "cooldown", blockDate, message: `You're already confirmed for ${fmtLong(blockDate)}, which is within about 4 weeks. We space your sets a month apart, so this date is too close.` };
    }
    const reopen = addDays(blockDate, AUTO_DECLINE_DAYS + 1);
    return { ok: false, code: "cooldown", blockDate, message: `You're confirmed for ${fmtLong(blockDate)}. New dates open up from ${fmtLong(reopen)}.` };
  }
  return { ok: true, writers };
}

/** Confirming a request: validates the slot, returns the auto-decline set.
    Auto-declines that artist's other PENDING requests dated within AUTO_DECLINE_DAYS
    AFTER the confirmed date (same-night second set survives). */
export function planConfirmation(snap, requestId, slotTime) {
  const target = snap.requests.find((r) => r.id === requestId);
  if (!target) return { ok: false, code: "not-found", message: "Request not found." };
  if (target.setType !== "writers-round") {
    if (!SLOT_TIMES.includes(slotTime)) return { ok: false, code: "slot-required", message: "Confirming requires choosing a slot time." };
    if (takenSlots(snap, target.date).has(slotTime)) {
      return { ok: false, code: "slot-taken", message: `The ${slotTime} set is already confirmed for that night. Pick another slot.` };
    }
  } else {
    slotTime = null; // Writers Round confirms without a slot time
  }
  const autoDecline = snap.requests.filter((r) => {
    if (r.id === requestId || r.artistId !== target.artistId || r.status !== "pending" || !r.date) return false;
    const diff = Math.abs(daysBetween(r.date, target.date));
    return diff > 0 && diff <= AUTO_DECLINE_DAYS; // within 4 weeks either side; same night survives
  }).map((r) => r.id);
  return { ok: true, target, slotTime, autoDecline, autoReason: fmtLong(target.date) };
}

/** Night quality score: raw Talent + Draw of the confirmed bill. 0 counts; null is unrated.
    Never includes recommendation bonuses. */
export function nightScore(snap, dateISO) {
  const { entries } = entriesFor(snap, dateISO);
  const confirmed = entries.filter((e) => e.status === "confirmed");
  if (confirmed.length === 0) return null;
  let total = 0;
  confirmed.forEach((e) => {
    let a = null;
    if (e.reqId) {
      const r = snap.requests.find((x) => x.id === e.reqId);
      a = r ? snap.artists[r.artistId] : null;
    }
    if (!a) a = Object.values(snap.artists).find((x) => (x.name || "").toLowerCase() === (e.name || "").toLowerCase()) || null;
    if (a) total += (a.talentScore || 0) + (a.drawScore || 0);
  });
  return total;
}

/** Badges for an inbox card / artist row. */
export function badges(snap, { artistId, city, bookingPref, guest }, today) {
  const a = snap.artists[artistId] || {};
  const out = [];
  if (guest) out.push("GUEST");
  if (!hasPlayed(snap, artistId, today)) out.push("NEW");
  if (artistIsLocal({ ...a, city: city || a.city }, snap.localCities)) out.push("LOCAL");
  if (bookingPref === "rotation") out.push("REGULAR");
  if (bookingPref === "single") out.push("SINGLE");
  return out;
}
