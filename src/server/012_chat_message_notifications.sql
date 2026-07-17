ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS related_chat_message_id UUID
  REFERENCES chat_messages(id) ON DELETE CASCADE;

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check CHECK (
    type IN (
      'friend_request',
      'match_found',
      'tournament_starting',
      'system',
      'report',
      'ban',
      'message'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_chat_message_unique
  ON notifications(related_chat_message_id)
  WHERE related_chat_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_unread_messages
  ON notifications(user_id, created_at DESC)
  WHERE type = 'message' AND read = false;
