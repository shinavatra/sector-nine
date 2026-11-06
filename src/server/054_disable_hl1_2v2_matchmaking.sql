BEGIN;

-- Preserve the 2v2 composition rules for future four-player Host Agent support,
-- but do not advertise or allocate this mode while the trusted server lifecycle
-- only supports two assigned competitors.
UPDATE matchmaking_mode_rules
SET matchmaking_available = FALSE,
    server_pipeline_ready = FALSE,
    availability_reason = 'HL1 2v2 is unavailable until four-player Host Agent orchestration is verified.'
WHERE rule_id = 'hl1-ag-2v2'
  AND game_id = 'hl1'
  AND game_mode = 'classic-deathmatch'
  AND team_size = 2
  AND total_players = 4;

COMMIT;
