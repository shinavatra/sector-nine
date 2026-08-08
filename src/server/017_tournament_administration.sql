ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS maps TEXT[] NOT NULL DEFAULT '{}'::TEXT[];

UPDATE tournaments t
SET current_participants = (
  SELECT COUNT(*)::INTEGER
  FROM tournament_participants tp
  WHERE tp.tournament_id = t.id
);
