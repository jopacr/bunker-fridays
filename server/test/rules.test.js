// Acceptance checklist (§11) regression tests over the pure rule modules.
// Run with: npm test

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkSubmission, planConfirmation, takenSlots, suggestFridays,
  cooldownBlock, writersNight, artistUnavailableOn,
} from "../src/lib/rules.js";
import { runRecommendations } from "../src/lib/recommend.js";
import { applyWorkbook } from "../src/lib/workbook.js";
import { addDays, fridaysAhead } from "../src/lib/dates.js";

const TODAY = "2026-06-12"; // a Friday
const fridays = fridaysAhead(120, new Date("2026-06-12T12:00:00-04:00"));
const [F1, F2, F3, F4, F5, F6] = fridays;

function snap({ artists = {}, requests = [], nights = {}, recPasses = {} } = {}) {
  return { artists, requests, nights, recPasses, localCities: null };
}

const artist = (id, over = {}) => ({
  id, name: `Artist ${id}`, email: `${id}@x.com`, phone: "", city: "",
  originalsSets: "1", coversSets: "1", bookingPref: "rotation",
  talentScore: 2, drawScore: 2, blackouts: [], unavailableDates: [],
  importedLastPlayed: "", lastCompanions: [], account: true, ...over,
});

const reqOf = (id, artistId, date, over = {}) => ({
  id, artistId, name: `Artist ${artistId}`, email: `${artistId}@x.com`,
  date, eventType: "friday", setType: "covers", slotPref: "any",
  slotTime: null, status: "pending", guest: false, ...over,
});

const CFG = { daysSincePlayed: 120, localBonus: 10, newArtistBonus: 5, newOriginalsBonus: 3, recencyPenalty: 2 };

/* ---------- cooldown (28 days either side of a confirmed date) ---------- */

test("confirming auto-declines pending requests within 28 days EITHER SIDE, same night survives", () => {
  const s = snap({
    artists: { a1: artist("a1") },
    requests: [
      reqOf("r1", "a1", F2),
      reqOf("r2", "a1", F2, { setType: "single-originals" }), // same night second set survives
      reqOf("r3", "a1", addDays(F2, 21)),                     // within 28 after: auto-declined
      reqOf("r4", "a1", addDays(F2, 35)),                     // beyond 28: survives
      reqOf("r5", "a1", addDays(F2, -7)),                     // within 28 before: auto-declined
    ],
  });
  const plan = planConfirmation(s, "r1", "8PM");
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.autoDecline.sort(), ["r3", "r5"]);
});

test("new requests within 28 days after any confirmed booking are blocked at submission", () => {
  const s = snap({
    artists: { a1: artist("a1") },
    requests: [reqOf("r1", "a1", F2, { status: "approved", slotTime: "8PM" })],
  });
  const within = checkSubmission(s, { artistId: "a1", email: "a1@x.com", dateISO: addDays(F2, 14), setType: "covers" }, TODAY);
  assert.equal(within.ok, false);
  assert.equal(within.code, "cooldown");
  const past28 = checkSubmission(s, { artistId: "a1", email: "a1@x.com", dateISO: addDays(F2, 35), setType: "covers" }, TODAY);
  assert.equal(past28.ok, true);
  // Same night second set still allowed (max 2)
  const sameNight = checkSubmission(s, { artistId: "a1", email: "a1@x.com", dateISO: F2, setType: "single-originals" }, TODAY);
  assert.equal(sameNight.ok, true);
});

test("max 2 sets per artist per night, max 2 originals per night, friday-only", () => {
  const s = snap({
    artists: { a1: artist("a1"), a2: artist("a2"), a3: artist("a3") },
    requests: [
      reqOf("r1", "a1", F1, { status: "approved", slotTime: "8PM" }),
      reqOf("r2", "a1", F1, { status: "approved", slotTime: "9PM" }),
      reqOf("r3", "a2", F1, { status: "approved", setType: "single-originals", slotTime: "10PM" }),
    ],
  });
  const third = checkSubmission(s, { artistId: "a1", email: "a1@x.com", dateISO: F1, setType: "covers" }, TODAY);
  assert.equal(third.ok, false);
  assert.equal(third.code, "per-night");
  // a3 wants originals on a night that already has... only one originals set; allowed
  const o2 = checkSubmission(s, { artistId: "a3", email: "a3@x.com", dateISO: F1, setType: "single-originals" }, TODAY);
  assert.equal(o2.ok, true);
  // not a Friday
  const tue = checkSubmission(s, { artistId: "a3", email: "a3@x.com", dateISO: addDays(F1, 4), setType: "covers" }, TODAY);
  assert.equal(tue.ok, false);
});

