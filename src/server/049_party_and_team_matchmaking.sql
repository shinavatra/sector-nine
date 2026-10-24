BEGIN;

CREATE TABLE IF NOT EXISTS matchmaking_mode_rules (
  rule_id TEXT PRIMARY KEY,
  game_id TEXT NOT NULL,
  game_mode TEXT NOT NULL,
  team_size INTEGER,
  total_players INTEGER,
  max_party_size INTEGER,
  minimum_ready_players INTEGER,
  team_count INTEGER,
  allow_mixed_parties BOOLEAN NOT NULL DEFAULT FALSE,
  matchmaking_available BOOLEAN NOT NULL DEFAULT FALSE,
  server_pipeline_ready BOOLEAN NOT NULL DEFAULT FALSE,
  display_name TEXT NOT NULL,
  availability_reason TEXT,
  UNIQUE (game_id, game_mode, team_size, total_players),
  CHECK (team_size IS NULL OR team_size > 0),
  CHECK (total_players IS NULL OR total_players > 0),
  CHECK (max_party_size IS NULL OR max_party_size > 0),
  CHECK (minimum_ready_players IS NULL OR minimum_ready_players > 0),
  CHECK (team_count IS NULL OR team_count > 0)
);

INSERT INTO matchmaking_mode_rules
  (rule_id,game_id,game_mode,team_size,total_players,max_party_size,minimum_ready_players,team_count,allow_mixed_parties,matchmaking_available,server_pipeline_ready,display_name,availability_reason)
VALUES
  ('hl1-ag-1v1','hl1','classic-deathmatch',1,2,1,1,2,FALSE,TRUE,TRUE,'Adrenaline Gamer 6.6 — 1v1',NULL),
  ('hl1-ag-2v2','hl1','classic-deathmatch',2,4,2,1,2,TRUE,TRUE,TRUE,'Adrenaline Gamer 6.6 — 2v2',NULL),
  ('cs16-clan-war','cs16','competitive-1v1',5,10,5,1,2,TRUE,FALSE,FALSE,'Clan War — 5v5','CS 1.6 server pipeline is not ready.'),
  ('cod4-promod-tdm','cod4','promod-1v1',NULL,NULL,NULL,NULL,2,FALSE,FALSE,FALSE,'Promod TDM','Player and party capacity require confirmed server configuration.'),
  ('l4d2-coop','l4d2','survival-duel',4,4,4,1,1,TRUE,FALSE,FALSE,'Co-op — 4 players','L4D2 backend and server integration are not ready.'),
  ('l4d2-versus','l4d2','survival-duel',4,8,4,1,2,TRUE,FALSE,FALSE,'Versus — 4v4','L4D2 backend and server integration are not ready.')
ON CONFLICT (rule_id) DO UPDATE SET
  total_players=EXCLUDED.total_players,max_party_size=EXCLUDED.max_party_size,
  minimum_ready_players=EXCLUDED.minimum_ready_players,team_count=EXCLUDED.team_count,
  allow_mixed_parties=EXCLUDED.allow_mixed_parties,matchmaking_available=EXCLUDED.matchmaking_available,
  server_pipeline_ready=EXCLUDED.server_pipeline_ready,display_name=EXCLUDED.display_name,
  availability_reason=EXCLUDED.availability_reason;

CREATE TABLE IF NOT EXISTS parties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leader_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  selected_game_id TEXT,
  selected_game_mode TEXT,
  selected_team_size INTEGER,
  selected_region TEXT,
  queue_status TEXT NOT NULL DEFAULT 'idle' CHECK (queue_status IN ('idle','searching','matched')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS party_members (
  party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ready BOOLEAN NOT NULL DEFAULT FALSE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (party_id,user_id),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS party_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id UUID NOT NULL REFERENCES parties(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','cancelled','expired')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW()+INTERVAL '15 minutes',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  CHECK (inviter_id<>invitee_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS party_invites_one_pending
  ON party_invites(party_id,invitee_id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS party_invites_invitee_pending
  ON party_invites(invitee_id,created_at DESC) WHERE status='pending';

ALTER TABLE queue_entries ADD COLUMN IF NOT EXISTS party_id UUID REFERENCES parties(id) ON DELETE CASCADE;
ALTER TABLE queue_entries ADD COLUMN IF NOT EXISTS team_size INTEGER NOT NULL DEFAULT 1;
ALTER TABLE queue_entries ADD COLUMN IF NOT EXISTS total_players INTEGER NOT NULL DEFAULT 2;
CREATE UNIQUE INDEX IF NOT EXISTS queue_entries_one_party
  ON queue_entries(party_id) WHERE party_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS match_participants (
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  team_number INTEGER NOT NULL CHECK (team_number > 0),
  party_id UUID REFERENCES parties(id) ON DELETE SET NULL,
  PRIMARY KEY(match_id,user_id)
);

ALTER TABLE matches ADD COLUMN IF NOT EXISTS team_size INTEGER NOT NULL DEFAULT 1;
ALTER TABLE matches ADD COLUMN IF NOT EXISTS total_players INTEGER NOT NULL DEFAULT 2;

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK(type IN('friend_request','match_found','tournament_starting','system','report','ban','message','party_invite','party_update'));

COMMIT;
