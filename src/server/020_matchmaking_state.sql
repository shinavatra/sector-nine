-- PostgreSQL-backed matchmaking lifecycle.
ALTER TABLE queue_entries
  ADD COLUMN IF NOT EXISTS game_id TEXT NOT NULL DEFAULT 'hl1';

ALTER TABLE queue_entries
  ADD COLUMN IF NOT EXISTS preferred_region TEXT;

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS matchmaking_region TEXT;

CREATE TABLE IF NOT EXISTS match_acceptances (
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','declined')),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (match_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_match_acceptances_user
  ON match_acceptances(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_queue_matchmaking_lookup
  ON queue_entries(game_id, game_mode, joined_at);
