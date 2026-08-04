-- Carry the slot time and set type the venue was offering when they pinged an
-- artist, so the artist's "Request this date" prefills the same slot/style
-- while still letting them change it.
ALTER TABLE pings ADD COLUMN IF NOT EXISTS slot_time TEXT;
ALTER TABLE pings ADD COLUMN IF NOT EXISTS set_type TEXT;