test("originals cap: two confirmed originals close the door on a third", () => {
  const s = snap({
    artists: { a1: artist("a1"), a2: artist("a2"), a3: artist("a3") },
    requests: [
      reqOf("r1", "a1", F1, { status: "approved", setType: "single-originals", slotTime: "8PM" }),
      reqOf("r2", "a2", F1, { status: "approved", setType: "single-originals", slotTime: "9PM" }),
    ],
  });
  const o3 = checkSubmission(s, { artistId: "a3", email: "a3@x.com", dateISO: F1, setType: "single-originals" }, TODAY);
  assert.equal(o3.ok, false);
  assert.equal(o3.code, "originals-full");
  const c = checkSubmission(s, { artistId: "a3", email: "a3@x.com", dateISO: F1, setType: "covers" }, TODAY);
  assert.equal(c.ok, true);
});

/* ---------- slot collisions re-checked at write time ---------- */

test("confirming into a taken slot fails; writers round confirms without a slot", () => {
  const s = snap({
    artists: { a1: artist("a1"), a2: artist("a2") },
    requests: [
      reqOf("r1", "a1", F1, { status: "approved", slotTime: "9PM" }),
      reqOf("r2", "a2", F1),
    ],
  });
  assert.equal(planConfirmation(s, "r2", "9PM").ok, false);
  assert.equal(planConfirmation(s, "r2", "8PM").ok, true);
  assert.equal(planConfirmation(s, "r2", null).ok, false); // slot required

  // Manual slots count too
  const s2 = snap({
    artists: { a2: artist("a2") },
    requests: [reqOf("r2", "a2", F1)],
    nights: { [F1]: { closed: false, writersOverride: null, slots: [{ name: "Walk-in", setType: "covers", status: "confirmed", slotTime: "8PM", source: "website inquiry" }] } },
  });
  assert.equal(planConfirmation(s2, "r2", "8PM").ok, false);
  assert.ok(takenSlots(s2, F1).has("8PM"));

  // Writers round: no slot needed
  const wfDate = fridays.find((d) => writersNight(snap(), d));
  const s3 = snap({
    artists: { a2: artist("a2") },
    requests: [reqOf("r3", "a2", wfDate, { eventType: "writers-round", setType: "writers-round" })],
  });
  const plan = planConfirmation(s3, "r3", null);
  assert.equal(plan.ok, true);
  assert.equal(plan.slotTime, null);
});

/* ---------- recommender (§5) regressions ---------- */

test("recommender excludes an artist BOOKED 2 weeks LATER than the target (symmetric window)", () => {
  const target = F1;
  const laterBooking = F3; // two weeks after target
  const s = snap({
    artists: {
      a1: artist("a1", { importedLastPlayed: "2025-01-03" }),
      a2: artist("a2", { importedLastPlayed: "2025-01-03" }),
    },
    requests: [reqOf("rb", "a1", laterBooking, { status: "approved", slotTime: "8PM" })],
  });
  const nights = runRecommendations(s, CFG, 1, TODAY);
  const picks = nights[0].picks.map((p) => p.name).filter(Boolean);
  assert.ok(!picks.includes("Artist a1"), "a1 has a confirmed booking 2 weeks later and must not be recommended");
  assert.ok(picks.includes("Artist a2"));
});

test("recommender excludes an artist who PLAYED 3 weeks PRIOR to the target", () => {
  const target = F1;
  const played = addDays(F1, -21);
  const s = snap({
    artists: {
      a1: artist("a1", { importedLastPlayed: played }),
      a2: artist("a2", { importedLastPlayed: "2025-01-03" }),
    },
  });
  const nights = runRecommendations(s, CFG, 1, TODAY);
  const picks = nights[0].picks.map((p) => p.name).filter(Boolean);
  assert.ok(!picks.includes("Artist a1"), "a1 played 3 weeks ago and must not be recommended");
  assert.ok(picks.includes("Artist a2"));
});

