ALTER TABLE friendships DROP CONSTRAINT IF EXISTS friendships_status_check;
ALTER TABLE friendships ADD CONSTRAINT friendships_status_check CHECK(status IN('pending','accepted','declined','blocked'));
ALTER TABLE friendships ADD CONSTRAINT friendships_not_self CHECK(user_id<>friend_id) NOT VALID;

DELETE FROM friendships WHERE user_id=friend_id;

WITH ranked AS (
  SELECT id,ROW_NUMBER() OVER(PARTITION BY LEAST(user_id,friend_id),GREATEST(user_id,friend_id) ORDER BY CASE status WHEN 'accepted' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END,created_at) AS rn
  FROM friendships
)
DELETE FROM friendships WHERE id IN(SELECT id FROM ranked WHERE rn>1);

CREATE UNIQUE INDEX IF NOT EXISTS friendships_unique_pair
  ON friendships(LEAST(user_id,friend_id),GREATEST(user_id,friend_id));
ALTER TABLE friendships VALIDATE CONSTRAINT friendships_not_self;
