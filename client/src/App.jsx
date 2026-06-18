import { useState, useEffect, useRef } from "react";
import { api, urlBase64ToUint8Array } from "./api.js";

/* ============================================================
   BUNKER FRIDAY SETS · v3
   Artist request portal + admin booking desk
   The Bunker Performance Lounge, 104 Wellington St, Stratford ON
   ============================================================ */

const FONT_LINK = "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Karla:ital,wght@0,400;0,500;0,700;1,400&display=swap";

const T = {
  ink: "#15110C",
  panel: "#211A12",
  panel2: "#2A2218",
  line: "#3A2F20",
  amber: "#E9A23B",
  amberDim: "#8A6526",
  cream: "#F0E7D8",
  muted: "#A08F77",
  green: "#7FAF82",
  red: "#C96A5B",
};

const DEFAULT_PIN = "104";
const INFO_EMAIL = "info@bunkerstratford.com";
const MAX_PHOTOS = 4;
const MAX_PER_NIGHT = 2;
const AUTO_DECLINE_DAYS = 28;
const SLOT_TIMES = ["8PM", "9PM", "10PM"];
const DEFAULT_REC_CONFIG = {
  daysSincePlayed: 120,
  localBonus: 10,
  newArtistBonus: 5,
  newOriginalsBonus: 3,
  recencyPenalty: 2,
};

/* ============================================================
   VENUE KNOWLEDGE
   Compiled from: Friday Night Sessions v1.3 (Dec 2025),
   Friday Night Sessions Songwriter Round v1.2 (Jul 2025),
   Stage Setup and Equipment Spec Sheet, and venue direction.
   ============================================================ */
const CORE_FACTS = `
VENUE: The Bunker Performance Lounge and Cafe, 104 Wellington Street, Stratford, Ontario. info@bunkerstratford.com, 226-345-5520. A listening room: audiences come to listen. No cover for guests on Friday Night Sessions.

FRIDAY NIGHT SESSIONS (standard Fridays):
- Curated showcase of local and regional emerging artists.
- 3 artists per night. Each artist gets one 45-minute slot, every hour from 8PM to 11PM. When requesting, artists can indicate a preferred start time (8PM, 9PM, or 10PM) and leave a note about scheduling needs; the venue does its best to accommodate, but the final lineup order is set by the venue and the slot is confirmed with the booking.
- Two set types: an ORIGINALS set or a COVERS set. A covers set may include some originals, but only an originals set carries the tip guarantee.
- A maximum of 2 of the 3 slots per night can be originals sets.
- Soundcheck: 6PM to 7PM before the show.
- Artists may request as many dates as they like, up to 2 sets on any single night. Generally one set per artist gets booked per night. Once one date is confirmed, any other pending requests within the following 4 weeks are automatically declined, and new requests for dates within 4 weeks after a confirmed booking are not accepted.
- An artist can only request a set type they actually offer: if their inquiry says 0 original sets, they cannot request an originals set, and likewise for covers.

AUDIO RECORDING (optional add-on, can be requested with a booking):
- Two tiers. BOARD TAPE: a stereo mix direct from the board, delivered as a single uncompressed broadcast-quality .wav, great for demos, archives, and social content. FULL TRACKS: multi-track recording delivered as individual uncompressed .wav files per track plus the stereo board mix, for full control in post-production. Full Tracks includes the Board Tape mix.
- Board Tape rates: Open Mic 15 min $25, Full Set 45 min $59, 2 Sets $99, 3rd set add-on $29.
- Full Tracks rates: Open Mic 15 min $45, Full Set 45 min $99, 2 Sets $159, 3rd set add-on $49.
- The 3rd set add-on is available when booking 2 sets and must be requested at time of booking. All prices subject to HST.
- Recording must be booked in advance with a minimum of 48 hours notice, and is subject to engineer availability.
- Daytime recording is available in conjunction with rehearsal space bookings, and recording is available by arrangement for private sessions.
- All recordings are delivered as raw, unedited files: no mixing, mastering, editing, or post-production of any kind. Deliverables are provided as captured, as-is.
- Recording bookings and questions: info@bunkerstratford.com.

FRIDAY NIGHT SESSIONS COMPENSATION:
- Tips collected for the night work like a door cover: The Bunker invites patrons to tip on their bills, and those tips are split equally among the night's sets. This way every artist benefits from the whole night, not just their own slot.
- If a patron asks to tip a specific artist, the first $5 of that tip is still split equally among all sets, and the rest goes to the requested artist.
- Tips are distributed over the weekend via e-transfer. Artists can provide a separate e-transfer email if it differs from their contact email. Transfers sent to an incorrect email address cannot be corrected, so artists must double-check for typos. If the artist is not set up for autodeposit, the e-transfer password is "Bunker".
- Originals sets carry a $50 tip guarantee, whether from patrons or topped up by The Bunker. Covers sets do not carry the guarantee, even if some originals are played.
- Typical earnings: artists have made between $50 and $150 per set, with outliers on both the upper and lower ends.
- Merch: sales happen directly between artist and patrons. Artists keep 100% of merch revenue. Bring merch.
- Drinks: each slot includes 2 half-price drinks.

WRITERS ROUND / SONGWRITER ROUND (last Friday of every month):
- Nashville round style: 3 artists take turns telling stories and sharing their original songs.
- Original songs only. Each artist plays 12 to 15 songs and must have that many ready.
- Show runs 8PM to roughly 10:30PM: two sets with a 15-minute break between.
- Soundcheck: 6:30PM to 7PM.
- Pay What You Can night with a recommended $15 donation.
- Comp: PWYC proceeds are collected on guest tabs and split between the artists via e-transfer after the show, typically Saturday or Sunday for accurate reconciliation. $50 from donations and bar covers sound costs.
- Each artist gets 2 half-price drinks or complimentary pop. Merch welcome and encouraged.

BOOKING, ACCOUNTS, AND ROTATION:
- Every request is reviewed manually by the venue before a slot is confirmed.
- The app calendar shows 90 days ahead; artists can request further-out Fridays with the date picker.
- The Bunker aims for at least 1 local (Stratford area) artist on every bill. Home city also factors into winter bookings because of travel weather.
- When requesting, artists choose a booking preference: SINGLE SET (a one-off; the venue will not reach out about future sets) or REGULAR ROTATION (the venue adds the artist to its booking rotation and may reach out proactively to offer future dates).
- An account gives artists prefilled request forms, request tracking in the app, and the ability for the venue to send them short in-app messages about open dates they might want.
- Promotion: artists can upload up to 4 photos for promo materials. The Friday lineup goes into monthly and weekly social media, recap media, and the monthly newsletter. Artists who self-promote and fill seats have a higher rebook rate.
- After the show: artists with streamable music are added to the Bunker Alumni playlist in the lounge. New releases get included in Bunker Alumni social posts on a best-effort basis. The venue kindly asks artists to leave a Google review.
- Artists are encouraged to stay and support the other acts on the bill, though it is not required. Artist networking is a real benefit of Friday Night Sessions.

PARKING AND LOAD-IN:
- Load-in happens in The Bunker parking lot.
- Evening parking must be in neighbouring lots or on the street. Do not leave vehicles in the Bunker lot; those spots belong to other units in the building.

STAGE, BACKLINE, AND GEAR RULES:
- Stage: 15 feet wide, 4.5 feet deep stage left to 7 feet deep stage right. Intimate listening room.
- Drums: NO personal drum kits on stage, house kit only. The house kit lives in an enclosed sound booth (kick, snare, toms, hi-hat, crash, ride), every drum individually mic'd, with a headphone mix for the drummer. Hand percussion like hand drums and cajons IS allowed on stage.
- Personal amps: welcome, but they go in the amp isolation box on stage when applicable. The iso box fits two 1x12 combo amps, each mic'd for volume control, with space for one more amp up to 24" wide, 12" deep, 27" high.
- Backing tracks: discouraged, since The Bunker is a live music venue, but some exceptions are made. Ask the venue.
- Bass: GH bass head with direct line-out to the mixer.
- Guitar: house Blackstar Club 40 available.
- Keys: Korg SP500 digital piano with weighted keys.
- Stands: 3 general guitar stands, 2 acoustic guitar stands.
- Sound: PreSonus board controlled wirelessly by iPad (Universal Control). Mackie active mains, Alto subwoofer, 3 Alto stage monitors with individual mixes.
- Mics: 3 SE Audio V7 dynamic vocal mics with stands. DIs available for acoustic instruments or keyboards. Bring your own extras if you need more than 3 mics or stands.
- Lighting: basic LED front and backlighting; artists may bring extra lighting effects.
- Power: multiple surge-protected outlets on stage.
`.trim();

const DEFAULT_KB = `Anything not covered by the core venue knowledge can be added here by the venue. The chatbot answers only from the core knowledge plus this text; everything else gets a human follow-up from ${INFO_EMAIL}.`;

/* Storage and password hashing now live on the server. The client talks to the
   REST API in ./api.js; sessions ride on httpOnly cookies. */

/* ---------------- date helpers ---------------- */
const iso = (d) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};
function parseISO(s) {
  const [y, m, dd] = s.split("-").map(Number);
  return new Date(y, m - 1, dd);
}
function fridaysAhead(days) {
  const out = [];
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(now);
  while (d.getDay() !== 5) d.setDate(d.getDate() + 1);
  const limit = new Date(now);
  limit.setDate(limit.getDate() + days);
  while (d <= limit) {
    out.push(new Date(d));
    d.setDate(d.getDate() + 7);
  }
  return out;
}
function isLastFridayOfMonth(d) {
  if (d.getDay() !== 5) return false;
  const next = new Date(d);
  next.setDate(next.getDate() + 7);
  return next.getMonth() !== d.getMonth();
}
function fmtLong(d) {
  return d.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}
const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ---------------- image compression ---------------- */
function compressImage(file, maxDim = 320) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL("image/jpeg", 0.72));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function photosOf(a) {
  if (!a) return [];
  if (Array.isArray(a.photos)) return a.photos;
  return a.headshot ? [a.headshot] : [];
}

/* Profile fields a signed-in artist needs filled before they can request a date.
   These live in the Account tab; the date-request form no longer asks for them. */
function profileMissingForBooking(a) {
  if (!a) return ["your profile"];
  const m = [];
  if (!String(a.name || "").trim()) m.push("act name");
  if (!String(a.email || "").trim() || !String(a.email).includes("@")) m.push("email");
  const cm = a.contactMethod || "Email";
  if ((cm === "Phone" || cm === "Text") && !String(a.phone || "").trim()) m.push("phone number");
  if (cm === "Instagram" && !String(a.instagram || "").trim()) m.push("Instagram handle");
  if (cm === "Facebook" && !String(a.facebook || "").trim()) m.push("Facebook handle");
  if (!String(a.genre || "").trim()) m.push("genre");
  if (String(a.originalsSets ?? "").trim() === "") m.push("number of original sets");
  if (String(a.coversSets ?? "").trim() === "") m.push("number of cover sets");
  if (!String(a.city || "").trim()) m.push("home city");
  if (!String(a.bio || "").trim()) m.push("short bio");
  if (!["single", "rotation"].includes(a.bookingPref)) m.push("booking preference");
  return m;
}

/* Towns within roughly a 20-minute drive of Stratford */
const LOCAL_CITIES = ["stratford", "sebringville", "shakespeare", "tavistock", "mitchell", "milverton", "st. marys", "st marys", "new hamburg", "gads hill", "gadshill", "st. pauls", "st pauls", "avonton", "amulree", "wartburg", "harmony", "fullarton", "rostock", "brunner"];
function isLocal(city) {
  if (!city) return false;
  const c = city.toLowerCase();
  return LOCAL_CITIES.some((l) => c.includes(l));
}
function artistIsLocal(a) {
  if (a && a.city && String(a.city).trim()) return isLocal(a.city);
  return !!(a && a.local);
}

const SET_LABELS = {
  "single-originals": "Originals set ($50 guarantee)",
  "covers": "Covers set",
  "writers-round": "Writers Round",
  "other": "Set",
};

/* Event types: "friday" and "writers-round" are live. "snl" (Saturday
   Night Live) is reserved for a future phase with its own compensation
   illustration model; the data shape is ready, the UI is not. */
const EVENT_TYPES = { FRIDAY: "friday", WRITERS: "writers-round", SNL: "snl" };

/* ---------------- follow-up email drafts ---------------- */
function confirmEmailDraft(r, artist) {
  const writers = r.setType === "writers-round";
  const lines = [];
  lines.push(`Hi ${r.name},`);
  lines.push("");
  lines.push(`Great news: you're confirmed for ${fmtLong(parseISO(r.date))}${r.slotTime ? `, taking the ${r.slotTime} set` : ""} at The Bunker.`);
  lines.push("");
  lines.push("The night at a glance:");
  if (writers) {
    lines.push("- Writers Round: three artists trading original songs and stories, two sets from 8PM to about 10:30PM with a 15-minute break.");
    lines.push("- Soundcheck: 6:30PM to 7PM.");
    lines.push("- It's a Pay What You Can night (recommended $15); proceeds are split between the artists by e-transfer after the show.");
  } else {
    lines.push(`- Your set: 45 minutes${r.slotTime ? `, starting at ${r.slotTime}` : ""}.`);
    lines.push("- Soundcheck: 6PM to 7PM.");
    lines.push("- Comp: night's tips split among the sets, e-transferred over the weekend. You keep 100% of merch, so bring it.");
  }
  lines.push("- Load in at The Bunker lot, then please move your vehicle to a neighbouring lot or the street for the evening.");
  lines.push("- Each set includes 2 half-price drinks.");
  const payTo = artist?.etransferEmail || r.email;
  lines.push("");
  lines.push(`We'll e-transfer to ${payTo}. Please double-check that's correct, since transfers to a wrong address can't be recalled. Not set up for autodeposit? The password is "Bunker".`);
  if (r.recording && r.recording !== "none") {
    lines.push("");
    lines.push(`You also requested ${r.recording === "board-tape" ? "Board Tape recording ($59 +HST)" : "Full Tracks recording ($99 +HST)"}; we'll confirm the engineer and settle details before the night.`);
  }
  lines.push("");
  lines.push("Invite your people: artists who fill seats have the highest rebook rate, and we'll be promoting the lineup on our socials and newsletter too.");
  lines.push("");
  lines.push("See you Friday,");
  lines.push("The Bunker Performance Lounge");
  return { subject: `Confirmed: The Bunker, ${fmtLong(parseISO(r.date))}${r.slotTime ? ` (${r.slotTime})` : ""}`, body: lines.join("\n") };
}

function declineEmailDraft(reason, r, suggestions) {
  const lines = [];
  lines.push(`Hi ${r.name},`);
  lines.push("");
  if (reason === "slot-filled") {
    lines.push(`Thanks so much for requesting ${fmtLong(parseISO(r.date))}. That night drew a lot of interest and filled up before we could fit you in. This is not a pass on you, just on the date.`);
  } else if (reason === "conflict") {
    lines.push(`Thanks for requesting ${fmtLong(parseISO(r.date))}. Our apologies: that night already had a prior booking that hadn't made it into the calendar yet, so we have to release your request for that date. This one's on us, not on you.`);
  } else {
    lines.push(`Thanks for requesting ${fmtLong(parseISO(r.date))}. We aren't able to make that particular night work, but we'd genuinely like to find you a spot.`);
  }
  if (suggestions.length > 0) {
    lines.push("");
    lines.push("A few upcoming Fridays that look like a great fit:");
    suggestions.forEach((s) => lines.push(`- ${s.label}${s.writers ? " (Writers Round: originals only, 12 to 15 songs)" : ""}`));
    lines.push("");
    lines.push("Would any of those work for you? Reply with your availability, or request directly in the app, and we'll get you on a bill.");
  } else {
    lines.push("");
    lines.push("Reply with a few dates that work for you and we'll find you a bill.");
  }
  lines.push("");
  lines.push("Talk soon,");
  lines.push("The Bunker Performance Lounge");
  return { subject: `About your Bunker request for ${fmtLong(parseISO(r.date))}`, body: lines.join("\n") };
}

function timeChangeEmailDraft(r, oldSlot) {
  const lines = [];
  lines.push(`Hi ${r.name},`);
  lines.push("");
  lines.push(`Quick scheduling update for your set on ${fmtLong(parseISO(r.date))}: you're now taking the ${r.slotTime} set${oldSlot ? ` (moved from ${oldSlot})` : ""}.`);
  lines.push("");
  lines.push("Everything else stays the same: soundcheck 6PM to 7PM, load in at The Bunker lot then move your vehicle for the evening, and 2 half-price drinks with your set.");
  lines.push("");
  lines.push("If the new time creates a problem on your end, reply here and we'll sort it out.");
  lines.push("");
  lines.push("Thanks for rolling with it,");
  lines.push("The Bunker Performance Lounge");
  return { subject: `Time update: The Bunker, ${fmtLong(parseISO(r.date))} (now ${r.slotTime})`, body: lines.join("\n") };
}

function outreachEmailDraft(artistName, dateLabel, slotLabel, slotType, writers) {
  const lines = [];
  lines.push(`Hi ${artistName},`);
  lines.push("");
  if (writers) {
    lines.push(`We're putting together our Writers Round on ${dateLabel} (a Nashville-style round: three artists trading original songs and the stories behind them, 12 to 15 songs each) and you came to mind.`);
  } else {
    lines.push(`We have ${slotType === "originals" ? "an originals set" : "a covers set"} open on ${dateLabel}${slotLabel && slotLabel !== "TBD" ? `, the ${slotLabel} slot,` : ""} at The Bunker and you came to mind.`);
    if (slotType === "originals") lines.push("Originals sets carry our $50 tip guarantee, and you keep 100% of merch.");
  }
  lines.push("");
  lines.push("Any interest, and are you available that night? Reply here, or request the date directly in our Bunker Fridays app, and we'll lock it in.");
  lines.push("");
  lines.push("Hope to see you on our stage,");
  lines.push("The Bunker Performance Lounge");
  return { subject: `A Friday set at The Bunker? ${dateLabel}`, body: lines.join("\n") };
}

function outreachShortText(artistName, dateLabel, slotLabel, slotType, writers) {
  if (writers) return `Hi ${artistName}, it's The Bunker in Stratford. We're building our Writers Round for ${dateLabel} (originals, 12 to 15 songs) and thought of you. Interested and available?`;
  return `Hi ${artistName}, it's The Bunker in Stratford. We have ${slotType === "originals" ? "an originals set" : "a covers set"} open ${dateLabel}${slotLabel && slotLabel !== "TBD" ? ` at ${slotLabel}` : ""}. Interested and available?`;
}

/* ============================================================
   APP
   ============================================================ */
