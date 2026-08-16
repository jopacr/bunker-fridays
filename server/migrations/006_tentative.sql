-- Tracks "I've reached out and they're tentative" per (artist, date). Not a
-- reservation — multiple artists can be tentative for the same date while the
-- venue juggles responses. Cleared automatically (with a notification) when a
-- booking for that date is confirmed.
CREATE TABLE IF NOT EXISTS tentative_holds (
  id         TEXT PRIMARY KEY,
  artist_id  TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  date_iso   TEXT NOT NULL,
  slot_label TEXT,
  created    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (artist_id, date_iso)
);
CREATE INDEX IF NOT EXISTS tentative_holds_date_idx ON tentative_holds (date_iso);
