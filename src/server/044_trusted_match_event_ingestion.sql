BEGIN;

ALTER TABLE match_events
  ADD COLUMN IF NOT EXISTS source_server_id UUID REFERENCES game_servers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_event_id UUID,
  ADD COLUMN IF NOT EXISTS source_sequence INTEGER,
  ADD COLUMN IF NOT EXISTS source_payload_hash TEXT;

ALTER TABLE match_events DROP CONSTRAINT IF EXISTS match_events_source_sequence_positive;
ALTER TABLE match_events ADD CONSTRAINT match_events_source_sequence_positive
  CHECK (source_sequence IS NULL OR source_sequence BETWEEN 1 AND 1000000);

ALTER TABLE match_events DROP CONSTRAINT IF EXISTS match_events_source_payload_hash_format;
ALTER TABLE match_events ADD CONSTRAINT match_events_source_payload_hash_format
  CHECK (source_payload_hash IS NULL OR source_payload_hash ~ '^[0-9a-f]{64}$');

CREATE UNIQUE INDEX IF NOT EXISTS idx_match_events_server_event_id
  ON match_events(source_server_id,source_event_id)
  WHERE source_server_id IS NOT NULL AND source_event_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_match_events_match_server_source_sequence
  ON match_events(match_id,source_server_id,source_sequence)
  WHERE source_server_id IS NOT NULL AND source_sequence IS NOT NULL;

COMMIT;
