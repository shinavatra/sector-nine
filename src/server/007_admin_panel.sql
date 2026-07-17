-- Sector Nine administration subsystem (idempotent)
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS vip_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE badges ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE frames ADD COLUMN IF NOT EXISTS featured BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE bans ADD COLUMN IF NOT EXISTS issued_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE bans ADD COLUMN IF NOT EXISTS ban_type TEXT NOT NULL DEFAULT 'matchmaking';
ALTER TABLE bans ALTER COLUMN duration_minutes DROP NOT NULL;
ALTER TABLE bans ALTER COLUMN expires_at DROP NOT NULL;

CREATE TABLE IF NOT EXISTS game_servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game TEXT NOT NULL DEFAULT 'Half-Life 1', region TEXT NOT NULL,
  name TEXT NOT NULL, ip TEXT NOT NULL, port INTEGER NOT NULL CHECK (port BETWEEN 1 AND 65535),
  playit_tunnel TEXT, slots INTEGER NOT NULL CHECK (slots > 0),
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online','offline','maintenance')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(ip, port)
);

-- 003 may have created the multi-game variant first. Keep that model and add
-- the administration-facing compatibility columns idempotently.
ALTER TABLE game_servers ADD COLUMN IF NOT EXISTS game TEXT;
ALTER TABLE game_servers ADD COLUMN IF NOT EXISTS ip TEXT;
ALTER TABLE game_servers ADD COLUMN IF NOT EXISTS playit_tunnel TEXT;
ALTER TABLE game_servers ADD COLUMN IF NOT EXISTS slots INTEGER;
ALTER TABLE game_servers ADD COLUMN IF NOT EXISTS game_id TEXT NOT NULL DEFAULT 'hl1';
ALTER TABLE game_servers ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE game_servers ADD COLUMN IF NOT EXISTS max_slots INTEGER NOT NULL DEFAULT 2;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='game_servers' AND column_name='game_id') THEN
    EXECUTE 'UPDATE game_servers SET game=COALESCE(game,game_id,''Half-Life 1'') WHERE game IS NULL';
  ELSE
    UPDATE game_servers SET game='Half-Life 1' WHERE game IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='game_servers' AND column_name='ip_address') THEN
    EXECUTE 'UPDATE game_servers SET ip=COALESCE(ip,ip_address) WHERE ip IS NULL';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='game_servers' AND column_name='max_slots') THEN
    EXECUTE 'UPDATE game_servers SET slots=COALESCE(slots,max_slots,2) WHERE slots IS NULL';
  ELSE
    UPDATE game_servers SET slots=2 WHERE slots IS NULL;
  END IF;
END $$;

UPDATE game_servers SET ip_address=ip WHERE ip_address IS NULL;
UPDATE game_servers SET max_slots=slots WHERE max_slots IS NULL;

ALTER TABLE game_servers ALTER COLUMN game SET DEFAULT 'Half-Life 1';
ALTER TABLE game_servers ALTER COLUMN game SET NOT NULL;
ALTER TABLE game_servers ALTER COLUMN ip SET NOT NULL;
ALTER TABLE game_servers ALTER COLUMN ip_address SET NOT NULL;
ALTER TABLE game_servers ALTER COLUMN slots SET NOT NULL;
ALTER TABLE game_servers DROP CONSTRAINT IF EXISTS game_servers_status_check;
ALTER TABLE game_servers ADD CONSTRAINT game_servers_status_check CHECK (status IN ('online','offline','maintenance','in_use'));

CREATE TABLE IF NOT EXISTS user_mutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL, issued_by UUID REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ, is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), lifted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS login_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('password','steam')), success BOOLEAN NOT NULL,
  ip INET, user_agent TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb, ip INET, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY, value JSONB NOT NULL, description TEXT,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role) WHERE role='admin';
CREATE INDEX IF NOT EXISTS idx_users_admin_search ON users(lower(username), lower(email));
CREATE INDEX IF NOT EXISTS idx_servers_status ON game_servers(status);
CREATE INDEX IF NOT EXISTS idx_mutes_active ON user_mutes(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_admin ON admin_audit_logs(admin_id, created_at DESC);

INSERT INTO platform_settings (key, value, description) VALUES
  ('maintenance_mode', 'false'::jsonb, 'Disable public platform actions'),
  ('registration_enabled', 'true'::jsonb, 'Allow new account registration')
ON CONFLICT (key) DO NOTHING;
