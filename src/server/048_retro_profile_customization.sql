-- Static profile cosmetics extracted from the supplied Sector Nine artwork.
-- Competitive thresholds intentionally remain NULL until product owners define them.

ALTER TABLE users ADD COLUMN IF NOT EXISTS active_profile_rank_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS active_special_badge_id TEXT;

CREATE TABLE IF NOT EXISTS profile_rank_definitions (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, asset_url TEXT NOT NULL,
  min_rating INTEGER, max_rating INTEGER,
  auto_assign_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (min_rating IS NULL OR min_rating >= 0),
  CHECK (max_rating IS NULL OR max_rating >= 0),
  CHECK (min_rating IS NULL OR max_rating IS NULL OR min_rating <= max_rating)
);

CREATE TABLE IF NOT EXISTS profile_special_badges (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, asset_url TEXT NOT NULL,
  allows_custom_title BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_special_badges (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id TEXT NOT NULL REFERENCES profile_special_badges(id) ON DELETE RESTRICT,
  custom_title TEXT, assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id,badge_id),
  CHECK (custom_title IS NULL OR (char_length(custom_title) BETWEEN 1 AND 32 AND custom_title !~ '[<>]'))
);

CREATE TABLE IF NOT EXISTS competitive_medal_definitions (
  id TEXT PRIMARY KEY, level INTEGER NOT NULL UNIQUE CHECK (level BETWEEN 1 AND 11),
  name TEXT NOT NULL, asset_url TEXT NOT NULL, rating_threshold INTEGER,
  auto_award_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (rating_threshold IS NULL OR rating_threshold >= 0),
  CHECK (NOT auto_award_enabled OR rating_threshold IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS user_competitive_medals (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id TEXT NOT NULL,
  medal_id TEXT NOT NULL REFERENCES competitive_medal_definitions(id) ON DELETE RESTRICT,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  rating_at_award INTEGER NOT NULL CHECK (rating_at_award >= 0),
  source_match_id UUID REFERENCES matches(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id,game_id,medal_id)
);

DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_active_profile_rank_fk FOREIGN KEY(active_profile_rank_id) REFERENCES profile_rank_definitions(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_active_special_badge_fk FOREIGN KEY(active_special_badge_id) REFERENCES profile_special_badges(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_user_competitive_medals_profile ON user_competitive_medals(user_id,game_id,earned_at);
CREATE INDEX IF NOT EXISTS idx_user_special_badges_profile ON user_special_badges(user_id,assigned_at);

INSERT INTO profile_rank_definitions(id,name,asset_url) VALUES
  ('new_recruit','NEW RECRUIT','/profile-assets/retro/ranks/new-recruit.png'),
  ('active_player','ACTIVE PLAYER','/profile-assets/retro/ranks/active-player.png'),
  ('elite_player','ELITE PLAYER','/profile-assets/retro/ranks/elite-player.png'),
  ('veteran','VETERAN','/profile-assets/retro/ranks/veteran.png')
ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,asset_url=EXCLUDED.asset_url;

INSERT INTO profile_special_badges(id,name,asset_url,allows_custom_title) VALUES
  ('clan_owner','CLAN OWNER','/profile-assets/retro/badges/clan-owner.png',FALSE),
  ('clan_leader','CLAN LEADER','/profile-assets/retro/badges/clan-leader.png',FALSE),
  ('clan_member','CLAN MEMBER','/profile-assets/retro/badges/clan-member.png',FALSE),
  ('custom_title','CUSTOM TITLE','/profile-assets/retro/badges/custom-title.png',TRUE)
ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,asset_url=EXCLUDED.asset_url,allows_custom_title=EXCLUDED.allows_custom_title;

INSERT INTO competitive_medal_definitions(id,level,name,asset_url) VALUES
  ('competitive_01',1,'Competitive Level 1','/profile-assets/retro/medals/level-01.png'),
  ('competitive_02',2,'Competitive Level 2','/profile-assets/retro/medals/level-02.png'),
  ('competitive_03',3,'Competitive Level 3','/profile-assets/retro/medals/level-03.png'),
  ('competitive_04',4,'Competitive Level 4','/profile-assets/retro/medals/level-04.png'),
  ('competitive_05',5,'Competitive Level 5','/profile-assets/retro/medals/level-05.png'),
  ('competitive_06',6,'Competitive Level 6','/profile-assets/retro/medals/level-06.png'),
  ('competitive_07',7,'Competitive Level 7','/profile-assets/retro/medals/level-07.png'),
  ('competitive_08',8,'Competitive Level 8','/profile-assets/retro/medals/level-08.png'),
  ('competitive_09',9,'Competitive Level 9','/profile-assets/retro/medals/level-09.png'),
  ('competitive_10',10,'Competitive Level 10','/profile-assets/retro/medals/level-10.png'),
  ('challenger',11,'CHALLENGER','/profile-assets/retro/medals/level-11.png')
ON CONFLICT(id) DO UPDATE SET level=EXCLUDED.level,name=EXCLUDED.name,asset_url=EXCLUDED.asset_url;

INSERT INTO frames(id,name,description,style,rarity,price_points,vip_only,featured,is_active,metadata) VALUES
  ('retro_frame_01','Retro Frame 01','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 1=50 THEN 'LEGENDARY' WHEN 1>39 THEN 'EPIC' WHEN 1>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-01.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-01.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_02','Retro Frame 02','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 2=50 THEN 'LEGENDARY' WHEN 2>39 THEN 'EPIC' WHEN 2>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-02.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-02.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_03','Retro Frame 03','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 3=50 THEN 'LEGENDARY' WHEN 3>39 THEN 'EPIC' WHEN 3>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-03.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-03.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_04','Retro Frame 04','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 4=50 THEN 'LEGENDARY' WHEN 4>39 THEN 'EPIC' WHEN 4>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-04.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-04.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_05','Retro Frame 05','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 5=50 THEN 'LEGENDARY' WHEN 5>39 THEN 'EPIC' WHEN 5>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-05.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-05.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_06','Retro Frame 06','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 6=50 THEN 'LEGENDARY' WHEN 6>39 THEN 'EPIC' WHEN 6>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-06.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-06.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_07','Retro Frame 07','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 7=50 THEN 'LEGENDARY' WHEN 7>39 THEN 'EPIC' WHEN 7>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-07.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-07.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_08','Retro Frame 08','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 8=50 THEN 'LEGENDARY' WHEN 8>39 THEN 'EPIC' WHEN 8>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-08.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-08.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_09','Retro Frame 09','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 9=50 THEN 'LEGENDARY' WHEN 9>39 THEN 'EPIC' WHEN 9>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-09.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-09.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_10','Retro Frame 10','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 10=50 THEN 'LEGENDARY' WHEN 10>39 THEN 'EPIC' WHEN 10>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-10.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-10.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_11','Retro Frame 11','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 11=50 THEN 'LEGENDARY' WHEN 11>39 THEN 'EPIC' WHEN 11>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-11.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-11.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_12','Retro Frame 12','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 12=50 THEN 'LEGENDARY' WHEN 12>39 THEN 'EPIC' WHEN 12>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-12.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-12.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_13','Retro Frame 13','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 13=50 THEN 'LEGENDARY' WHEN 13>39 THEN 'EPIC' WHEN 13>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-13.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-13.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_14','Retro Frame 14','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 14=50 THEN 'LEGENDARY' WHEN 14>39 THEN 'EPIC' WHEN 14>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-14.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-14.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_15','Retro Frame 15','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 15=50 THEN 'LEGENDARY' WHEN 15>39 THEN 'EPIC' WHEN 15>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-15.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-15.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_16','Retro Frame 16','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 16=50 THEN 'LEGENDARY' WHEN 16>39 THEN 'EPIC' WHEN 16>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-16.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-16.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_17','Retro Frame 17','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 17=50 THEN 'LEGENDARY' WHEN 17>39 THEN 'EPIC' WHEN 17>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-17.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-17.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_18','Retro Frame 18','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 18=50 THEN 'LEGENDARY' WHEN 18>39 THEN 'EPIC' WHEN 18>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-18.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-18.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_19','Retro Frame 19','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 19=50 THEN 'LEGENDARY' WHEN 19>39 THEN 'EPIC' WHEN 19>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-19.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-19.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_20','Retro Frame 20','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 20=50 THEN 'LEGENDARY' WHEN 20>39 THEN 'EPIC' WHEN 20>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-20.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-20.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_21','Retro Frame 21','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 21=50 THEN 'LEGENDARY' WHEN 21>39 THEN 'EPIC' WHEN 21>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-21.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-21.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_22','Retro Frame 22','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 22=50 THEN 'LEGENDARY' WHEN 22>39 THEN 'EPIC' WHEN 22>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-22.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-22.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_23','Retro Frame 23','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 23=50 THEN 'LEGENDARY' WHEN 23>39 THEN 'EPIC' WHEN 23>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-23.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-23.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_24','Retro Frame 24','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 24=50 THEN 'LEGENDARY' WHEN 24>39 THEN 'EPIC' WHEN 24>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-24.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-24.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_25','Retro Frame 25','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 25=50 THEN 'LEGENDARY' WHEN 25>39 THEN 'EPIC' WHEN 25>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-25.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-25.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_26','Retro Frame 26','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 26=50 THEN 'LEGENDARY' WHEN 26>39 THEN 'EPIC' WHEN 26>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-26.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-26.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_27','Retro Frame 27','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 27=50 THEN 'LEGENDARY' WHEN 27>39 THEN 'EPIC' WHEN 27>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-27.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-27.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_28','Retro Frame 28','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 28=50 THEN 'LEGENDARY' WHEN 28>39 THEN 'EPIC' WHEN 28>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-28.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-28.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_29','Retro Frame 29','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 29=50 THEN 'LEGENDARY' WHEN 29>39 THEN 'EPIC' WHEN 29>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-29.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-29.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_30','Retro Frame 30','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 30=50 THEN 'LEGENDARY' WHEN 30>39 THEN 'EPIC' WHEN 30>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-30.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-30.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_31','Retro Frame 31','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 31=50 THEN 'LEGENDARY' WHEN 31>39 THEN 'EPIC' WHEN 31>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-31.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-31.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_32','Retro Frame 32','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 32=50 THEN 'LEGENDARY' WHEN 32>39 THEN 'EPIC' WHEN 32>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-32.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-32.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_33','Retro Frame 33','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 33=50 THEN 'LEGENDARY' WHEN 33>39 THEN 'EPIC' WHEN 33>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-33.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-33.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_34','Retro Frame 34','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 34=50 THEN 'LEGENDARY' WHEN 34>39 THEN 'EPIC' WHEN 34>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-34.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-34.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_35','Retro Frame 35','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 35=50 THEN 'LEGENDARY' WHEN 35>39 THEN 'EPIC' WHEN 35>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-35.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-35.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_36','Retro Frame 36','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 36=50 THEN 'LEGENDARY' WHEN 36>39 THEN 'EPIC' WHEN 36>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-36.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-36.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_37','Retro Frame 37','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 37=50 THEN 'LEGENDARY' WHEN 37>39 THEN 'EPIC' WHEN 37>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-37.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-37.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_38','Retro Frame 38','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 38=50 THEN 'LEGENDARY' WHEN 38>39 THEN 'EPIC' WHEN 38>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-38.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-38.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_39','Retro Frame 39','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 39=50 THEN 'LEGENDARY' WHEN 39>39 THEN 'EPIC' WHEN 39>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-39.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-39.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_40','Retro Frame 40','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 40=50 THEN 'LEGENDARY' WHEN 40>39 THEN 'EPIC' WHEN 40>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-40.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-40.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_41','Retro Frame 41','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 41=50 THEN 'LEGENDARY' WHEN 41>39 THEN 'EPIC' WHEN 41>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-41.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-41.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_42','Retro Frame 42','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 42=50 THEN 'LEGENDARY' WHEN 42>39 THEN 'EPIC' WHEN 42>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-42.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-42.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_43','Retro Frame 43','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 43=50 THEN 'LEGENDARY' WHEN 43>39 THEN 'EPIC' WHEN 43>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-43.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-43.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_44','Retro Frame 44','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 44=50 THEN 'LEGENDARY' WHEN 44>39 THEN 'EPIC' WHEN 44>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-44.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-44.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_45','Retro Frame 45','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 45=50 THEN 'LEGENDARY' WHEN 45>39 THEN 'EPIC' WHEN 45>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-45.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-45.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_46','Retro Frame 46','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 46=50 THEN 'LEGENDARY' WHEN 46>39 THEN 'EPIC' WHEN 46>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-46.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-46.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_47','Retro Frame 47','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 47=50 THEN 'LEGENDARY' WHEN 47>39 THEN 'EPIC' WHEN 47>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-47.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-47.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_48','Retro Frame 48','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 48=50 THEN 'LEGENDARY' WHEN 48>39 THEN 'EPIC' WHEN 48>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-48.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-48.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_49','Retro Frame 49','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 49=50 THEN 'LEGENDARY' WHEN 49>39 THEN 'EPIC' WHEN 49>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-49.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-49.png','catalogType','future_fl_shop','purchasable',false)),
  ('retro_frame_50','Retro Frame 50','Original static Sector Nine retro FPS avatar frame','',CASE WHEN 50=50 THEN 'LEGENDARY' WHEN 50>39 THEN 'EPIC' WHEN 50>19 THEN 'RARE' ELSE 'UNCOMMON' END,0,FALSE,FALSE,FALSE,jsonb_build_object('assetUrl','/profile-assets/retro/frames/frame-50.png','thumbnailUrl','/profile-assets/retro/frames/thumbs/frame-50.png','catalogType','future_fl_shop','purchasable',false))
ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,rarity=EXCLUDED.rarity,metadata=EXCLUDED.metadata,is_active=TRUE;

