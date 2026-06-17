// Date helpers. The venue lives in America/Toronto; the server may not.
// All "today" / Friday math is pinned to the venue's wall clock.

export const VENUE_TZ = "America/Toronto";

const fmtCache = new Intl.DateTimeFormat("en-CA", {
  timeZone: VENUE_TZ, year: "numeric", month: "2-digit", day: "2-digit",
});

/** Today's date in the venue timezone as YYYY-MM-DD. */
export function todayISO(now = new Date()) {
  return fmtCache.format(now); // en-CA gives YYYY-MM-DD
}

/** Parse YYYY-MM-DD into a Date at UTC noon (immune to DST/TZ edge cases for day math). */
export function parseISO(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}

export function iso(d) {
  return d.toISOString().slice(0, 10);
}

export function addDays(dISO, n) {
  const d = parseISO(dISO);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}

export function daysBetween(aISO, bISO) {
  return Math.round((parseISO(aISO) - parseISO(bISO)) / 86400000);
}

/** Upcoming Fridays (inclusive of today if today is a Friday), venue time. */
export function fridaysAhead(days, now = new Date()) {
  const out = [];
  let d = todayISO(now);
  while (parseISO(d).getUTCDay() !== 5) d = addDays(d, 1);
  const limit = addDays(todayISO(now), days);
  while (d <= limit) {
    out.push(d);
    d = addDays(d, 7);
  }
  return out;
}

export function isLastFridayOfMonth(dISO) {
  const d = parseISO(dISO);
  if (d.getUTCDay() !== 5) return false;
  return parseISO(addDays(dISO, 7)).getUTCMonth() !== d.getUTCMonth();
}

/** "Friday, June 12, 2026" */
export function fmtLong(dISO) {
  return parseISO(dISO).toLocaleDateString("en-CA", {
    weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  });
}
