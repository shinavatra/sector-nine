BEGIN;

-- Fresh installs and historically provisioned Railway databases must converge
-- without recreating game_servers or changing existing server relationships.
CREATE INDEX IF NOT EXISTS idx_matches_game ON matches(game_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_game ON tournaments(game_id);
CREATE INDEX IF NOT EXISTS idx_ladder_seasons_game ON ladder_seasons(game_id);
CREATE INDEX IF NOT EXISTS idx_queue_entries_game ON queue_entries(game_id);
CREATE INDEX IF NOT EXISTS idx_game_servers_lookup ON game_servers(game_id,region,status);

ALTER TABLE game_servers
  ALTER COLUMN port SET DEFAULT 27015,
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

UPDATE game_servers SET created_at=NOW() WHERE created_at IS NULL;
UPDATE game_servers SET updated_at=NOW() WHERE updated_at IS NULL;

ALTER TABLE game_servers
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='game_servers'::regclass AND conname='game_servers_port_check') THEN
    ALTER TABLE game_servers ADD CONSTRAINT game_servers_port_check CHECK(port BETWEEN 1 AND 65535);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='game_servers'::regclass AND conname='game_servers_slots_check') THEN
    ALTER TABLE game_servers ADD CONSTRAINT game_servers_slots_check CHECK(slots > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='game_servers'::regclass AND conname='game_servers_ip_port_key') THEN
    ALTER TABLE game_servers ADD CONSTRAINT game_servers_ip_port_key UNIQUE(ip,port);
  END IF;
END $$;

DO $$
DECLARE
  delete_action "char";
BEGIN
  SELECT confdeltype INTO delete_action
  FROM pg_constraint
  WHERE conrelid='matches'::regclass
    AND conname='matches_server_id_fkey'
    AND contype='f';

  IF delete_action IS DISTINCT FROM 'n' THEN
    ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_server_id_fkey;
    ALTER TABLE matches
      ADD CONSTRAINT matches_server_id_fkey
      FOREIGN KEY(server_id) REFERENCES game_servers(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMIT;
