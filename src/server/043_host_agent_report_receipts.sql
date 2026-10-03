BEGIN;

CREATE TABLE IF NOT EXISTS game_server_agent_reports (
  server_id UUID NOT NULL REFERENCES game_servers(id) ON DELETE CASCADE,
  report_id UUID NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('match_completed')),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  payload_hash TEXT NOT NULL CHECK (payload_hash ~ '^[0-9a-f]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (server_id, report_id)
);

CREATE INDEX IF NOT EXISTS idx_game_server_agent_reports_match
  ON game_server_agent_reports(match_id,created_at DESC);

COMMIT;