export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState("artist");
  const [adminOk, setAdminOk] = useState(false);

  const [requests, setRequests] = useState([]);
  const [artists, setArtists] = useState({});
  const [overrides, setOverrides] = useState({});
  const [calendar, setCalendar] = useState([]);   // public calendar nights (artist view)
  const [serverToday, setServerToday] = useState(null);
  const [info, setInfo] = useState(null);          // /api/info: coreFacts, kb, flags
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [kb, setKb] = useState("");
  const [escalations, setEscalations] = useState([]);
  const [session, setSession] = useState(null);
  const [recConfig, setRecConfig] = useState(DEFAULT_REC_CONFIG);
  const [pings, setPings] = useState({});
  const [recPasses, setRecPasses] = useState({});
  const [drafts, setDrafts] = useState([]);

  const [page, setPage] = useState("info");
  const [adminPage, setAdminPage] = useState("inbox");
  const [requestDate, setRequestDate] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONT_LINK;
    document.head.appendChild(link);
    (async () => {
      try {
        const [cal, nfo] = await Promise.all([api.calendar(), api.info()]);
        setCalendar(cal.nights || []); setServerToday(cal.today || null);
        setInfo(nfo); setKb(nfo.kb || "");
      } catch (e) { console.error("boot", e); }
      try {
        const me = await api.me();
        if (me && me.session) { setSession(me.session); await loadArtistData(me.session); }
      } catch (e) { /* not signed in */ }
      try {
        const am = await api.adminMe();
        if (am && am.admin) { setAdminAuthed(true); }
      } catch (e) { /* not an admin session */ }
      // Deep link from a push notification: /?request=YYYY-MM-DD or /?page=mine
      try {
        const qp = new URLSearchParams(window.location.search);
        if (qp.get("page") === "mine") setPage("mine");
        const rd = qp.get("request");
        if (rd) { setPage("dates"); setRequestDate(rd); }
      } catch (e) {}
      setLoaded(true);
    })();
  }, []);

  function flash(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 4200);
  }

  // Artist view data: the signed-in artist's own requests, profile, and pings.
  async function loadArtistData(sess) {
    const session = sess || (typeof window !== "undefined" ? null : null);
    try {
      const [mine, prof, png] = await Promise.all([api.myRequests(), api.myProfile(), api.myPings()]);
      setRequests(mine.requests || []);
      if (prof && prof.artist) setArtists({ [prof.artist.id]: prof.artist });
      const id = (sess && sess.artistId) || (prof && prof.artist && prof.artist.id);
      setPings(id ? { [id]: (png.pings || []) } : {});
    } catch (e) { console.error("artist data", e); }
  }
  async function refreshArtist() {
    try { const cal = await api.calendar(); setCalendar(cal.nights || []); setServerToday(cal.today || null); } catch (e) {}
    if (session) await loadArtistData(session);
  }
  // Desk view data: the full snapshot from /api/admin/state.
  // Push notifications for the venue desk: subscribe once when the desk is open
  // and the server has a VAPID key configured.
  useEffect(() => {
    if (!adminOk && !adminAuthed) return;
    if (!info?.pushPublicKey) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const existing = await reg.pushManager.getSubscription();
        if (existing) return; // already subscribed
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(info.pushPublicKey),
        });
        await api.pushSubscribe(sub.toJSON());
      } catch (e) { console.warn("push setup:", e); }
    })();
  }, [adminOk, adminAuthed, info?.pushPublicKey]);

  async function refreshDesk() {
    try {
      const st8 = await api.adminState();
      setRequests(st8.requests || []);
      setArtists(st8.artists || {});
      setOverrides(st8.nights || {});
      setDrafts(st8.drafts || []);
      setEscalations(st8.escalations || []);
      setRecConfig({ ...DEFAULT_REC_CONFIG, ...(st8.recConfig || {}) });
      setKb(st8.kb || "");
      setServerToday(st8.today || null);
      const rp = {};
      (st8.recPasses ? Object.keys(st8.recPasses) : []).forEach((k) => { rp[k] = st8.recPasses[k]; });
      setRecPasses(st8.recPasses || {});
    } catch (e) { console.error("desk data", e); }
  }

  useEffect(() => {
    if (!loaded) return;
    if (view === "admin" && (adminOk || adminAuthed)) refreshDesk();
    else if (view === "artist") refreshArtist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, adminAuthed, loaded]);

  function entriesFor(dateISO) {
    // Artist view reads the public calendar payload (no access to other
    // artists' private rows); the desk computes from the full snapshot.
    if (view === "artist") {
      const n = calendar.find((x) => x.dateISO === dateISO);
      if (!n) return { entries: [], closed: false, note: "" };
      return { entries: (n.entries || []).map((e) => ({ ...e })), closed: !!n.closed, note: n.note || "" };
    }
    const ov = overrides[dateISO] || {};
    const manual = (ov.slots || []).map((s, manualIndex) => ({ ...s, manual: true, manualIndex }));
    const reqs = requests
      .filter((r) => r.date === dateISO && (r.status === "pending" || r.status === "approved"))
      .map((r) => ({ name: r.name, setType: r.setType, status: r.status === "approved" ? "confirmed" : "pending", slotTime: r.slotTime || null, reqId: r.id }));
    return { entries: [...manual, ...reqs], closed: !!ov.closed, note: ov.note || "" };
  }

  function perNightCount(artistId, email, dateISO) {
    return requests.filter((r) =>
      (r.artistId === artistId || (email && r.email && r.email.toLowerCase() === email.toLowerCase())) &&
      (r.status === "pending" || r.status === "approved") &&
      r.date === dateISO
    ).length;
  }

  // Returns the blocking confirmed date if the requested date falls within
  // AUTO_DECLINE_DAYS after one of the artist's confirmed bookings.
  function cooldownBlock(artistId, email, dateISO) {
    const target = parseISO(dateISO);
    const hit = requests.find((r) => {
      if (r.status !== "approved") return false;
      if (!(r.artistId === artistId || (email && r.email && r.email.toLowerCase() === email.toLowerCase()))) return false;
      const cd = parseISO(r.date);
      const end = new Date(cd);
      end.setDate(end.getDate() + AUTO_DECLINE_DAYS);
      return target > cd && target <= end;
    });
    return hit ? hit.date : null;
  }

  function hasPlayed(artistId) {
    const today = iso(new Date());
    if (artists[artistId]?.importedLastPlayed) return true;
    return requests.some((r) => r.artistId === artistId && r.status === "approved" && r.date < today);
  }

  function takenSlots(dateISO) {
    const { entries } = entriesFor(dateISO);
    const s = new Set();
    entries.forEach((e) => { if (e.status === "confirmed" && e.slotTime) s.add(e.slotTime); });
    return s;
  }

  // Up to n upcoming open Fridays (for follow-up email suggestions)
  function suggestFridays(excludeISO, setType, n = 3) {
    const out = [];
    for (const d of fridaysAhead(120)) {
      const dISO = iso(d);
      if (dISO === excludeISO) continue;
      const { entries, closed } = entriesFor(dISO);
      if (closed) continue;
      const confirmed = entries.filter((e) => e.status === "confirmed");
      if (confirmed.length >= 3) continue;
      const writers = writersNight(d);
      if (setType === "single-originals" && !writers) {
        const origs = confirmed.filter((e) => e.setType === "single-originals").length;
        if (origs >= 2) continue;
      }
      if (setType === "covers" && writers) continue;
      out.push({ dateISO: dISO, label: fmtLong(d), writers });
      if (out.length >= n) break;
    }
    return out;
  }

  // Writers Round: last Friday of the month by default, overridable per night
  function writersNight(d) {
    const dISO = iso(d);
    if (view === "artist") {
      const n = calendar.find((x) => x.dateISO === dISO);
      if (n && typeof n.writers === "boolean") return n.writers;
      return isLastFridayOfMonth(d);
    }
    const ov = overrides[dISO];
    if (ov && typeof ov.writersOverride === "boolean") return ov.writersOverride;
    return isLastFridayOfMonth(d);
  }

  // Effective unavailability: imported dates, plus self-set blackouts.
  // A Stratford-gig blackout blocks 2 weeks either side at the Bunker.
  function artistUnavailableOn(a, dISO) {
    if ((a.unavailableDates || []).includes(dISO)) return true;
    const t = parseISO(dISO).getTime();
    for (const b of (a.blackouts || [])) {
      if (b.reason === "stratford") {
        if (Math.abs(t - parseISO(b.date).getTime()) / 86400000 <= 14) return true;
      } else if (b.date === dISO) return true;
    }
    return false;
  }

  if (!loaded) {
    return (
      <div style={{ ...st.shell, alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: 4, color: T.amber }}>BUNKER</div>
        <div style={{ color: T.muted, fontSize: 13 }}>warming up the room...</div>
      </div>
    );
  }

  const ctx = { requests, artists, overrides, kb, escalations, session, recConfig, pings, recPasses, drafts, calendar, info, serverToday, api, setSession, setPage, refreshArtist, refreshDesk, entriesFor, perNightCount, cooldownBlock, hasPlayed, takenSlots, suggestFridays, writersNight, artistUnavailableOn, flash, setRequestDate };

  return (
    <div style={st.shell}>
      <Header view={view} onSwitch={() => setView(view === "artist" ? "admin" : "artist")} />
      {view === "artist" ? (
        <>
          <main style={st.main}>
            {session && <PingBanner ctx={ctx} />}
            {page === "dates" && <DatesPage ctx={ctx} />}
            {page === "info" && <InfoPage kb={kb} />}
            {page === "ask" && <AskPage ctx={ctx} />}
            {page === "mine" && <MinePage ctx={ctx} />}
            {page === "account" && <AccountPage ctx={ctx} />}
          </main>
          <nav style={st.tabbar}>
            {[["account", session ? "Account" : "Sign in"], ["info", "The Deal"], ["dates", "Dates"], ["ask", "Ask"], ["mine", "Requests"]].map(([k, label]) => (
              <button key={k} onClick={() => setPage(k)} style={{ ...st.tab, color: page === k ? T.amber : T.muted, borderTop: page === k ? `2px solid ${T.amber}` : "2px solid transparent" }}>{label}</button>
            ))}
          </nav>
        </>
      ) : (
        <main style={st.main}>
          {!(adminOk || adminAuthed) ? (
            <AdminGate onOk={async () => { setAdminAuthed(true); setAdminOk(true); await refreshDesk(); }} />
          ) : (
            <>
              <div style={st.adminTabs}>
                {[["inbox", "Inbox"], ["calendar", "Calendar"], ["recommend", "Recommend"], ["artists", "Artists"], ["knowledge", "Knowledge"], ["escalations", "Follow-ups"]].map(([k, label]) => (
                  <button key={k} onClick={() => setAdminPage(k)} style={{ ...st.adminTab, background: adminPage === k ? T.amber : "transparent", color: adminPage === k ? T.ink : T.muted }}>{label}</button>
                ))}
              </div>
              {adminPage === "inbox" && <AdminInbox ctx={ctx} />}
              {adminPage === "calendar" && <AdminCalendar ctx={ctx} />}
              {adminPage === "recommend" && <AdminRecommend ctx={ctx} />}
              {adminPage === "artists" && <AdminArtists ctx={ctx} />}
              {adminPage === "knowledge" && <AdminKnowledge ctx={ctx} />}
              {adminPage === "escalations" && <AdminEscalations ctx={ctx} />}
            </>
          )}
        </main>
      )}
      {requestDate && <RequestModal ctx={ctx} dateISO={requestDate} onClose={() => setRequestDate(null)} />}
      {toast && <div style={st.toast}>{toast}</div>}
    </div>
  );
}

/* ============================================================
   HEADER
   ============================================================ */
function useDeskLoad() {}
function Header({ view, onSwitch }) {
  return (
    <header style={st.header}>
      <div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: 5, color: T.cream, lineHeight: 1 }}>
          BUNKER <span style={{ color: T.amber }}>FRIDAYS</span>
        </div>
        <div style={{ fontSize: 11, color: T.muted, letterSpacing: 1.5, textTransform: "uppercase" }}>104 Wellington St · Stratford ON · a listening room</div>
      </div>
      <button onClick={onSwitch} style={st.ghostBtn}>{view === "artist" ? "Venue desk" : "Artist view"}</button>
    </header>
  );
}

/* ============================================================
   LAMPS
   ============================================================ */
function sortEntries(entries) {
  const orderOf = (e) => {
    if (e.status === "confirmed" && e.slotTime) return SLOT_TIMES.indexOf(e.slotTime);
    if (e.status === "confirmed") return 3;
    return 4;
  };
  return [...entries].sort((a, b) => orderOf(a) - orderOf(b));
}

function Lamps({ entries, writers }) {
  const dotStyle = (state) => {
    let bg = T.panel2, glow = "none", border = `1px solid ${T.line}`;
    if (state === "confirmed") { bg = T.amber; glow = `0 0 8px ${T.amber}`; border = `1px solid ${T.amber}`; }
    else if (state === "pending") { bg = "transparent"; border = `1px dashed ${T.amber}`; }
    return { width: 11, height: 11, borderRadius: "50%", background: bg, boxShadow: glow, border, display: "inline-block" };
  };

  if (writers) {
    // Writers Round: three round seats, no time slots
    return (
      <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
        {[0, 1, 2].map((i) => {
          const e = entries[i];
          return <span key={i} style={dotStyle(e ? e.status : null)} />;
        })}
      </span>
    );
  }

  // Standard night: dots are the 8PM, 9PM, 10PM sets, in order
  const state = { "8PM": null, "9PM": null, "10PM": null };
  const confirmed = entries.filter((e) => e.status === "confirmed");
  const pending = entries.filter((e) => e.status === "pending");
  confirmed.forEach((e) => { if (e.slotTime && !state[e.slotTime]) state[e.slotTime] = "confirmed"; });
  confirmed.filter((e) => !e.slotTime || state[e.slotTime] !== "confirmed").forEach((e) => {
    if (e.slotTime && state[e.slotTime] === "confirmed") return;
    const open = SLOT_TIMES.find((t) => !state[t]);
    if (open) state[open] = "confirmed";
  });
  pending.forEach(() => {
    const open = SLOT_TIMES.find((t) => !state[t]);
    if (open) state[open] = "pending";
  });

  return (
    <span style={{ display: "inline-flex", gap: 8, alignItems: "flex-start" }}>
      {SLOT_TIMES.map((t) => (
        <span key={t} style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <span style={dotStyle(state[t])} />
          <span style={{ fontSize: 8.5, letterSpacing: 0.5, color: state[t] === "confirmed" ? T.amber : T.muted, lineHeight: 1 }}>{t.replace("PM", "")}</span>
        </span>
      ))}
    </span>
  );
}

/* ============================================================
   ARTIST: PING BANNER (venue messages)
   ============================================================ */
