-- Cache the Steam Web API fields used by the account integration UI.
-- PostgreSQL remains the source of truth between explicit Steam refreshes.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS steam_persona_name TEXT,
  ADD COLUMN IF NOT EXISTS steam_level INTEGER,
  ADD COLUMN IF NOT EXISTS steam_visibility INTEGER,
  ADD COLUMN IF NOT EXISTS steam_games_visible BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS steam_vac_ban_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS steam_game_ban_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS steam_owned_games JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_steam_level_nonnegative,
  ADD CONSTRAINT users_steam_level_nonnegative
    CHECK (steam_level IS NULL OR steam_level >= 0);

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_steam_ban_counts_nonnegative,
  ADD CONSTRAINT users_steam_ban_counts_nonnegative
    CHECK (steam_vac_ban_count >= 0 AND steam_game_ban_count >= 0);
