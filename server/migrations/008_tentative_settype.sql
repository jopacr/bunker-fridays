-- Recommend-tab tentative holds now also carry a set type, so they can be
-- displayed inline with the same info (and edited the same way) as a manual
-- calendar entry, rather than as a separate, sparser list.
ALTER TABLE tentative_holds ADD COLUMN IF NOT EXISTS set_type TEXT;
