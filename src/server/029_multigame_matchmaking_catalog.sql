BEGIN;

INSERT INTO game_matchmaking_config(game_id,enabled,modes,default_mode,required_map_count)
VALUES
  ('cs16',TRUE,ARRAY['competitive-1v1'],'competitive-1v1',5),
  ('l4d2',TRUE,ARRAY['survival-duel'],'survival-duel',5),
  ('cod4',TRUE,ARRAY['promod-1v1'],'promod-1v1',5)
ON CONFLICT(game_id) DO UPDATE SET
  enabled=EXCLUDED.enabled,
  modes=EXCLUDED.modes,
  default_mode=EXCLUDED.default_mode,
  required_map_count=EXCLUDED.required_map_count,
  updated_at=NOW();

INSERT INTO game_map_pools(game_id,game_mode,maps,is_active)
VALUES
  ('cs16','competitive-1v1',ARRAY['de_dust2','de_inferno','de_nuke','de_train','de_cbble','de_aztec','de_dust','de_prodigy','de_tuscan','de_cpl_mill'],TRUE),
  ('l4d2','survival-duel',ARRAY['c1m4_atrium','c2m1_highway','c2m5_concert','c3m1_plankcountry','c3m4_plantation','c4m1_milltown_a','c4m5_milltown_escape','c5m2_park','c5m5_bridge','c6m3_port'],TRUE),
  ('cod4','promod-1v1',ARRAY['mp_backlot','mp_citystreets','mp_crash','mp_crossfire','mp_strike','mp_vacant','mp_bog','mp_countdown','mp_pipeline','mp_showdown'],TRUE)
ON CONFLICT(game_id,game_mode) DO UPDATE SET
  maps=EXCLUDED.maps,
  is_active=EXCLUDED.is_active,
  updated_at=NOW();

COMMIT;
