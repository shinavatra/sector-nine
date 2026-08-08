BEGIN;

CREATE TABLE IF NOT EXISTS profile_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_comments_profile_created
  ON profile_comments(profile_user_id,created_at DESC,id DESC)
  WHERE is_deleted=FALSE;

DROP TRIGGER IF EXISTS trg_profile_comments_updated_at ON profile_comments;
CREATE TRIGGER trg_profile_comments_updated_at
  BEFORE UPDATE ON profile_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS community_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 1 AND 2000),
  event_type TEXT NOT NULL DEFAULT 'community' CHECK (event_type IN ('community','tournament','double_xp','maintenance')),
  game_id TEXT CHECK (game_id IS NULL OR game_id IN ('hl1','cs16','l4d2','cod4')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at>starts_at)
);

CREATE INDEX IF NOT EXISTS idx_community_events_public
  ON community_events(starts_at,ends_at)
  WHERE is_published=TRUE;

DROP TRIGGER IF EXISTS trg_community_events_updated_at ON community_events;
CREATE TRIGGER trg_community_events_updated_at
  BEFORE UPDATE ON community_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO community_events(id,title,description,event_type,game_id,starts_at,ends_at,is_published)
VALUES
  ('10000000-0000-4000-8000-000000000001','Sector Nine Summer Operations','Complete ranked matches across supported games and climb the active Summer ladder.','community',NULL,'2026-07-22 00:00:00+00','2026-09-30 23:59:59+00',TRUE),
  ('10000000-0000-4000-8000-000000000002','Black Mesa Championship Weekend','Half-Life competitors enter the Black Mesa Championship elimination bracket.','tournament','hl1','2026-08-15 18:00:00+00','2026-08-16 22:00:00+00',TRUE)
ON CONFLICT(id) DO UPDATE SET
  title=EXCLUDED.title,description=EXCLUDED.description,event_type=EXCLUDED.event_type,
  game_id=EXCLUDED.game_id,starts_at=EXCLUDED.starts_at,ends_at=EXCLUDED.ends_at,
  is_published=EXCLUDED.is_published,updated_at=NOW();

INSERT INTO news_articles(id,title,summary,content,category,is_pinned,is_published,comments_enabled,published_at)
VALUES(
  '20000000-0000-4000-8000-000000000001',
  'Sector Nine Summer Operations Are Live',
  'Ranked ladders, multi-game queues, and the 2026 tournament schedule are now active.',
  'Sector Nine Summer Operations are now active. Verify your supported Steam games, select a competitive protocol, and join ranked matchmaking. Tournament registration and the Summer ladder are available from the platform navigation.',
  'platform',TRUE,TRUE,TRUE,'2026-07-22 00:00:00+00'
)
ON CONFLICT(id) DO UPDATE SET
  title=EXCLUDED.title,summary=EXCLUDED.summary,content=EXCLUDED.content,category=EXCLUDED.category,
  is_pinned=EXCLUDED.is_pinned,is_published=EXCLUDED.is_published,
  comments_enabled=EXCLUDED.comments_enabled,published_at=EXCLUDED.published_at,updated_at=NOW();

COMMIT;
