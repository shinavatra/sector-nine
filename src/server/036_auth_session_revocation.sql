ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_version INTEGER NOT NULL DEFAULT 0;

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_auth_version_nonnegative;
ALTER TABLE users ADD CONSTRAINT users_auth_version_nonnegative CHECK (auth_version >= 0);
