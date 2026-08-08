BEGIN;

-- These games require team-aware queue, roster, scoring, and server lifecycle
-- support. Keep their isolated data visible, but do not create placeholder
-- one-versus-one matches.
UPDATE game_matchmaking_config
SET enabled = FALSE,
    updated_at = NOW()
WHERE game_id IN ('cs16', 'l4d2', 'cod4');

COMMIT;
