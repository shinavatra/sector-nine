-- Sector Nine final schema repair. Safe to run repeatedly; preserves production rows.
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_visibility TEXT DEFAULT 'public';
ALTER TABLE users ADD COLUMN IF NOT EXISTS show_online_status BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS steam_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS owns_hl1 BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS vac_banned BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS game_banned BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_steam_check TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_source TEXT NOT NULL DEFAULT 'steam';
ALTER TABLE users ADD COLUMN IF NOT EXISTS social_links JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS vip_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_last_steam_check ON users(last_steam_check);
CREATE INDEX IF NOT EXISTS idx_users_steam_eligibility ON users(steam_verified,owns_hl1,vac_banned,game_banned);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role) WHERE role='admin';

ALTER TABLE game_servers ADD COLUMN IF NOT EXISTS current_match_id UUID;
ALTER TABLE game_servers ADD COLUMN IF NOT EXISTS rcon_password TEXT;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS server_id UUID;
CREATE INDEX IF NOT EXISTS idx_game_servers_current_match ON game_servers(current_match_id);
CREATE INDEX IF NOT EXISTS idx_matches_server ON matches(server_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='game_servers_current_match_id_fkey' AND conrelid='game_servers'::regclass) THEN
    ALTER TABLE game_servers ADD CONSTRAINT game_servers_current_match_id_fkey FOREIGN KEY(current_match_id) REFERENCES matches(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='matches_server_id_fkey' AND conrelid='matches'::regclass) THEN
    ALTER TABLE matches ADD CONSTRAINT matches_server_id_fkey FOREIGN KEY(server_id) REFERENCES game_servers(id) ON DELETE SET NULL;
  END IF;
END $$;

INSERT INTO frames(id,name,description,style,rarity,price_points,vip_only)
VALUES('fr_basic','Basic Frame','Default Sector Nine frame','border-2 border-orange-500','COMMON',0,false)
ON CONFLICT(id) DO NOTHING;

UPDATE users SET equipped_frame='fr_basic' WHERE equipped_frame='fr_standard';
UPDATE users SET owned_frames=ARRAY(SELECT DISTINCT CASE WHEN value='fr_standard' THEN 'fr_basic' ELSE value END FROM unnest(COALESCE(owned_frames,'{}'::text[])) value) WHERE 'fr_standard'=ANY(COALESCE(owned_frames,'{}'::text[]));
ALTER TABLE users ALTER COLUMN equipped_frame SET DEFAULT 'fr_basic';
ALTER TABLE users ALTER COLUMN owned_frames SET DEFAULT ARRAY['fr_basic']::text[];

ALTER TABLE friendships ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
DO $$ DECLARE definition TEXT; BEGIN
  SELECT pg_get_constraintdef(oid) INTO definition FROM pg_constraint WHERE conname='friendships_status_check' AND conrelid='friendships'::regclass;
  IF definition IS NULL OR definition NOT LIKE '%declined%' THEN
    ALTER TABLE friendships DROP CONSTRAINT IF EXISTS friendships_status_check;
    ALTER TABLE friendships ADD CONSTRAINT friendships_status_check CHECK(status IN('pending','accepted','declined','blocked'));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='friendships_not_self' AND conrelid='friendships'::regclass) THEN
    ALTER TABLE friendships ADD CONSTRAINT friendships_not_self CHECK(user_id<>friend_id) NOT VALID;
  END IF;
END $$;
ALTER TABLE friendships VALIDATE CONSTRAINT friendships_not_self;
CREATE UNIQUE INDEX IF NOT EXISTS friendships_unique_pair ON friendships(LEAST(user_id,friend_id),GREATEST(user_id,friend_id));

ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS recipient_id UUID;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS related_chat_message_id UUID;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS related_friendship_id UUID;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='chat_messages_recipient_id_fkey' AND conrelid='chat_messages'::regclass) THEN
    ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_recipient_id_fkey FOREIGN KEY(recipient_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='notifications_related_chat_message_id_fkey' AND conrelid='notifications'::regclass) THEN
    ALTER TABLE notifications ADD CONSTRAINT notifications_related_chat_message_id_fkey FOREIGN KEY(related_chat_message_id) REFERENCES chat_messages(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='notifications_related_friendship_id_fkey' AND conrelid='notifications'::regclass) THEN
    ALTER TABLE notifications ADD CONSTRAINT notifications_related_friendship_id_fkey FOREIGN KEY(related_friendship_id) REFERENCES friendships(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ DECLARE definition TEXT; BEGIN
  SELECT pg_get_constraintdef(oid) INTO definition FROM pg_constraint WHERE conname='notifications_type_check' AND conrelid='notifications'::regclass;
  IF definition IS NULL OR definition NOT LIKE '%friend_request%' OR definition NOT LIKE '%message%' THEN
    ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
    ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK(type IN('friend_request','match_found','tournament_starting','system','report','ban','message'));
  END IF;
END $$;

-- Link an existing pending request's newest notification and retire only duplicate unread alerts.
WITH candidates AS (
  SELECT n.id,f.id AS friendship_id,
         ROW_NUMBER() OVER(PARTITION BY f.id ORDER BY n.created_at DESC,n.id DESC) AS position
  FROM notifications n
  JOIN friendships f ON f.friend_id=n.user_id AND f.user_id=n.related_user_id AND f.status='pending'
  WHERE n.type='friend_request' AND n.related_friendship_id IS NULL
)
UPDATE notifications n
SET related_friendship_id=CASE WHEN candidates.position=1 THEN candidates.friendship_id ELSE NULL END,
    read=CASE WHEN candidates.position=1 THEN n.read ELSE true END
FROM candidates WHERE candidates.id=n.id;

CREATE INDEX IF NOT EXISTS idx_chat_participants ON chat_messages(user_id,recipient_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_recipient_created ON chat_messages(recipient_id,created_at DESC) WHERE recipient_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_chat_message_unique ON notifications(related_chat_message_id) WHERE related_chat_message_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_friendship_unique ON notifications(related_friendship_id) WHERE related_friendship_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id,created_at DESC) WHERE read=false;

CREATE TABLE IF NOT EXISTS login_history(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,method TEXT NOT NULL,success BOOLEAN NOT NULL,ip INET,user_agent TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS admin_audit_logs(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),admin_id UUID REFERENCES users(id) ON DELETE SET NULL,action TEXT NOT NULL,target_type TEXT NOT NULL,target_id TEXT,details JSONB NOT NULL DEFAULT '{}'::jsonb,ip INET,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS platform_settings(key TEXT PRIMARY KEY,value JSONB NOT NULL,description TEXT,updated_by UUID REFERENCES users(id) ON DELETE SET NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS user_mutes(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,reason TEXT NOT NULL,issued_by UUID REFERENCES users(id) ON DELETE SET NULL,expires_at TIMESTAMPTZ,is_active BOOLEAN NOT NULL DEFAULT true,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),lifted_at TIMESTAMPTZ);
