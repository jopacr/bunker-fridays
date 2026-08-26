// Recommendation engine (§5): direct port of the venue's VBA module via the
// prototype's runRecommendations. Pure over a snapshot; deterministic given `today`.
//
// Per open slot: highest-scoring eligible artist where
//   score = talent + draw
//         + localBonus        (if no local on the bill yet)
//         + newArtistBonus    (if no new artist yet)
//         + newOriginalsBonus (new artist in an originals slot)
//         - recencyPenalty * (recommendations already made this run)
// Eligibility excludes: single-preference artists, passed (artist,date) pairs,
// blackout/unavailable dates, capability mismatches, and any booking (past play,
// future confirmation, manual or imported) within daysSincePlayed IN EITHER DIRECTION.
//
// Two additional tiers, tried only once the normal pool is exhausted for a slot:
//   1. Artists with a BLANK (not explicitly "0") set-type field for that slot's
//      style — capable in principle, just unconfirmed, so they're a last resort
//      rather than mixed in at equal priority with confirmed-capable artists.
//   2. Soft-passed artists for this date — deprioritized to the back of the
//      line rather than fully excluded (that's what a hard pass is for).
//
// One new artist max per night, preferred for the first slot. Pass 1 avoids
// candidates whose last bill shared members with this bill. Writers Rounds
// included, non-originals artists omitted. Confirmed artists seed the companion check.

import { fridaysAhead, parseISO, daysBetween, fmtLong } from "./dates.js";
import { entriesFor, writersNight, artistUnavailableOn, isLocal, artistIsLocal, SLOT_TIMES } from "./rules.js";

// Artist-level pool entry, independent of any particular date. Date-specific
// exclusions (blackout, passes, tentative, spacing) are applied separately by
// the caller for whichever date is in question.
export function buildPool(snap) {
  const bookedByName = {};
  const noteBooking = (name, dISO) => {
    if (!name) return;
    const k = name.toLowerCase();
    (bookedByName[k] = bookedByName[k] || new Set()).add(dISO);
  };
  snap.requests.forEach((r) => { if (r.status === "approved" && r.date) noteBooking(r.name, r.date); });
  Object.entries(snap.nights).forEach(([dISO, day]) => {
    (day.slots || []).forEach((s) => { if (s.status === "confirmed") noteBooking(s.name, dISO); });
  });

  return Object.values(snap.artists).map((a) => {
    const booked = new Set(bookedByName[(a.name || "").toLowerCase()] || []);
    if (a.importedLastPlayed) booked.add(a.importedLastPlayed);
    return {
      id: a.id, name: a.name, email: a.email || "", phone: a.phone || "",
      account: !!a.account,
      single: a.bookingPref === "single",
      isNew: booked.size === 0,
      local: artistIsLocal(a, snap.localCities),
      // canX: not explicitly "0" — still counted eligible for that style.
      // xClear: explicitly a non-blank value — vs a blank field, which is
      // eligible but goes into the "unclear" last-resort tier below.
      canO: String(a.originalsSets ?? "").trim() !== "0",
      canC: String(a.coversSets ?? "").trim() !== "0",
      oClear: String(a.originalsSets ?? "").trim() !== "",
      cClear: String(a.coversSets ?? "").trim() !== "",
      base: (a.talentScore || 0) + (a.drawScore || 0),
      booked,
      raw: a,
      companions: a.lastCompanions || [],
      rec: 0,
    };
  });
}

// Date-specific exclusion reasons for one artist. Used both to build the
// eligible pool for a given night and to power the "why isn't this artist
// showing up" diagnostic — one source of truth so the two can't drift apart.
function dateExclusions(snap, cfg, a, dISO, { includeSoftPass } = {}) {
  const recPasses = snap.recPasses || {};
  const softPasses = snap.softPasses || {};
  const tentatives = snap.tentatives || {};
  const reasons = [];
  if (a.single) reasons.push({ code: "single", blocking: true, message: "Booking preference is Single set, so they're excluded from recommendations. Switch them to Regular rotation on their card to include them again." });
  if (artistUnavailableOn(a.raw, dISO)) reasons.push({ code: "blackout", blocking: true, message: "They've blacked out this date, or it falls in a 2-week Stratford buffer." });
  if (recPasses[`${a.id}|${dISO}`]) reasons.push({ code: "hard-pass", blocking: true, message: "You've hard-passed on them for this specific date." });
  const isSoftPassed = !!softPasses[`${a.id}|${dISO}`];
  if (isSoftPassed) reasons.push({ code: "soft-pass", blocking: !includeSoftPass, message: "You've soft-passed on them for this date — deprioritized to a last resort, not excluded outright." });
  if (tentatives[`${a.id}|${dISO}`]) reasons.push({ code: "tentative", blocking: true, message: "They're already marked tentative for this date." });
  for (const b of a.booked) {
    const gap = Math.abs(daysBetween(dISO, b));
    if (gap <= cfg.daysSincePlayed) {
      reasons.push({ code: "spacing", blocking: true, message: `A booking on ${b} is only ${gap} day${gap === 1 ? "" : "s"} away — inside the ${cfg.daysSincePlayed}-day spacing window.`, conflictDate: b, gap });
      break;
    }
  }
  return { reasons, isSoftPassed };
}