function PingBanner({ ctx }) {
  const mine = (ctx.pings[ctx.session?.artistId] || []).filter((p) => !p.read);
  if (mine.length === 0) return null;
  async function dismiss(pid) {
    try { await ctx.api.markPingRead(pid); } catch (e) {}
    await ctx.refreshArtist();
  }
  return (
    <div style={{ marginBottom: 14 }}>
      {mine.map((p) => (
        <div key={p.id} style={{ ...st.card, borderLeft: `3px solid ${T.amber}`, marginBottom: 8 }}>
          <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: T.amber }}>Message from The Bunker</div>
          <div style={{ fontSize: 13.5, color: T.cream, marginTop: 5, lineHeight: 1.5 }}>{p.msg || p.message}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
            {p.dateISO && <button onClick={() => { dismiss(p.id); ctx.setRequestDate(p.dateISO); }} style={{ ...st.amberBtn, fontSize: 12, padding: "6px 12px" }}>Request this date</button>}
            <button onClick={() => dismiss(p.id)} style={{ ...st.ghostBtn, fontSize: 11.5, padding: "4px 10px" }}>Got it</button>
            <span style={{ fontSize: 10.5, color: T.muted }}>{new Date(p.ts).toLocaleDateString("en-CA")}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   ARTIST: DATES
   ============================================================ */
function DatesPage({ ctx }) {
  const [futureDate, setFutureDate] = useState("");
  const fridays = fridaysAhead(90);

  function tryFuture() {
    if (!futureDate) return;
    const d = parseISO(futureDate);
    if (d.getDay() !== 5) { ctx.flash("That date is not a Friday. Sessions run Friday nights."); return; }
    if (d <= new Date()) { ctx.flash("Pick a future date."); return; }
    ctx.setRequestDate(futureDate);
  }

  return (
    <div>
      <p style={st.lede}>Three artists share every Friday night, one 45-minute set each from 8PM to 11PM. Request as many dates as you like, up to 2 sets on any single night; generally one gets booked. Artists have made $50 to $150 per set, with outliers both ways.</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {fridays.map((d) => {
          const dISO = iso(d);
          const { entries, closed } = ctx.entriesFor(dISO);
          const writers = ctx.writersNight(d);
          const confirmed = entries.filter((e) => e.status === "confirmed").length;
          const full = closed || confirmed >= 3;
          return (
            <div key={dISO} style={{ ...st.card, opacity: full ? 0.55 : 1, borderLeft: writers ? `3px solid ${T.amber}` : `3px solid transparent` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ textAlign: "center", minWidth: 52 }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 34, color: T.cream, lineHeight: 0.9 }}>{d.getDate()}</div>
                  <div style={{ fontSize: 11, letterSpacing: 2, color: T.amber }}>{MONTHS[d.getMonth()]}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <Lamps entries={entries} writers={writers} />
                    {writers && <span style={st.badge}>WRITERS ROUND</span>}
                    {full && <span style={{ ...st.badge, borderColor: T.muted, color: T.muted }}>{closed ? "CLOSED" : "FULL"}</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: T.muted, marginTop: 5, lineHeight: 1.5 }}>
                    {entries.length === 0
                      ? (writers ? "Originals only · 12 to 15 songs · PWYC night" : "Open night · 3 slots")
                      : sortEntries(entries).map((e, i) => (
                          <div key={i} style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                            {!writers && <span style={{ color: e.slotTime ? T.amber : T.muted, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, fontSize: 13, minWidth: 34 }}>{e.slotTime || "—"}</span>}
                            <span style={{ color: T.cream }}>{e.name}</span>
                            <span style={{ color: e.status === "confirmed" ? T.green : T.amberDim, fontSize: 11.5 }}>{e.status}</span>
                          </div>
                        ))}
                  </div>
                </div>
                {!full && <button onClick={() => ctx.setRequestDate(dISO)} style={st.amberBtn}>Request</button>}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ ...st.card, marginTop: 18 }}>
        <div style={st.cardTitle}>Looking further out?</div>
        <p style={{ fontSize: 13, color: T.muted, margin: "6px 0 10px" }}>Pick any future Friday beyond the 90-day window. We review these the same way.</p>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="date" value={futureDate} onChange={(e) => setFutureDate(e.target.value)} style={st.input} />
          <button onClick={tryFuture} style={st.amberBtn}>Request</button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   ARTIST: INFO ("The Deal")
   ============================================================ */
function InfoPage({ kb }) {
  return (
    <div>
      <h2 style={st.h2}>How Friday Night Sessions work</h2>

      <div style={st.card}>
        <div style={st.cardTitle}>The room</div>
        <p style={st.p}>Tucked downtown at 104 Wellington, The Bunker is Stratford's listening room: a small, warm space where people come to actually listen. Quiet for the verses, loud after the last chord. We built Friday Night Sessions to give emerging artists a stage that treats their music like it matters, in front of a crowd that's here for exactly that.</p>
        <p style={st.p}>It's also a hang. Artists are encouraged to stay for the other acts on their bill, not required, but the between-set conversations are half the magic: plenty of collaborations, co-writes, and future bookings have started at our bar. Leave with new fans and new friends.</p>
        <p style={st.p}>The practical shape of the night: three artists, one 45-minute set each from 8PM to 11PM, soundcheck 6PM to 7PM, no cover for guests, and we aim for at least one local artist on every bill. We seat roughly 30 to 40 guests, close enough that every word carries.</p>
        <p style={st.p}>Two set types: an <b style={{ color: T.cream }}>originals set</b> or a <b style={{ color: T.cream }}>covers set</b>. You're welcome to play some originals inside a covers set, but only an originals set carries the tip guarantee. A maximum of 2 of the 3 nightly slots can be originals sets.</p>
      </div>

      <div style={st.card}>
        <div style={st.cardTitle}>Compensation: tips and merch</div>
        <p style={st.p}><b style={{ color: T.cream }}>Tips work like a door cover.</b> We invite patrons to tip right on their bills, and those tips are split equally among the night's sets, so every artist benefits from the whole night, not just their own hour. If a patron asks to tip you specifically, the first $5 still gets split equally among all sets, and the rest goes to you. Tips are e-transferred over the weekend. Double-check your e-transfer email when you request: transfers sent to a wrong address can't be corrected. If you're not set up for autodeposit, the transfer password is "Bunker".</p>
        <p style={st.p}><b style={{ color: T.amber }}>$50 tip guarantee</b> on originals sets, whether it comes from patrons or The Bunker tops it up. Covers sets don't carry the guarantee, even if some originals are played.</p>
        <p style={st.p}><b style={{ color: T.cream }}>What artists actually make:</b> typically $50 to $150 per set between tips and merch, with outliers on both the upper and lower ends.</p>
        <p style={st.p}><b style={{ color: T.cream }}>Merch:</b> sales happen directly between you and patrons. You keep 100%. Bring it.</p>
        <p style={st.p}><b style={{ color: T.cream }}>Drinks:</b> each slot includes 2 half-price drinks.</p>
      </div>

      <div style={{ ...st.card, borderLeft: `3px solid ${T.amber}` }}>
        <div style={st.cardTitle}>Writers Round · last Friday of every month</div>
        <p style={st.p}>A Nashville-style round: three artists trade songs and the stories behind them, originals only, 12 to 15 songs each. Two sets from 8PM to about 10:30PM with a 15-minute break. Soundcheck 6:30 to 7PM.</p>
        <p style={st.p}>It's a Pay What You Can night (recommended $15). PWYC proceeds are collected on guest tabs and split between the artists by e-transfer after the show, usually Saturday or Sunday. $50 from donations and bar covers sound costs. You get 2 half-price drinks or complimentary pop, and merch is encouraged.</p>
      </div>

      <div style={st.card}>
        <div style={st.cardTitle}>Record your set</div>
        <p style={st.p}>Capture your performance with professional audio recording, bookable as an add-on when you request a set. <b style={{ color: T.cream }}>Board Tape</b> ($59 per full set): a stereo mix straight from the board, one uncompressed broadcast-quality .wav, ready for demos, archives, and social content. <b style={{ color: T.cream }}>Full Tracks</b> ($99 per full set): multi-track recording delivered as individual .wav files per channel plus the board mix, so you can mix and master it yourself. Two sets run $99 (Board Tape) or $159 (Full Tracks). Prices plus HST.</p>
        <p style={st.p}>Recordings are delivered raw and unedited, as captured: no mixing, mastering, or post-production. Book at least 48 hours ahead; subject to engineer availability. Questions: {INFO_EMAIL}.</p>
      </div>

      <div style={st.card}>
        <div style={st.cardTitle}>Booking: single set or rotation</div>
        <p style={st.p}>Every request is reviewed by the venue before a slot is confirmed. You'll see your request marked pending right away and confirmed once approved. Request as many dates as you like, up to 2 sets on any single night; generally one gets booked. Once you're confirmed for a date, new bookings open up again 4 weeks after that show.</p>
        <p style={st.p}>When you request, tell us what you're after: a <b style={{ color: T.cream }}>single set</b> (a one-off; we won't reach out about future sets) or <b style={{ color: T.cream }}>regular rotation</b> (we add you to our booking rotation and may reach out to offer future dates).</p>
        <p style={st.p}>An account gets you prefilled request forms and request tracking right here in the app. Either way, once you've played or requested, you're in our artist database.</p>
      </div>

      <div style={st.card}>
        <div style={st.cardTitle}>Promotion</div>
        <p style={st.p}>Upload up to {MAX_PHOTOS} photos with your request; we use them in promo posters, weekly and monthly social posts, recap media, and the newsletter. Artists who self-promote and fill seats have a higher rebook rate. After the show, streamable artists join the Bunker Alumni playlist in the lounge, and new releases get shared on our socials on a best-effort basis. We'd also love a Google review.</p>
      </div>

      <div style={st.card}>
        <div style={st.cardTitle}>Stage, gear rules, and load-in</div>
        <p style={st.p}>Stage is 15' wide, 4.5' to 7' deep. <b style={{ color: T.cream }}>Drums: house kit only, no personal kits on stage.</b> The house kit lives in a mic'd sound booth with a headphone mix. Hand percussion (hand drums, cajons) is welcome on stage.</p>
        <p style={st.p}><b style={{ color: T.cream }}>Your amps are welcome</b>, but they go in the amp isolation box on stage when applicable (fits two mic'd 1x12 combos, plus room for one more up to 24" x 12" x 27"). <b style={{ color: T.cream }}>Backing tracks are discouraged</b>: we're a live music venue, though some exceptions are made. Ask us.</p>
        <p style={st.p}><b style={{ color: T.cream }}>We provide our own sound tech and a full PA</b>, so you're mixed by someone who knows the room. House backline: GH bass head with DI, Blackstar Club 40, Korg SP500 weighted digital piano, 5 guitar stands. PreSonus board run from iPad, Mackie mains, Alto sub, 3 Alto monitors with individual mixes, 3 SE V7 vocal mics with stands, plus DIs. Bring extras if you need more than 3 mics or stands; extra lighting welcome.</p>
        <p style={st.p}>Load in at The Bunker lot, then move your vehicle: evening parking is in neighbouring lots or on the street, since the Bunker spots belong to other units.</p>
      </div>

      {kb && kb.trim() && (
        <div style={st.card}>
          <div style={st.cardTitle}>More particulars</div>
          <p style={{ ...st.p, whiteSpace: "pre-wrap" }}>{kb}</p>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   PHOTO UPLOADER
   ============================================================ */
function PhotoUploader({ photos, onChange, flash, ctx }) {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const uploadsOn = !!(ctx && ctx.info && ctx.info.photoUploads && ctx.session);
  async function onFiles(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) { flash(`Maximum ${MAX_PHOTOS} photos.`); return; }
    const take = files.slice(0, room);
    setBusy(true);
    try {
      if (uploadsOn) {
        // Full-resolution upload to object storage via presigned PUT.
        const urls = [];
        for (const file of take) {
          const ct = file.type && file.type.startsWith("image/") ? file.type : "image/jpeg";
          const pre = await ctx.api.photoPresign(ct);
          const put = await fetch(pre.uploadUrl, { method: "PUT", headers: { "Content-Type": ct }, body: file });
          if (!put.ok) throw new Error("upload failed");
          urls.push(pre.publicUrl);
        }
        const next = [...photos, ...urls];
        onChange(next);
        try { await ctx.api.savePhotos(next.filter((p) => p.startsWith("https://"))); } catch (er) {}
      } else {
        // Not signed in or uploads not configured: local preview only.
        const added = await Promise.all(take.map((f) => compressImage(f)));
        onChange([...photos, ...added]);
        flash("Preview only: sign in to save promo photos to your profile.");
      }
      if (files.length > room) flash(`Added ${room}; max ${MAX_PHOTOS} photos.`);
    } catch { flash("Could not upload one of those images."); }
    setBusy(false);
    e.target.value = "";
  }
  return (
    <div>
      <div style={st.label}>Promo photos ({photos.length}/{MAX_PHOTOS})</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {photos.map((p, i) => (
          <div key={i} style={{ position: "relative" }}>
            <img src={p} alt={`photo ${i + 1}`} style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6, border: `1px solid ${T.line}`, display: "block" }} />
            <button onClick={() => onChange(photos.filter((_, j) => j !== i))} aria-label="Remove photo" style={{
              position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%",
              background: T.red, color: T.cream, border: "none", fontSize: 11, lineHeight: "18px", cursor: "pointer", padding: 0,
            }}>✕</button>
          </div>
        ))}
        {photos.length < MAX_PHOTOS && (
          <button onClick={() => fileRef.current?.click()} disabled={busy} style={st.ghostBtn}>{busy ? "Uploading..." : (photos.length ? "+ Add photo" : "+ Add photos")}</button>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple onChange={onFiles} style={{ display: "none" }} />
      </div>
      <div style={{ fontSize: 11.5, color: T.muted, marginTop: 6 }}>Please add at least one clear photo. We use these for posters, socials, recap media, and the newsletter.</div>
    </div>
  );
}

/* ============================================================
   ARTIST: REQUEST MODAL
   Fields mirror BunkerStratford.com/performer-inquiry
   ============================================================ */
function RequestModal({ ctx, dateISO, onClose }) {
  const d = parseISO(dateISO);
  const writers = ctx.writersNight(d);
  const { entries } = ctx.entriesFor(dateISO);
  const originalsTaken = entries.filter((e) => e.status === "confirmed" && e.setType === "single-originals").length;
  const originalsFull = originalsTaken >= 2;
  const takenTimes = ctx.takenSlots(dateISO);

  const loggedIn = !!ctx.session;
  const prof = loggedIn ? (ctx.artists[ctx.session.artistId] || {}) : null;
  const profGap = loggedIn ? profileMissingForBooking(prof) : [];

  const [f, setF] = useState({
    name: prof?.name || "",
    contactMethod: prof?.contactMethod || "Email",
    email: prof?.email || "",
    phone: prof?.phone || "",
    instagram: prof?.instagram || "",
    facebook: prof?.facebook || "",
    genre: prof?.genre || "",
    originalsSets: prof?.originalsSets ?? "",
    coversSets: prof?.coversSets ?? "",
    city: prof?.city || "",
    links: prof?.links || "",
    bio: prof?.bio || "",
    etransferEmail: prof?.etransferEmail || "",
    photos: photosOf(prof),
    setType: writers ? "writers-round" : (originalsFull ? "covers" : ""),
    bookingPref: prof?.bookingPref || "",
    slotPref: "any",
    recording: "none",
    songsReady: false,
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [missing, setMissing] = useState([]);

  // For a signed-in artist, set availability comes from their saved profile.
  const noOriginals = String((loggedIn ? prof?.originalsSets : f.originalsSets) ?? "").trim() === "0";
  const noCovers = String((loggedIn ? prof?.coversSets : f.coversSets) ?? "").trim() === "0";

  function up(k, v) {
    setF((p) => {
      const n = { ...p, [k]: v };
      if (k === "originalsSets" && String(v).trim() === "0" && n.setType === "single-originals") n.setType = "";
      if (k === "coversSets" && String(v).trim() === "0" && n.setType === "covers") n.setType = "";
      return n;
    });
    setMissing([]);
  }

  function validate() {
    const m = [];
    if (!loggedIn) {
      if (!f.name.trim()) m.push("performer or group name");
      if (!f.email.trim()) m.push("email");
      if ((f.contactMethod === "Phone" || f.contactMethod === "Text") && !f.phone.trim()) m.push("phone (your chosen contact method)");
      if (f.contactMethod === "Instagram" && !f.instagram.trim()) m.push("Instagram handle (your chosen contact method)");
      if (f.contactMethod === "Facebook" && !f.facebook.trim()) m.push("Facebook handle (your chosen contact method)");
      if (!f.genre.trim()) m.push("genre");
      if (String(f.originalsSets).trim() === "") m.push("# of original sets");
      if (String(f.coversSets).trim() === "") m.push("# of cover sets");
      if (!f.city.trim()) m.push("home city");
      if (!f.bio.trim()) m.push("biography");
      if (!f.bookingPref) m.push("booking preference (single or rotation)");
      if (f.etransferEmail.trim() && !f.etransferEmail.includes("@")) m.push("a valid e-transfer email");
    }
    if (!writers && !f.setType) m.push("set type");
    if (!writers && f.setType === "single-originals" && noOriginals) m.push("an available set type (you list 0 original sets)");
    if (!writers && f.setType === "covers" && noCovers) m.push("an available set type (you list 0 cover sets)");
    if (!writers && noOriginals && noCovers) m.push("at least 1 original or cover set in your counts");
    if (writers && noOriginals) m.push("original material (Writers Round is originals only, but you list 0 original sets)");
    if (writers && !f.songsReady) m.push("12 to 15 originals confirmation");
    return m;
  }

  async function submit() {
    if (loggedIn && profGap.length) {
      ctx.flash("Finish your profile in the Account tab first.");
      return;
    }
    const m = validate();
    if (m.length) {
      setMissing(m);
      ctx.flash(`Still needed: ${m.slice(0, 3).join(", ")}${m.length > 3 ? `, and ${m.length - 3} more` : ""}`);
      return;
    }
    setBusy(true);
    const p = loggedIn ? prof : f;
    const payload = {
      date: dateISO,
      eventType: writers ? EVENT_TYPES.WRITERS : EVENT_TYPES.FRIDAY,
      setType: writers ? "writers-round" : f.setType,
      slotPref: f.slotPref, recording: f.recording, notes: f.notes.trim(),
      songsReady: f.songsReady,
      name: String(p.name || "").trim(), contactMethod: p.contactMethod || "Email",
      email: String(p.email || "").trim(), phone: String(p.phone || "").trim(),
      instagram: String(p.instagram || "").trim(), facebook: String(p.facebook || "").trim(),
      genre: String(p.genre || "").trim(), originalsSets: String(p.originalsSets ?? ""), coversSets: String(p.coversSets ?? ""),
      city: String(p.city || "").trim(), links: String(p.links || "").trim(), bio: String(p.bio || "").trim(),
      etransferEmail: String(p.etransferEmail || "").trim(),
      bookingPref: p.bookingPref,
      photos: (loggedIn ? photosOf(prof) : (f.photos || [])).filter((x) => typeof x === "string" && x.startsWith("https://")),
      turnstileToken: window.__bunkerTurnstileToken || undefined,
    };
    try {
      await ctx.api.submitRequest(payload);
      await ctx.refreshArtist();
      setBusy(false);
      onClose();
      ctx.flash("Request sent. It shows as pending until the venue reviews it.");
    } catch (e) {
      setBusy(false);
      ctx.flash(e.message || "Could not send the request. Try again.");
    }
  }

  return (
    <div style={st.overlay} onClick={onClose}>
      <div style={st.modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: 2, color: T.amber }}>
          REQUEST · {fmtLong(d).toUpperCase()}
        </div>
        {writers && <div style={{ ...st.badge, marginTop: 6 }}>WRITERS ROUND · ORIGINALS ONLY · PWYC</div>}
        {!loggedIn && <p style={{ fontSize: 12.5, color: T.muted, marginTop: 8 }}>You're requesting as a guest. An account lets you keep a profile and skip straight to set details next time. Either way your info joins our artist database once you request or play.</p>}
        {loggedIn && (
          <div style={{ fontSize: 12.5, color: T.muted, marginTop: 8 }}>
            Booking as <span style={{ color: T.cream }}>{prof?.name}</span>{prof?.bookingPref ? ` · ${prof.bookingPref === "rotation" ? "in rotation" : "single sets"}` : ""}. Update your details in the Account tab.
          </div>
        )}

        {loggedIn && profGap.length > 0 ? (
          <div style={{ ...st.card, borderLeft: `3px solid ${T.amber}`, marginTop: 12 }}>
            <div style={{ fontSize: 13.5, color: T.amber, fontWeight: 700 }}>Finish your profile to request dates</div>
            <div style={{ fontSize: 12.5, color: T.muted, marginTop: 6 }}>Still needed: {profGap.join(", ")}.</div>
            <button onClick={() => { onClose(); ctx.setPage("account"); }} style={{ ...st.amberBtn, marginTop: 10 }}>Go to my Account</button>
          </div>
        ) : (
        <>
        <div style={st.formGrid}>
          {!loggedIn && <>
            <input placeholder="Full name of performer or group *" value={f.name} onChange={(e) => up("name", e.target.value)} style={st.input} />
            <div>
              <div style={st.label}>Best contact method *</div>
              <select value={f.contactMethod} onChange={(e) => up("contactMethod", e.target.value)} style={{ ...st.input, width: "100%", boxSizing: "border-box" }}>
                <option>Email</option><option>Phone</option><option>Text</option><option>Instagram</option><option>Facebook</option>
              </select>
            </div>
            <input type="email" name="contact-email" autoComplete="email" inputMode="email" placeholder="Email *" value={f.email} onChange={(e) => up("email", e.target.value)} style={st.input} />
            <input placeholder={`Phone ${f.contactMethod === "Phone" || f.contactMethod === "Text" ? "*" : "(optional)"}`} value={f.phone} onChange={(e) => up("phone", e.target.value)} style={st.input} />
            <div style={{ display: "flex", gap: 8 }}>
              <input placeholder={`Instagram ${f.contactMethod === "Instagram" ? "*" : "(optional)"}`} value={f.instagram} onChange={(e) => up("instagram", e.target.value)} style={{ ...st.input, flex: 1, minWidth: 0 }} />
              <input placeholder={`Facebook ${f.contactMethod === "Facebook" ? "*" : "(optional)"}`} value={f.facebook} onChange={(e) => up("facebook", e.target.value)} style={{ ...st.input, flex: 1, minWidth: 0 }} />
            </div>
            <input placeholder="Genre *" value={f.genre} onChange={(e) => up("genre", e.target.value)} style={st.input} />
            <div style={{ display: "flex", gap: 8 }}>
              <input placeholder="# of original sets *" value={f.originalsSets} onChange={(e) => up("originalsSets", e.target.value)} style={{ ...st.input, flex: 1, minWidth: 0 }} />
              <input placeholder="# of cover sets *" value={f.coversSets} onChange={(e) => up("coversSets", e.target.value)} style={{ ...st.input, flex: 1, minWidth: 0 }} />
            </div>
            <input placeholder="Home city * (we book at least 1 local per night)" value={f.city} onChange={(e) => up("city", e.target.value)} style={st.input} />
            <input placeholder="Where can we see a sample of your work? (optional)" value={f.links} onChange={(e) => up("links", e.target.value)} style={st.input} />
            <textarea placeholder="Biography *" value={f.bio} onChange={(e) => up("bio", e.target.value)} rows={3} style={{ ...st.input, resize: "vertical" }} />
          </>}

          {!writers && (
            <div>
              <div style={st.label}>Set type *</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Choice active={f.setType === "single-originals"} disabled={originalsFull || noOriginals} onClick={() => up("setType", "single-originals")}
                  title="Originals set" sub={noOriginals ? "Your profile lists 0 original sets" : originalsFull ? "Both originals slots are taken this night" : "$50 tip guarantee"} />
                <Choice active={f.setType === "covers"} disabled={noCovers} onClick={() => up("setType", "covers")}
                  title="Covers set" sub={noCovers ? "Your profile lists 0 cover sets" : "Originals welcome in the mix; no guarantee"} />
              </div>
            </div>
          )}

          {writers && (
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13.5, color: T.cream, cursor: "pointer" }}>
              <input type="checkbox" checked={f.songsReady} onChange={(e) => up("songsReady", e.target.checked)} style={{ marginTop: 3 }} />
              I have 12 to 15 original songs ready to perform. *
            </label>
          )}

          {!writers && (
            <div>
              <div style={st.label}>Preferred start time (not guaranteed)</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[["any", "Any"], ["8PM", "8PM"], ["9PM", "9PM"], ["10PM", "10PM"]].map(([v, label]) => {
                  const taken = v !== "any" && takenTimes.has(v);
                  return (
                    <button key={v} onClick={() => !taken && up("slotPref", v)} disabled={taken} style={{
                      padding: "8px 14px", borderRadius: 8, cursor: taken ? "not-allowed" : "pointer", fontWeight: 700, fontSize: 13,
                      fontFamily: "'Karla', sans-serif",
                      background: f.slotPref === v ? T.panel2 : "transparent",
                      color: f.slotPref === v ? T.amber : T.muted,
                      border: f.slotPref === v ? `1px solid ${T.amber}` : `1px solid ${T.line}`,
                      opacity: taken ? 0.35 : 1,
                    }}>{taken ? `${label} (taken)` : label}</button>
                  );
                })}
              </div>
              <div style={{ fontSize: 11.5, color: T.muted, marginTop: 5 }}>We'll do our best; the final lineup order is set by the venue.</div>
            </div>
          )}

          {!loggedIn && (
            <div>
              <div style={st.label}>What are you looking for? *</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Choice active={f.bookingPref === "single"} onClick={() => up("bookingPref", "single")}
                  title="Single set" sub="A one-off; we won't reach out about future sets" />
                <Choice active={f.bookingPref === "rotation"} onClick={() => up("bookingPref", "rotation")}
                  title="Regular rotation" sub="Add me to the rotation; reach out with future dates" />
              </div>
            </div>
          )}

          {!loggedIn && (
            <div>
              <div style={st.label}>E-transfer email (if different from above)</div>
              <input type="email" name="etransfer-email" autoComplete="off" inputMode="email" data-1p-ignore data-lpignore="true" placeholder="Leave blank to use your contact email" value={f.etransferEmail} onChange={(e) => up("etransferEmail", e.target.value)} style={{ ...st.input, width: "100%", boxSizing: "border-box" }} />
              <div style={{ fontSize: 11.5, color: T.red, marginTop: 5 }}>Please double-check for typos. E-transfers sent to an incorrect email cannot be corrected.</div>
              <div style={{ fontSize: 11.5, color: T.muted, marginTop: 3 }}>Not set up for autodeposit? The transfer password is "Bunker".</div>
            </div>
          )}

          {!writers && (
          <div>
            <div style={st.label}>Record your set? (optional add-on, +HST)</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Choice active={f.recording === "none"} onClick={() => up("recording", "none")}
                title="No recording" sub="Just the show" />
              <Choice active={f.recording === "board-tape"} onClick={() => up("recording", "board-tape")}
                title="Board Tape · $59" sub="Stereo board mix, one .wav, demo and social ready" />
              <Choice active={f.recording === "full-tracks"} onClick={() => up("recording", "full-tracks")}
                title="Full Tracks · $99" sub="Multi-track .wav per channel plus board mix" />
            </div>
            {f.recording !== "none" && <div style={{ fontSize: 11.5, color: T.muted, marginTop: 5 }}>Recordings are raw, unedited files, delivered as captured. Subject to engineer availability; we'll confirm with your booking.</div>}
          </div>
          )}

          {!loggedIn && <PhotoUploader photos={f.photos} onChange={(p) => up("photos", p)} flash={ctx.flash} ctx={ctx} />}

          <textarea placeholder="Anything we should know? (need an early set for the babysitter, arriving late from work, gear notes...)" value={f.notes} onChange={(e) => up("notes", e.target.value)} rows={2} style={{ ...st.input, resize: "vertical" }} />
        </div>

        {missing.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 12.5, color: T.red }}>
            Still needed: {missing.join(", ")}
          </div>
        )}

        <div style={{ marginTop: 12, fontSize: 11.5, color: T.muted, lineHeight: 1.5 }}>
          We reply from <span style={{ color: T.cream }}>{INFO_EMAIL}</span>. Please add it to your safe senders, and check your junk folder if you don't hear back.
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button onClick={submit} disabled={busy} style={{ ...st.amberBtn, flex: 1, opacity: busy ? 0.6 : 1 }}>{busy ? "Sending..." : "Send request"}</button>
          <button onClick={onClose} style={st.ghostBtn}>Cancel</button>
        </div>
        </>
        )}
      </div>
    </div>
  );
}

function Choice({ active, disabled, onClick, title, sub }) {
  return (
    <button onClick={disabled ? undefined : onClick} style={{
      textAlign: "left", padding: "10px 12px", borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer",
      background: active ? T.panel2 : "transparent",
      border: active ? `1px solid ${T.amber}` : `1px solid ${T.line}`,
      opacity: disabled ? 0.45 : 1, flex: "1 1 150px",
    }}>
      <div style={{ color: T.cream, fontSize: 13.5, fontWeight: 700 }}>{title}</div>
      <div style={{ color: active ? T.amber : T.muted, fontSize: 12 }}>{sub}</div>
    </button>
  );
}

/* ============================================================
   ARTIST: ASK (chatbot)
   Requires the Claude artifact environment to reach the AI API.
   ============================================================ */
function AskPage({ ctx }) {
  const [msgs, setMsgs] = useState([
    { role: "assistant", text: "Hey, I can answer questions about Friday Night Sessions: comp, set times, the Writers Round, gear rules, parking, promo. If I'm not sure about something, a human from the venue follows up. What would you like to know?" },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  async function send() {
    const q = input.trim();
    if (!q || busy) return;
    const history = [...msgs, { role: "user", text: q }];
    setMsgs(history);
    setInput("");
    setBusy(true);
    try {
      // The server holds the knowledge base and the Anthropic key; it answers
      // from CORE_FACTS + venue notes and logs an escalation when it can't.
      const apiHistory = history.map((m) => ({ role: m.role === "user" ? "user" : "assistant", text: m.text }));
      const r = await ctx.api.chat(apiHistory);
      setMsgs((p) => [...p, { role: "assistant", text: r.text, mailto: r.mailto || null }]);
    } catch (e) {
      const mailBody = encodeURIComponent(`Unanswered artist question from the Bunker Fridays app\n\nQuestion: ${q}`);
      setMsgs((p) => [...p, { role: "assistant", text: "I couldn't reach the assistant just now. You can email the venue directly below and a human will follow up.", mailto: `mailto:${INFO_EMAIL}?subject=${encodeURIComponent("Artist question: " + q.slice(0, 60))}&body=${mailBody}` }]);
    }
    setBusy(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 200px)", minHeight: 360 }}>
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, paddingBottom: 8 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === "user" ? "flex-end" : "flex-start",
            maxWidth: "85%", padding: "10px 13px", borderRadius: 10, fontSize: 14, lineHeight: 1.5,
            background: m.role === "user" ? T.amber : T.panel,
            color: m.role === "user" ? T.ink : T.cream,
            border: m.role === "user" ? "none" : `1px solid ${T.line}`,
          }}>
            {m.text}
            {m.detail && <div style={{ fontSize: 10.5, color: T.amberDim, marginTop: 6, fontFamily: "monospace" }}>technical: {m.detail}</div>}
            {m.mailto && (
              <div style={{ marginTop: 8 }}>
                <a href={m.mailto} style={{ color: T.amber, fontSize: 13, fontWeight: 700 }}>Email the venue now →</a>
                <div style={{ fontSize: 11.5, color: T.muted, marginTop: 4 }}>Your question was also logged for the venue to follow up.</div>
              </div>
            )}
          </div>
        ))}
        {busy && <div style={{ color: T.muted, fontSize: 13 }}>thinking...</div>}
        <div ref={endRef} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Ask about comp, gear rules, the Writers Round..." style={{ ...st.input, flex: 1 }} />
        <button onClick={send} disabled={busy} style={st.amberBtn}>Send</button>
      </div>
    </div>
  );
}

/* ============================================================
   ARTIST: MY REQUESTS
   ============================================================ */
function MinePage({ ctx }) {
  const [cancelId, setCancelId] = useState(null);
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    setArmed(false);
    if (cancelId) {
      const t = setTimeout(() => setArmed(true), 450);
      return () => clearTimeout(t);
    }
  }, [cancelId]);
  const mine = ctx.session
    ? ctx.requests.filter((r) => r.artistId === ctx.session.artistId)
    : [];
  const today = iso(new Date());

  async function cancel(id) {
    try { await ctx.api.cancelRequest(id); await ctx.refreshArtist(); }
    catch (e) { ctx.flash(e.message || "Could not cancel."); }
    setCancelId(null);
    ctx.flash("Request cancelled. The night is open again.");
  }

  if (!ctx.session) return <p style={st.lede}>Sign in (Account tab) to track your requests here with prefilled forms. Guest requests are still reviewed and responded to, they just aren't tracked in the app.</p>;
  if (mine.length === 0) return <p style={st.lede}>No requests yet. Head to the Dates tab and grab a Friday. Request as many dates as you like, up to 2 sets on any single night.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ fontSize: 12.5, color: T.muted }}>Request as many dates as you like, up to 2 sets per night; generally one gets booked. Once you're confirmed for a date, new bookings open up again 4 weeks after that show.</p>
      {mine.map((r) => {
        const cancellable = (r.status === "pending" || r.status === "approved") && r.date >= today;
        return (
          <div key={r.id} style={st.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ color: T.cream, fontWeight: 700 }}>{fmtLong(parseISO(r.date))}{r.slotTime ? ` · ${r.slotTime}` : ""}</div>
                <div style={{ fontSize: 12.5, color: T.muted }}>{SET_LABELS[r.setType] || "Set"}{r.slotPref && r.slotPref !== "any" && !r.slotTime ? ` · requested ${r.slotPref}` : ""}</div>
                {r.auto && <div style={{ fontSize: 11.5, color: T.amberDim, marginTop: 2 }}>Auto-declined: you were confirmed for {r.autoReason}</div>}
              </div>
              <StatusPill status={r.status} />
            </div>
            {cancellable && cancelId !== r.id && (
              <button onClick={() => setCancelId(r.id)} style={{ ...st.ghostBtn, fontSize: 11.5, padding: "4px 10px", marginTop: 8 }}>Cancel this request</button>
            )}
            {cancelId === r.id && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12.5, color: r.status === "approved" ? T.red : T.muted }}>
                  {r.status === "approved"
                    ? "You're confirmed for this night. Cancelling frees the slot and lets the venue know. Sure?"
                    : "Cancel this request?"}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <button onClick={() => armed && cancel(r.id)} disabled={!armed} style={{ ...st.ghostBtn, borderColor: T.red, color: T.red, fontSize: 12, padding: "5px 12px", opacity: armed ? 1 : 0.4 }}>Yes, cancel</button>
                  <button onClick={() => setCancelId(null)} style={{ ...st.ghostBtn, fontSize: 12, padding: "5px 12px" }}>Keep it</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatusPill({ status }) {
  const map = { pending: [T.amber, "PENDING"], approved: [T.green, "CONFIRMED"], declined: [T.red, "DECLINED"], cancelled: [T.muted, "CANCELLED"] };
  const [c, label] = map[status] || [T.muted, String(status).toUpperCase()];
  return <span style={{ ...st.badge, borderColor: c, color: c }}>{label}</span>;
}

/* ============================================================
   ARTIST: ACCOUNT (email + password)
   ============================================================ */
function AccountPage({ ctx }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [mode, setMode] = useState("signin");
  const [notice, setNotice] = useState("");

  async function go() {
    const em = email.trim().toLowerCase();
    if (!em || !pw) { ctx.flash("Email and password needed."); return; }
    try {
      if (mode === "create") {
        if (!name.trim()) { ctx.flash("Name needed."); return; }
        if (pw.length < 8) { ctx.flash("Password must be at least 8 characters."); return; }
        if (pw !== pw2) { ctx.flash("Passwords don't match."); return; }
        const r = await ctx.api.signup({ name: name.trim(), email: em, password: pw });
        if (r.devVerifyLink) {
          ctx.flash("Account created. Open the verification link to finish (shown below).");
          setNotice(`Verification link (email sending is off in this environment): ${r.devVerifyLink}`);
        } else {
          ctx.flash(r.message || "Check your email to verify, then sign in.");
          setNotice("We sent a verification email. Click the link, then sign in.");
        }
        setMode("signin");
      } else {
        const r = await ctx.api.login(em, pw);
        if (r && r.session) { ctx.setSession(r.session); await ctx.refreshArtist(); ctx.flash(`Welcome back, ${r.session.name}.`); }
      }
    } catch (e) {
      if (e.code === "unverified") { setNotice("Please verify your email first; check your inbox for the link."); }
      ctx.flash(e.message || "Something went wrong.");
    }
    setPw(""); setPw2("");
  }

  if (ctx.session) {
    const a = ctx.artists[ctx.session.artistId] || {};
    return <ProfileEditor ctx={ctx} artist={a} />;
  }

  return (
    <div>
      <p style={st.lede}>An account gets you prefilled date requests, a profile the venue can see, and request tracking right here. You set whether the venue reaches out about future dates in your profile.</p>
      {notice && <div style={{ ...st.card, borderLeft: `3px solid ${T.amber}`, marginBottom: 12, fontSize: 12.5, color: T.cream, wordBreak: "break-all" }}>{notice}</div>}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <button onClick={() => setMode("signin")} style={{ ...st.adminTab, background: mode === "signin" ? T.amber : "transparent", color: mode === "signin" ? T.ink : T.muted }}>Sign in</button>
        <button onClick={() => setMode("create")} style={{ ...st.adminTab, background: mode === "create" ? T.amber : "transparent", color: mode === "create" ? T.ink : T.muted }}>Create account</button>
      </div>
      <div style={st.formGrid}>
        {mode === "create" && <input placeholder="Artist / act name" value={name} onChange={(e) => setName(e.target.value)} style={st.input} />}
        <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} style={st.input} />
        <input type="password" placeholder={mode === "create" ? "Password (8+ characters)" : "Password"} value={pw} onChange={(e) => setPw(e.target.value)} style={st.input} />
        {mode === "create" && <input type="password" placeholder="Confirm password" value={pw2} onChange={(e) => setPw2(e.target.value)} style={st.input} />}
        <button onClick={go} style={st.amberBtn}>{mode === "create" ? "Create account" : "Sign in"}</button>
      </div>
      <p style={{ fontSize: 11.5, color: T.muted, marginTop: 10 }}>Passwords are hashed, never stored in plain text. This is a preview build; production adds server-side authentication and two-factor sign-in.</p>
    </div>
  );
}

/* ============================================================
   ARTIST: PROFILE EDITOR (the Account tab when signed in)
   ============================================================ */
function ProfileEditor({ ctx, artist }) {
  const [f, setF] = useState({
    name: artist.name || "",
    stageName: artist.stageName || "",
    contactMethod: artist.contactMethod || "Email",
    phone: artist.phone || "",
    instagram: artist.instagram || "",
    facebook: artist.facebook || "",
    genre: artist.genre || "",
    city: artist.city || "",
    originalsSets: artist.originalsSets ?? "",
    coversSets: artist.coversSets ?? "",
    bookingPref: artist.bookingPref || "",
    bio: artist.bio || "",
    etransferEmail: artist.etransferEmail || "",
  });
  const initialLinks = (artist.links || "").split(/\n+/).map((s) => s.trim()).filter(Boolean);
  const [links, setLinks] = useState(initialLinks.length ? initialLinks : [""]);
  const [photos, setPhotos] = useState(photosOf(artist));
  const [busy, setBusy] = useState(false);
  function up(k, v) { setF((p) => ({ ...p, [k]: v })); }
  const setLink = (i, v) => setLinks((p) => p.map((x, j) => (j === i ? v : x)));
  const addLink = () => setLinks((p) => [...p, ""]);
  const removeLink = (i) => setLinks((p) => (p.length <= 1 ? [""] : p.filter((_, j) => j !== i)));

  const uploadsOn = !!(ctx.info && ctx.info.photoUploads && ctx.session);
  const missing = [
    ...profileMissingForBooking({ ...f, email: artist.email }),
    ...(uploadsOn && photos.length === 0 ? ["a promo photo"] : []),
  ];

  async function save() {
    if (busy) return;
    if (!f.name.trim()) { ctx.flash("Your act name can't be empty."); return; }
    setBusy(true);
    try {
      await ctx.api.saveProfile({
        name: f.name.trim(), stageName: f.stageName.trim(), contactMethod: f.contactMethod,
        phone: f.phone.trim(), instagram: f.instagram.trim(), facebook: f.facebook.trim(),
        genre: f.genre.trim(), city: f.city.trim(),
        originalsSets: String(f.originalsSets), coversSets: String(f.coversSets),
        bookingPref: f.bookingPref, bio: f.bio.trim(),
        links: links.map((s) => s.trim()).filter(Boolean).join("\n"),
        etransferEmail: f.etransferEmail.trim(),
      });
      await ctx.refreshArtist();
      ctx.flash("Profile saved. The venue sees these details.");
    } catch (e) {
      ctx.flash(e.message || "Could not save your profile.");
    }
    setBusy(false);
  }

  return (
    <div>
      <div style={st.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div>
            <div style={{ color: T.cream, fontWeight: 700, fontSize: 16 }}>Your profile</div>
            <div style={{ color: T.muted, fontSize: 12.5 }}>{artist.email}</div>
          </div>
          <button onClick={async () => { try { await ctx.api.logout(); } catch (e) {} ctx.setSession(null); ctx.flash("Signed out."); }} style={{ ...st.ghostBtn, fontSize: 12, padding: "5px 12px" }}>Sign out</button>
        </div>
        <p style={{ ...st.p, marginTop: 8 }}>This is what the venue sees, and it prefills your date requests, so you only pick set details when you book. Your login email is fixed; contact the venue to change it.</p>

        {missing.length > 0 && (
          <div style={{ ...st.card, borderLeft: `3px solid ${T.amber}`, marginTop: 6, marginBottom: 2 }}>
            <div style={{ fontSize: 12.5, color: T.amber, fontWeight: 700 }}>Finish your profile to request dates</div>
            <div style={{ fontSize: 12.5, color: T.muted, marginTop: 4 }}>Still needed: {missing.join(", ")}.</div>
          </div>
        )}

        <div style={st.formGrid}>
          <input placeholder="Performer or group name *" value={f.name} onChange={(e) => up("name", e.target.value)} style={st.input} />
          <input placeholder="Preferred stage name (if different)" value={f.stageName} onChange={(e) => up("stageName", e.target.value)} style={st.input} />
          <div>
            <div style={st.label}>Best contact method</div>
            <select value={f.contactMethod} onChange={(e) => up("contactMethod", e.target.value)} style={{ ...st.input, width: "100%", boxSizing: "border-box" }}>
              <option>Email</option><option>Phone</option><option>Text</option><option>Instagram</option><option>Facebook</option>
            </select>
          </div>
          <input type="tel" inputMode="tel" placeholder={f.contactMethod === "Phone" || f.contactMethod === "Text" ? "Phone *" : "Phone"} value={f.phone} onChange={(e) => up("phone", e.target.value)} style={st.input} />
          <div style={{ display: "flex", gap: 8 }}>
            <input placeholder={f.contactMethod === "Instagram" ? "Instagram *" : "Instagram"} value={f.instagram} onChange={(e) => up("instagram", e.target.value)} style={{ ...st.input, flex: 1, minWidth: 0 }} />
            <input placeholder={f.contactMethod === "Facebook" ? "Facebook *" : "Facebook"} value={f.facebook} onChange={(e) => up("facebook", e.target.value)} style={{ ...st.input, flex: 1, minWidth: 0 }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input placeholder="Genre *" value={f.genre} onChange={(e) => up("genre", e.target.value)} style={{ ...st.input, flex: 1, minWidth: 0 }} />
            <input placeholder="Home city *" value={f.city} onChange={(e) => up("city", e.target.value)} style={{ ...st.input, flex: 1, minWidth: 0 }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input inputMode="numeric" placeholder="# original sets *" value={f.originalsSets} onChange={(e) => up("originalsSets", e.target.value)} style={{ ...st.input, flex: 1, minWidth: 0 }} />
            <input inputMode="numeric" placeholder="# cover sets *" value={f.coversSets} onChange={(e) => up("coversSets", e.target.value)} style={{ ...st.input, flex: 1, minWidth: 0 }} />
          </div>

          <div>
            <div style={st.label}>Booking preference *</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Choice active={f.bookingPref === "single"} onClick={() => up("bookingPref", "single")}
                title="Single set" sub="One-offs; we won't reach out about future dates" />
              <Choice active={f.bookingPref === "rotation"} onClick={() => up("bookingPref", "rotation")}
                title="Regular rotation" sub="Add me to the rotation; reach out with future dates" />
            </div>
          </div>

          <textarea placeholder="Short bio *" value={f.bio} onChange={(e) => up("bio", e.target.value)} rows={3} style={{ ...st.input, resize: "vertical" }} />

          <div>
            <div style={st.label}>Links (website, streaming, EPK)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {links.map((lnk, i) => (
                <div key={i} style={{ display: "flex", gap: 8 }}>
                  <input placeholder="https://..." value={lnk} onChange={(e) => setLink(i, e.target.value)} style={{ ...st.input, flex: 1, minWidth: 0 }} />
                  {links.length > 1 && (
                    <button onClick={() => removeLink(i)} aria-label="Remove link" style={{ ...st.ghostBtn, padding: "0 12px", color: T.muted }}>✕</button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={addLink} style={{ ...st.ghostBtn, marginTop: 8, fontSize: 12.5, padding: "5px 12px" }}>+ Add another link</button>
          </div>

          <div>
            <div style={st.label}>Promo photos · used for posters, socials, and the newsletter</div>
            <PhotoUploader photos={photos} onChange={setPhotos} flash={ctx.flash} ctx={ctx} />
          </div>

          <div>
            <div style={st.label}>E-transfer email (if different from your login email)</div>
            <input type="email" name="etransfer-email" autoComplete="off" inputMode="email" data-1p-ignore data-lpignore="true" placeholder="Leave blank to use your contact email" value={f.etransferEmail} onChange={(e) => up("etransferEmail", e.target.value)} style={{ ...st.input, width: "100%", boxSizing: "border-box" }} />
            <div style={{ fontSize: 11.5, color: T.red, marginTop: 5 }}>Double-check for typos. E-transfers sent to an incorrect email cannot be corrected.</div>
            <div style={{ fontSize: 11.5, color: T.muted, marginTop: 3 }}>Not set up for autodeposit? The transfer password is "Bunker".</div>
          </div>

          <button onClick={save} disabled={busy} style={{ ...st.amberBtn, opacity: busy ? 0.6 : 1 }}>{busy ? "Saving..." : "Save profile"}</button>
        </div>
      </div>

      {ctx.info?.pushPublicKey && "serviceWorker" in navigator && "PushManager" in window && (
        <div style={st.card}>
          <div style={st.cardTitle}>Booking notifications</div>
          <p style={{ ...st.p, marginTop: 4 }}>Get a notification on this device when The Bunker confirms your booking. Requires this app to be added to your home screen on iPhone.</p>
          <button onClick={async () => {
            try {
              const permission = await Notification.requestPermission();
              if (permission !== "granted") { ctx.flash("Notification permission was denied."); return; }
              const reg = await navigator.serviceWorker.ready;
              const existing = await reg.pushManager.getSubscription();
              if (existing) await existing.unsubscribe();
              const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(ctx.info.pushPublicKey) });
              await ctx.api.artistPushSubscribe(sub.toJSON());
              ctx.flash("Notifications enabled. You'll get a ping when your booking is confirmed.");
            } catch (e) { ctx.flash(e.message || "Could not enable notifications."); }
          }} style={st.ghostBtn}>
            {Notification.permission === "granted" ? "Re-register this device" : "Enable booking notifications"}
          </button>
        </div>
      )}

      <BlackoutCard ctx={ctx} artist={artist} />
    </div>
  );
}

/* ============================================================
   ARTIST: BLACKOUT DATES
   ============================================================ */
function BlackoutCard({ ctx, artist }) {
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("other");
  const today = iso(new Date());
  const blackouts = (artist.blackouts || []).filter((b) => {
    // keep Stratford blackouts until their 2-week tail has passed
    const keepUntil = parseISO(b.date);
    keepUntil.setDate(keepUntil.getDate() + (b.reason === "stratford" ? 14 : 0));
    return iso(keepUntil) >= today;
  });

  async function add() {
    if (!date) return;
    if (date < today) { ctx.flash("Pick a future date."); return; }
    try {
      await ctx.api.addBlackout(date, reason);
      await ctx.refreshArtist();
      setDate("");
      ctx.flash(reason === "stratford"
        ? "Got it. We won't reach out for that date, or for 2 weeks either side, since you're playing locally."
        : "Got it. We won't reach out for that date.");
    } catch (e) { ctx.flash(e.message || "Could not save that date."); }
  }

  async function remove(idx) {
    const b = blackouts[idx];
    if (!b) return;
    try { await ctx.api.removeBlackout(b.date, b.reason); await ctx.refreshArtist(); }
    catch (e) { ctx.flash(e.message || "Could not remove that date."); }
  }

  return (
    <div style={{ ...st.card, marginTop: 10 }}>
      <div style={st.cardTitle}>Blackout dates</div>
      <p style={{ fontSize: 12.5, color: T.muted, margin: "6px 0 10px" }}>Tell us when you can't play and we won't reach out for those dates. If you're playing elsewhere in Stratford, we also hold off for 2 weeks either side; spacing local shows keeps the draw strong for everyone, you included.</p>
      {blackouts.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
          {blackouts.map((b, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13, color: T.cream }}>{fmtLong(parseISO(b.date))}</span>
              <span style={{ ...st.badge, borderColor: b.reason === "stratford" ? T.amber : T.muted, color: b.reason === "stratford" ? T.amber : T.muted }}>{b.reason === "stratford" ? "PLAYING IN STRATFORD · 2WK BUFFER" : "UNAVAILABLE"}</span>
              <button onClick={() => remove(i)} style={{ ...st.ghostBtn, fontSize: 11, padding: "2px 8px", marginLeft: "auto" }}>Remove</button>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={st.input} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Choice active={reason === "other"} onClick={() => setReason("other")} title="Just unavailable" sub="Only this date is blocked" />
          <Choice active={reason === "stratford"} onClick={() => setReason("stratford")} title="Playing elsewhere in Stratford" sub="Blocks 2 weeks either side here" />
        </div>
        <button onClick={add} style={st.amberBtn}>Add blackout date</button>
      </div>
    </div>
  );
}

/* ============================================================
   ADMIN
   ============================================================ */
function AdminGate({ onOk }) {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [totp, setTotp] = useState("");
  const [needTotp, setNeedTotp] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  async function check() {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const r = await api.adminLogin(email.trim().toLowerCase(), pw, needTotp ? totp.trim() : undefined);
      if (r && r.ok) { onOk(); return; }
    } catch (e) {
      if (e.code === "totp-required") { setNeedTotp(true); setErr("Enter your authenticator code."); }
      else setErr(e.message || "Sign-in failed.");
    }
    setBusy(false);
  }
  return (
    <div style={{ maxWidth: 360, margin: "60px auto", textAlign: "center" }}>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 3, color: T.amber }}>VENUE DESK</div>
      <p style={{ fontSize: 13, color: T.muted }}>Sign in with your venue account.</p>
      <input value={email} onChange={(e) => { setEmail(e.target.value); setErr(""); }} placeholder="Email" style={{ ...st.input, width: "100%", boxSizing: "border-box", marginBottom: 8 }} />
      <input type="password" value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} onKeyDown={(e) => e.key === "Enter" && check()} placeholder="Password" style={{ ...st.input, width: "100%", boxSizing: "border-box" }} />
      {needTotp && <input value={totp} onChange={(e) => { setTotp(e.target.value); setErr(""); }} onKeyDown={(e) => e.key === "Enter" && check()} placeholder="6-digit authenticator code" style={{ ...st.input, width: "100%", boxSizing: "border-box", marginTop: 8, textAlign: "center", letterSpacing: 4 }} />}
      {err && <div style={{ color: T.red, fontSize: 13, marginTop: 6 }}>{err}</div>}
      <button onClick={check} disabled={busy} style={{ ...st.amberBtn, marginTop: 10, width: "100%", opacity: busy ? 0.6 : 1 }}>{busy ? "Signing in..." : "Open the desk"}</button>
      <p style={{ fontSize: 11.5, color: T.muted, marginTop: 12 }}>Accounts use server-side hashing and rate-limited logins. Enrol two-factor under the Knowledge tab once you're in.</p>
    </div>
  );
}

/* ---------------- recommender workbook export ----------------
   Matches the VBA Booking Recommendations module layout:
   Artists: A=Name B=Status C=Local D=CanOriginals E=CanCovers
            F=TalentScore G=DrawScore H=(unused) I=LastPlayed
            J=(unused) K=UnavailableDates
   Bookings: A=Date B=SlotType C=ManualArtist D=Recommendation E=Score */
function DraftPanel({ d, flash, onDismiss, onToggleSent, api: dpApi, onSent }) {
  const [sending, setSending] = useState(false);
  const [body, setBody] = useState(d.body);
  useEffect(() => { setBody(d.body); }, [d.id, d.reqId, d.kind]);
  const mailto = `mailto:${d.to}?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(body)}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(`Subject: ${d.subject}\n\n${body}`);
      flash("Draft copied to clipboard.");
    } catch {
      flash("Couldn't copy automatically; select the text and copy manually.");
    }
  }
  return (
    <div style={{ ...st.card, borderLeft: `3px solid ${T.green}`, marginTop: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <div style={st.cardTitle}>{d.kind === "confirmation" ? "Confirmation email draft" : "Follow-up email draft"}</div>
        <button onClick={onDismiss} style={{ ...st.ghostBtn, fontSize: 11.5, padding: "3px 8px" }}>Collapse</button>
      </div>
      <div style={{ fontSize: 12.5, color: T.muted, marginTop: 4 }}>To: {d.to}</div>
      <div style={{ fontSize: 12.5, color: T.cream, marginTop: 2 }}>Subject: {d.subject}</div>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={12} style={{ ...st.input, width: "100%", boxSizing: "border-box", resize: "vertical", marginTop: 8, fontSize: 16, lineHeight: 1.5 }} />
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "center" }}>
        {dpApi && d.id && (
          <button onClick={async () => {
            if (sending) return;
            setSending(true);
            try { await dpApi.sendDraft(d.id); flash("Email sent."); if (onSent) onSent(); }
            catch (e) { flash(e.message || "Couldn't send. Use Open in email or Copy instead."); }
            setSending(false);
          }} disabled={sending} style={{ ...st.amberBtn, opacity: sending ? 0.6 : 1 }}>{sending ? "Sending..." : "Send email"}</button>
        )}
        <a href={mailto} style={{ ...st.ghostBtn, textDecoration: "none", display: "inline-block" }}>Open in email</a>
        <button onClick={copy} style={st.ghostBtn}>Copy draft</button>
        {onToggleSent && (
          <button onClick={onToggleSent} style={{ ...st.ghostBtn, marginLeft: "auto", borderColor: d.sent ? T.green : T.line, color: d.sent ? T.green : T.muted }}>{d.sent ? "Sent ✓ (tap to undo)" : "Mark as sent"}</button>
        )}
      </div>
      <div style={{ fontSize: 11.5, color: T.muted, marginTop: 6 }}>Edit freely before sending. Drafts are never sent automatically, and every draft is kept in the Drafts list at the top of the Inbox until you delete it.</div>
    </div>
  );
}

function DraftsList({ ctx }) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [delArm, setDelArm] = useState(null);
  const unsent = ctx.drafts.filter((d) => !d.sent).length;
  if (ctx.drafts.length === 0) return null;

  async function toggleSent(id) {
    const cur = ctx.drafts.find((d) => d.id === id);
    try { await ctx.api.markDraftSent(id, !(cur && cur.sent)); await ctx.refreshDesk(); }
    catch (e) { ctx.flash(e.message || "Could not update."); }
  }
  async function remove(id) {
    try { await ctx.api.deleteDraft(id); await ctx.refreshDesk(); }
    catch (e) { ctx.flash(e.message || "Could not delete."); }
    setDelArm(null);
    if (expanded === id) setExpanded(null);
  }

  const sorted = [...ctx.drafts].sort((a, b) => (a.sent === b.sent ? b.ts.localeCompare(a.ts) : a.sent ? 1 : -1));

  return (
    <div style={{ ...st.card, borderLeft: unsent > 0 ? `3px solid ${T.amber}` : "3px solid transparent" }}>
      <button onClick={() => setOpen(!open)} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", width: "100%", textAlign: "left" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={st.cardTitle}>Email drafts {unsent > 0 ? `· ${unsent} unsent` : "· all sent"}</span>
          <span style={{ color: T.muted, fontSize: 13 }}>{open ? "Hide" : "Show"}</span>
        </div>
      </button>
      {open && (
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {sorted.map((d) => (
            <div key={d.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ ...st.badge, borderColor: d.sent ? T.green : T.amber, color: d.sent ? T.green : T.amber }}>{d.sent ? "SENT" : "UNSENT"}</span>
                <button onClick={() => setExpanded(expanded === d.id ? null : d.id)} style={{ background: "transparent", border: "none", padding: 0, cursor: "pointer", color: T.cream, fontSize: 13, fontFamily: "'Karla', sans-serif", textAlign: "left", flex: 1, minWidth: 140 }}>{d.label || d.subject}</button>
                <span style={{ fontSize: 10.5, color: T.muted }}>{new Date(d.ts).toLocaleDateString("en-CA")}</span>
                <button onClick={() => toggleSent(d.id)} style={{ ...st.ghostBtn, fontSize: 11, padding: "2px 8px", borderColor: d.sent ? T.line : T.green, color: d.sent ? T.muted : T.green }}>{d.sent ? "Unsend" : "Mark sent"}</button>
                <button onClick={() => (delArm === d.id ? remove(d.id) : setDelArm(d.id))} style={{ ...st.ghostBtn, fontSize: 11, padding: "2px 8px", borderColor: delArm === d.id ? T.red : T.line, color: delArm === d.id ? T.red : T.muted }}>{delArm === d.id ? "Sure?" : "✕"}</button>
              </div>
              {expanded === d.id && <DraftPanel d={d} flash={ctx.flash} api={ctx.api} onSent={() => ctx.refreshDesk()} onDismiss={() => setExpanded(null)} onToggleSent={() => toggleSent(d.id)} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminInbox({ ctx }) {
  const pending = ctx.requests.filter((r) => r.status === "pending");
  const recent = ctx.requests.filter((r) => r.status !== "pending").slice(0, 12);
  const [confirmingId, setConfirmingId] = useState(null);
  const [decliningId, setDecliningId] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [changingId, setChangingId] = useState(null);
  const [openDraftFor, setOpenDraftFor] = useState(null); // request id whose draft(s) are expanded
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    setArmed(false);
    if (confirmingId || decliningId || cancellingId || changingId) {
      const t = setTimeout(() => setArmed(true), 450);
      return () => clearTimeout(t);
    }
  }, [confirmingId, decliningId, cancellingId, changingId]);

  async function decide(id, status, slot, declineReason) {
    const target = ctx.requests.find((r) => r.id === id);
    try {
      const r = await ctx.api.decide(id, { status, slot: slot || undefined, declineReason: declineReason || undefined });
      await ctx.refreshDesk();
      setConfirmingId(null);
      setDecliningId(null);
      setOpenDraftFor(id);
      if (status === "approved") {
        const slotMsg = slot ? ` for the ${slot} slot` : "";
        ctx.flash(r.autoDeclined > 0
          ? `Confirmed${slotMsg}. ${r.autoDeclined} other request${r.autoDeclined > 1 ? "s" : ""} within 4 weeks auto-declined. Email draft ready below.`
          : `Confirmed${slotMsg}. Email draft ready below.`);
      } else {
        ctx.flash("Declined. A warm follow-up draft is ready below.");
      }
    } catch (e) {
      ctx.flash(e.message || "Could not record that decision.");
    }
  }

  async function changeTime(id, slot) {
    try {
      const r = await ctx.api.changeTime(id, slot);
      await ctx.refreshDesk();
      setChangingId(null);
      setOpenDraftFor(id);
      ctx.flash(`Moved to ${slot}. Heads-up email drafted below and saved to Drafts.`);
    } catch (e) { ctx.flash(e.message || "Could not change the time."); }
  }

  async function cancelBooking(id) {
    try { await ctx.api.venueCancel(id); await ctx.refreshDesk(); }
    catch (e) { ctx.flash(e.message || "Could not cancel."); }
    setCancellingId(null);
    ctx.flash("Booking cancelled. The slot is open again.");
  }

  function ReqCard({ r, actions }) {
    const a = ctx.artists[r.artistId] || {};
    const pics = photosOf(a);
    const today = iso(new Date());
    const venueCancellable = r.status === "approved" && r.date >= today;
    return (
      <div>
      <div style={st.card}>
        <div style={{ display: "flex", gap: 12 }}>
          {pics[0] && <img src={pics[0]} alt="" style={{ width: 48, height: 48, borderRadius: 6, objectFit: "cover" }} />}
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
              <div style={{ color: T.cream, fontWeight: 700 }}>
                {r.name}
                {r.guest && <span style={{ ...st.badge, marginLeft: 6 }}>GUEST</span>}
                {!ctx.hasPlayed(r.artistId) && <span style={{ ...st.badge, marginLeft: 6, borderColor: T.amber, color: T.amber }}>NEW</span>}
                {artistIsLocal({ ...a, city: r.city || a.city }) && <span style={{ ...st.badge, marginLeft: 6, borderColor: T.green, color: T.green }}>LOCAL</span>}
                {r.bookingPref === "rotation" && <span style={{ ...st.badge, marginLeft: 6, borderColor: T.green, color: T.green }}>REGULAR</span>}
                {r.bookingPref === "single" && <span style={{ ...st.badge, marginLeft: 6, borderColor: T.muted, color: T.muted }}>SINGLE</span>}
              </div>
              <StatusPill status={r.status} />
            </div>
            <div style={{ fontSize: 13, color: T.amber, marginTop: 2 }}>{fmtLong(parseISO(r.date))}{r.slotTime ? ` · ${r.slotTime} slot` : ""}</div>
            <div style={{ fontSize: 12.5, color: T.muted, marginTop: 3 }}>
              {SET_LABELS[r.setType] || "Set"}
              {r.slotPref && r.slotPref !== "any" ? ` · prefers ${r.slotPref}` : ""}
              {a.genre ? ` · ${a.genre}` : ""}{r.city ? ` · ${r.city}` : ""} · {r.email}
            </div>
            {(a.drawScore != null || a.talentScore != null) ? <div style={{ fontSize: 12, color: T.amber, marginTop: 3 }}>{[a.drawScore != null && `Draw ${a.drawScore}/3`, a.talentScore != null && `Talent ${a.talentScore}/3`].filter(Boolean).join(" · ")}</div> : null}
            {a.links && <div style={{ fontSize: 12.5, marginTop: 3 }}><a href={a.links.startsWith("http") ? a.links : `https://${a.links}`} target="_blank" rel="noreferrer" style={{ color: T.amber }}>{a.links}</a></div>}
            {r.recording && r.recording !== "none" && <div style={{ fontSize: 12.5, color: T.amber, marginTop: 4 }}>Recording requested: {r.recording === "board-tape" ? "Board Tape ($59)" : "Full Tracks ($99)"}</div>}
            {a.etransferEmail && a.etransferEmail !== a.email && <div style={{ fontSize: 12.5, color: T.cream, marginTop: 4 }}>E-transfer to: {a.etransferEmail}</div>}
            {a.adminNotes && <div style={{ fontSize: 12.5, color: T.green, marginTop: 4 }}>Venue note: {a.adminNotes}</div>}
            {r.notes && <div style={{ fontSize: 12.5, color: T.cream, marginTop: 4, fontStyle: "italic" }}>"{r.notes}"</div>}
            {r.auto && <div style={{ fontSize: 11.5, color: T.amberDim, marginTop: 4 }}>Auto-declined: confirmed for {r.autoReason}</div>}
            {r.cancelledBy && <div style={{ fontSize: 11.5, color: T.amberDim, marginTop: 4 }}>Cancelled by {r.cancelledBy}</div>}

            {actions && confirmingId !== r.id && decliningId !== r.id && (
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={() => {
                  if (r.setType === "writers-round") { decide(r.id, "approved"); }
                  else { setConfirmingId(r.id); setDecliningId(null); }
                }} style={{ ...st.amberBtn }}>Confirm</button>
                <button onClick={() => { setDecliningId(r.id); setConfirmingId(null); }} style={{ ...st.ghostBtn, borderColor: T.red, color: T.red }}>Decline</button>
              </div>
            )}
            {actions && confirmingId === r.id && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, color: T.muted, marginBottom: 6 }}>
                  Confirm for which slot?{r.slotPref && r.slotPref !== "any" ? ` (artist prefers ${r.slotPref})` : ""}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {SLOT_TIMES.map((s) => {
                    const taken = ctx.takenSlots(r.date).has(s);
                    return (
                      <button key={s} onClick={() => armed && !taken && decide(r.id, "approved", s)} disabled={!armed || taken} style={{
                        ...st.amberBtn,
                        background: r.slotPref === s && !taken ? T.amber : "transparent",
                        color: r.slotPref === s && !taken ? T.ink : taken ? T.muted : T.amber,
                        border: taken ? `1px solid ${T.line}` : `1px solid ${T.amber}`,
                        opacity: !armed ? 0.4 : taken ? 0.45 : 1,
                      }}>{taken ? `${s} taken` : s}</button>
                    );
                  })}
                  <button onClick={() => setConfirmingId(null)} style={st.ghostBtn}>Cancel</button>
                </div>
              </div>
            )}
            {actions && decliningId === r.id && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, color: T.muted, marginBottom: 6 }}>Why? This shapes the follow-up email draft.</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => armed && decide(r.id, "declined", null, "slot-filled")} disabled={!armed} style={{ ...st.ghostBtn, opacity: armed ? 1 : 0.4 }}>Night filled up</button>
                  <button onClick={() => armed && decide(r.id, "declined", null, "conflict")} disabled={!armed} style={{ ...st.ghostBtn, opacity: armed ? 1 : 0.4 }}>Calendar conflict</button>
                  <button onClick={() => armed && decide(r.id, "declined", null, "not-now")} disabled={!armed} style={{ ...st.ghostBtn, opacity: armed ? 1 : 0.4 }}>Not this time</button>
                  <button onClick={() => setDecliningId(null)} style={{ ...st.ghostBtn, color: T.muted }}>Back</button>
                </div>
              </div>
            )}
            {venueCancellable && !actions && cancellingId !== r.id && changingId !== r.id && (
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                {r.setType !== "writers-round" && (
                  <button onClick={() => { setChangingId(r.id); setCancellingId(null); }} style={{ ...st.ghostBtn, fontSize: 11.5, padding: "4px 10px" }}>Change time</button>
                )}
                <button onClick={() => { setCancellingId(r.id); setChangingId(null); }} style={{ ...st.ghostBtn, fontSize: 11.5, padding: "4px 10px", borderColor: T.red, color: T.red }}>Cancel booking</button>
              </div>
            )}
            {venueCancellable && !actions && changingId === r.id && (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, color: T.muted, marginBottom: 6 }}>Move {r.name} to which set? (currently {r.slotTime || "unassigned"})</div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {SLOT_TIMES.map((s) => {
                    const isCurrent = r.slotTime === s;
                    const taken = !isCurrent && ctx.takenSlots(r.date).has(s);
                    return (
                      <button key={s} onClick={() => armed && !taken && !isCurrent && changeTime(r.id, s)} disabled={!armed || taken || isCurrent} style={{
                        ...st.ghostBtn,
                        borderColor: taken || isCurrent ? T.line : T.amber,
                        color: isCurrent ? T.muted : taken ? T.muted : T.amber,
                        opacity: !armed ? 0.4 : (taken || isCurrent) ? 0.45 : 1,
                      }}>{isCurrent ? `${s} (current)` : taken ? `${s} taken` : s}</button>
                    );
                  })}
                  <button onClick={() => setChangingId(null)} style={st.ghostBtn}>Back</button>
                </div>
              </div>
            )}
            {venueCancellable && !actions && cancellingId === r.id && (
              <div style={{ display: "flex", gap: 6, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: T.red }}>Free this slot?</span>
                <button onClick={() => armed && cancelBooking(r.id)} disabled={!armed} style={{ ...st.ghostBtn, borderColor: T.red, color: T.red, fontSize: 12, padding: "4px 10px", opacity: armed ? 1 : 0.4 }}>Yes, cancel</button>
                <button onClick={() => setCancellingId(null)} style={{ ...st.ghostBtn, fontSize: 12, padding: "4px 10px" }}>Keep</button>
              </div>
            )}
          </div>
        </div>
      </div>
      {(() => {
        const cardDrafts = ctx.drafts.filter((d) => d.reqId === r.id);
        if (cardDrafts.length === 0) return null;
        const open = openDraftFor === r.id;
        const anyUnsent = cardDrafts.some((d) => !d.sent);
        return (
          <div style={{ marginTop: 4 }}>
            <button onClick={() => setOpenDraftFor(open ? null : r.id)} style={{ ...st.ghostBtn, fontSize: 11.5, padding: "4px 10px", borderColor: anyUnsent ? T.amber : T.line, color: anyUnsent ? T.amber : T.muted }}>
              {open ? "Hide email draft" : `Email draft${cardDrafts.length > 1 ? `s (${cardDrafts.length})` : ""}${anyUnsent ? " · unsent" : " · sent"}`}
            </button>
            {open && cardDrafts.map((d) => (
              <DraftPanel key={d.id} d={d} flash={ctx.flash} api={ctx.api} onSent={() => ctx.refreshDesk()} onDismiss={() => setOpenDraftFor(null)} onToggleSent={async () => {
                try { await ctx.api.markDraftSent(d.id, !d.sent); await ctx.refreshDesk(); }
                catch (e) { ctx.flash(e.message || "Could not update."); }
              }} />
            ))}
          </div>
        );
      })()}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <DraftsList ctx={ctx} />
      <h3 style={st.h3}>Pending review ({pending.length})</h3>
      <p style={{ fontSize: 12, color: T.muted }}>Confirming asks for a slot time and drafts the confirmation email. Declining asks why and drafts a warm follow-up with open dates. Confirming also auto-declines that artist's other pending requests within 4 weeks.</p>
      {pending.length === 0 && <p style={{ color: T.muted, fontSize: 13.5 }}>Inbox zero. Nothing waiting.</p>}
      {pending.map((r) => <ReqCard key={r.id} r={r} actions />)}
      {recent.length > 0 && <>
        <h3 style={{ ...st.h3, marginTop: 12 }}>Recently decided</h3>
        {recent.map((r) => <ReqCard key={r.id} r={r} />)}
      </>}
    </div>
  );
}


