BEGIN;

ALTER TABLE game_servers
  ADD COLUMN IF NOT EXISTS rcon_secret_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS server_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS current_players INTEGER NOT NULL DEFAULT 0 CHECK (current_players>=0),
  ADD COLUMN IF NOT EXISTS current_map TEXT,
  ADD COLUMN IF NOT EXISTS last_heartbeat TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS telemetry JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE game_servers SET rcon_password=NULL WHERE rcon_password IS NOT NULL;

CREATE TABLE IF NOT EXISTS game_server_player_snapshots (
  id BIGSERIAL PRIMARY KEY,
  server_id UUID NOT NULL REFERENCES game_servers(id) ON DELETE CASCADE,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  player_count INTEGER NOT NULL CHECK (player_count>=0),
  map_name TEXT,
  players JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_server_snapshots_server_observed
  ON game_server_player_snapshots(server_id,observed_at DESC);

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS result_source TEXT NOT NULL DEFAULT 'player' CHECK (result_source IN ('player','game_server','admin'));

COMMIT;
