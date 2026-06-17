# Bunker Fridays

A booking system for Friday Night Sessions at The Bunker Performance Lounge and Cafe, 104 Wellington St, Stratford ON. Artists request Friday dates from a phone-first web app; the venue reviews requests, books slots, runs a recommendation engine, and keeps an artist database, all from a desk view in the same app.

This repo is the production build of the venue-approved prototype: the same screens, copy, and business rules, now backed by a real server, a database, accounts, and the venue's integrations.

## What's in the box

```
bunker-fridays/
  client/      React app (Vite). Artist portal + venue desk. PWA with push.
  server/      Node + Express REST API over PostgreSQL.
  docker-compose.yml   Local Postgres.
  railway.json         One-service deploy (build client, serve from server).
```

The server serves the built client, so production runs as a single service on one origin. In development you run them separately and Vite proxies `/api` to the server.

## Architecture

The business rules live in pure functions in `server/src/lib` (dates, rules, recommend, drafts, workbook, knowledge) and are exercised by a test suite that mirrors the prototype's acceptance checklist. Every artist-facing write and every booking decision is validated on the server, so the client cannot talk the system into breaking a rule (slot collisions, the originals cap, the 28-day cooldown, Writers Round gating, per-night limits).

Canon enforced server-side: three artists per Friday at 8/9/10PM, 45-minute sets, at most two originals sets a night with a $50 originals guarantee, a Writers Round on the last Friday of each month (overridable, originals only), at most two sets per artist per night, a 28-day cooldown after any confirmed date (pending requests inside that window auto-decline, new ones are blocked), and blackout dates (a "playing in Stratford" blackout also holds outreach for 14 days either side, but never blocks a direct request).

The recommendation engine scores eligible artists by talent plus draw, with bonuses for filling a local or new-artist gap and a penalty for repeat recommendations, spacing every booking in both directions and avoiding repeat bills. Accepting a pick only drafts outreach; nothing books until the artist says yes.

Email is draft-first by design. The system writes confirmation, decline, time-change, and outreach drafts, but nothing is sent to an artist until a person clicks Send on that draft (or uses Open in email / Copy). Account verification and password-reset emails are the only system-sent mail.

## Integrations (all optional, all degrade gracefully)

If a key is absent the feature switches off and the boot log lists it; the rest of the app keeps working.

- Anthropic, for the artist chatbot. It answers only from the built-in venue facts plus venue-editable notes, and escalates anything else to a logged follow-up.
- Resend, for sending drafts on demand and for auth emails.
- Cloudflare Turnstile, for spam protection on the public request form.
- Cloudflare R2, for full-resolution promo photo uploads via presigned PUT.
- Web Push (VAPID), for open-date pings to artists' phones through the PWA.
- Wix Automations webhook, bridging the existing performer-inquiry form into the desk inbox.
- The Excel booking workbook, imported and exported in the VBA macro's exact layout so the venue can keep using it alongside the app.

## Security

Artist and admin accounts use bcrypt password hashing, email verification at signup, rate-limited logins, and expiring session cookies. The venue desk supports TOTP two-factor (enrolled in-app under Knowledge, then required at sign-in). Every approval, edit, and send is written to an audit log. Artist e-transfer details are handled with PIPEDA care and never exposed in public responses.

## Local development

Prerequisites: Node 20+ and either Docker (for Postgres) or a local Postgres.

```bash
# 1. Database
docker compose up -d

# 2. Server
cd server
cp .env.example .env          # fill in keys as you enable features
npm install
npm run migrate
npm run seed:admin you@venue.com "a strong password"
npm start                     # http://localhost:8080

# 3. Client (separate terminal)
cd client
npm install
npm run dev                   # http://localhost:5173, proxies /api to :8080
```

Run the rule tests from `server/`:

```bash
npm test
```

## Deploy (Railway, alongside the existing site)

The app is built to live behind the same domain as the venue's current site at `whats-tonight-production.up.railway.app`.

1. Create a Railway project with a PostgreSQL plugin; copy its connection string into `DATABASE_URL`.
2. Set the service variables from `server/.env.example`. At minimum set `BASE_URL` to the public URL, `COOKIE_SECURE=true`, and `MIGRATE_ON_BOOT=true`.
3. Deploy. `railway.json` builds the client, installs the server, and starts it; migrations run on boot.
4. Seed the first admin once, from the Railway shell: `cd server && node src/seedAdmin.js you@venue.com "a strong password"`, then sign in at the desk and enrol two-factor under Knowledge.

## Migration day

1. Stand up the database and deploy as above.
2. In the desk, open Artists and import the current `New_Booking_doc.xlsm`. This loads artists, statuses, scores, last-played and unavailable dates, and any future bookings onto the calendar. Re-importing is safe and idempotent.
3. Spot-check a few upcoming Fridays on the public calendar against the workbook.
4. Point the Wix performer-inquiry Automation at `POST /api/integrations/wix` with the shared secret header, and confirm a test inquiry lands in the inbox.
5. Soft launch: share the app link with a handful of rotation artists before announcing it widely. Export the workbook any time you want Excel to stay a mirror.

## API surface (brief)

Public: `GET /api/calendar`, `GET /api/info`, `POST /api/requests`, `POST /api/chat`, plus `/api/me/*` for a signed-in artist (requests, profile, blackouts, pings, photos, push).
Auth: `/api/auth/*` (artist signup/verify/login/reset), `/api/admin/auth/*` (login, TOTP, password).
Desk: `/api/admin/*` (state, request decisions, calendar ops, artists, drafts incl. the single Send path, recommendations, knowledge, escalations) and `/api/admin/workbook/{import,export}`.
Integrations: `POST /api/integrations/wix`.