function AdminCalendar({ ctx }) {
  const fridays = fridaysAhead(120);
  const [adding, setAdding] = useState(null);
  const [f, setF] = useState({ name: "", setType: "covers", status: "confirmed", slotTime: "" });
  const [removeArm, setRemoveArm] = useState(null); // "dateISO|idx"
  const [timesOpen, setTimesOpen] = useState(null); // dateISO
  const [calDrafts, setCalDrafts] = useState([]);
  const [removeDrafts, setRemoveDrafts] = useState({}); // dISO -> [draft]

  // Apply one or two time changes (a move, or a swap on a full night).
  // App-request artists get a heads-up email draft; manual entries just move.
  async function applyTimes(dateISO, changes) {
    const payload = changes.map(({ entry, slot }) => (
      entry.reqId
        ? { reqId: entry.reqId, slot }
        : { name: entry.name, fromSlot: entry.slotTime || null, slot }
    ));
    try {
      const r = await ctx.api.applyTimes(dateISO, payload);
      await ctx.refreshDesk();
      setCalDrafts((r.drafts || []).map((d) => ({ ...d })));
    } catch (e) { ctx.flash(e.message || "Could not apply the time changes."); }
  }

  // Night quality score: raw Talent + Draw of the confirmed bill.
  // No local or new-artist bonuses; those exist only to pick recommendations.
  function nightScore(dateISO, entries) {
    const confirmed = entries.filter((e) => e.status === "confirmed");
    if (confirmed.length === 0) return null;
    let total = 0;
    confirmed.forEach((e) => {
      let a = null;
      if (e.reqId) {
        const r = ctx.requests.find((x) => x.id === e.reqId);
        a = r ? ctx.artists[r.artistId] : null;
      }
      if (!a) a = Object.values(ctx.artists).find((x) => x.name.toLowerCase() === e.name.toLowerCase()) || null;
      if (a) total += (a.talentScore || 0) + (a.drawScore || 0);
    });
    return total;
  }

  async function addManual() {
    if (!f.name.trim() || !adding) return;
    try {
      await ctx.api.addManual(adding, { name: f.name.trim(), setType: f.setType, status: f.status, slotTime: f.slotTime || null });
      await ctx.refreshDesk();
      setAdding(null); setF({ name: "", setType: "covers", status: "confirmed", slotTime: "" });
      ctx.flash("Logged. The calendar updated for everyone.");
    } catch (e) { ctx.flash(e.message || "Could not log that entry."); }
  }

  async function removeManual(dateISO, idx) {
    try { await ctx.api.removeManual(dateISO, idx); await ctx.refreshDesk(); }
    catch (e) { ctx.flash(e.message || "Could not remove that entry."); }
  }

  async function toggleClosed(dateISO) {
    try { await ctx.api.toggleClosed(dateISO); await ctx.refreshDesk(); }
    catch (e) { ctx.flash(e.message || "Could not update the night."); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ fontSize: 13, color: T.muted }}>When a Friday request comes in through the website (Outlook inbox), log it here so the app calendar stays true. Manual entries show to artists immediately.</p>
      {fridays.map((d) => {
        const dISO = iso(d);
        const { entries, closed } = ctx.entriesFor(dISO);
        const ovSlots = ctx.overrides[dISO]?.slots || [];
        const writers = ctx.writersNight(d);
        return (
          <div key={dISO} style={{ ...st.card, borderLeft: writers ? `3px solid ${T.amber}` : "3px solid transparent" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <div>
                <span style={{ color: T.cream, fontWeight: 700 }}>{fmtLong(d)}</span>
                {writers && <span style={{ ...st.badge, marginLeft: 8 }}>WRITERS ROUND</span>}
                {closed && <span style={{ ...st.badge, marginLeft: 8, borderColor: T.red, color: T.red }}>CLOSED</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {nightScore(dISO, entries) != null && (
                  <span style={{ fontSize: 11.5, color: T.amber, fontWeight: 700 }} title="Raw Talent + Draw of the confirmed bill. No recommendation bonuses.">Night score {nightScore(dISO, entries)}</span>
                )}
                <Lamps entries={entries} writers={writers} />
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: T.muted, marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
              {entries.length === 0 ? "No entries" : sortEntries(entries).map((e, i) => {
                const armKey = `${dISO}|${e.manual ? "m" + e.manualIndex : "r" + e.reqId}`;
                const isArmed = removeArm === armKey;
                const canRemove = e.manual || (e.reqId && e.status === "confirmed");
                async function doRemove() {
                  if (e.manual) { removeManual(dISO, e.manualIndex); }
                  else {
                    try {
                      const res = await ctx.api.venueCancel(e.reqId);
                      await ctx.refreshDesk();
                      if (res && res.draft) {
                        setRemoveDrafts((p) => ({ ...p, [dISO]: [...(p[dISO] || []), res.draft] }));
                        ctx.flash(`Cancelled ${e.name}'s set. A removal email draft is ready below.`);
                      } else {
                        ctx.flash(`Cancelled ${e.name}'s set. The slot is open again.`);
                      }
                    } catch (er) { ctx.flash(er.message || "Could not cancel."); }
                  }
                  setRemoveArm(null);
                }
                return (
                  <div key={i} style={{ display: "flex", gap: 6, alignItems: "baseline", flexWrap: "wrap" }}>
                    {!writers && <span style={{ color: e.slotTime ? T.amber : T.muted, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: 1, fontSize: 13, minWidth: 34 }}>{e.slotTime || "—"}</span>}
                    <span style={{ color: T.cream }}>{e.name}</span>
                    <span style={{ color: e.status === "confirmed" ? T.green : T.amberDim, fontSize: 11.5 }}>{e.status}</span>
                    <span style={{ fontSize: 10.5, color: T.muted }}>{e.manual ? "manual" : "via app"}</span>
                    {canRemove && (
                      <button onClick={doRemove} onBlur={() => setRemoveArm(null)} onMouseDown={(ev) => { if (!isArmed) { ev.preventDefault(); setRemoveArm(armKey); } }} style={{
                        ...st.ghostBtn, fontSize: 10.5, padding: "1px 7px", marginLeft: 2,
                        borderColor: isArmed ? T.red : T.line, color: isArmed ? T.red : T.muted,
                      }}>{isArmed ? (e.manual ? "Remove?" : "Cancel set?") : (e.manual ? "Remove" : "Cancel")}</button>
                    )}
                    {!canRemove && e.reqId && <span style={{ fontSize: 10.5, color: T.muted }}>· decide in Inbox</span>}
                  </div>
                );
              })}
            </div>
            {(removeDrafts[dISO] || []).length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: T.muted, marginBottom: 4 }}>Removal email draft (nothing sends until you click)</div>
                {(removeDrafts[dISO] || []).map((d, i) => (
                  <DraftPanel key={d.id || i} d={d} flash={ctx.flash} api={ctx.api} onSent={() => ctx.refreshDesk()}
                    onDismiss={() => setRemoveDrafts((p) => ({ ...p, [dISO]: (p[dISO] || []).filter((_, j) => j !== i) }))}
                    onToggleSent={d.id ? async () => {
                      try { await ctx.api.markDraftSent(d.id, !d.sent); await ctx.refreshDesk(); setRemoveDrafts((p) => ({ ...p, [dISO]: (p[dISO] || []).map((x, j) => (j === i ? { ...x, sent: !x.sent } : x)) })); }
                      catch (e) { ctx.flash(e.message || "Could not update."); }
                    } : undefined} />
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
              <button onClick={() => setAdding(adding === dISO ? null : dISO)} style={st.ghostBtn}>{adding === dISO ? "Cancel" : "Manual entry"}</button>
              {!writers && entries.some((e) => e.status === "confirmed") && (
                <button onClick={() => { setTimesOpen(timesOpen === dISO ? null : dISO); setCalDrafts([]); }} style={st.ghostBtn}>{timesOpen === dISO ? "Hide times" : "Set times"}</button>
              )}
              <div style={{ display: "flex", gap: 8, marginLeft: "auto", flexWrap: "wrap" }}>
                <button onClick={async () => {
                  try { await ctx.api.setWriters(dISO, !writers); await ctx.refreshDesk(); ctx.flash(!writers ? "Night set to Writers Round." : "Night set to standard session."); }
                  catch (e) { ctx.flash(e.message || "Could not update the night."); }
                }} style={{ ...st.ghostBtn, borderColor: writers ? T.amber : T.line, color: writers ? T.amber : T.muted }}>{writers ? "Make standard night" : "Make Writers Round"}</button>
                <button onClick={() => toggleClosed(dISO)} style={{ ...st.ghostBtn, borderColor: closed ? T.green : T.line, color: closed ? T.green : T.muted }}>{closed ? "Reopen night" : "Close night"}</button>
              </div>
            </div>
            {timesOpen === dISO && !writers && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.line}` }}>
                <div style={{ fontSize: 11.5, color: T.muted, marginBottom: 6 }}>Tap a time to move an artist. Tapping an occupied time swaps the two artists.</div>
                {entries.filter((e) => e.status === "confirmed").map((e, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: i ? 8 : 0 }}>
                    <span style={{ fontSize: 12.5, color: T.cream, minWidth: 110 }}>{e.name}</span>
                    {SLOT_TIMES.map((s) => {
                      const isCurrent = e.slotTime === s;
                      const occupant = entries.find((x) => x !== e && x.status === "confirmed" && x.slotTime === s);
                      return (
                        <button key={s} onClick={() => {
                          if (isCurrent) return;
                          const changes = [{ entry: e, slot: s }];
                          if (occupant) changes.push({ entry: occupant, slot: e.slotTime || null });
                          applyTimes(dISO, changes);
                          ctx.flash(occupant ? `Swapped ${e.name} and ${occupant.name}.` : `${e.name} moved to ${s}.`);
                        }} disabled={isCurrent} style={{
                          ...st.ghostBtn, fontSize: 11.5, padding: "4px 10px",
                          borderColor: isCurrent ? T.amber : T.amber,
                          color: isCurrent ? T.amber : occupant ? T.muted : T.cream,
                          opacity: isCurrent ? 1 : occupant ? 0.7 : 1,
                        }}>{isCurrent ? `${s} ✓` : occupant ? `${s} swap` : s}</button>
                      );
                    })}
                  </div>
                ))}
                {calDrafts.map((d, i) => <DraftPanel key={d.id || d.reqId + i} d={d} flash={ctx.flash} api={ctx.api} onSent={() => ctx.refreshDesk()} onDismiss={() => setCalDrafts(calDrafts.filter((_, j) => j !== i))} onToggleSent={d.id ? async () => {
                  try { await ctx.api.markDraftSent(d.id, !d.sent); await ctx.refreshDesk(); setCalDrafts(calDrafts.map((x, j) => (j === i ? { ...x, sent: !x.sent } : x))); }
                  catch (e) { ctx.flash(e.message || "Could not update."); }
                } : undefined} />)}
              </div>
            )}
            {adding === dISO && (
              <div style={{ ...st.formGrid, marginTop: 10 }}>
                <input placeholder="Artist name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} style={st.input} />
                <div style={{ display: "flex", gap: 8 }}>
                  <select value={f.setType} onChange={(e) => setF({ ...f, setType: e.target.value })} style={{ ...st.input, flex: 1, minWidth: 0 }}>
                    <option value="single-originals">Originals set</option>
                    <option value="covers">Covers set</option>
                    <option value="writers-round">Writers Round</option>
                  </select>
                  <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} style={{ ...st.input, flex: 1, minWidth: 0 }}>
                    <option value="confirmed">Confirmed</option>
                    <option value="pending">Pending</option>
                  </select>
                  <select value={f.slotTime} onChange={(e) => setF({ ...f, slotTime: e.target.value })} style={{ ...st.input, flex: 1, minWidth: 0 }}>
                    <option value="">No set time</option>
                    <option value="8PM">8PM</option>
                    <option value="9PM">9PM</option>
                    <option value="10PM">10PM</option>
                  </select>
                </div>
                <button onClick={addManual} style={st.amberBtn}>Add to night</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================
   ADMIN: RECOMMEND
   JS port of the VBA Booking Recommendations module:
   eligibility window, local/new bonuses, originals kicker,
   recency penalty, one new artist per night, first-slot-new
   preference, and companion-conflict avoidance (pass 1).
   Writers Rounds are included; non-originals artists are omitted.
   ============================================================ */
function AdminRecommend({ ctx }) {
  const [cfg, setCfg] = useState(ctx.recConfig);
  const [weeks, setWeeks] = useState(8);
  const [results, setResults] = useState(null);
  const [outreach, setOutreach] = useState(null); // {key, to, subject, body, kind:"follow-up"}

  function upCfg(k, v) { setCfg((p) => ({ ...p, [k]: Number(v) || 0 })); }

  async function run() {
    try {
      await ctx.api.setRecConfig(cfg);
      const r = await ctx.api.runRecommend(weeks);
      setResults(r.nights || []);
      setOutreach(null);
    } catch (e) { ctx.flash(e.message || "Could not run recommendations."); }
  }

  async function passOn(pick, night) {
    try {
      const r = await ctx.api.passRecommend({ artistId: pick.artistId, name: pick.name, date: night.dateISO, weeks });
      setResults(r.nights || []);
      await ctx.refreshDesk();
      ctx.flash(`Passed on ${pick.name} for that date. They won't be recommended for it again (clears from their profile, or automatically once the date passes).`);
    } catch (e) { ctx.flash(e.message || "Could not pass."); }
  }

  async function ping(pick, night) {
    try {
      await ctx.api.outreach({ artistId: pick.artistId, name: pick.name, email: pick.email, date: night.dateISO, slotLabel: pick.slot.label, slotType: pick.slot.type, ping: true });
      ctx.flash(`${pick.name} will get a push (if enabled) and see this message next time they open the app.`);
    } catch (e) { ctx.flash(e.message || "Could not send the ping."); }
  }

  const cfgFields = [
    ["daysSincePlayed", "Days since played", "Min days since an artist last played before eligible again"],
    ["localBonus", "Local bonus", "Added when no local artist is on the bill yet"],
    ["newArtistBonus", "New artist bonus", "Added when no new artist is on the bill yet"],
    ["newOriginalsBonus", "New + originals bonus", "Extra for a new artist filling an originals slot"],
    ["recencyPenalty", "Recency penalty", "Deducted per prior recommendation this run"],
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={st.card}>
        <div style={st.cardTitle}>Booking recommendations</div>
        <p style={{ fontSize: 12.5, color: T.muted, margin: "6px 0 10px" }}>Your scoring logic, live on venue data: eligibility spacing in both directions around every booking, local and new-artist bonuses, recency penalty, and same-bill repeat avoidance. Writers Rounds included (originals artists only). Single-set artists, unavailable dates, and passed picks are skipped. Outreach is drafted, never sent; nothing books until the artist says yes. In production, app pings become real push notifications on artists' phones when they allow them.</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {cfgFields.map(([k, label, desc]) => (
            <div key={k} style={{ flex: "1 1 130px", minWidth: 0 }}>
              <div style={{ ...st.label, marginBottom: 3 }} title={desc}>{label}</div>
              <input type="number" value={cfg[k]} onChange={(e) => upCfg(k, e.target.value)} style={{ ...st.input, width: "100%", boxSizing: "border-box" }} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
          <select value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} style={st.input}>
            <option value={4}>Next 4 weeks</option>
            <option value={8}>Next 8 weeks</option>
            <option value={12}>Next 12 weeks</option>
          </select>
          <button onClick={run} style={st.amberBtn}>Run recommendations</button>
        </div>
      </div>

      {results && results.length === 0 && <p style={{ color: T.muted, fontSize: 13.5 }}>No open slots in that window. Nice problem to have.</p>}
      {results && results.map((night) => (
        <div key={night.dateISO} style={{ ...st.card, borderLeft: night.writers ? `3px solid ${T.amber}` : "3px solid transparent" }}>
          <div style={{ color: T.cream, fontWeight: 700 }}>{night.label} {night.writers && <span style={{ ...st.badge, marginLeft: 6 }}>WRITERS ROUND</span>}</div>
          {night.picks.map((p, i) => {
            const key = `${night.dateISO}-${i}`;
            return (
              <div key={key} style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.line}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: 12, color: T.amber }}>{p.slot.label}{!night.writers ? ` · ${p.slot.type}` : ""}</span>
                    <div style={{ color: p.name ? T.cream : T.muted, fontWeight: 700, fontSize: 14.5 }}>
                      {p.name || "No eligible artists"}
                      {p.name && p.isNew && <span style={{ ...st.badge, marginLeft: 6, borderColor: T.amber, color: T.amber }}>NEW</span>}
                      {p.name && p.local && <span style={{ ...st.badge, marginLeft: 6, borderColor: T.green, color: T.green }}>LOCAL</span>}
                    </div>
                    {p.name && <div style={{ fontSize: 11.5, color: T.muted }}>score {p.score}</div>}
                  </div>
                  {p.name && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button onClick={async () => {
                        try {
                          const r = await ctx.api.outreach({ artistId: p.artistId, name: p.name, email: p.email, date: night.dateISO, slotLabel: p.slot.label, slotType: p.slot.type });
                          await ctx.refreshDesk();
                          if (r.draft) setOutreach({ ...r.draft, key });
                        } catch (e) { ctx.flash(e.message || "Could not draft outreach."); }
                      }} style={{ ...st.amberBtn, fontSize: 12, padding: "6px 12px" }} disabled={!p.email}>Email</button>
                      {p.phone && (
                        <a href={`sms:${p.phone.replace(/[^+\d]/g, "")}?&body=${encodeURIComponent(outreachShortText(p.name, night.label, p.slot.label, p.slot.type, night.writers))}`} style={{ ...st.ghostBtn, textDecoration: "none", fontSize: 12, padding: "6px 12px", display: "inline-block" }}>Text</a>
                      )}
                      {p.account && (
                        <button onClick={() => ping(p, night)} style={{ ...st.ghostBtn, fontSize: 12, padding: "6px 12px", borderColor: T.green, color: T.green }}>App ping</button>
                      )}
                      <button onClick={() => passOn(p, night)} style={{ ...st.ghostBtn, fontSize: 12, padding: "6px 12px", borderColor: T.red, color: T.red }}>Pass</button>
                    </div>
                  )}
                </div>
                {outreach && outreach.key === key && <DraftPanel d={outreach} flash={ctx.flash} api={ctx.api} onSent={() => ctx.refreshDesk()} onDismiss={() => setOutreach(null)} onToggleSent={outreach.id ? async () => {
                  try { await ctx.api.markDraftSent(outreach.id, !outreach.sent); await ctx.refreshDesk(); setOutreach({ ...outreach, sent: !outreach.sent }); } catch (e) {}
                } : undefined} />}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function AdminArtists({ ctx }) {
  const importRef = useRef(null);
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [f, setF] = useState({ name: "", email: "", phone: "", city: "", genre: "", links: "" });
  const [noteEdit, setNoteEdit] = useState({});
  const [editId, setEditId] = useState(null);
  const [editF, setEditF] = useState({});
  const [delArm, setDelArm] = useState(null);
  const [mergeId, setMergeId] = useState(null); // artist being merged away
  const [mergeArm, setMergeArm] = useState(null); // keeper id armed for confirm

  async function doMerge(keepId) {
    const goneName = ctx.artists[mergeId]?.name || "that record";
    const keepName = ctx.artists[keepId]?.name || "the kept record";
    try {
      const res = await ctx.api.mergeArtists(keepId, mergeId);
      await ctx.refreshDesk();
      setMergeId(null); setMergeArm(null);
      ctx.flash(`Merged ${goneName} into ${res.keptName || keepName}. History and scores were combined.`);
    } catch (e) {
      ctx.flash(e.message || "Could not merge those records.");
      setMergeArm(null);
    }
  }

  function startEdit(a) {
    setEditId(a.id);
    setEditF({
      name: a.name || "", stageName: a.stageName || "", email: a.email || "", phone: a.phone || "",
      city: a.city || "", genre: a.genre || "", links: a.links || "",
      instagram: a.instagram || "", facebook: a.facebook || "",
      originalsSets: a.originalsSets ?? "", coversSets: a.coversSets ?? "",
      etransferEmail: a.etransferEmail || "", local: !!a.local,
    });
    setDelArm(null);
  }

  async function saveEdit() {
    if (!editF.name.trim()) { ctx.flash("Name can't be empty."); return; }
    const fields = Object.fromEntries(Object.entries(editF).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]));
    try { await ctx.api.saveArtist(editId, fields); await ctx.refreshDesk(); setEditId(null); ctx.flash("Artist details updated."); }
    catch (e) { ctx.flash(e.message || "Could not save."); }
  }

  async function deleteArtist(id) {
    const name = ctx.artists[id]?.name || "artist";
    try { await ctx.api.deleteArtist(id); await ctx.refreshDesk(); }
    catch (e) { ctx.flash(e.message || "Could not delete."); return; }
    setEditId(null);
    ctx.flash(`${name} removed from the database. Their past requests stay in the history.`);
  }

  const list = Object.values(ctx.artists)
    .filter((a) => (a.name + " " + (a.city || "") + " " + (a.email || "") + " " + (a.genre || "")).toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.updated || "").localeCompare(a.updated || ""));

  async function addArtist() {
    if (!f.name.trim()) return;
    try {
      await ctx.api.createArtist({ name: f.name.trim(), email: f.email.trim(), phone: f.phone.trim(), city: f.city.trim(), genre: f.genre.trim(), links: f.links.trim() });
      await ctx.refreshDesk();
      setF({ name: "", email: "", phone: "", city: "", genre: "", links: "" });
      setShowAdd(false);
      ctx.flash("Artist added to the database.");
    } catch (e) { ctx.flash(e.message || "Could not add."); }
  }

  async function saveNote(id) {
    try { await ctx.api.saveArtist(id, { adminNotes: (noteEdit[id] ?? "").trim() }); await ctx.refreshDesk(); }
    catch (e) { ctx.flash(e.message || "Could not save note."); return; }
    setNoteEdit((p) => { const n = { ...p }; delete n[id]; return n; });
    ctx.flash("Note saved. Only the venue desk sees these.");
  }

  async function setScore(id, field, value) {
    const current = ctx.artists[id]?.[field];
    const next = current === value ? null : value; // tap same to clear; 0 is a real rating
    try { await ctx.api.saveArtist(id, { [field]: next }); await ctx.refreshDesk(); }
    catch (e) { ctx.flash(e.message || "Could not save score."); }
  }

  function ScoreRow({ a, field, label }) {
    const val = a[field];
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5 }}>
        <span style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: T.muted, width: 48 }}>{label}</span>
        {[0, 1, 2, 3].map((n) => {
          const active = n === 0 ? val === 0 : (typeof val === "number" && val >= n);
          return (
            <button key={n} onClick={() => setScore(a.id, field, n)} style={{
              width: 26, height: 26, borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700,
              fontFamily: "'Karla', sans-serif",
              background: active ? T.amber : "transparent",
              color: active ? T.ink : T.muted,
              border: active ? `1px solid ${T.amber}` : `1px solid ${T.line}`,
              padding: 0,
            }}>{n}</button>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input placeholder="Search name, city, email, genre..." value={q} onChange={(e) => setQ(e.target.value)} style={{ ...st.input, flex: 1, minWidth: 0 }} />
        <button onClick={() => setShowAdd(!showAdd)} style={st.amberBtn}>{showAdd ? "Cancel" : "+ Add"}</button>
      </div>
      {showAdd && (
        <div style={st.card}>
          <div style={st.formGrid}>
            <input placeholder="Artist / act name *" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} style={st.input} />
            <input placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} style={st.input} />
            <input placeholder="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} style={st.input} />
            <input placeholder="Home city" value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} style={st.input} />
            <input placeholder="Genre" value={f.genre} onChange={(e) => setF({ ...f, genre: e.target.value })} style={st.input} />
            <input placeholder="Music links" value={f.links} onChange={(e) => setF({ ...f, links: e.target.value })} style={st.input} />
            <button onClick={addArtist} style={st.amberBtn}>Save artist</button>
          </div>
        </div>
      )}
      <div style={{ fontSize: 12.5, color: T.muted }}>{list.length} artist{list.length === 1 ? "" : "s"}. Records build automatically from app requests; add website-inquiry artists manually. Draw and Talent scores and notes are venue-only, and they'll feed the future recommendation logic.</div>
      {mergeId && (
        <div style={{ ...st.card, borderLeft: `3px solid ${T.amber}`, position: "sticky", top: 8, zIndex: 5 }}>
          <div style={{ fontSize: 13.5, color: T.amber, fontWeight: 700 }}>Merging "{ctx.artists[mergeId]?.name}" into another record</div>
          <div style={{ fontSize: 12.5, color: T.muted, marginTop: 4 }}>Find the record to keep below and tap "Keep this one." History, scores, blackouts, and photos combine into the kept record; this one is then removed.</div>
          <button onClick={() => { setMergeId(null); setMergeArm(null); }} style={{ ...st.ghostBtn, marginTop: 8, fontSize: 12 }}>Cancel merge</button>
        </div>
      )}
      <div style={st.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div>
            <div style={st.cardTitle}>Recommender workbook</div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>Import pulls your booking workbook into the app: artists, statuses, scores, last-played and unavailable dates, plus future bookings onto the calendar. Export goes the other way, in your VBA macro's exact layout, so Excel stays a working mirror as long as you want one.</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={() => importRef.current?.click()} style={st.amberBtn}>Import workbook</button>
            <a href={ctx.api.workbookExportUrl()} style={{ ...st.ghostBtn, textDecoration: "none", display: "inline-block" }}>Export .xlsx</a>
          </div>
          <input ref={importRef} type="file" accept=".xlsm,.xlsx,.xls" style={{ display: "none" }} onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            try {
              const form = new FormData();
              form.append("file", file);
              const res = await fetch("/api/admin/workbook/import", { method: "POST", credentials: "same-origin", body: form });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(data.error || "Import failed.");
              await ctx.refreshDesk();
              ctx.flash(`Imported ${data.importedArtists} artists, ${data.importedBookings} future bookings${data.closedNights ? `, ${data.closedNights} closed nights` : ""}.`);
            } catch (err) {
              console.error(err);
              ctx.flash(err.message || "Couldn't read that workbook. Check it has Artists and Bookings sheets.");
            }
            e.target.value = "";
          }} />
        </div>
      </div>
      {list.map((a) => {
        const pics = photosOf(a);
        const editing = noteEdit[a.id] !== undefined;
        return (
          <div key={a.id} style={st.card}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              {pics[0] ? <img src={pics[0]} alt="" style={{ width: 44, height: 44, borderRadius: 6, objectFit: "cover" }} /> :
                <div style={{ width: 44, height: 44, borderRadius: 6, background: T.panel2, display: "flex", alignItems: "center", justifyContent: "center", color: T.amber, fontFamily: "'Bebas Neue', sans-serif", fontSize: 20 }}>{(a.name || "?")[0]}</div>}
              <div style={{ flex: 1 }}>
                <div style={{ color: T.cream, fontWeight: 700 }}>
                  {a.name}{a.stageName && a.stageName !== a.name && <span style={{ color: T.muted, fontWeight: 400 }}> · "{a.stageName}"</span>}
                  {a.account && <span style={{ ...st.badge, marginLeft: 6, borderColor: T.green, color: T.green }}>ACCOUNT</span>}
                  {!ctx.hasPlayed(a.id) && <span style={{ ...st.badge, marginLeft: 6, borderColor: T.amber, color: T.amber }}>NEW</span>}
                  {artistIsLocal(a) && <span style={{ ...st.badge, marginLeft: 6, borderColor: T.green, color: T.green }}>LOCAL</span>}
                  {a.bookingPref === "rotation" && <span style={{ ...st.badge, marginLeft: 6, borderColor: T.green, color: T.green }}>REGULAR</span>}
                  {a.bookingPref === "single" && <span style={{ ...st.badge, marginLeft: 6, borderColor: T.muted, color: T.muted }}>SINGLE</span>}
                </div>
                <div style={{ fontSize: 12.5, color: T.muted }}>{[a.genre, a.city, a.email, a.phone].filter(Boolean).join(" · ")}</div>
                {a.etransferEmail && a.etransferEmail !== a.email && <div style={{ fontSize: 12, color: T.cream }}>E-transfer: {a.etransferEmail}</div>}
                {(a.instagram || a.facebook) && <div style={{ fontSize: 12, color: T.muted }}>{[a.instagram && `IG: ${a.instagram}`, a.facebook && `FB: ${a.facebook}`].filter(Boolean).join(" · ")}</div>}
                {a.links && (a.links.split(/\n+/).map((s) => s.trim()).filter(Boolean).map((lnk, i) => (
                  <div key={i}><a href={lnk.startsWith("http") ? lnk : `https://${lnk}`} target="_blank" rel="noreferrer" style={{ color: T.amber, fontSize: 12.5 }}>{lnk}</a></div>
                )))}
                {(String(a.originalsSets ?? "") !== "" || String(a.coversSets ?? "") !== "" || a.contactMethod) && (
                  <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>
                    {[
                      String(a.originalsSets ?? "") !== "" && `${a.originalsSets} originals`,
                      String(a.coversSets ?? "") !== "" && `${a.coversSets} covers`,
                      a.contactMethod && `prefers ${a.contactMethod}`,
                    ].filter(Boolean).join(" · ")}
                  </div>
                )}
                {a.bio && <div style={{ fontSize: 12.5, color: T.cream, marginTop: 6, whiteSpace: "pre-wrap" }}>{a.bio}</div>}
                {pics.length > 1 && (
                  <div style={{ marginTop: 6 }}>
                    <div style={{ fontSize: 11, color: T.muted, marginBottom: 4 }}>Tap a photo to make it the headshot.</div>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {pics.map((p, i) => (
                        <button key={i} title={i === 0 ? "Current headshot" : "Set as headshot"} onClick={async () => {
                          if (i === 0) return;
                          const next = [p, ...pics.filter((_, j) => j !== i)];
                          try { await ctx.api.saveArtist(a.id, { photos: next }); await ctx.refreshDesk(); ctx.flash(`Headshot updated for ${a.name}.`); }
                          catch (er) { ctx.flash(er.message || "Could not update the headshot."); }
                        }} style={{ padding: 0, border: i === 0 ? `2px solid ${T.amber}` : `1px solid ${T.line}`, borderRadius: 6, background: "none", cursor: i === 0 ? "default" : "pointer", lineHeight: 0 }}>
                          <img src={p} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4, display: "block" }} />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {editId === a.id && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${T.line}` }}>
                    <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: T.amber, marginBottom: 8 }}>Edit artist details</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <input placeholder="Name" value={editF.name} onChange={(e) => setEditF({ ...editF, name: e.target.value })} style={st.input} />
                      <input placeholder="Preferred stage name" value={editF.stageName} onChange={(e) => setEditF({ ...editF, stageName: e.target.value })} style={st.input} />
                      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, color: T.muted }}>
                        <input type="checkbox" checked={!!editF.local} onChange={(e) => setEditF({ ...editF, local: e.target.checked })} />
                        Local (within ~20 min of Stratford)
                      </label>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input placeholder="Email" value={editF.email} onChange={(e) => setEditF({ ...editF, email: e.target.value })} style={{ ...st.input, flex: 1, minWidth: 0 }} />
                        <input placeholder="Phone" value={editF.phone} onChange={(e) => setEditF({ ...editF, phone: e.target.value })} style={{ ...st.input, flex: 1, minWidth: 0 }} />
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input placeholder="Home city" value={editF.city} onChange={(e) => setEditF({ ...editF, city: e.target.value })} style={{ ...st.input, flex: 1, minWidth: 0 }} />
                        <input placeholder="Genre" value={editF.genre} onChange={(e) => setEditF({ ...editF, genre: e.target.value })} style={{ ...st.input, flex: 1, minWidth: 0 }} />
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input placeholder="# original sets" value={editF.originalsSets} onChange={(e) => setEditF({ ...editF, originalsSets: e.target.value })} style={{ ...st.input, flex: 1, minWidth: 0 }} />
                        <input placeholder="# cover sets" value={editF.coversSets} onChange={(e) => setEditF({ ...editF, coversSets: e.target.value })} style={{ ...st.input, flex: 1, minWidth: 0 }} />
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input placeholder="Instagram" value={editF.instagram} onChange={(e) => setEditF({ ...editF, instagram: e.target.value })} style={{ ...st.input, flex: 1, minWidth: 0 }} />
                        <input placeholder="Facebook" value={editF.facebook} onChange={(e) => setEditF({ ...editF, facebook: e.target.value })} style={{ ...st.input, flex: 1, minWidth: 0 }} />
                      </div>
                      <input placeholder="Music links" value={editF.links} onChange={(e) => setEditF({ ...editF, links: e.target.value })} style={st.input} />
                      <input placeholder="E-transfer email (if different)" value={editF.etransferEmail} onChange={(e) => setEditF({ ...editF, etransferEmail: e.target.value })} style={st.input} />
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <button onClick={saveEdit} style={st.amberBtn}>Save details</button>
                      <button onClick={() => setEditId(null)} style={st.ghostBtn}>Cancel</button>
                      <button onClick={() => {
                        if (delArm === a.id) { deleteArtist(a.id); }
                        else setDelArm(a.id);
                      }} style={{ ...st.ghostBtn, marginLeft: "auto", borderColor: T.red, color: T.red }}>{delArm === a.id ? "Tap again to delete forever" : "Delete artist"}</button>
                    </div>
                    <div style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>Artists keep their own info current by requesting; this is the back-end override.</div>
                  </div>
                )}
                {!editing && editId !== a.id && (
                  <div style={{ marginTop: 8 }}>
                    <ScoreRow a={a} field="drawScore" label="Draw" />
                    <ScoreRow a={a} field="talentScore" label="Talent" />
                    {Object.keys(ctx.recPasses).filter((k) => k.startsWith(a.id + "|")).length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        <span style={{ fontSize: 11, letterSpacing: 1, textTransform: "uppercase", color: T.muted }}>Passed dates: </span>
                        {Object.keys(ctx.recPasses).filter((k) => k.startsWith(a.id + "|")).map((k) => {
                          const dt = k.split("|")[1];
                          return (
                            <button key={k} onClick={async () => {
                              try { await ctx.api.clearPasses(a.id); await ctx.refreshDesk(); ctx.flash(`Cleared passes for ${a.name}. They're eligible again.`); }
                              catch (e) { ctx.flash(e.message || "Could not clear."); }
                            }} style={{ ...st.ghostBtn, fontSize: 11, padding: "2px 8px", marginRight: 4, borderColor: T.red, color: T.red }} title="Tap to clear this artist's passes">{dt} ✕</button>
                          );
                        })}
                      </div>
                    )}
                    {a.adminNotes
                      ? <div style={{ fontSize: 12.5, color: T.green, marginTop: 8 }}>Note: {a.adminNotes}</div>
                      : <div style={{ fontSize: 12, color: T.muted, fontStyle: "italic", marginTop: 8 }}>No venue notes</div>}
                    <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap", alignItems: "center" }}>
                      <button onClick={() => setNoteEdit((p) => ({ ...p, [a.id]: a.adminNotes || "" }))} style={{ ...st.ghostBtn, fontSize: 11.5, padding: "3px 8px" }}>{a.adminNotes ? "Edit note" : "Add note"}</button>
                      <button onClick={() => startEdit(a)} style={{ ...st.ghostBtn, fontSize: 11.5, padding: "3px 8px" }}>Edit details</button>
                      {!mergeId && (
                        <button onClick={() => { setMergeId(a.id); setMergeArm(null); setEditId(null); }} style={{ ...st.ghostBtn, fontSize: 11.5, padding: "3px 8px" }}>Merge</button>
                      )}
                      {mergeId && a.id !== mergeId && (
                        <button onClick={() => (mergeArm === a.id ? doMerge(a.id) : setMergeArm(a.id))} onBlur={() => setMergeArm(null)} style={{ ...st.ghostBtn, fontSize: 11.5, padding: "3px 8px", borderColor: T.amber, color: T.amber }}>{mergeArm === a.id ? `Keep ${a.name || "this"}, merge in the other?` : "Keep this one ←"}</button>
                      )}
                      {mergeId === a.id && <span style={{ fontSize: 11.5, color: T.amber }}>merging this record…</span>}
                    </div>
                  </div>
                )}
                {editing && (
                  <div style={{ marginTop: 8 }}>
                    <textarea value={noteEdit[a.id]} onChange={(e) => setNoteEdit((p) => ({ ...p, [a.id]: e.target.value }))} rows={2} placeholder="Venue-only note: draw, reliability, sound needs, weather range..." style={{ ...st.input, width: "100%", boxSizing: "border-box", resize: "vertical" }} />
                    <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                      <button onClick={() => saveNote(a.id)} style={{ ...st.amberBtn, fontSize: 12, padding: "5px 12px" }}>Save note</button>
                      <button onClick={() => setNoteEdit((p) => { const n = { ...p }; delete n[a.id]; return n; })} style={{ ...st.ghostBtn, fontSize: 11.5, padding: "4px 10px" }}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
              <div style={{ fontSize: 11, color: T.muted, textAlign: "right" }}>{a.source}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SecurityCard({ ctx }) {
  const [stage, setStage] = useState("idle"); // idle | enrolling
  const [secret, setSecret] = useState("");
  const [otpauth, setOtpauth] = useState("");
  const [code, setCode] = useState("");
  const [enrolled, setEnrolled] = useState(null);
  const [cur, setCur] = useState("");
  const [nw, setNw] = useState("");

  useEffect(() => { (async () => { try { const m = await ctx.api.adminMe(); setEnrolled(!!(m && m.admin && m.admin.totpEnrolled)); } catch (e) {} })(); }, []);

  async function start() {
    try { const r = await ctx.api.adminTotpStart(); setSecret(r.secret); setOtpauth(r.otpauthUrl || ""); setStage("enrolling"); }
    catch (e) { ctx.flash(e.message || "Could not start enrolment."); }
  }
  async function confirm() {
    try { await ctx.api.adminTotpConfirm(secret, code.trim()); setEnrolled(true); setStage("idle"); setCode(""); ctx.flash("Two-factor is on. You'll need a code at next sign-in."); }
    catch (e) { ctx.flash(e.message || "That code didn't match. Try the current one."); }
  }
  async function changePw() {
    if (nw.length < 10) { ctx.flash("New password must be at least 10 characters."); return; }
    try { await ctx.api.adminPassword(cur, nw); setCur(""); setNw(""); ctx.flash("Password changed."); }
    catch (e) { ctx.flash(e.message || "Could not change the password."); }
  }

  return (
    <div style={st.card}>
      <div style={st.cardTitle}>Desk security</div>
      <p style={{ fontSize: 12.5, color: T.muted, margin: "6px 0 10px" }}>Two-factor uses an authenticator app (Google Authenticator, 1Password, Authy). {enrolled ? "It's currently on." : "It's currently off."}</p>
      {!enrolled && stage === "idle" && <button onClick={start} style={st.amberBtn}>Enable two-factor</button>}
      {stage === "enrolling" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 12.5, color: T.cream }}>Add this secret to your authenticator, then enter the current 6-digit code:</div>
          <code style={{ fontSize: 13, color: T.amber, wordBreak: "break-all", background: T.panel2, padding: "6px 8px", borderRadius: 6 }}>{secret}</code>
          {otpauth && <div style={{ fontSize: 11, color: T.muted, wordBreak: "break-all" }}>{otpauth}</div>}
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" style={{ ...st.input, letterSpacing: 4, textAlign: "center" }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={confirm} style={st.amberBtn}>Confirm</button>
            <button onClick={() => { setStage("idle"); setCode(""); }} style={st.ghostBtn}>Cancel</button>
          </div>
        </div>
      )}
      <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.line}` }}>
        <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: T.amber, marginBottom: 8 }}>Change password</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input type="password" value={cur} onChange={(e) => setCur(e.target.value)} placeholder="Current password" style={st.input} />
          <input type="password" value={nw} onChange={(e) => setNw(e.target.value)} placeholder="New password (10+ characters)" style={st.input} />
          <button onClick={changePw} style={st.ghostBtn}>Update password</button>
        </div>
      </div>
    </div>
  );
}

function AdminKnowledge({ ctx }) {
  const [text, setText] = useState(ctx.kb);
  const [notifStatus, setNotifStatus] = useState(Notification.permission);

  async function enableNotifications() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      ctx.flash("Push notifications aren't supported on this browser.");
      return;
    }
    if (!ctx.info?.pushPublicKey) {
      ctx.flash("VAPID keys aren't configured on the server yet.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setNotifStatus(permission);
      if (permission !== "granted") { ctx.flash("Notification permission was denied."); return; }
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) await existing.unsubscribe();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(ctx.info.pushPublicKey),
      });
      await ctx.api.pushSubscribe(sub.toJSON());
      ctx.flash("Notifications enabled. You'll get a ping when a new request comes in.");
    } catch (e) {
      ctx.flash(e.message || "Could not enable notifications.");
    }
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={st.card}>
        <div style={st.cardTitle}>Extra venue knowledge</div>
        <p style={{ fontSize: 13, color: T.muted, margin: "6px 0 10px" }}>The Friday Night Sessions docs (v1.3), Songwriter Round (v1.2), stage spec sheet, gear rules, and the tip/door-cover model are already built in. Add anything beyond those here. This text feeds both the artist "The Deal" page and the chatbot; anything not covered escalates to {INFO_EMAIL}.</p>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} placeholder={DEFAULT_KB} style={{ ...st.input, width: "100%", resize: "vertical", boxSizing: "border-box" }} />
        <button onClick={async () => { try { await ctx.api.saveKb(text); await ctx.refreshDesk(); ctx.flash("Knowledge updated for the page and the chatbot."); } catch (e) { ctx.flash(e.message || "Could not save."); } }} style={{ ...st.amberBtn, marginTop: 8 }}>Save knowledge</button>
      </div>

      <div style={st.card}>
        <div style={st.cardTitle}>Booking request notifications</div>
        <p style={{ fontSize: 13, color: T.muted, margin: "6px 0 10px" }}>
          Get a push notification on this device when an artist submits a booking request. Requires the app to be added to your home screen on iPhone.
        </p>
        {notifStatus === "granted"
          ? <div style={{ fontSize: 13, color: T.green }}>Notifications are enabled on this device.</div>
          : notifStatus === "denied"
          ? <div style={{ fontSize: 13, color: T.red }}>Notifications are blocked. Go to your phone Settings → Safari → Notifications → bunkerstratford.com and allow them, then tap below.</div>
          : null}
        <button onClick={enableNotifications} style={{ ...st.ghostBtn, marginTop: 8 }}>
          {notifStatus === "granted" ? "Re-register this device" : "Enable notifications on this device"}
        </button>
      </div>

      <SecurityCard ctx={ctx} />

      <div style={{ ...st.card, borderLeft: `3px solid ${T.red}` }}>
        <div style={st.cardTitle}>Security roadmap</div>
        <p style={st.p}>Authentication runs server-side. What's live now:</p>
        <p style={st.p}>1. <b style={{ color: T.cream }}>Accounts:</b> passwords hashed with bcrypt, never stored or transmitted in plain text; email verification at signup; rate-limited logins; session cookies with expiry; password reset by email.</p>
        <p style={st.p}>2. <b style={{ color: T.cream }}>Venue 2FA:</b> TOTP authenticator codes for the desk, enrolled above. Once enrolled, desk sign-in needs your password and a current code.</p>
        <p style={st.p}>3. <b style={{ color: T.cream }}>Accountability:</b> every approval, edit, and send is written to an audit log.</p>
        <p style={st.p}>4. <b style={{ color: T.cream }}>Next:</b> passkeys (WebAuthn: Face ID, fingerprint, or hardware key), role-based permissions, and automated encrypted backups.</p>
        <p style={{ ...st.p, color: T.muted }}>No system is unhackable, and anyone promising that is selling something. Server-side auth plus TOTP puts the Bunker ahead of most venues its size.</p>
      </div>
    </div>
  );
}

function AdminEscalations({ ctx }) {
  async function toggle(id) {
    const cur = ctx.escalations.find((e) => e.id === id);
    try { await ctx.api.resolveEscalation(id, !(cur && cur.resolved)); await ctx.refreshDesk(); }
    catch (e) { ctx.flash(e.message || "Could not update."); }
  }
  if (ctx.escalations.length === 0) return <p style={{ color: T.muted, fontSize: 13.5 }}>No chatbot escalations yet. When the bot can't answer, the question lands here and the artist gets a prefilled email to {INFO_EMAIL}.</p>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {ctx.escalations.map((e) => (
        <div key={e.id} style={{ ...st.card, opacity: e.resolved ? 0.55 : 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <div style={{ color: T.cream, fontWeight: 700 }}>{e.question}</div>
            <button onClick={() => toggle(e.id)} style={{ ...st.ghostBtn, fontSize: 11.5, padding: "3px 8px", borderColor: e.resolved ? T.green : T.line, color: e.resolved ? T.green : T.muted }}>{e.resolved ? "Resolved" : "Mark resolved"}</button>
          </div>
          <div style={{ fontSize: 12.5, color: T.amber, marginTop: 4 }}>{e.contact}</div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 6, whiteSpace: "pre-wrap" }}>{e.summary}</div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 6 }}>{new Date(e.ts).toLocaleString("en-CA")}</div>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   STYLES
   ============================================================ */
const st = {
  shell: {
    minHeight: "100vh", background: T.ink, color: T.cream,
    fontFamily: "'Karla', system-ui, sans-serif",
    display: "flex", flexDirection: "column",
  },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "16px 16px 12px", borderBottom: `1px solid ${T.line}`,
    background: `linear-gradient(180deg, ${T.panel} 0%, ${T.ink} 100%)`,
    position: "sticky", top: 0, zIndex: 5, gap: 10,
  },
  main: { flex: 1, padding: "16px 16px 80px", maxWidth: 720, width: "100%", margin: "0 auto", boxSizing: "border-box" },
  tabbar: {
    position: "fixed", bottom: 0, left: 0, right: 0, display: "flex",
    background: T.panel, borderTop: `1px solid ${T.line}`, zIndex: 5,
    paddingBottom: "env(safe-area-inset-bottom, 0px)",
  },
  tab: { flex: 1, padding: "14px 4px 16px", background: "transparent", border: "none", fontSize: 12.5, fontFamily: "'Karla', sans-serif", fontWeight: 700, letterSpacing: 0.5, cursor: "pointer" },
  adminTabs: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 },
  adminTab: { padding: "7px 12px", borderRadius: 20, border: `1px solid ${T.line}`, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "'Karla', sans-serif" },
  card: { background: T.panel, border: `1px solid ${T.line}`, borderRadius: 10, padding: "13px 14px", marginBottom: 2 },
  cardTitle: { fontFamily: "'Bebas Neue', sans-serif", fontSize: 17, letterSpacing: 2, color: T.amber },
  h2: { fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: 2, color: T.cream, margin: "0 0 12px", fontWeight: 400 },
  h3: { fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, letterSpacing: 2, color: T.amber, margin: "4px 0 2px", fontWeight: 400 },
  p: { fontSize: 13.5, lineHeight: 1.6, color: T.muted, margin: "6px 0" },
  lede: { fontSize: 14, lineHeight: 1.6, color: T.muted, margin: "0 0 14px" },
  badge: { display: "inline-block", fontSize: 10, letterSpacing: 1.5, fontWeight: 700, color: T.amber, border: `1px solid ${T.amber}`, borderRadius: 4, padding: "2px 6px", verticalAlign: "middle" },
  input: {
    background: T.panel2, border: `1px solid ${T.line}`, borderRadius: 8,
    padding: "10px 12px", color: T.cream, fontSize: 16, fontFamily: "'Karla', sans-serif",
    outline: "none", minWidth: 0,
  },
  amberBtn: {
    background: T.amber, color: T.ink, border: "none", borderRadius: 8,
    padding: "9px 16px", fontSize: 13.5, fontWeight: 700, cursor: "pointer",
    fontFamily: "'Karla', sans-serif", whiteSpace: "nowrap",
  },
  ghostBtn: {
    background: "transparent", color: T.muted, border: `1px solid ${T.line}`, borderRadius: 8,
    padding: "8px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
    fontFamily: "'Karla', sans-serif", whiteSpace: "nowrap",
  },
  formGrid: { display: "flex", flexDirection: "column", gap: 9, marginTop: 12 },
  label: { fontSize: 11.5, letterSpacing: 1.5, textTransform: "uppercase", color: T.muted, marginBottom: 6 },
  overlay: {
    position: "fixed", inset: 0, background: "rgba(10,8,5,0.8)", zIndex: 10,
    display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "30px 14px",
  },
  modal: {
    background: T.panel, border: `1px solid ${T.line}`, borderRadius: 12,
    padding: "18px 18px 20px", maxWidth: 480, width: "100%", boxSizing: "border-box",
  },
  toast: {
    position: "fixed", bottom: 70, left: "50%", transform: "translateX(-50%)",
    background: T.amber, color: T.ink, fontWeight: 700, fontSize: 13.5,
    padding: "10px 18px", borderRadius: 24, zIndex: 20, boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
    maxWidth: "90%", textAlign: "center",
  },
};
