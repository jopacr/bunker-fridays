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
// One new artist max per night, preferred for the first slot. Pass 1 avoids
// candidates whose last bill shared members with this bill. Writers Rounds
// included, non-originals artists omitted. Confirmed artists seed the companion check.

import { fridaysAhead, parseISO, daysBetween, fmtLong } from "./dates.js";
import { entriesFor, writersNight, artistUnavailableOn, isLocal, artistIsLocal, SLOT_TIMES } from "./rules.js";

export function runRecommendations(snap, cfg, weeks, today) {
  const recPasses = snap.recPasses || {};

  // Every booked date per artist: past plays, future confirmations from app
  // requests, manual/imported calendar slots (matched by name), imported last-played.
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

  const pool = Object.values(snap.artists).map((a) => {
    const booked = new Set(bookedByName[(a.name || "").toLowerCase()] || []);
    if (a.importedLastPlayed) booked.add(a.importedLastPlayed);
    let last = "";
    booked.forEach((d) => { if (d < today && d > last) last = d; });
    return {
      id: a.id, name: a.name, email: a.email || "", phone: a.phone || "",
      account: !!a.account,
      single: a.bookingPref === "single",
      isNew: booked.size === 0,
      local: artistIsLocal(a, snap.localCities),
      canO: String(a.originalsSets ?? "").trim() !== "0",
      canC: String(a.coversSets ?? "").trim() !== "0",
      base: (a.talentScore || 0) + (a.drawScore || 0),
      booked,
      raw: a,
      companions: a.lastCompanions || [],
      rec: 0,
    };
  });

  const nights = [];
  for (const dISO of fridaysAhead(weeks * 7, parseISO(today))) {
    const { entries, closed } = entriesFor(snap, dISO);
    if (closed) continue;
    const writers = writersNight(snap, dISO);
    const confirmed = entries.filter((e) => e.status === "confirmed");
    if (confirmed.length >= 3) continue;

    let slots = [];
    if (writers) {
      for (let k = confirmed.length; k < 3; k++) slots.push({ type: "originals", label: `Round seat ${k + 1}`, writers: true });
    } else {
      const takenTimes = new Set(confirmed.filter((e) => e.slotTime).map((e) => e.slotTime));
      const untimed = confirmed.filter((e) => !e.slotTime).length;
      const openTimes = SLOT_TIMES.filter((t) => !takenTimes.has(t)).slice(untimed);
      const origCap = 2 - confirmed.filter((e) => e.setType === "single-originals").length;
      const totalOpen = 3 - confirmed.length;
      // 9PM is the originals seat; a second originals (if capacity) goes to 10PM,
      // so 8PM stays a covers slot (covers preferred at 8PM).
      const origByTime = ["9PM", "10PM", "8PM"].filter((t) => openTimes.includes(t)).slice(0, Math.max(0, origCap));
      for (let k = 0; k < totalOpen; k++) {
        const time = openTimes[k] || "TBD";
        const type = origByTime.includes(time) ? "originals" : "covers";
        slots.push({ type, label: time, writers: false });
      }
    }

    const elig = pool.filter((a) => {
      if (a.single) return false;
      if (artistUnavailableOn(a.raw, dISO)) return false;
      if (recPasses[`${a.id}|${dISO}`]) return false;
      // Symmetric spacing: no booking (past OR future) within the window
      for (const b of a.booked) {
        if (Math.abs(daysBetween(dISO, b)) <= cfg.daysSincePlayed) return false;
      }
      return true;
    });

    // Artists already confirmed on this night count for the companion check
    const used = new Set(confirmed.map((e) => e.name));
    let usedNew = false, firstSlot = true, hasLocal = false, hasNew = false;
    const picks = [];

    for (const slot of slots) {
      let wantNew = firstSlot && elig.some((a) => a.isNew && !used.has(a.name));
      let best = null;
      const search = (avoidConflict, requireNew) => {
        for (const a of elig) {
          if (used.has(a.name)) continue;
          if (requireNew && !a.isNew) continue;
          if (usedNew && a.isNew) continue;
          if (slot.type === "covers" && !a.canC) continue;
          if (slot.type === "originals" && !a.canO) continue;
          if (avoidConflict && a.companions.some((c) => used.has(c))) continue;
          let sc = a.base;
          if (!hasLocal && a.local) sc += cfg.localBonus;
          if (!hasNew && a.isNew) sc += cfg.newArtistBonus;
          if (slot.type === "originals" && a.isNew) sc += cfg.newOriginalsBonus;
          sc -= a.rec * cfg.recencyPenalty;
          if (!best || sc > best.sc) best = { a, sc };
        }
      };
      search(true, wantNew); if (!best) search(false, wantNew);
      if (!best && wantNew) { search(true, false); if (!best) search(false, false); }

      if (best) {
        picks.push({ slot, name: best.a.name, score: Math.round(best.sc * 10) / 10, email: best.a.email, phone: best.a.phone, account: best.a.account, artistId: best.a.id, isNew: best.a.isNew, local: best.a.local });
        used.add(best.a.name);
        best.a.rec++; best.a.booked.add(dISO);
        if (best.a.isNew) { usedNew = true; hasNew = true; best.a.isNew = false; }
        if (best.a.local) hasLocal = true;
      } else {
        picks.push({ slot, name: null });
      }
      firstSlot = false;
    }
    nights.push({ dateISO: dISO, label: fmtLong(dISO), writers, picks });
  }
  return nights;
}
