BEGIN;

ALTER TABLE game_servers
  ADD COLUMN IF NOT EXISTS game_mode TEXT;

CREATE INDEX IF NOT EXISTS idx_game_servers_mode_assignment
  ON game_servers(game_id,game_mode,region,status,created_at)
  WHERE current_match_id IS NULL;

CREATE OR REPLACE FUNCTION enforce_game_server_mode()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.game_mode IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM game_matchmaking_config config
    WHERE config.game_id=NEW.game_id
      AND NEW.game_mode=ANY(config.modes)
  ) THEN
    RAISE EXCEPTION 'Game server mode is not configured for game %', NEW.game_id
      USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_game_servers_mode ON game_servers;
CREATE TRIGGER trg_game_servers_mode
BEFORE INSERT OR UPDATE OF game_id,game_mode ON game_servers
FOR EACH ROW EXECUTE FUNCTION enforce_game_server_mode();

CREATE OR REPLACE FUNCTION enforce_match_server_game()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.server_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM game_servers server
    WHERE server.id=NEW.server_id
      AND server.game_id=NEW.game_id
      AND server.game_mode=NEW.game_mode
  ) THEN
    RAISE EXCEPTION 'Match and server game IDs and modes must match' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_matches_server_game ON matches;
CREATE TRIGGER trg_matches_server_game
BEFORE INSERT OR UPDATE OF server_id,game_id,game_mode ON matches
FOR EACH ROW EXECUTE FUNCTION enforce_match_server_game();

COMMIT;
