ALTER TABLE matches ADD COLUMN IF NOT EXISTS game_id TEXT NOT NULL DEFAULT 'hl1';
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS game_id TEXT NOT NULL DEFAULT 'hl1';
ALTER TABLE ladder_seasons ADD COLUMN IF NOT EXISTS game_id TEXT NOT NULL DEFAULT 'hl1';
ALTER TABLE queue_entries ADD COLUMN IF NOT EXISTS game_id TEXT NOT NULL DEFAULT 'hl1';

CREATE INDEX IF NOT EXISTS idx_matches_game ON matches(game_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_game ON tournaments(game_id);
CREATE INDEX IF NOT EXISTS idx_ladder_seasons_game ON ladder_seasons(game_id);
CREATE INDEX IF NOT EXISTS idx_queue_entries_game ON queue_entries(game_id);

CREATE TABLE IF NOT EXISTS game_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id TEXT NOT NULL DEFAULT 'hl1',
  region TEXT NOT NULL,
  name TEXT NOT NULL,
  ip_address TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 27015,
  rcon_password TEXT,
  max_slots INTEGER NOT NULL DEFAULT 2,
  status TEXT NOT NULL DEFAULT 'offline'
    CHECK (status IN ('online', 'offline', 'in_use')),
  current_match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_game_servers_lookup
  ON game_servers(game_id, region, status);

ALTER TABLE matches ADD COLUMN IF NOT EXISTS server_id UUID REFERENCES game_servers(id);