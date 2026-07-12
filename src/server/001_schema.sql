-- =====================================================
-- SECTOR NINE INITIATIVE - DATABASE SCHEMA
-- Pure PostgreSQL - No Supabase dependencies
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- USERS (replaces auth.users + profiles combined)
-- =====================================================

CREATE TABLE IF NOT EXISTS users (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email           TEXT        NOT NULL UNIQUE,
  username        TEXT        NOT NULL UNIQUE,
  password_hash   TEXT        NOT NULL,
  display_name    TEXT,

  -- Steam
  steam_id        TEXT        UNIQUE,
  steam_avatar    TEXT,
  steam_profile_url TEXT,

  -- VIP
  is_premium      BOOLEAN     DEFAULT false,
  vip_since       TIMESTAMPTZ,
  vip_method      TEXT        CHECK (vip_method IN ('points', 'payment')),

  -- Progression
  points          INTEGER     DEFAULT 1000,
  experience      INTEGER     DEFAULT 0,
  level           INTEGER     DEFAULT 0,

  -- Cosmetics (equipped)
  equipped_badge  TEXT        DEFAULT 'av_lambda',
  equipped_frame  TEXT        DEFAULT 'fr_standard',

  -- Cosmetics (owned arrays)
  owned_badges    TEXT[]      DEFAULT ARRAY['av_lambda']::TEXT[],
  owned_frames    TEXT[]      DEFAULT ARRAY['fr_standard']::TEXT[],

  -- Stats
  wins            INTEGER     DEFAULT 0,
  losses          INTEGER     DEFAULT 0,
  win_streak      INTEGER     DEFAULT 0,
  best_win_streak INTEGER     DEFAULT 0,
  total_kills     INTEGER     DEFAULT 0,
  total_deaths    INTEGER     DEFAULT 0,

  -- Auth
  reset_token         TEXT,
  reset_token_expires TIMESTAMPTZ,

  -- Timestamps
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  last_seen       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email    ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_steam_id ON users(steam_id);
CREATE INDEX IF NOT EXISTS idx_users_xp       ON users(experience DESC);

-- =====================================================
-- SESSIONS (JWT refresh tracking)
-- =====================================================

CREATE TABLE IF NOT EXISTS sessions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT        NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user   ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token  ON sessions(token_hash);

-- =====================================================
-- BADGES & FRAMES CATALOG
-- =====================================================

CREATE TABLE IF NOT EXISTS badges (
  id            TEXT    PRIMARY KEY,
  name          TEXT    NOT NULL,
  description   TEXT,
  icon          TEXT,
  rarity        TEXT    CHECK (rarity IN ('COMMON','UNCOMMON','RARE','EPIC','LEGENDARY','VIP_EXCLUSIVE')),
  type          TEXT    CHECK (type IN ('avatar','profile')),
  price_points  INTEGER DEFAULT 0,
  vip_only      BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS frames (
  id            TEXT    PRIMARY KEY,
  name          TEXT    NOT NULL,
  description   TEXT,
  style         TEXT,
  rarity        TEXT    CHECK (rarity IN ('COMMON','UNCOMMON','RARE','EPIC','LEGENDARY','VIP_EXCLUSIVE')),
  price_points  INTEGER DEFAULT 0,
  vip_only      BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- MATCHES
-- =====================================================

CREATE TABLE IF NOT EXISTS matches (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  match_type  TEXT    NOT NULL CHECK (match_type IN ('classic-deathmatch','instagib-mode')),
  game_mode   TEXT,

  player1_id  UUID    REFERENCES users(id) ON DELETE CASCADE,
  player2_id  UUID    REFERENCES users(id) ON DELETE CASCADE,
  winner_id   UUID    REFERENCES users(id) ON DELETE SET NULL,

  maps        TEXT[],
  selected_map TEXT,
  score_p1    INTEGER DEFAULT 0,
  score_p2    INTEGER DEFAULT 0,
  p1_xp_change INTEGER,
  p2_xp_change INTEGER,

  status      TEXT    DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','cancelled')),

  created_at  TIMESTAMPTZ DEFAULT NOW(),
  started_at  TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_matches_player1    ON matches(player1_id);
CREATE INDEX IF NOT EXISTS idx_matches_player2    ON matches(player2_id);
CREATE INDEX IF NOT EXISTS idx_matches_status     ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_created_at ON matches(created_at DESC);

-- =====================================================
-- TOURNAMENTS
-- =====================================================

CREATE TABLE IF NOT EXISTS tournaments (
  id                    TEXT    PRIMARY KEY,
  name                  TEXT    NOT NULL,
  description           TEXT,
  tournament_type       TEXT    CHECK (tournament_type IN ('single-elimination','double-elimination','round-robin')),
  game_mode             TEXT    CHECK (game_mode IN ('classic-deathmatch','instagib-mode')),
  max_participants      INTEGER,
  current_participants  INTEGER DEFAULT 0,
  entry_fee_points      INTEGER DEFAULT 0,
  requires_vip          BOOLEAN DEFAULT true,
  prize_pool_points     INTEGER DEFAULT 0,
  prize_1st             INTEGER,
  prize_2nd             INTEGER,
  prize_3rd             INTEGER,
  start_date            TIMESTAMPTZ,
  end_date              TIMESTAMPTZ,
  registration_deadline TIMESTAMPTZ,
  status                TEXT    DEFAULT 'registration' CHECK (status IN ('registration','in_progress','completed','cancelled')),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tournament_participants (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id TEXT    REFERENCES tournaments(id) ON DELETE CASCADE,
  user_id       UUID    REFERENCES users(id) ON DELETE CASCADE,
  placement     INTEGER,
  is_eliminated BOOLEAN DEFAULT false,
  wins          INTEGER DEFAULT 0,
  losses        INTEGER DEFAULT 0,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tournament_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_tp_tournament ON tournament_participants(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tp_user       ON tournament_participants(user_id);

-- =====================================================
-- CHAT
-- =====================================================

CREATE TABLE IF NOT EXISTS chat_messages (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID    REFERENCES users(id) ON DELETE CASCADE,
  username    TEXT    NOT NULL,
  message     TEXT    NOT NULL,
  room        TEXT    NOT NULL CHECK (room IN ('global','alpha','beta','gamma','delta')),
  is_premium  BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_room ON chat_messages(room, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_messages(user_id);

-- =====================================================
-- FRIENDS
-- =====================================================

CREATE TABLE IF NOT EXISTS friendships (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID    REFERENCES users(id) ON DELETE CASCADE,
  friend_id   UUID    REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT    DEFAULT 'pending' CHECK (status IN ('pending','accepted','blocked')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_user   ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend ON friendships(friend_id);

-- =====================================================
-- NOTIFICATIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS notifications (
  id                    UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID    REFERENCES users(id) ON DELETE CASCADE,
  type                  TEXT    NOT NULL CHECK (type IN ('friend_request','match_found','tournament_starting','system','report','ban')),
  title                 TEXT    NOT NULL,
  message               TEXT    NOT NULL,
  read                  BOOLEAN DEFAULT false,
  related_user_id       UUID    REFERENCES users(id) ON DELETE SET NULL,
  related_match_id      UUID    REFERENCES matches(id) ON DELETE SET NULL,
  related_tournament_id TEXT    REFERENCES tournaments(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_user   ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_unread ON notifications(user_id, read) WHERE read = false;

-- =====================================================
-- REPORTS & MODERATION
-- =====================================================

CREATE TABLE IF NOT EXISTS reports (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID    REFERENCES users(id) ON DELETE CASCADE,
  reported_id UUID    REFERENCES users(id) ON DELETE CASCADE,
  reason      TEXT    NOT NULL CHECK (reason IN ('cheating','toxic_behavior','offensive_name','griefing','other')),
  description TEXT,
  match_id    UUID    REFERENCES matches(id) ON DELETE SET NULL,
  status      TEXT    DEFAULT 'pending' CHECK (status IN ('pending','reviewed','actioned','dismissed')),
  admin_notes TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_reported ON reports(reported_id);
CREATE INDEX IF NOT EXISTS idx_reports_status   ON reports(status);

-- =====================================================
-- BANS
-- =====================================================

CREATE TABLE IF NOT EXISTS bans (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID    REFERENCES users(id) ON DELETE CASCADE,
  reason           TEXT    NOT NULL,
  ban_level        INTEGER DEFAULT 1,
  duration_minutes INTEGER NOT NULL,
  is_active        BOOLEAN DEFAULT true,
  expires_at       TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  lifted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bans_user   ON bans(user_id);
CREATE INDEX IF NOT EXISTS idx_bans_active ON bans(user_id, is_active, expires_at) WHERE is_active = true;

-- =====================================================
-- LADDER SEASONS
-- =====================================================

CREATE TABLE IF NOT EXISTS ladder_seasons (
  id          TEXT    PRIMARY KEY,
  name        TEXT    NOT NULL,
  season_type TEXT    CHECK (season_type IN ('monthly','winter','spring','summer','autumn')),
  start_date  TIMESTAMPTZ NOT NULL,
  end_date    TIMESTAMPTZ NOT NULL,
  prize_1st   INTEGER,
  prize_2nd   INTEGER,
  prize_3rd   INTEGER,
  status      TEXT    DEFAULT 'active' CHECK (status IN ('upcoming','active','completed')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ladder_entries (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id   TEXT    REFERENCES ladder_seasons(id) ON DELETE CASCADE,
  user_id     UUID    REFERENCES users(id) ON DELETE CASCADE,
  points      INTEGER DEFAULT 0,
  wins        INTEGER DEFAULT 0,
  losses      INTEGER DEFAULT 0,
  win_streak  INTEGER DEFAULT 0,
  rank        INTEGER,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(season_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ladder_season ON ladder_entries(season_id, points DESC);
CREATE INDEX IF NOT EXISTS idx_ladder_user   ON ladder_entries(user_id);

-- =====================================================
-- MATCHMAKING QUEUE (in-memory via server, but persisted for crashes)
-- =====================================================

CREATE TABLE IF NOT EXISTS queue_entries (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID    REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  game_mode     TEXT    NOT NULL,
  selected_maps TEXT[],
  joined_at     TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- FUNCTIONS & TRIGGERS
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_level(xp INTEGER)
RETURNS INTEGER AS $$
BEGIN
  RETURN FLOOR(SQRT(xp / 100.0));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION update_user_level()
RETURNS TRIGGER AS $$
BEGIN
  NEW.level = calculate_level(NEW.experience);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- updated_at triggers
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_updated_at') THEN
    CREATE TRIGGER trg_users_updated_at
      BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tournaments_updated_at') THEN
    CREATE TRIGGER trg_tournaments_updated_at
      BEFORE UPDATE ON tournaments
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_friendships_updated_at') THEN
    CREATE TRIGGER trg_friendships_updated_at
      BEFORE UPDATE ON friendships
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_user_level') THEN
    CREATE TRIGGER trg_user_level
      BEFORE INSERT OR UPDATE OF experience ON users
      FOR EACH ROW EXECUTE FUNCTION update_user_level();
  END IF;
END $$;

-- =====================================================
-- VIEWS
-- =====================================================

CREATE OR REPLACE VIEW leaderboard AS
SELECT
  u.id,
  u.username,
  u.display_name,
  u.steam_avatar,
  u.is_premium,
  u.level,
  u.experience,
  u.wins,
  u.losses,
  u.win_streak,
  u.best_win_streak,
  CASE
    WHEN (u.wins + u.losses) > 0
    THEN ROUND((u.wins::DECIMAL / (u.wins + u.losses)) * 100, 2)
    ELSE 0
  END AS win_rate,
  ROW_NUMBER() OVER (ORDER BY u.experience DESC) AS rank
FROM users u
ORDER BY u.experience DESC;

CREATE OR REPLACE VIEW active_matches AS
SELECT
  m.id,
  m.match_type,
  m.status,
  p1.username AS player1_username,
  p1.steam_avatar AS player1_avatar,
  p1.level AS player1_level,
  p2.username AS player2_username,
  p2.steam_avatar AS player2_avatar,
  p2.level AS player2_level,
  m.selected_map,
  m.score_p1,
  m.score_p2,
  m.created_at,
  m.started_at
FROM matches m
JOIN users p1 ON m.player1_id = p1.id
JOIN users p2 ON m.player2_id = p2.id
WHERE m.status IN ('pending','in_progress')
ORDER BY m.created_at DESC;

CREATE OR REPLACE VIEW tournament_standings AS
SELECT
  tp.tournament_id,
  t.name AS tournament_name,
  u.id AS user_id,
  u.username,
  u.steam_avatar,
  u.is_premium,
  tp.wins,
  tp.losses,
  tp.placement,
  tp.is_eliminated
FROM tournament_participants tp
JOIN users u ON tp.user_id = u.id
JOIN tournaments t ON tp.tournament_id = t.id
ORDER BY tp.tournament_id, tp.placement NULLS LAST, tp.wins DESC;

-- =====================================================
-- SEED DATA
-- =====================================================

INSERT INTO badges (id, name, description, icon, rarity, type, price_points, vip_only) VALUES
('av_lambda',         'Lambda Operative',      'Standard Black Mesa operative badge',   'λ',  'COMMON',      'avatar', 0,     false),
('av_crowbar',        'Crowbar Wielder',        'Basic melee combat badge',              '🔨', 'COMMON',      'avatar', 100,   false),
('av_headcrab',       'Headcrab Hunter',        'Eliminated your first headcrab',        '🦀', 'COMMON',      'avatar', 150,   false),
('av_scientist',      'Research Assistant',     'Entry-level scientist badge',           '🔬', 'COMMON',      'avatar', 200,   false),
('av_gordon',         'Gordon Freeman Tribute', 'Honor the legendary scientist',         '👤', 'UNCOMMON',    'avatar', 500,   false),
('av_gman',           'G-Man Observer',         'Mysterious observer status',            '🕴️','UNCOMMON',    'avatar', 750,   false),
('av_barney',         'Security Chief',         'Advanced security clearance',           '👮', 'UNCOMMON',    'avatar', 1000,  false),
('av_combine',        'Combine Elite',          'Elite tactical unit badge',             '⚡', 'RARE',        'avatar', 2000,  false),
('av_vortigaunt',     'Vortigaunt Ally',        'Allied with the Vortigaunts',           '👽', 'RARE',        'avatar', 2500,  false),
('av_strider',        'Strider Killer',         'Defeated a Strider in combat',          '🦾', 'EPIC',        'avatar', 5000,  false),
('av_nihilanth',      'Nihilanth Slayer',       'Conquered the final boss',              '👁️','EPIC',        'avatar', 7500,  false),
('av_freeman_master', 'Freeman Master',         'Master of all Half-Life combat',        '🏆', 'LEGENDARY',   'avatar', 15000, false),
('av_blackmesa_legend','Black Mesa Legend',     'Legendary operative status',            '⭐', 'LEGENDARY',   'avatar', 25000, false),
('av_vip_gold',       'VIP Gold Member',        'Exclusive VIP gold status',             '👑', 'VIP_EXCLUSIVE','avatar', 0,    true),
('av_vip_diamond',    'VIP Diamond Elite',      'Ultra-rare VIP diamond status',         '💎', 'VIP_EXCLUSIVE','avatar', 10000,true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO frames (id, name, description, style, rarity, price_points, vip_only) VALUES
('fr_standard',   'Standard Frame',          'Default Black Mesa frame',               'border-2 border-orange-500',                                          'COMMON',      0,     false),
('fr_hazard',     'Hazard Frame',            'Safety orange warning frame',            'border-2 border-yellow-500 bg-yellow-500/10',                          'COMMON',      200,   false),
('fr_security',   'Security Frame',          'Blue security clearance frame',          'border-2 border-blue-500 bg-blue-500/10',                              'COMMON',      300,   false),
('fr_lambda',     'Lambda Frame',            'Classic lambda symbol frame',            'border-4 border-orange-500 shadow-lg shadow-orange-500/50',            'UNCOMMON',    800,   false),
('fr_hazsuit',    'HEV Suit Frame',          'Iconic HEV suit styled frame',           'border-4 border-green-500 shadow-lg shadow-green-500/50',              'UNCOMMON',    1200,  false),
('fr_combine',    'Combine Frame',           'Menacing Combine technology frame',      'border-4 border-red-600 shadow-lg shadow-red-600/50',                  'RARE',        3000,  false),
('fr_xen',        'Xen Crystal Frame',       'Alien crystal energy frame',             'border-4 border-purple-500 shadow-lg shadow-purple-500/50',            'RARE',        4000,  false),
('fr_portal',     'Portal Frame',            'Interdimensional portal frame',          'border-4 border-cyan-400 shadow-2xl shadow-cyan-400/50 animate-pulse', 'EPIC',        8000,  false),
('fr_resonance',  'Resonance Cascade Frame', 'Chaotic resonance cascade frame',        'border-4 border-orange-600 shadow-2xl shadow-orange-600/70 animate-pulse','EPIC',     10000, false),
('fr_blackmesa',  'Black Mesa Elite Frame',  'Prestigious Black Mesa frame',           'border-8 border-orange-500 shadow-2xl shadow-orange-500/80',           'LEGENDARY',   20000, false),
('fr_gman',       'G-Man Frame',             'Mysterious briefcase frame',             'border-8 border-slate-400 shadow-2xl shadow-slate-400/80',             'LEGENDARY',   30000, false),
('fr_vip_gold',   'VIP Gold Frame',          'Exclusive VIP gold frame',               'border-8 border-yellow-400 shadow-2xl shadow-yellow-400/90',           'VIP_EXCLUSIVE',0,   true),
('fr_vip_diamond','VIP Diamond Frame',       'Ultra-rare VIP diamond frame',           'border-8 border-cyan-300 shadow-2xl shadow-cyan-300/90 animate-pulse', 'VIP_EXCLUSIVE',15000,true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO tournaments (id, name, description, tournament_type, game_mode, max_participants, requires_vip, prize_1st, prize_2nd, prize_3rd, start_date, end_date, registration_deadline, status) VALUES
('black-mesa-championship', 'Black Mesa Championship',          'Premier monthly tournament',          'single-elimination', 'classic-deathmatch', 32, true, 50000, 25000, 10000, NOW() + INTERVAL '7 days',  NOW() + INTERVAL '14 days', NOW() + INTERVAL '6 days',  'registration'),
('lambda-instagib',         'Lambda Instagib Tournament',       'Fast-paced instagib competition',     'single-elimination', 'instagib-mode',      16, true, 30000, 15000, 7500,  NOW() + INTERVAL '10 days', NOW() + INTERVAL '17 days', NOW() + INTERVAL '9 days',  'registration'),
('tactical-ops',            'Tactical Operations Championship', 'Strategic combat tournament',         'double-elimination', 'classic-deathmatch', 24, true, 40000, 20000, 8000,  NOW() + INTERVAL '14 days', NOW() + INTERVAL '21 days', NOW() + INTERVAL '13 days', 'registration'),
('resonance-cascade',       'Resonance Cascade Royale',        'Ultimate Half-Life 1 tournament',     'single-elimination', 'classic-deathmatch', 64, true, 100000,50000, 25000, NOW() + INTERVAL '21 days', NOW() + INTERVAL '28 days', NOW() + INTERVAL '20 days', 'registration')
ON CONFLICT (id) DO NOTHING;

INSERT INTO ladder_seasons (id, name, season_type, start_date, end_date, prize_1st, prize_2nd, prize_3rd, status) VALUES
('monthly-2025-01', 'January 2025 Ladder', 'monthly', '2025-01-01', '2025-01-31', 25000, 15000, 7500, 'active')
ON CONFLICT (id) DO NOTHING;
