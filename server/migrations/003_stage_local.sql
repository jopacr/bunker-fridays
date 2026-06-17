-- Preferred stage name (display), distinct from the legal/booking name.
ALTER TABLE artists ADD COLUMN IF NOT EXISTS stage_name TEXT;

-- Local flag carried from the booking workbook's "Local" column. The app also
-- treats an artist as local when their city is within ~20 min of Stratford;
-- this flag covers imported artists whose real city we don't have.
ALTER TABLE artists ADD COLUMN IF NOT EXISTS is_local BOOLEAN NOT NULL DEFAULT FALSE;
