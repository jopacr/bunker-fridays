// Venue knowledge (§8). CORE_FACTS is the canon compiled from the Friday Night
// Sessions sheets, the Songwriter Round sheet, the stage spec, and venue direction.
// One source feeds both the artist "The Deal" page and the chatbot.
// The venue-editable extra block lives in the venue_kb table.

export const INFO_EMAIL = "info@bunkerstratford.com";

export const CORE_FACTS = `
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

export const DEFAULT_KB = `Anything not covered by the core venue knowledge can be added here by the venue. The chatbot answers only from the core knowledge plus this text; everything else gets a human follow-up from ${INFO_EMAIL}.`;