function nightSlots(entries, confirmed, writers) {
  if (writers) {
    const slots = [];
    for (let k = confirmed.length; k < 3; k++) slots.push({ preferredType: "originals", label: `Round seat ${k + 1}`, writers: true });
    return slots;
  }
  const takenTimes = new Set(confirmed.filter((e) => e.slotTime).map((e) => e.slotTime));
  const untimed = confirmed.filter((e) => !e.slotTime).length;
  const openTimes = SLOT_TIMES.filter((t) => !takenTimes.has(t)).slice(untimed);
  const totalOpen = 3 - confirmed.length;
  // preferredType is a SOFT hint only, not a hard requirement: 9PM/10PM lean
  // originals, 8PM leans covers, per house convention. It nudges scoring and
  // decides how a flexible (both-capable) artist gets billed — it never
  // excludes a covers-only artist from a slot just because 9PM/10PM was the
  // "ideal" type for it. The real hard limit (max 2 originals/night) is
  // enforced separately via the originals budget in runRecommendations.
  const slots = [];
  for (let k = 0; k < totalOpen; k++) {
    const time = openTimes[k] || "TBD";
    const preferredType = (time === "9PM" || time === "10PM") ? "originals" : "covers";
    slots.push({ preferredType, label: time, writers: false });
  }
  return slots;
}

const ORIGINALS_PREFERENCE_BONUS = 1; // tie-breaker nudge toward filling originals capacity, never a hard requirement

// Runs the full 4-way (avoidConflict x requireNew) cascade against a pool,
// optionally allowing "unclear" (blank field) candidates for the slot's style.
// Eligibility here is deliberately soft on TYPE: a covers-only artist is never
// excluded just because 9PM/10PM is the "ideal" slot for originals — the only
// hard constraint is the night's originals budget (max 2/night, tracked in
// ctx.originalsBudget). Once that budget is used up, only covers-capable
// artists remain eligible for whatever's left, since there's nowhere left to
// put an originals-only artist.
function searchPass(elig, slot, ctx, allowUnclear) {
  let best = null;
  const run = (avoidConflict, requireNew) => {
    for (const a of elig) {
      if (ctx.used.has(a.name)) continue;
      if (requireNew && !a.isNew) continue;
      if (ctx.usedNew && a.isNew) continue;

      let capable, clear;
      if (slot.writers) {
        capable = a.canO; clear = a.oClear;
      } else if (ctx.originalsBudget > 0) {
        capable = a.canO || a.canC;
        clear = (a.canO && a.oClear) || (a.canC && a.cClear);
      } else {
        capable = a.canC; clear = a.cClear;
      }
      if (!capable) continue;
      if (!clear && !allowUnclear) continue;
      if (avoidConflict && a.companions.some((c) => ctx.used.has(c))) continue;

      let sc = a.base;
      if (!ctx.hasLocal && a.local) sc += ctx.cfg.localBonus;
      if (!ctx.hasNew && a.isNew) sc += ctx.cfg.newArtistBonus;
      const wouldPreferOriginals = !slot.writers && ctx.originalsBudget > 0 && slot.preferredType === "originals" && a.canO;
      if (wouldPreferOriginals) sc += ORIGINALS_PREFERENCE_BONUS;
      if ((slot.writers || wouldPreferOriginals) && a.isNew) sc += ctx.cfg.newOriginalsBonus;
      sc -= a.rec * ctx.cfg.recencyPenalty;
      if (!best || sc > best.sc) best = { a, sc, unclear: !clear };
    }
  };
  run(true, ctx.wantNew); if (best) return best;
  run(false, ctx.wantNew); if (best) return best;
  if (ctx.wantNew) {
    run(true, false); if (best) return best;
    run(false, false); if (best) return best;
  }
  return null;
}

// Clear-capability candidates first; only if that whole cascade finds nobody
// do we retry allowing blank/unclear-capability candidates for this slot.
function findBest(elig, slot, ctx) {
  return searchPass(elig, slot, ctx, false) || searchPass(elig, slot, ctx, true);
}

