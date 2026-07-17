-- Repair RCON schema drift caused by CREATE TABLE IF NOT EXISTS in migration 003.
ALTER TABLE game_servers
  ADD COLUMN IF NOT EXISTS rcon_password TEXT;

-- Preserve important match history when an account is permanently deleted.
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_player1_id_fkey;
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_player2_id_fkey;
ALTER TABLE matches
  ADD CONSTRAINT matches_player1_id_fkey
  FOREIGN KEY (player1_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE matches
  ADD CONSTRAINT matches_player2_id_fkey
  FOREIGN KEY (player2_id) REFERENCES users(id) ON DELETE SET NULL;

-- Preserve moderation history while anonymizing deleted participants.
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_reporter_id_fkey;
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_reported_id_fkey;
ALTER TABLE reports
  ADD CONSTRAINT reports_reporter_id_fkey
  FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE reports
  ADD CONSTRAINT reports_reported_id_fkey
  FOREIGN KEY (reported_id) REFERENCES users(id) ON DELETE SET NULL;
