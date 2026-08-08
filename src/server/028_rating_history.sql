BEGIN;

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS p1_rating_change INTEGER,
  ADD COLUMN IF NOT EXISTS p2_rating_change INTEGER;

CREATE TABLE IF NOT EXISTS rating_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  rating_before INTEGER NOT NULL CHECK (rating_before >= 0),
  rating_after INTEGER NOT NULL CHECK (rating_after >= 0),
  rating_delta INTEGER NOT NULL,
  rank_before INTEGER NOT NULL CHECK (rank_before > 0),
  rank_after INTEGER NOT NULL CHECK (rank_after > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, match_id)
);

CREATE INDEX IF NOT EXISTS idx_rating_history_user_game_created
  ON rating_history(user_id, game_id, created_at DESC, id DESC);

COMMIT;
