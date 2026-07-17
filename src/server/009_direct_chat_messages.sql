ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_room_check;
ALTER TABLE chat_messages
  ADD CONSTRAINT chat_messages_room_check CHECK (
    (recipient_id IS NULL AND room IN ('global','alpha','beta','gamma','delta')) OR
    (recipient_id IS NOT NULL AND room LIKE 'dm:%')
  );

CREATE INDEX IF NOT EXISTS idx_chat_participants
  ON chat_messages(user_id, recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_recipient_created
  ON chat_messages(recipient_id, created_at DESC)
  WHERE recipient_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chat_room_created
  ON chat_messages(room, created_at DESC, id DESC);
