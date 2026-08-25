-- Soft passes: deprioritize an artist for a specific date without excluding
-- them outright (a hard pass, via rec_passes, still fully excludes). Mirrors
-- rec_passes' shape exactly.
CREATE TABLE IF NOT EXISTS soft_passes (
  artist_id TEXT NOT NULL REFERENCES artists(id) ON DELETE CASCADE,
  date      TEXT NOT NULL,
  ts        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (artist_id, date)
);
