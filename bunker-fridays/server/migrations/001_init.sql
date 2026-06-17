-- Bunker Fridays · production schema (spec §3, §9)

CREATE TABLE IF NOT EXISTS artists (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT,
  phone         TEXT,
  contact_method TEXT,
  instagram     TEXT,
  facebook      TEXT,
  genre         TEXT,
  originals_sets TEXT,
  covers_sets   TEXT,
  city          TEXT,
  links         TEXT,
  bio           TEXT,
  etransfer_email TEXT,            -- payment-adjacent PII: minimize display, never log (PIPEDA)
  booking_pref  TEXT CHECK (booking_pref IN ('single','rotation') OR booking_pref IS NULL),
  talent_score  SMALLINT CHECK (talent_score BETWEEN 0 AND 3 OR talent_score IS NULL),
  draw_score    SMALLINT CHECK (draw_score BETWEEN 0 AND 3 OR draw_score IS NULL),
  admin_notes   TEXT,              -- venue-only
  unavailable_dates JSONB NOT NULL DEFAULT '[]',   -- imported, ["YYYY-MM-DD"]
  blackouts     JSONB NOT NULL DEFAULT '[]',       -- [{date, reason: 'stratford'|'other'}]
  imported_last_played TEXT,
  last_companions JSONB NOT NULL DEFAULT '[]',
  account       BOOLEAN NOT NULL DEFAULT FALSE,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  pw_hash       TEXT,
  source        TEXT,
  photos        JSONB NOT NULL DEFAULT '[]',       -- R2 URLs, max 4
  created       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS artists_email_idx ON artists (lower(email));
CREATE INDEX IF NOT EXISTS artists_name_idx ON artists (lower(name));

CREATE TABLE IF NOT EXISTS requests (
  id            TEXT PRIMARY KEY,
  artist_id     TEXT REFERENCES artists(id) ON DELETE SET NULL, -- artist delete keeps history
  date          TEXT,                               -- YYYY-MM-DD; NULL for undated website inquiries
  event_type    TEXT NOT NULL DEFAULT 'friday' CHECK (event_type IN ('friday','writers-round','snl')),
  name          TEXT NOT NULL,
  email         TEXT,
  city          TEXT,
  set_type      TEXT CHECK (set_type IN ('single-originals','covers','writers-round') OR set_type IS NULL),
  slot_pref     TEXT NOT NULL DEFAULT 'any' CHECK (slot_pref IN ('any','8PM','9PM','10PM')),
  slot_time     TEXT CHECK (slot_time IN ('8PM','9PM','10PM') OR slot_time IS NULL),
  booking_pref  TEXT CHECK (booking_pref IN ('single','rotation') OR booking_pref IS NULL),
  recording     TEXT NOT NULL DEFAULT 'none' CHECK (recording IN ('none','board-tape','full-tracks')),
  notes         TEXT,
  guest         BOOLEAN NOT NULL DEFAULT FALSE,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined','cancelled')),
  decline_reason TEXT,
  auto          BOOLEAN NOT NULL DEFAULT FALSE,
  auto_reason   TEXT,
  cancelled_by  TEXT CHECK (cancelled_by IN ('artist','venue') OR cancelled_by IS NULL),
  cancelled_at  TIMESTAMPTZ,
  source        TEXT NOT NULL DEFAULT 'app',        -- app | wix
  ts            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS requests_date_idx ON requests (date);
CREATE INDEX IF NOT EXISTS requests_artist_idx ON requests (artist_id);
CREATE INDEX IF NOT EXISTS requests_status_idx ON requests (status);

-- prototype "overrides", keyed by night
CREATE TABLE IF NOT EXISTS nights (
  date          TEXT PRIMARY KEY,                   -- YYYY-MM-DD
  closed        BOOLEAN NOT NULL DEFAULT FALSE,
  writers_override BOOLEAN,                         -- NULL = default rule (last Friday of month)
  manual_slots  JSONB NOT NULL DEFAULT '[]',        -- [{name,setType,status,slotTime,source}]
  note          TEXT,
  updated       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drafts (
  id        TEXT PRIMARY KEY,
  to_email  TEXT,
  subject   TEXT NOT NULL,
  body      TEXT NOT NULL,
  kind      TEXT NOT NULL CHECK (kind IN ('confirmation','follow-up')),
  label     TEXT,
  sent      BOOLEAN NOT NULL DEFAULT FALSE,
  archived  BOOLEAN NOT NULL DEFAULT FALSE,         -- UI caps at 50; archive past that, retain in DB
  ts        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS escalations (
  id        TEXT PRIMARY KEY,
  question  TEXT NOT NULL,
  contact   TEXT,
  summary   TEXT,
  resolved  BOOLEAN NOT NULL DEFAULT FALSE,
  ts        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pings (
  id        TEXT PRIMARY KEY,
  artist_id TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  message   TEXT NOT NULL,
  date_iso  TEXT,                                   -- renders a "Request this date" button
  read      BOOLEAN NOT NULL DEFAULT FALSE,
  ts        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pings_artist_idx ON pings (artist_id);

CREATE TABLE IF NOT EXISTS rec_passes (
  artist_id TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  date      TEXT NOT NULL,
  ts        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (artist_id, date)
);

-- single-row config tables
CREATE TABLE IF NOT EXISTS rec_config (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  days_since_played   INT NOT NULL DEFAULT 120,
  local_bonus         INT NOT NULL DEFAULT 10,
  new_artist_bonus    INT NOT NULL DEFAULT 5,
  new_originals_bonus INT NOT NULL DEFAULT 3,
  recency_penalty     INT NOT NULL DEFAULT 2
);
INSERT INTO rec_config (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS venue_kb (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  text TEXT NOT NULL DEFAULT '',
  local_cities JSONB                                 -- configurable LOCAL badge list; NULL = built-in default
);
INSERT INTO venue_kb (id) VALUES (1) ON CONFLICT DO NOTHING;

-- §9: auth
CREATE TABLE IF NOT EXISTS admin_users (
  id        TEXT PRIMARY KEY,
  email     TEXT NOT NULL UNIQUE,
  name      TEXT,
  pw_hash   TEXT NOT NULL,
  totp_secret TEXT,                                  -- base32; NULL until enrolled
  role      TEXT NOT NULL DEFAULT 'owner',
  created   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,                       -- random 256-bit, stored hashed
  kind       TEXT NOT NULL CHECK (kind IN ('artist','admin')),
  subject_id TEXT NOT NULL,
  expires    TIMESTAMPTZ NOT NULL,
  created    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_subject_idx ON sessions (subject_id);

CREATE TABLE IF NOT EXISTS email_tokens (             -- verification + password reset
  token      TEXT PRIMARY KEY,
  artist_id  TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  purpose    TEXT NOT NULL CHECK (purpose IN ('verify','reset')),
  expires    TIMESTAMPTZ NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT FALSE,
  created    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         TEXT PRIMARY KEY,
  artist_id  TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  subscription JSONB NOT NULL,                       -- {endpoint, keys:{p256dh, auth}}
  created    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS push_endpoint_idx ON push_subscriptions ((subscription->>'endpoint'));

-- §9 hardening: audit log of approvals/edits/deletes
CREATE TABLE IF NOT EXISTS audit_log (
  id        BIGSERIAL PRIMARY KEY,
  actor     TEXT NOT NULL,                           -- admin user id / 'artist:<id>' / 'system'
  action    TEXT NOT NULL,
  entity    TEXT,
  entity_id TEXT,
  detail    JSONB,
  ts        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS login_attempts (           -- rate-limited logins
  key       TEXT NOT NULL,                            -- email or ip
  ts        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_attempts_idx ON login_attempts (key, ts);
