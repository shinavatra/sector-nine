ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_hash TEXT;

UPDATE users
SET reset_token = NULL,
    reset_token_expires = NULL
WHERE reset_token IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_reset_token_hash
  ON users(reset_token_hash)
  WHERE reset_token_hash IS NOT NULL;
