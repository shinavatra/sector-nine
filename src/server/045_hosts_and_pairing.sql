BEGIN;

CREATE TABLE IF NOT EXISTS hosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (BTRIM(name)<>''),
  region TEXT NOT NULL CHECK (region IN ('eu','us-east','us-central')),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online','offline')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  agent_version TEXT,
  last_seen_at TIMESTAMPTZ,
  credential_hash TEXT,
  credential_revoked_at TIMESTAMPTZ,
  pairing_code_hash TEXT,
  pairing_expires_at TIMESTAMPTZ,
  pairing_used_at TIMESTAMPTZ,
  capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  profiles JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE game_servers
  ADD COLUMN IF NOT EXISTS host_id UUID REFERENCES hosts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS host_profile_id TEXT;

CREATE INDEX IF NOT EXISTS idx_hosts_region_enabled ON hosts(region,enabled,status);
CREATE UNIQUE INDEX IF NOT EXISTS hosts_credential_hash_unique ON hosts(credential_hash) WHERE credential_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_game_servers_host_profile ON game_servers(host_id,host_profile_id);
CREATE UNIQUE INDEX IF NOT EXISTS game_servers_host_profile_unique
  ON game_servers(host_id,host_profile_id) WHERE host_id IS NOT NULL AND host_profile_id IS NOT NULL;

COMMIT;
