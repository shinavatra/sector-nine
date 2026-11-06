BEGIN;

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS server_reserved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS server_ready_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_matches_pending_server_deadlines
  ON matches(server_ready_at)
  WHERE status='pending' AND server_id IS NOT NULL;

COMMIT;
