BEGIN;

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS map_ban_turn_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS match_map_selections (
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  maps TEXT[] NOT NULL,
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (match_id, user_id)
);

CREATE TABLE IF NOT EXISTS match_map_bans (
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL CHECK (sequence > 0),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  map_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (match_id, sequence),
  UNIQUE (match_id, map_id)
);

CREATE INDEX IF NOT EXISTS idx_match_map_selections_user
  ON match_map_selections(user_id, confirmed_at DESC);

CREATE INDEX IF NOT EXISTS idx_match_map_bans_match
  ON match_map_bans(match_id, sequence);

UPDATE game_map_pools
SET maps = ARRAY[
  'dm_crossfire', 'dm_bounce', 'dm_lockdown', 'dm_rapidcore', 'dm_stalkyard',
  'dm_killbox', 'dm_undertow', 'dm_gasworks', 'dm_boot_camp', 'dm_datacore'
]
WHERE game_id = 'hl1'
  AND game_mode = 'instagib-mode'
  AND cardinality(maps) < 10;

COMMIT;
