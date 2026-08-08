-- Persists the two-letter country code returned by Steam so leaderboard
-- country filtering remains PostgreSQL-backed and does not call Steam live.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS country_code TEXT;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_country_code_check;
ALTER TABLE users
  ADD CONSTRAINT users_country_code_check
  CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$');

CREATE INDEX IF NOT EXISTS idx_users_country_code
  ON users(country_code)
  WHERE deleted_at IS NULL AND country_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ladder_entries_ranking
  ON ladder_entries(season_id, points DESC, wins DESC, user_id);