test("recommender skips single-preference artists and passed picks; pass refills with next best", () => {
  const s = snap({
    artists: {
      a1: artist("a1", { talentScore: 3, drawScore: 3, importedLastPlayed: "2025-01-03" }),
      a2: artist("a2", { talentScore: 1, drawScore: 1, importedLastPlayed: "2025-01-03" }),
      a3: artist("a3", { bookingPref: "single", talentScore: 3, drawScore: 3, importedLastPlayed: "2025-01-03" }),
    },
  });
  let nights = runRecommendations(s, CFG, 1, TODAY);
  let names = nights[0].picks.map((p) => p.name);
  assert.ok(!names.includes("Artist a3"), "single-preference artists are never recommended");
  assert.equal(names[0], "Artist a1", "highest talent+draw goes first");

  // Venue passes on a1 for that date: a2 takes the refilled slot
  const passed = snap({ ...s, recPasses: { [`a1|${nights[0].dateISO}`]: Date.now() } });
  passed.artists = s.artists; passed.requests = s.requests; passed.nights = s.nights;
  nights = runRecommendations(passed, CFG, 1, TODAY);
  names = nights[0].picks.map((p) => p.name).filter(Boolean);
  assert.ok(!names.includes("Artist a1"));
  assert.equal(names[0], "Artist a2");
});

/* ---------- blackouts (§4): stratford buffers 14 days either side ---------- */

test("stratford blackout removes the artist from recommendations and now also blocks direct requests in the buffered window", () => {
  const target = F2;
  const a1 = artist("a1", { importedLastPlayed: "2025-01-03", blackouts: [{ date: addDays(target, 10), reason: "stratford" }] });
  const a2 = artist("a2", { importedLastPlayed: "2025-01-03", blackouts: [{ date: addDays(target, 10), reason: "other" }] });

  // Buffer semantics: stratford reason blocks 14 days either side; "other" blocks only the exact date.
  assert.equal(artistUnavailableOn(a1, target), true, "stratford reason buffers 14 days either side");
  assert.equal(artistUnavailableOn(a2, target), false, "'other' blocks only the exact date");
  assert.equal(artistUnavailableOn(a1, addDays(target, 10)), true);
  assert.equal(artistUnavailableOn(a2, addDays(target, 10)), true);

  // In a run, a1 never appears on the buffered night.
  const s = snap({ artists: { a1, a2 } });
  const nights = runRecommendations(s, CFG, 2, TODAY);
  const n = nights.find((x) => x.dateISO === target);
  assert.ok(!n.picks.some((p) => p.name === "Artist a1"), "blacked-out artist excluded from the buffered night");

  // A direct request within the buffered window is now blocked too.
  const direct = checkSubmission(s, { artistId: "a1", email: "a1@x.com", dateISO: target, setType: "covers" }, TODAY);
  assert.equal(direct.ok, false, "stratford blackout blocks direct requests in the buffer");
  assert.equal(direct.code, "blackout");

  // The "other" artist, whose blackout is only the exact date, can still request the buffered Friday.
  const ok = checkSubmission(s, { artistId: "a2", email: "a2@x.com", dateISO: target, setType: "covers" }, TODAY);
  assert.equal(ok.ok, true, "exact-date 'other' blackout does not block a different Friday");
});

test("closed nights and exact-date blackouts are excluded", () => {
  const s = snap({
    artists: { a1: artist("a1", { importedLastPlayed: "2025-01-03", blackouts: [{ date: F1, reason: "other" }] }) },
    nights: { [F2]: { closed: true, writersOverride: null, slots: [] } },
  });
  const nights = runRecommendations(s, CFG, 2, TODAY);
  assert.ok(!nights.some((n) => n.dateISO === F2), "closed nights are skipped entirely");
  const n1 = nights.find((n) => n.dateISO === F1);
  assert.ok(!n1.picks.some((p) => p.name === "Artist a1"));
  // And submission to a closed night is blocked
  const sub = checkSubmission(s, { artistId: "a1", email: "a1@x.com", dateISO: F2, setType: "covers" }, TODAY);
  assert.equal(sub.ok, false);
});

/* ---------- decline suggestions are real open Fridays ---------- */

test("suggestFridays offers up to 3 open Fridays filtered by set type", () => {
  const s = snap({
    artists: { a1: artist("a1"), a2: artist("a2") },
    requests: [
      reqOf("r1", "a1", F2, { status: "approved", setType: "single-originals", slotTime: "9PM" }),
      reqOf("r2", "a2", F2, { status: "approved", setType: "single-originals", slotTime: "10PM" }),
    ],
    nights: { [F3]: { closed: true, writersOverride: null, slots: [] } },
  });
  const sugg = suggestFridays(s, F1, "single-originals", 3, TODAY);
  assert.ok(sugg.length <= 3 && sugg.length > 0);
  const isos = sugg.map((x) => x.dateISO);
  assert.ok(!isos.includes(F1), "excluded date stays out");
  assert.ok(!isos.includes(F2), "originals-full night not suggested for an originals artist");
  assert.ok(!isos.includes(F3), "closed night not suggested");
});

