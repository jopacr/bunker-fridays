// Email draft templates (§6), ported verbatim from the venue-approved prototype.
// Drafts are generated and saved; NOTHING sends without an explicit venue click.

import { fmtLong } from "./dates.js";

export function confirmEmailDraft(r, artist) {
  const writers = r.setType === "writers-round";
  const lines = [];
  lines.push(`Hi ${r.name},`);
  lines.push("");
  lines.push(`Great news: you're confirmed for ${fmtLong(r.date)}${r.slotTime ? `, taking the ${r.slotTime} set` : ""} at The Bunker.`);
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
  return { subject: `Confirmed: The Bunker, ${fmtLong(r.date)}${r.slotTime ? ` (${r.slotTime})` : ""}`, body: lines.join("\n") };
}

export function declineEmailDraft(reason, r, suggestions) {
  const lines = [];
  lines.push(`Hi ${r.name},`);
  lines.push("");
  if (reason === "slot-filled") {
    lines.push(`Thanks so much for requesting ${fmtLong(r.date)}. That night drew a lot of interest and filled up before we could fit you in. This is not a pass on you, just on the date.`);
  } else if (reason === "conflict") {
    lines.push(`Thanks for requesting ${fmtLong(r.date)}. Our apologies: that night already had a prior booking that hadn't made it into the calendar yet, so we have to release your request for that date. This one's on us, not on you.`);
  } else {
    lines.push(`Thanks for requesting ${fmtLong(r.date)}. We aren't able to make that particular night work, but we'd genuinely like to find you a spot.`);
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
  return { subject: `About your Bunker request for ${fmtLong(r.date)}`, body: lines.join("\n") };
}

export function timeChangeEmailDraft(r, oldSlot) {
  const lines = [];
  lines.push(`Hi ${r.name},`);
  lines.push("");
  lines.push(`Quick scheduling update for your set on ${fmtLong(r.date)}: you're now taking the ${r.slotTime} set${oldSlot ? ` (moved from ${oldSlot})` : ""}.`);
  lines.push("");
  lines.push("Everything else stays the same: soundcheck 6PM to 7PM, load in at The Bunker lot then move your vehicle for the evening, and 2 half-price drinks with your set.");
  lines.push("");
  lines.push("If the new time creates a problem on your end, reply here and we'll sort it out.");
  lines.push("");
  lines.push("Thanks for rolling with it,");
  lines.push("The Bunker Performance Lounge");
  return { subject: `Time update: The Bunker, ${fmtLong(r.date)} (now ${r.slotTime})`, body: lines.join("\n") };
}

export function removalEmailDraft(r, reason) {
  const lines = [];
  lines.push(`Hi ${r.name},`);
  lines.push("");
  lines.push(`I'm sorry for the change, but we've had to release your ${r.slotTime ? `${r.slotTime} ` : ""}set on ${fmtLong(r.date)} at The Bunker.`);
  if (reason && String(reason).trim()) {
    lines.push("");
    lines.push(String(reason).trim());
  }
  lines.push("");
  lines.push("This isn't a reflection on you or your music, and we'd love to get you on an upcoming Friday. Reply here and we'll find a new date that works.");
  lines.push("");
  lines.push("With apologies and thanks for understanding,");
  lines.push("The Bunker Performance Lounge");
  return { subject: `Update on your set at The Bunker, ${fmtLong(r.date)}`, body: lines.join("\n") };
}

export function outreachEmailDraft(artistName, dateLabel, slotLabel, slotType, writers) {
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

export function outreachShortText(artistName, dateLabel, slotLabel, slotType, writers) {
  if (writers) return `Hi ${artistName}, it's The Bunker in Stratford. We're building our Writers Round for ${dateLabel} (originals, 12 to 15 songs) and thought of you. Interested and available?`;
  return `Hi ${artistName}, it's The Bunker in Stratford. We have ${slotType === "originals" ? "an originals set" : "a covers set"} open ${dateLabel}${slotLabel && slotLabel !== "TBD" ? ` at ${slotLabel}` : ""}. Interested and available?`;
}
