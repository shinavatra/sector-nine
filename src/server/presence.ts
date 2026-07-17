export const ONLINE_WINDOW_SQL = "INTERVAL '5 minutes'"

export const onlineUserPredicate = (alias = 'u') =>
  `${alias}.deleted_at IS NULL AND ${alias}.show_online_status = TRUE AND ${alias}.last_seen > NOW() - ${ONLINE_WINDOW_SQL}`
