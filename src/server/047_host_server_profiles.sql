CREATE TABLE IF NOT EXISTS host_server_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES hosts(id) ON DELETE CASCADE,
  profile_id TEXT NOT NULL,
  name TEXT NOT NULL,
  game_id TEXT NOT NULL,
  game_mode TEXT NOT NULL,
  local_port INTEGER NOT NULL CHECK (local_port BETWEEN 1024 AND 65535),
  telemetry_port INTEGER NOT NULL CHECK (telemetry_port BETWEEN 1 AND 65535),
  reported_state TEXT NOT NULL DEFAULT 'ready' CHECK (reported_state IN ('ready','running','offline','failed')),
  reported_match_id UUID,
  approval_status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (approval_status IN ('pending_approval','approved','rejected')),
  matchmaking_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  game_server_id UUID REFERENCES game_servers(id) ON DELETE SET NULL,
  lifecycle_status TEXT NOT NULL DEFAULT 'idle' CHECK (lifecycle_status IN ('idle','reserved','starting','match_running','match_finished','server_error','offline')),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  removed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT host_server_profiles_host_profile_unique UNIQUE(host_id,profile_id),
  CONSTRAINT host_server_profiles_host_local_port_unique UNIQUE(host_id,local_port),
  CONSTRAINT host_server_profiles_host_telemetry_port_unique UNIQUE(host_id,telemetry_port)
);

CREATE UNIQUE INDEX IF NOT EXISTS host_server_profiles_game_server_unique
  ON host_server_profiles(game_server_id) WHERE game_server_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS host_server_profiles_host_status_idx
  ON host_server_profiles(host_id,approval_status,matchmaking_enabled) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS host_server_profiles_last_seen_idx
  ON host_server_profiles(last_seen_at);

INSERT INTO host_server_profiles(host_id,profile_id,name,game_id,game_mode,local_port,telemetry_port,reported_state,reported_match_id,approval_status,matchmaking_enabled,game_server_id,lifecycle_status,last_seen_at)
SELECT h.id,p->>'id',COALESCE(NULLIF(p->>'name',''),p->>'id'),p->>'gameId',p->>'gameMode',(p->>'localPort')::integer,(p->>'telemetryPort')::integer,
       CASE WHEN p->>'state' IN ('ready','running','offline','failed') THEN p->>'state' ELSE 'ready' END,
       CASE WHEN COALESCE(p->>'currentMatchId','') ~* '^[0-9a-f-]{36}$' THEN (p->>'currentMatchId')::uuid ELSE NULL END,
       CASE WHEN s.id IS NULL THEN 'pending_approval' ELSE 'approved' END,
       s.id IS NOT NULL,s.id,
       CASE WHEN p->>'state'='failed' THEN 'server_error' WHEN p->>'state'='offline' THEN 'offline' WHEN p->>'state'='running' THEN 'starting' ELSE 'idle' END,
       COALESCE(h.last_seen_at,NOW())
FROM hosts h
CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(h.profiles)='array' THEN h.profiles ELSE '[]'::jsonb END) p
LEFT JOIN game_servers s ON s.host_id=h.id AND s.host_profile_id=p->>'id'
WHERE COALESCE(p->>'id','') ~ '^[a-zA-Z0-9_-]{1,64}$'
  AND COALESCE(p->>'gameId','')<>'' AND COALESCE(p->>'gameMode','')<>''
  AND COALESCE(p->>'localPort','') ~ '^[0-9]+$' AND (p->>'localPort')::integer BETWEEN 1024 AND 65535
  AND COALESCE(p->>'telemetryPort','') ~ '^[0-9]+$' AND (p->>'telemetryPort')::integer BETWEEN 1 AND 65535
ON CONFLICT(host_id,profile_id) DO NOTHING;
