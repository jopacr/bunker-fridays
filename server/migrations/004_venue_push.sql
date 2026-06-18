-- Venue (admin) push subscriptions. Separate from artist push_subscriptions
-- since the venue has no artist_id. Multiple devices/browsers are supported.
CREATE TABLE IF NOT EXISTS venue_push_subscriptions (
  id          TEXT PRIMARY KEY,
  subscription JSONB NOT NULL,
  created     TIMESTAMPTZ NOT NULL DEFAULT now()
);
