-- Repair installations where 003 ran after game_servers already existed.
-- CREATE TABLE IF NOT EXISTS does not add columns to an existing table.
ALTER TABLE game_servers
  ADD COLUMN IF NOT EXISTS current_match_id UUID;

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS server_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey)
    WHERE c.contype='f'
      AND c.conrelid='game_servers'::regclass
      AND c.confrelid='matches'::regclass
      AND a.attname='current_match_id'
  ) THEN
    ALTER TABLE game_servers
      ADD CONSTRAINT game_servers_current_match_id_fkey
      FOREIGN KEY (current_match_id) REFERENCES matches(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=ANY(c.conkey)
    WHERE c.contype='f'
      AND c.conrelid='matches'::regclass
      AND c.confrelid='game_servers'::regclass
      AND a.attname='server_id'
  ) THEN
    ALTER TABLE matches
      ADD CONSTRAINT matches_server_id_fkey
      FOREIGN KEY (server_id) REFERENCES game_servers(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_game_servers_current_match
  ON game_servers(current_match_id);

CREATE INDEX IF NOT EXISTS idx_matches_server
  ON matches(server_id);
