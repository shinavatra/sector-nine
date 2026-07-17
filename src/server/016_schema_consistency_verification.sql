-- Read-only verification after 016_schema_consistency_and_notifications.sql.
SELECT table_name,column_name,data_type,column_default
FROM information_schema.columns
WHERE table_schema='public' AND (
  (table_name='users' AND column_name IN('custom_avatar_url','avatar_source','social_links','notification_preferences','owns_hl1','vac_banned','game_banned','last_steam_check','role','deleted_at','vip_expires_at')) OR
  (table_name='game_servers' AND column_name IN('current_match_id','rcon_password')) OR
  (table_name='matches' AND column_name='server_id') OR
  (table_name='chat_messages' AND column_name IN('user_id','recipient_id','created_at')) OR
  (table_name='notifications' AND column_name IN('read','related_chat_message_id','related_friendship_id'))
) ORDER BY table_name,column_name;

SELECT c.conrelid::regclass AS table_name,c.conname,pg_get_constraintdef(c.oid) AS definition,c.convalidated
FROM pg_constraint c
WHERE c.conname IN('friendships_not_self','game_servers_current_match_id_fkey','matches_server_id_fkey','chat_messages_recipient_id_fkey','notifications_related_chat_message_id_fkey','notifications_related_friendship_id_fkey','notifications_type_check')
ORDER BY (c.conrelid::regclass)::text,c.conname;

SELECT schemaname,tablename,indexname,indexdef
FROM pg_indexes
WHERE schemaname='public' AND indexname IN('friendships_unique_pair','idx_game_servers_current_match','idx_matches_server','idx_chat_participants','idx_chat_recipient_created','idx_notifications_chat_message_unique','idx_notifications_friendship_unique','idx_notifications_user_unread')
ORDER BY indexname;

SELECT id,name,style FROM frames WHERE id IN('fr_basic','fr_standard') ORDER BY id;
SELECT COUNT(*) AS users_still_using_fr_standard FROM users WHERE equipped_frame='fr_standard' OR 'fr_standard'=ANY(COALESCE(owned_frames,'{}'::text[]));

SELECT table_name FROM information_schema.tables
WHERE table_schema='public' AND table_name IN('admin_audit_logs','platform_settings','login_history','user_mutes')
ORDER BY table_name;
