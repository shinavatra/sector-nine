-- =====================================================
-- MIGRATION: 006_notification_preferences.sql
-- Run once after 005_profile_customization.sql
-- =====================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{
    "matchFound": true,
    "friendRequests": true,
    "tournaments": true,
    "messages": true,
    "social": true
  }'::jsonb;
