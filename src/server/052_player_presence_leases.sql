BEGIN;

CREATE TABLE IF NOT EXISTS player_presence_leases (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  auth_session_id UUID NOT NULL REFERENCES auth_sessions(id) ON DELETE CASCADE,
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS player_presence_leases_user_active_idx
  ON player_presence_leases(user_id,expires_at DESC);
CREATE INDEX IF NOT EXISTS player_presence_leases_session_idx
  ON player_presence_leases(auth_session_id);

COMMIT;
