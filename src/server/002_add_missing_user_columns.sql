-- =====================================================
-- MIGRATION: 002_add_missing_user_columns.sql
-- Run this ONCE after 001_initial_schema.sql
-- =====================================================

-- bio — user-written description shown on profile
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';

-- profile_visibility — public / friends / private
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_visibility TEXT DEFAULT 'public'
  CHECK (profile_visibility IN ('public', 'friends', 'private'));

-- show_online_status — whether others can see you online
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_online_status BOOLEAN DEFAULT true;

-- steam_verified — true once the server has confirmed HL1 ownership via Steam API
ALTER TABLE users ADD COLUMN IF NOT EXISTS steam_verified BOOLEAN DEFAULT false;
