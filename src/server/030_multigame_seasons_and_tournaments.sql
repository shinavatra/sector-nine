BEGIN;

ALTER TABLE tournaments DROP CONSTRAINT IF EXISTS tournaments_game_mode_check;
ALTER TABLE tournaments ADD CONSTRAINT tournaments_game_mode_check CHECK (
  game_mode IN ('classic-deathmatch','instagib-mode','competitive-1v1','survival-duel','promod-1v1')
);

UPDATE ladder_seasons
SET status='completed'
WHERE end_date<NOW() AND status<>'completed';

INSERT INTO ladder_seasons(id,name,season_type,start_date,end_date,prize_1st,prize_2nd,prize_3rd,status,game_id)
VALUES
  ('hl1-2026-q3','Half-Life Q3 2026','summer','2026-07-01 00:00:00+00','2026-09-30 23:59:59+00',5000,3000,1500,'active','hl1'),
  ('cs16-2026-q3','Counter-Strike 1.6 Q3 2026','summer','2026-07-01 00:00:00+00','2026-09-30 23:59:59+00',5000,3000,1500,'active','cs16'),
  ('l4d2-2026-q3','Left 4 Dead 2 Q3 2026','summer','2026-07-01 00:00:00+00','2026-09-30 23:59:59+00',5000,3000,1500,'active','l4d2'),
  ('cod4-2026-q3','Call of Duty 4 Q3 2026','summer','2026-07-01 00:00:00+00','2026-09-30 23:59:59+00',5000,3000,1500,'active','cod4')
ON CONFLICT(id) DO UPDATE SET
  name=EXCLUDED.name,season_type=EXCLUDED.season_type,start_date=EXCLUDED.start_date,
  end_date=EXCLUDED.end_date,prize_1st=EXCLUDED.prize_1st,prize_2nd=EXCLUDED.prize_2nd,
  prize_3rd=EXCLUDED.prize_3rd,status=EXCLUDED.status,game_id=EXCLUDED.game_id;

UPDATE tournaments SET
  start_date=CASE id
    WHEN 'black-mesa-championship' THEN '2026-08-15 18:00:00+00'::timestamptz
    WHEN 'lambda-instagib' THEN '2026-08-22 18:00:00+00'::timestamptz
    WHEN 'tactical-ops' THEN '2026-09-05 18:00:00+00'::timestamptz
    WHEN 'resonance-cascade' THEN '2026-09-19 18:00:00+00'::timestamptz
  END,
  end_date=CASE id
    WHEN 'black-mesa-championship' THEN '2026-08-16 22:00:00+00'::timestamptz
    WHEN 'lambda-instagib' THEN '2026-08-23 22:00:00+00'::timestamptz
    WHEN 'tactical-ops' THEN '2026-09-06 22:00:00+00'::timestamptz
    WHEN 'resonance-cascade' THEN '2026-09-20 22:00:00+00'::timestamptz
  END,
  registration_deadline=CASE id
    WHEN 'black-mesa-championship' THEN '2026-08-12 23:59:59+00'::timestamptz
    WHEN 'lambda-instagib' THEN '2026-08-19 23:59:59+00'::timestamptz
    WHEN 'tactical-ops' THEN '2026-09-02 23:59:59+00'::timestamptz
    WHEN 'resonance-cascade' THEN '2026-09-16 23:59:59+00'::timestamptz
  END,
  status='registration',updated_at=NOW()
WHERE id IN ('black-mesa-championship','lambda-instagib','tactical-ops','resonance-cascade');

INSERT INTO tournaments(
  id,name,description,tournament_type,game_mode,max_participants,current_participants,
  entry_fee_points,requires_vip,prize_pool_points,prize_1st,prize_2nd,prize_3rd,
  start_date,end_date,registration_deadline,status,game_id,maps
)
VALUES
  ('cs16-summer-open-2026','CS 1.6 Summer Open','Classic Counter-Strike 1.6 one-versus-one elimination tournament.','single-elimination','competitive-1v1',32,0,0,FALSE,9000,5000,2500,1500,'2026-08-29 18:00:00+00','2026-08-30 22:00:00+00','2026-08-26 23:59:59+00','registration','cs16',ARRAY['de_dust2','de_inferno','de_nuke','de_train','de_tuscan']),
  ('l4d2-survival-open-2026','L4D2 Survival Open','Left 4 Dead 2 head-to-head survival tournament.','single-elimination','survival-duel',16,0,0,FALSE,7000,4000,2000,1000,'2026-09-12 18:00:00+00','2026-09-13 22:00:00+00','2026-09-09 23:59:59+00','registration','l4d2',ARRAY['c1m4_atrium','c2m5_concert','c3m4_plantation','c5m2_park','c6m3_port']),
  ('cod4-promod-open-2026','CoD4 Promod Open','Call of Duty 4 Promod one-versus-one elimination tournament.','single-elimination','promod-1v1',32,0,0,FALSE,9000,5000,2500,1500,'2026-09-26 18:00:00+00','2026-09-27 22:00:00+00','2026-09-23 23:59:59+00','registration','cod4',ARRAY['mp_backlot','mp_citystreets','mp_crash','mp_crossfire','mp_strike'])
ON CONFLICT(id) DO UPDATE SET
  name=EXCLUDED.name,description=EXCLUDED.description,tournament_type=EXCLUDED.tournament_type,
  game_mode=EXCLUDED.game_mode,max_participants=EXCLUDED.max_participants,entry_fee_points=EXCLUDED.entry_fee_points,
  requires_vip=EXCLUDED.requires_vip,prize_pool_points=EXCLUDED.prize_pool_points,
  prize_1st=EXCLUDED.prize_1st,prize_2nd=EXCLUDED.prize_2nd,prize_3rd=EXCLUDED.prize_3rd,
  start_date=EXCLUDED.start_date,end_date=EXCLUDED.end_date,registration_deadline=EXCLUDED.registration_deadline,
  status=EXCLUDED.status,game_id=EXCLUDED.game_id,maps=EXCLUDED.maps,updated_at=NOW();

COMMIT;
