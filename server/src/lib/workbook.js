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

// Excel's date epoch (serial 1 = 1900-01-01, with the well-known 1900 leap-year
// bug baked in, matching how Excel/xlsx actually count days). Used when a date
// cell comes through as a bare number instead of a real Date (common when a
// column's cell format is "General"/"Number" rather than a date format).
function excelSerialToISO(n) {
  if (!Number.isFinite(n) || n <= 0 || n > 80000) return null; // sane range guard
  const utcDays = Math.floor(n - (n > 60 ? 1 : 0)); // account for the fictitious Feb 29 1900
  const ms = Math.round((utcDays - 25569) * 86400 * 1000); // 25569 = days between 1899-12-30 and 1970-01-01
  const d = new Date(ms);
  if (isNaN(d)) return null;
  return iso(d);
}

// Reject a parsed date whose year falls way outside any plausible booking
// range. This is the safety net against Date.parse quietly reading a bare
// number string ("45859") as an absurd extended year instead of failing.
function plausibleISO(dISO) {
  if (!dISO) return null;
  const year = Number(dISO.slice(0, 4));
  return year >= 2020 && year <= 2100 ? dISO : null;
}

const toISO = (v) => {
  if (v instanceof Date && !isNaN(v)) return plausibleISO(iso(v));
  if (typeof v === "number") return excelSerialToISO(v);
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    // Already ISO (yyyy-mm-dd, possibly with a time suffix)
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return plausibleISO(s.slice(0, 10));
    // Slash or dash separated numeric date: M/D/Y, D/M/Y, or Y/M/D. Disambiguate
    // day vs month using whichever component can't possibly be a month.
    const parts = s.match(/^(\d{1,4})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (parts) {
      let [, p1, p2, p3] = parts;
      if (p1.length === 4) {
        // Y/M/D
        return plausibleISO(`${p1}-${String(p2).padStart(2, "0")}-${String(p3).padStart(2, "0")}`);
      }
      let month = Number(p1), day = Number(p2);
      const year = p3.length === 2 ? `20${p3}` : p3;
      if (month > 12 && day <= 12) { const t = month; month = day; day = t; } // swap: first part was actually the day
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return plausibleISO(`${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
      }
      return null;
    }
    // A bare number typed as text (e.g. a stray Excel serial pasted as a
    // string) — never hand this to Date.parse, which will misread it as a
    // year and silently produce a nonsense date decades away.
    if (/^\d{3,6}(\.\d+)?$/.test(s)) return excelSerialToISO(Number(s));
    // Last resort: month-name formats ("July 25, 2026"). Validate the result
    // rather than trusting Date.parse blindly.
    if (!isNaN(Date.parse(s))) return plausibleISO(new Date(Date.parse(s)).toISOString().slice(0, 10));
  }
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
  // Snapshot of what each date looked like BEFORE this import touches it, so we
  // can tell the venue what's about to be overwritten.
  const beforeSlots = {};
  Object.entries(snap.nights).forEach(([d, n]) => { beforeSlots[d] = (n.slots || []).map((s) => s.name); });

  const wbTouched = new Set();
  const closedTouched = new Set();
  let importedBookings = 0, closedNights = 0;
  const skippedRows = []; // { row, raw, name } — dates we couldn't confidently parse
  const playedByDate = {}; // dateISO -> [names], for companions
  let lastDateISO = null; // carry-forward for blank date cells (same night as the row above)

  if (bookingRows) {
    for (let i = 1; i < bookingRows.length; i++) {
      const r = bookingRows[i] || [];
      const rawDate = r[0];
      const nameGuess = String(r[2] || "").trim();
      const slotGuess = String(r[1] || "").trim();
      const rowBlank = (rawDate == null || rawDate === "") && !nameGuess && !slotGuess;
      if (rowBlank) continue; // fully empty row, not an error

      let dISO;
      if (rawDate == null || rawDate === "") {
        // Blank date cell: common when a booking sheet lists two artists for
        // the same night stacked in adjacent rows and only writes the date once.
        dISO = lastDateISO;
      } else {
        dISO = toISO(rawDate);
        if (dISO) lastDateISO = dISO;
      }
      if (!dISO) {
        skippedRows.push({ row: i + 1, raw: String(rawDate ?? ""), name: nameGuess || "(no name)" });
        continue;
      }
      const slot = slotGuess.toLowerCase();
      const name = nameGuess;
      if (!name) continue;
      if (dISO < today) {
        (playedByDate[dISO] = playedByDate[dISO] || []).push(name);
        const id = byName[name.toLowerCase()];
        if (id && (!arts[id].importedLastPlayed || dISO > arts[id].importedLastPlayed)) {
          arts[id].importedLastPlayed = dISO;
        }
      } else {
        if (name.toLowerCase() === "closed") {
          if (!wbTouched.has(dISO)) { nights[dISO] = { ...(nights[dISO] || { slots: [] }), slots: [] }; wbTouched.add(dISO); }
          nights[dISO] = { ...nights[dISO], closed: true };
          closedTouched.add(dISO);
          closedNights++;
          continue;
        }
        if (name.toLowerCase() === "none" || name.toLowerCase() === "tbd") continue; // junk names skipped
        const day = nights[dISO] || { slots: [] };
        // The workbook is authoritative: the first row touching a date this
        // import clears EVERY existing slot for that date, regardless of where
        // it came from (a prior import, a manual entry, or an app booking).
        // Anything cleared that Excel doesn't re-add is reported as a conflict
        // so the venue can confirm before it's actually overwritten.
        if (!wbTouched.has(dISO)) {
          day.slots = [];
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

  // Conflicts: any date this import touched (booked or closed) where names
  // that existed before are no longer present after. Only real losses count —
  // a name Excel re-adds for the same date isn't a conflict.
  const conflicts = [];
  [...wbTouched].forEach((dISO) => {
    const before = beforeSlots[dISO] || [];
    if (!before.length) return;
    const afterNames = closedTouched.has(dISO) ? [] : (nights[dISO]?.slots || []).map((s) => s.name);
    const removed = before.filter((n) => !afterNames.some((a) => a.toLowerCase() === n.toLowerCase()));
    if (removed.length) conflicts.push({ date: dISO, removed, replacedWith: afterNames });
  });

  // Last companions: from each artist's most recent past bill
  Object.values(arts).forEach((a) => {
    const lp = a.importedLastPlayed;
    if (lp && playedByDate[lp] && playedByDate[lp].some((n) => n.toLowerCase() === (a.name || "").toLowerCase())) {
      a.lastCompanions = playedByDate[lp].filter((n) => n.toLowerCase() !== (a.name || "").toLowerCase());
    }
  });

  return { artists: arts, nights, stats: { importedArtists, importedBookings, closedNights, skippedRows, conflicts } };
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
