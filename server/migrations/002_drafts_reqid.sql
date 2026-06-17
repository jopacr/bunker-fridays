-- Tie each generated email draft to the request it came from, so the desk can
-- reopen a request's draft from the request card (not just the global list).
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS req_id TEXT;
CREATE INDEX IF NOT EXISTS idx_drafts_req_id ON drafts (req_id);
