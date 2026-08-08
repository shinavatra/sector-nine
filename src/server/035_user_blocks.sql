CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_user_id),
  CONSTRAINT user_blocks_distinct_users CHECK (blocker_id <> blocked_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked_user ON user_blocks(blocked_user_id, blocker_id);
