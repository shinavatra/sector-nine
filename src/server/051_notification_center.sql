BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{}'::jsonb;
UPDATE users SET notification_preferences=notification_preferences||jsonb_build_object(
  'partyInvites',COALESCE((notification_preferences->>'partyInvites')::boolean,true),
  'vipUpdates',COALESCE((notification_preferences->>'vipUpdates')::boolean,true),
  'shopPurchases',COALESCE((notification_preferences->>'shopPurchases')::boolean,true),
  'walletTransactions',COALESCE((notification_preferences->>'walletTransactions')::boolean,true)
);

ALTER TABLE notifications ADD COLUMN IF NOT EXISTS event_key TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_path TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS notifications_user_event_unique
  ON notifications(user_id,event_key) WHERE event_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS notifications_user_created_page
  ON notifications(user_id,created_at DESC,id DESC);

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK(type IN(
  'friend_request','friend_accepted','party_invite','party_update','match_found',
  'tournament_starting','vip','shop','wallet','system','report','ban','message'
));

COMMIT;
