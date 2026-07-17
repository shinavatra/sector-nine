UPDATE users SET equipped_frame='fr_basic' WHERE equipped_frame='fr_standard';
UPDATE users SET owned_frames=ARRAY(SELECT DISTINCT CASE WHEN frame_id='fr_standard' THEN 'fr_basic' ELSE frame_id END FROM unnest(COALESCE(owned_frames,'{}'::text[])) frame_id);
ALTER TABLE users ALTER COLUMN equipped_frame SET DEFAULT 'fr_basic';
ALTER TABLE users ALTER COLUMN owned_frames SET DEFAULT ARRAY['fr_basic']::TEXT[];