/* ---------- workbook (§7): idempotent re-import incl. double sets ---------- */

const WB_HEADER_A = [["Name", "Status", "Local", "CanOriginals", "CanCovers", "Talent", "Draw", "", "LastPlayed", "Notes", "Unavail1", "Unavail2"]];
const WB_HEADER_B = [["Date", "Slot", "Name", "", ""]];

test("importing the workbook twice produces no duplicates, double sets become two slots", () => {
  const artistsRows = [...WB_HEADER_A,
    ["Jo River", "Regular", "yes", "yes", "yes", 3, 2, "", "2026-01-09", "", "", ""],
    ["The Tides", "Single", "no", "no", "yes", 2, 3, "", "", "", "", ""],
  ];
  const bookingRows = [...WB_HEADER_B,
    [F2, "covers", "Jo River"],
    [F2, "originals", "Jo River"],   // double set: two rows, same artist
    [F3, "covers", "Closed"],
    [F4, "covers", "TBD"],
  ];
  const s0 = snap();
  const once = applyWorkbook(s0, { artists: artistsRows, bookings: bookingRows }, TODAY);
  assert.equal(once.nights[F2].slots.length, 2, "double set imports as two slots");
  assert.equal(once.nights[F2].slots[0].slotTime, "8PM", "covers take 8PM by house convention");
  assert.equal(once.nights[F2].slots[1].slotTime, "9PM", "originals take 9PM");
  assert.equal(once.nights[F3].closed, true);
  assert.ok(!once.nights[F4]?.slots?.length, "junk names skipped");

  // Re-import over the resulting state: same shape, no duplication
  const s1 = snap({ artists: once.artists, nights: once.nights });
  const twice = applyWorkbook(s1, { artists: artistsRows, bookings: bookingRows }, TODAY);
  assert.equal(twice.nights[F2].slots.length, 2, "re-import is idempotent");
  assert.equal(Object.values(twice.artists).filter((a) => a.name === "Jo River").length, 1, "artists upsert by name");
  const jo = Object.values(twice.artists).find((a) => a.name === "Jo River");
  assert.equal(jo.bookingPref, "rotation", "Regular maps to rotation");
  const tides = Object.values(twice.artists).find((a) => a.name === "The Tides");
  assert.equal(tides.bookingPref, "single");
  assert.equal(jo.city, "", "local yes no longer fabricates a Stratford city");
  assert.equal(jo.local, true, "local yes sets the local flag");
  assert.equal(tides.local, false, "local no leaves the flag false");
});

test("past workbook rows feed lastPlayed and companions, and the recommender honors them", () => {
  const past = addDays(F1, -21);
  const artistsRows = [...WB_HEADER_A,
    ["Jo River", "Regular", "no", "yes", "yes", 3, 3, "", "", "", "", ""],
    ["Sam Hill", "Regular", "no", "yes", "yes", 1, 1, "", "2025-01-03", "", "", ""],
  ];
  const bookingRows = [...WB_HEADER_B, [past, "covers", "Jo River"]];
  const out = applyWorkbook(snap(), { artists: artistsRows, bookings: bookingRows }, TODAY);
  const jo = Object.values(out.artists).find((a) => a.name === "Jo River");
  assert.equal(jo.importedLastPlayed, past);

  const s = snap({ artists: out.artists, nights: out.nights });
  const nights = runRecommendations(s, CFG, 1, TODAY);
  const picks = nights[0].picks.map((p) => p.name).filter(Boolean);
  assert.ok(!picks.includes("Jo River"), "played 3 weeks ago per the workbook: excluded despite top scores");
  assert.ok(picks.includes("Sam Hill"));
});

/* ---------- cooldownBlock helper sanity ---------- */

test("cooldownBlock reports the blocking booking", () => {
  const s = snap({
    artists: { a1: artist("a1") },
    requests: [reqOf("r1", "a1", F1, { status: "approved", slotTime: "8PM" })],
  });
  assert.ok(cooldownBlock(s, "a1", "a1@x.com", addDays(F1, 7)));
  assert.equal(cooldownBlock(s, "a1", "a1@x.com", addDays(F1, 35)), null);
  assert.ok(cooldownBlock(s, "a1", "a1@x.com", addDays(F1, -7)), "cooldown now spaces both sides of the confirmed date");
});
