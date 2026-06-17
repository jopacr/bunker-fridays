// Workbook import/export (§7). Matches the VBA Booking Recommendations layout:
//   Artists:  A=Name B=Status C=Local D=CanOriginals E=CanCovers
//             F=TalentScore G=DrawScore H=(unused) I=LastPlayed J=Notes K=UnavailableDates
//   Bookings: A=Date B=SlotType C=ManualArtist D=Recommendation E=Score
// Import upserts by name; per-date workbook rows replace prior workbook-sourced
// rows so re-import is idempotent AND double sets import as two slots.
// Pure: takes a snapshot + parsed rows, returns { artists, nights, stats }.

import * as XLSX from "xlsx";
import { iso, todayISO } from "./dates.js";

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

const toISO = (v) => {
  if (v instanceof Date && !isNaN(v)) return iso(v);
  if (typeof v === "string" && /\d{4}-\d{2}-\d{2}/.test(v.trim())) return v.trim().slice(0, 10);
  if (typeof v === "string" && v.trim() && !isNaN(Date.parse(v))) return new Date(Date.parse(v)).toISOString().slice(0, 10);
  return null;
};
const yes = (v) => String(v || "").trim().toLowerCase() === "yes";

export function parseWorkbook(buffer) {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = (n) => (wb.Sheets[n] ? XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1 }) : null);
  return { artists: sheet("Artists"), bookings: sheet("Bookings") };
}

export function applyWorkbook(snap, { artists: artistRows, bookings: bookingRows }, today = todayISO()) {
  const arts = {};
  Object.entries(snap.artists).forEach(([id, a]) => { arts[id] = { ...a }; });
  const byName = {};
  Object.values(arts).forEach((a) => { byName[(a.name || "").toLowerCase()] = a.id; });
  let importedArtists = 0;

  if (artistRows) {
    for (let i = 1; i < artistRows.length; i++) {
      const r = artistRows[i] || [];
      const name = String(r[0] || "").trim();
      if (!name) continue;
      const status = String(r[1] || "").trim().toLowerCase();
      let id = byName[name.toLowerCase()];
      if (!id) { id = newId(); byName[name.toLowerCase()] = id; }
      const prev = arts[id] || {};
      const unav = [];
      [r[10], r[11]].forEach((cell) => {
        if (cell == null || cell === "") return;
        String(cell instanceof Date ? iso(cell) : cell).split(",").forEach((tok) => {
          const dd = toISO(tok.trim());
          if (dd) unav.push(dd);
        });
      });
      // The workbook's "Local" column (C) is a flag, not a city. Earlier builds
      // wrongly wrote "Stratford" as the city for locals; clean that here and keep
      // the flag separately. Real cities (from app accounts) are preserved.
      const wasFabricated = prev.city === "Stratford" && !prev.account && /workbook/i.test(prev.source || "");
      arts[id] = {
        ...prev,
        id, name,
        bookingPref: status === "single" ? "single" : status === "regular" ? "rotation" : prev.bookingPref || null,
        city: wasFabricated ? "" : (prev.city || ""),
        local: yes(r[2]) || prev.local || false,
        originalsSets: prev.originalsSets ?? (yes(r[3]) ? "1" : "0"),
        coversSets: prev.coversSets ?? (yes(r[4]) ? "1" : "0"),
        talentScore: Number(r[5]) || prev.talentScore || 0,
        drawScore: Number(r[6]) || prev.drawScore || 0,
        importedLastPlayed: toISO(r[8]) || prev.importedLastPlayed || "",
        adminNotes: prev.adminNotes || (r[9] ? String(r[9]).trim() : ""),
        unavailableDates: unav.length ? unav : (prev.unavailableDates || []),
        source: prev.source || "workbook import",
      };
      importedArtists++;
    }
  }

  const nights = {};
  Object.entries(snap.nights).forEach(([d, n]) => { nights[d] = { ...n, slots: [...(n.slots || [])] }; });
  const wbTouched = new Set();
  let importedBookings = 0, closedNights = 0;
  const playedByDate = {}; // dateISO -> [names], for companions

  if (bookingRows) {
    for (let i = 1; i < bookingRows.length; i++) {
      const r = bookingRows[i] || [];
      const dISO = toISO(r[0]);
      if (!dISO) continue;
      const slot = String(r[1] || "").trim().toLowerCase();
      const name = String(r[2] || "").trim();
      if (!name) continue;
      if (dISO < today) {
        (playedByDate[dISO] = playedByDate[dISO] || []).push(name);
        const id = byName[name.toLowerCase()];
        if (id && (!arts[id].importedLastPlayed || dISO > arts[id].importedLastPlayed)) {
          arts[id].importedLastPlayed = dISO;
        }
      } else {
        if (name.toLowerCase() === "closed") {
          nights[dISO] = { ...(nights[dISO] || { slots: [] }), closed: true };
          closedNights++;
          continue;
        }
        if (name.toLowerCase() === "none" || name.toLowerCase() === "tbd") continue; // junk names skipped
        const day = nights[dISO] || { slots: [] };
        // First workbook row touching this date clears prior workbook-sourced slots:
        // re-imports stay clean AND double sets (two rows, same artist) become two slots.
        if (!wbTouched.has(dISO)) {
          day.slots = (day.slots || []).filter((s) => s.source !== "workbook import");
          wbTouched.add(dISO);
        }
        // House slot-time convention while the workbook is in use:
        // covers→8PM, originals→9PM then 10PM. Fall back to any open time.
        const usedTimes = new Set((day.slots || []).map((s) => s.slotTime).filter(Boolean));
        let slotTime = null;
        const prefer = slot === "originals" ? ["9PM", "10PM", "8PM"] : ["8PM", "9PM", "10PM"];
        for (const t of prefer) { if (!usedTimes.has(t)) { slotTime = t; break; } }
        day.slots = [...(day.slots || []), {
          name,
          setType: slot === "originals" ? "single-originals" : "covers",
          status: "confirmed", slotTime, source: "workbook import",
        }];
        nights[dISO] = day;
        importedBookings++;
      }
    }
  }

  // Last companions: from each artist's most recent past bill
  Object.values(arts).forEach((a) => {
    const lp = a.importedLastPlayed;
    if (lp && playedByDate[lp] && playedByDate[lp].some((n) => n.toLowerCase() === (a.name || "").toLowerCase())) {
      a.lastCompanions = playedByDate[lp].filter((n) => n.toLowerCase() !== (a.name || "").toLowerCase());
    }
  });

  return { artists: arts, nights, stats: { importedArtists, importedBookings, closedNights } };
}

