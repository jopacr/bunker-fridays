-- Support a "promo" draft kind for the fully-booked lineup email sent to
-- Candace, and tag it to the night's date so the desk can reliably find "the
-- promo draft for this Friday" among many drafts (req_id doesn't apply here
-- since this isn't tied to a single request).
ALTER TABLE drafts DROP CONSTRAINT IF EXISTS drafts_kind_check;
ALTER TABLE drafts ADD CONSTRAINT drafts_kind_check CHECK (kind IN ('confirmation', 'follow-up', 'promo'));
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS night_date TEXT;
CREATE INDEX IF NOT EXISTS idx_drafts_night_date ON drafts (night_date);
