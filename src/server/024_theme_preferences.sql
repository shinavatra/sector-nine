BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS theme_mode TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS preferred_theme TEXT NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS verified_game_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_theme_mode_check') THEN
    ALTER TABLE users ADD CONSTRAINT users_theme_mode_check
      CHECK (theme_mode IN ('manual', 'follow_game'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_preferred_theme_check') THEN
    ALTER TABLE users ADD CONSTRAINT users_preferred_theme_check
      CHECK (preferred_theme IN ('default', 'hl1', 'cs16', 'l4d2', 'cod4'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_verified_game_ids_check') THEN
    ALTER TABLE users ADD CONSTRAINT users_verified_game_ids_check
      CHECK (verified_game_ids <@ ARRAY['hl1', 'cs16', 'l4d2', 'cod4']::TEXT[]);
  END IF;
END $$;

COMMENT ON COLUMN users.verified_game_ids IS
  'Backend-managed supported-game access. Clients cannot update this field.';

COMMIT;
