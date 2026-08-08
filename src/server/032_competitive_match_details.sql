BEGIN;

ALTER TABLE user_game_stats
  ADD COLUMN IF NOT EXISTS placement_matches_played INTEGER NOT NULL DEFAULT 0 CHECK (placement_matches_played BETWEEN 0 AND 5),
  ADD COLUMN IF NOT EXISTS placement_complete BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE user_game_stats SET
  placement_matches_played=LEAST(5,matches_played),
  placement_complete=matches_played>=5;

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS demo_url TEXT,
  ADD COLUMN IF NOT EXISTS demo_uploaded_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS match_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL CHECK (sequence>0),
  event_type TEXT NOT NULL CHECK (event_type IN ('match_started','kill','score','map_selected','match_completed','system')),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(match_id,sequence)
);

CREATE INDEX IF NOT EXISTS idx_match_events_match_sequence ON match_events(match_id,sequence);

INSERT INTO match_events(match_id,sequence,event_type,occurred_at,details)
SELECT m.id,1,'match_started',COALESCE(m.started_at,m.created_at),jsonb_build_object('map',m.selected_map,'gameMode',m.game_mode)
FROM matches m WHERE m.status='completed'
ON CONFLICT(match_id,sequence) DO NOTHING;

INSERT INTO match_events(match_id,sequence,event_type,actor_user_id,occurred_at,details)
SELECT m.id,2,'match_completed',m.winner_id,COALESCE(m.completed_at,m.created_at),
       jsonb_build_object('scoreP1',m.score_p1,'scoreP2',m.score_p2,'winnerId',m.winner_id)
FROM matches m WHERE m.status='completed'
ON CONFLICT(match_id,sequence) DO NOTHING;

COMMIT;
