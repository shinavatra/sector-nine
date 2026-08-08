CREATE TABLE IF NOT EXISTS steam_auth_nonces (
  nonce_hash TEXT PRIMARY KEY,
  origin TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_steam_auth_nonces_expiry ON steam_auth_nonces(expires_at);
