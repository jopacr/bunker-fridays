-- Marks a night as "reviewed" — the venue has gone through each confirmed
-- artist's Draw/Talent scores and notes for that night. Used to require a
-- review pass before a past Friday is considered fully wrapped up.
ALTER TABLE nights ADD COLUMN IF NOT EXISTS reviewed BOOLEAN NOT NULL DEFAULT FALSE;
