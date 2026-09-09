BEGIN;

ALTER TABLE users
  ALTER COLUMN email DROP NOT NULL,
  ALTER COLUMN password_hash DROP NOT NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_provider TEXT NOT NULL DEFAULT 'password';

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_auth_provider_check;

ALTER TABLE users
  ADD CONSTRAINT users_auth_provider_check
    CHECK (auth_provider IN ('password', 'steam'));

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_email_or_steam_auth_check;

ALTER TABLE users
  ADD CONSTRAINT users_email_or_steam_auth_check
    CHECK (
      (email IS NOT NULL AND password_hash IS NOT NULL)
      OR
      (steam_id IS NOT NULL AND auth_provider = 'steam')
    );

ALTER TABLE steam_auth_nonces
  ADD COLUMN IF NOT EXISTS intent TEXT NOT NULL DEFAULT 'login',
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE steam_auth_nonces
  DROP CONSTRAINT IF EXISTS steam_auth_nonces_intent_check;

ALTER TABLE steam_auth_nonces
  ADD CONSTRAINT steam_auth_nonces_intent_check
    CHECK (intent IN ('login', 'link'));

CREATE INDEX IF NOT EXISTS idx_steam_auth_nonces_user_id
  ON steam_auth_nonces(user_id)
  WHERE user_id IS NOT NULL;

COMMIT;