/** Export mirrors the database back into the macro's exact layout. */
export function buildExportWorkbook(snap, helpers, today) {
  const { isLocal, entriesFor, writersNight, fridaysAhead } = helpers;

  const artistRows = [["Name", "Status", "Local", "CanOriginals", "CanCovers", "TalentScore", "DrawScore", "", "LastPlayed", "", "UnavailableDates"]];
  Object.values(snap.artists).forEach((a) => {
    const played = snap.requests
      .filter((r) => r.artistId === a.id && r.status === "approved" && r.date && r.date < today)
      .map((r) => r.date).sort();
    let last = played.length ? played[played.length - 1] : (a.importedLastPlayed || "");
    if (a.importedLastPlayed && a.importedLastPlayed > last) last = a.importedLastPlayed;
    const status = a.bookingPref === "single" ? "single" : (last ? "regular" : "new");
    const canO = String(a.originalsSets ?? "").trim() !== "0" ? "yes" : "no";
    const canC = String(a.coversSets ?? "").trim() !== "0" ? "yes" : "no";
    const localYes = (a.city && String(a.city).trim()) ? isLocal(a.city, snap.localCities) : !!a.local;
    artistRows.push([
      a.name, status, localYes ? "yes" : "no", canO, canC,
      a.talentScore || 0, a.drawScore || 0, "", last, "", (a.unavailableDates || []).join(","),
    ]);
  });

  const bookingRows = [["Date", "SlotType", "ManualArtist", "Recommendation", "Score"]];
  for (const dISO of fridaysAhead(120)) {
    if (writersNight(dISO)) continue; // Writers Rounds are curated by hand
    const { entries, closed } = entriesFor(dISO);
    if (closed) continue;
    const confirmed = entries.filter((e) => e.status === "confirmed");
    let origCap = 2 - confirmed.filter((e) => e.setType === "single-originals").length;
    confirmed.forEach((e) => {
      bookingRows.push([dISO, e.setType === "single-originals" ? "originals" : "covers", e.name, "", ""]);
    });
    for (let k = confirmed.length; k < 3; k++) {
      const type = origCap > 0 ? "originals" : "covers";
      if (origCap > 0) origCap--;
      bookingRows.push([dISO, type, "", "", ""]);
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(artistRows), "Artists");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(bookingRows), "Bookings");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
