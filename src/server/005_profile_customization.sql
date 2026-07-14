-- =====================================================
-- MIGRATION: 005_profile_customization.sql
-- Run once after 004_steam_cache.sql
-- =====================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS custom_avatar_url TEXT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS avatar_source TEXT NOT NULL DEFAULT 'steam';

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_avatar_source_check;
ALTER TABLE users
  ADD CONSTRAINT users_avatar_source_check CHECK (avatar_source IN ('steam', 'custom'));

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS social_links JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE VIEW leaderboard AS
SELECT
  u.id,
  u.username,
  u.display_name,
  COALESCE(CASE WHEN u.avatar_source = 'custom' THEN NULLIF(u.custom_avatar_url, '') END, u.steam_avatar) AS steam_avatar,
  u.is_premium,
  u.level,
  u.experience,
  u.wins,
  u.losses,
  u.win_streak,
  u.best_win_streak,
  CASE WHEN (u.wins + u.losses) > 0
    THEN ROUND((u.wins::DECIMAL / (u.wins + u.losses)) * 100, 2)
    ELSE 0
  END AS win_rate,
  ROW_NUMBER() OVER (ORDER BY u.experience DESC) AS rank
FROM users u
ORDER BY u.experience DESC;

CREATE OR REPLACE VIEW active_matches AS
SELECT
  m.id, m.match_type, m.status,
  p1.username AS player1_username,
  COALESCE(CASE WHEN p1.avatar_source = 'custom' THEN NULLIF(p1.custom_avatar_url, '') END, p1.steam_avatar) AS player1_avatar,
  p1.level AS player1_level,
  p2.username AS player2_username,
  COALESCE(CASE WHEN p2.avatar_source = 'custom' THEN NULLIF(p2.custom_avatar_url, '') END, p2.steam_avatar) AS player2_avatar,
  p2.level AS player2_level,
  m.selected_map, m.score_p1, m.score_p2, m.created_at, m.started_at
FROM matches m
JOIN users p1 ON m.player1_id = p1.id
JOIN users p2 ON m.player2_id = p2.id
WHERE m.status IN ('pending','in_progress')
ORDER BY m.created_at DESC;

CREATE OR REPLACE VIEW tournament_standings AS
SELECT
  tp.tournament_id, t.name AS tournament_name, u.id AS user_id, u.username,
  COALESCE(CASE WHEN u.avatar_source = 'custom' THEN NULLIF(u.custom_avatar_url, '') END, u.steam_avatar) AS steam_avatar,
  u.is_premium, tp.wins, tp.losses, tp.placement, tp.is_eliminated
FROM tournament_participants tp
JOIN users u ON tp.user_id = u.id
JOIN tournaments t ON tp.tournament_id = t.id
ORDER BY tp.tournament_id, tp.placement NULLS LAST, tp.wins DESC;
