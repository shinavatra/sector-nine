-- Keep at most one unread message notification per direct conversation.
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS related_conversation_id TEXT;

UPDATE notifications n
SET related_conversation_id = cm.room
FROM chat_messages cm
WHERE n.related_chat_message_id = cm.id
  AND n.type = 'message'
  AND n.related_conversation_id IS NULL;

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, related_conversation_id
           ORDER BY created_at DESC, id DESC
         ) AS position
  FROM notifications
  WHERE type = 'message'
    AND read = false
    AND related_conversation_id IS NOT NULL
)
UPDATE notifications n
SET read = true
FROM ranked
WHERE ranked.id = n.id
  AND ranked.position > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_unread_conversation_unique
  ON notifications(user_id, related_conversation_id)
  WHERE type = 'message'
    AND read = false
    AND related_conversation_id IS NOT NULL;
