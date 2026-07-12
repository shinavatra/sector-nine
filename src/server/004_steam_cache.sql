-- =====================================================
-- MIGRATION: 004_steam_cache.sql
-- Run this ONCE after migrations 001, 002 and 003
-- =====================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS owns_hl1 BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS vac_banned BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS game_banned BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_steam_check TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_last_steam_check
  ON users(last_steam_check);

CREATE INDEX IF NOT EXISTS idx_users_steam_eligibility
  ON users(steam_verified, owns_hl1, vac_banned, game_banned);
