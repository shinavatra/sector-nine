BEGIN;

ALTER TABLE game_servers
  ADD COLUMN IF NOT EXISTS public_host TEXT,
  ADD COLUMN IF NOT EXISTS public_port INTEGER,
  ADD COLUMN IF NOT EXISTS rcon_host TEXT,
  ADD COLUMN IF NOT EXISTS rcon_port INTEGER;

UPDATE game_servers
SET public_host=COALESCE(NULLIF(BTRIM(public_host),''),NULLIF(BTRIM(ip_address),''),NULLIF(BTRIM(ip),'')),
    public_port=COALESCE(public_port,port),
    rcon_host=COALESCE(NULLIF(BTRIM(rcon_host),''),NULLIF(BTRIM(ip_address),''),NULLIF(BTRIM(ip),'')),
    rcon_port=COALESCE(rcon_port,port)
WHERE public_host IS NULL OR public_port IS NULL OR rcon_host IS NULL OR rcon_port IS NULL;

ALTER TABLE game_servers
  ALTER COLUMN public_host SET NOT NULL,
  ALTER COLUMN public_port SET NOT NULL,
  ALTER COLUMN rcon_host SET NOT NULL,
  ALTER COLUMN rcon_port SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='game_servers_public_host_nonempty') THEN
    ALTER TABLE game_servers ADD CONSTRAINT game_servers_public_host_nonempty CHECK (BTRIM(public_host)<>'');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='game_servers_public_port_valid') THEN
    ALTER TABLE game_servers ADD CONSTRAINT game_servers_public_port_valid CHECK (public_port BETWEEN 1 AND 65535);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='game_servers_rcon_host_nonempty') THEN
    ALTER TABLE game_servers ADD CONSTRAINT game_servers_rcon_host_nonempty CHECK (BTRIM(rcon_host)<>'');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='game_servers_rcon_port_valid') THEN
    ALTER TABLE game_servers ADD CONSTRAINT game_servers_rcon_port_valid CHECK (rcon_port BETWEEN 1 AND 65535);
  END IF;
END $$;

COMMENT ON COLUMN game_servers.ip_address IS 'Deprecated compatibility field; use public_host or rcon_host explicitly.';
COMMENT ON COLUMN game_servers.port IS 'Deprecated compatibility field; use public_port or rcon_port explicitly.';

COMMIT;