export function runRecommendations(snap, cfg, weeks, today) {
  const pool = buildPool(snap);

  const nights = [];
  for (const dISO of fridaysAhead(weeks * 7, parseISO(today))) {
    const { entries, closed } = entriesFor(snap, dISO);
    if (closed) continue;
    const writers = writersNight(snap, dISO);
    const confirmed = entries.filter((e) => e.status === "confirmed");
    if (confirmed.length >= 3) continue;

    const slots = nightSlots(entries, confirmed, writers);

    // Two pools for this night: strict (no soft-passed) and, only as a
    // fallback per slot, one that also allows soft-passed candidates.
    const eligStrict = [];
    const eligWithSoft = [];
    pool.forEach((a) => {
      const { reasons, isSoftPassed } = dateExclusions(snap, cfg, a, dISO, { includeSoftPass: true });
      const hardBlocked = reasons.some((r) => r.blocking && r.code !== "soft-pass");
      if (hardBlocked) return;
      eligWithSoft.push(a);
      if (!isSoftPassed) eligStrict.push(a);
    });

    // Artists already confirmed on this night count for the companion check
    const used = new Set(confirmed.map((e) => e.name));
    let usedNew = false, firstSlot = true, hasLocal = false, hasNew = false;
    // Hard limit: max 2 originals sets per night (the $50 guarantee makes a
    // 3rd too costly). Everything else about originals is a soft preference.
    let originalsBudget = 2 - confirmed.filter((e) => e.setType === "single-originals").length;
    const picks = [];

    for (const slot of slots) {
      const wantNew = firstSlot && eligStrict.some((a) => a.isNew && !used.has(a.name));
      const ctx = { used, usedNew, hasLocal, hasNew, wantNew, cfg, originalsBudget };
      let best = findBest(eligStrict, slot, ctx);
      let softPick = false;
      if (!best) { best = findBest(eligWithSoft, slot, ctx); softPick = !!best; }

      if (best) {
        // Decide what this pick is actually billed as, now that we know who
        // it is. An originals-only artist has to go originals (eligibility
        // already confirmed the budget allows it). Otherwise, only bill them
        // as originals if budget remains AND this was an originals-leaning
        // slot (9PM/10PM) — covers-preferred slots (8PM) and exhausted budget
        // both fall back to covers, never to excluding the artist outright.
        let assignedType;
        if (slot.writers) assignedType = "originals";
        else if (!best.a.canC) assignedType = "originals";
        else if (originalsBudget > 0 && best.a.canO && slot.preferredType === "originals") assignedType = "originals";
        else assignedType = "covers";
        if (assignedType === "originals") originalsBudget--;

        picks.push({
          slot: { ...slot, type: assignedType }, name: best.a.name, score: Math.round(best.sc * 10) / 10,
          email: best.a.email, phone: best.a.phone, account: best.a.account,
          artistId: best.a.id, isNew: best.a.isNew, local: best.a.local,
          unclearSetType: best.unclear, softPassed: softPick,
        });
        used.add(best.a.name);
        best.a.rec++; best.a.booked.add(dISO);
        if (best.a.isNew) { usedNew = true; hasNew = true; best.a.isNew = false; }
        if (best.a.local) hasLocal = true;
      } else {
        picks.push({ slot: { ...slot, type: slot.preferredType }, name: null });
      }
      firstSlot = false;
    }
    nights.push({ dateISO: dISO, label: fmtLong(dISO), writers, picks });
  }
  return nights;
}

// Diagnostic: why is (or isn't) this artist eligible for this date? Mirrors
// the same exclusion checks runRecommendations uses, so it can't drift out of
// sync with real behavior. Returns date-level reasons plus, if the artist is
// otherwise eligible, a per-style capability note.
export function explainEligibility(snap, cfg, artistId, dISO) {
  const pool = buildPool(snap);
  const a = pool.find((x) => x.id === artistId);
  if (!a) return { found: false };

  const { reasons } = dateExclusions(snap, cfg, a, dISO, { includeSoftPass: true });
  const blocked = reasons.filter((r) => r.blocking);
  const notes = reasons.filter((r) => !r.blocking);

  const styleNotes = [];
  if (!a.canO) styleNotes.push("Marked as unable to play an originals set (0 original sets on file).");
  else if (!a.oClear) styleNotes.push("Originals capability is blank/unconfirmed — still eligible, but only offered for an originals slot after every artist with a confirmed originals count has been considered.");
  if (!a.canC) styleNotes.push("Marked as unable to play a covers set (0 cover sets on file).");
  else if (!a.cClear) styleNotes.push("Covers capability is blank/unconfirmed — still eligible, but only offered for a covers slot after every artist with a confirmed covers count has been considered.");

  return {
    found: true,
    name: a.name,
    eligibleForDate: blocked.length === 0,
    blockedReasons: blocked,
    notes,
    styleNotes,
    canOriginals: a.canO, canCovers: a.canC,
    originalsClear: a.oClear, coversClear: a.cClear,
  };
}
