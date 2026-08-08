BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS preferred_game_id TEXT NOT NULL DEFAULT 'hl1';

UPDATE matches SET game_id='hl1' WHERE game_id IS NULL OR BTRIM(game_id)='';
UPDATE tournaments SET game_id='hl1' WHERE game_id IS NULL OR BTRIM(game_id)='';
UPDATE ladder_seasons SET game_id='hl1' WHERE game_id IS NULL OR BTRIM(game_id)='';
UPDATE queue_entries SET game_id='hl1' WHERE game_id IS NULL OR BTRIM(game_id)='';
UPDATE game_servers SET game_id='hl1' WHERE game_id IS NULL OR BTRIM(game_id)='';

DO $$
DECLARE
  target_table TEXT;
  constraint_name TEXT;
BEGIN
  FOREACH target_table IN ARRAY ARRAY['matches','tournaments','ladder_seasons','queue_entries','game_servers']
  LOOP
    constraint_name := target_table || '_game_id_check';
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname=constraint_name) THEN
      EXECUTE format(
        'ALTER TABLE %I ADD CONSTRAINT %I CHECK (game_id IN (''hl1'',''cs16'',''l4d2'',''cod4''))',
        target_table, constraint_name
      );
    END IF;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='users_preferred_game_id_check') THEN
    ALTER TABLE users ADD CONSTRAINT users_preferred_game_id_check
      CHECK (preferred_game_id IN ('hl1','cs16','l4d2','cod4'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS user_game_stats (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL CHECK (game_id IN ('hl1','cs16','l4d2','cod4')),
  rating INTEGER NOT NULL DEFAULT 1000 CHECK (rating >= 0),
  points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  experience INTEGER NOT NULL DEFAULT 0 CHECK (experience >= 0),
  level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
  wins INTEGER NOT NULL DEFAULT 0 CHECK (wins >= 0),
  losses INTEGER NOT NULL DEFAULT 0 CHECK (losses >= 0),
  kills INTEGER NOT NULL DEFAULT 0 CHECK (kills >= 0),
  deaths INTEGER NOT NULL DEFAULT 0 CHECK (deaths >= 0),
  matches_played INTEGER NOT NULL DEFAULT 0 CHECK (matches_played >= 0),
  win_streak INTEGER NOT NULL DEFAULT 0 CHECK (win_streak >= 0),
  best_win_streak INTEGER NOT NULL DEFAULT 0 CHECK (best_win_streak >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, game_id)
);

INSERT INTO user_game_stats (
  user_id,game_id,rating,points,experience,level,wins,losses,kills,deaths,
  matches_played,win_streak,best_win_streak
)
SELECT id,'hl1',GREATEST(0,COALESCE(experience,0)),GREATEST(0,COALESCE(points,0)),
       GREATEST(0,COALESCE(experience,0)),GREATEST(1,COALESCE(level,1)),
       GREATEST(0,COALESCE(wins,0)),GREATEST(0,COALESCE(losses,0)),
       GREATEST(0,COALESCE(total_kills,0)),GREATEST(0,COALESCE(total_deaths,0)),
       GREATEST(0,COALESCE(wins,0)+COALESCE(losses,0)),
       GREATEST(0,COALESCE(win_streak,0)),GREATEST(0,COALESCE(best_win_streak,0))
FROM users
ON CONFLICT (user_id,game_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS game_map_pools (
  game_id TEXT NOT NULL CHECK (game_id IN ('hl1','cs16','l4d2','cod4')),
  game_mode TEXT NOT NULL,
  maps TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (game_id,game_mode)
);

INSERT INTO game_map_pools(game_id,game_mode,maps) VALUES
('hl1','classic-deathmatch',ARRAY['dm_crossfire','dm_bounce','dm_undertow','dm_gasworks','dm_boot_camp','dm_datacore','dm_lockdown','dm_rapidcore','dm_stalkyard','dm_lambda_bunker','dm_frenzy','dm_killbox','dm_subtransit','dm_powerhouse','dm_rust','dm_snark_pit','dm_stretch','dm_desert','dm_industrial','dm_fortress']),
('hl1','instagib-mode',ARRAY['dm_crossfire','dm_bounce','dm_lockdown','dm_rapidcore','dm_stalkyard','dm_killbox'])
ON CONFLICT (game_id,game_mode) DO NOTHING;

CREATE TABLE IF NOT EXISTS game_matchmaking_config (
  game_id TEXT PRIMARY KEY CHECK (game_id IN ('hl1','cs16','l4d2','cod4')),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  modes TEXT[] NOT NULL DEFAULT '{}',
  default_mode TEXT,
  required_map_count INTEGER NOT NULL DEFAULT 5 CHECK (required_map_count > 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO game_matchmaking_config(game_id,enabled,modes,default_mode) VALUES
('hl1',TRUE,ARRAY['classic-deathmatch','instagib-mode'],'classic-deathmatch'),
('cs16',FALSE,ARRAY[]::TEXT[],NULL),
('l4d2',FALSE,ARRAY[]::TEXT[],NULL),
('cod4',FALSE,ARRAY[]::TEXT[],NULL)
ON CONFLICT (game_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_user_game_stats_ranking
  ON user_game_stats(game_id,rating DESC,experience DESC,user_id);
CREATE INDEX IF NOT EXISTS idx_matches_game_status_created
  ON matches(game_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tournaments_game_status_start
  ON tournaments(game_id,status,start_date);
CREATE INDEX IF NOT EXISTS idx_game_servers_assignment
  ON game_servers(game_id,status,region)
  WHERE current_match_id IS NULL;

CREATE OR REPLACE FUNCTION enforce_match_server_game()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.server_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM game_servers s WHERE s.id=NEW.server_id AND s.game_id=NEW.game_id
  ) THEN
    RAISE EXCEPTION 'Match and server game IDs must match' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_matches_server_game ON matches;
CREATE TRIGGER trg_matches_server_game
BEFORE INSERT OR UPDATE OF server_id,game_id ON matches
FOR EACH ROW EXECUTE FUNCTION enforce_match_server_game();

CREATE OR REPLACE VIEW active_matches AS
SELECT
  m.id,m.match_type,m.status,
  p1.username AS player1_username,
  COALESCE(CASE WHEN p1.avatar_source='custom' THEN NULLIF(p1.custom_avatar_url,'') END,p1.steam_avatar) AS player1_avatar,
  p1.level AS player1_level,
  p2.username AS player2_username,
  COALESCE(CASE WHEN p2.avatar_source='custom' THEN NULLIF(p2.custom_avatar_url,'') END,p2.steam_avatar) AS player2_avatar,
  p2.level AS player2_level,
  m.selected_map,m.score_p1,m.score_p2,m.created_at,m.started_at,m.game_id
FROM matches m
JOIN users p1 ON p1.id=m.player1_id
JOIN users p2 ON p2.id=m.player2_id
WHERE m.status IN ('pending','in_progress');

COMMIT;
