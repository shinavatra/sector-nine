-- Run after 006_notification_preferences.sql to complete the preference contract
-- for existing and future users. This remains safe if 006 was not applied.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE users
SET notification_preferences = jsonb_build_object(
  'matchFound', COALESCE((notification_preferences->>'matchFound')::boolean, true),
  'friendRequests', COALESCE((notification_preferences->>'friendRequests')::boolean, true),
  'tournaments', COALESCE((notification_preferences->>'tournaments')::boolean, true),
  'messages', COALESCE((notification_preferences->>'messages')::boolean, true),
  'social', COALESCE((notification_preferences->>'social')::boolean, true),
  'systemMaintenance', COALESCE((notification_preferences->>'systemMaintenance')::boolean, true),
  'securityAlerts', COALESCE((notification_preferences->>'securityAlerts')::boolean, true)
);

ALTER TABLE users
  ALTER COLUMN notification_preferences SET DEFAULT '{
    "matchFound": true,
    "friendRequests": true,
    "tournaments": true,
    "messages": true,
    "social": true,
    "systemMaintenance": true,
    "securityAlerts": true
  }'::jsonb;
