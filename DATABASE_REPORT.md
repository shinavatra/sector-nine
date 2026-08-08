# PostgreSQL Database Audit

Audit date: 2026-07-19  
Database: `sectornine`  
PostgreSQL: 18.4  
Database size at audit time: approximately 11 MB

## Scope and safety

This audit inspected the live database configured by the project and reconciled it with the SQL used by the backend and the repository migrations. All live checks were `SELECT` statements inside a read-only transaction followed by `ROLLBACK`. No schema or data changes were made.

The database is currently very small: `users` has 3 estimated live rows, `notifications` 3, `chat_messages` 4, `login_history` 5, and most other application tables are empty. At this size, PostgreSQL will often prefer sequential scans even when a suitable index exists. Index recommendations below are therefore based on constraints and real application query patterns, not on sequential-scan counts alone.

## Executive summary

| Area | Result |
|---|---|
| Missing indexes | 8 foreign-key columns lack supporting indexes; 3 query-pattern indexes are recommended as the data grows |
| Exact duplicate indexes | None detected |
| Redundant/overlapping indexes | 6 strong candidates, including 3 non-unique `users` indexes duplicated by unique indexes |
| Slow queries | No query running longer than 1 second during the audit; historical analysis is unavailable because `pg_stat_statements` is not installed |
| Unnecessary columns | No column is safe to remove immediately; two server compatibility pairs and one tournament counter should be consolidated deliberately |
| Duplicate data | No duplicates found in the tested business keys |
| Maintenance | `users` has 11 estimated dead rows versus 3 live rows; routine vacuum/analyze should be verified |

## 1. Missing indexes

### High-confidence query indexes

These indexes match SQL that is currently executed by the backend.

| Priority | Table and columns | Reason |
|---|---|---|
| High | `queue_entries (joined_at)` | Queue listing orders by `joined_at`, and expiry deletes rows using `joined_at < ...`. Only primary-key and `user_id` indexes currently exist. |
| Medium | `reports (status, created_at DESC)` | The dashboard counts pending reports, while administration lists reports newest-first. The existing status-only index cannot also satisfy ordering efficiently at scale. |
| Medium | Partial `users (last_seen DESC)` | Online-user and online-admin queries repeatedly filter active, visible users by a recent `last_seen`. Add only when user volume makes these queries material. |

Suggested definitions, not executed:

```sql
CREATE INDEX CONCURRENTLY idx_queue_entries_joined_at
    ON queue_entries (joined_at);

CREATE INDEX CONCURRENTLY idx_reports_status_created_at
    ON reports (status, created_at DESC);

CREATE INDEX CONCURRENTLY idx_users_visible_last_seen
    ON users (last_seen DESC)
    WHERE deleted_at IS NULL AND show_online_status = TRUE;
```

Do not create all candidate indexes blindly. Capture workload statistics first, then use `EXPLAIN (ANALYZE, BUFFERS)` in a safe non-production workflow for representative queries.

### Foreign keys without supporting indexes

PostgreSQL does not automatically index referencing foreign-key columns. The following eight foreign keys currently lack a left-prefix supporting index:

| Table | Column | Foreign key |
|---|---|---|
| `bans` | `issued_by` | `bans_issued_by_fkey` |
| `matches` | `winner_id` | `matches_winner_id_fkey` |
| `notifications` | `related_match_id` | `notifications_related_match_id_fkey` |
| `notifications` | `related_tournament_id` | `notifications_related_tournament_id_fkey` |
| `notifications` | `related_user_id` | `notifications_related_user_id_fkey` |
| `platform_settings` | `updated_by` | `platform_settings_updated_by_fkey` |
| `reports` | `match_id` | `reports_match_id_fkey` |
| `user_mutes` | `issued_by` | `user_mutes_issued_by_fkey` |

These matter most when parent rows are updated/deleted or when the application joins through the foreign key. Given the present row counts, they are not urgent. Prioritize `notifications.related_user_id`, `matches.winner_id`, and `reports.match_id` if those tables begin growing. Add the administrator-reference indexes only if deletion/update behavior or audit queries demonstrate a need.

## 2. Duplicate and overlapping indexes

### Exact duplicates

No exact duplicate indexes were found in the live schema.

### Strong redundant-index candidates

The following non-unique indexes duplicate lookup coverage already provided by unique indexes:

| Redundant candidate | Existing covering unique index |
|---|---|
| `idx_users_email (email)` | `users_email_key (email)` |
| `idx_users_username (username)` | `users_username_key (username)` |
| `idx_users_steam_id (steam_id)` | `users_steam_id_key (steam_id)` |

These three indexes impose extra storage and write maintenance without adding a different access path. After checking production index usage over a representative period, they are good candidates for removal:

```sql
DROP INDEX CONCURRENTLY IF EXISTS idx_users_email;
DROP INDEX CONCURRENTLY IF EXISTS idx_users_username;
DROP INDEX CONCURRENTLY IF EXISTS idx_users_steam_id;
```

### Other overlapping indexes requiring usage evidence

- `idx_chat_room (room, created_at DESC)` is left-prefix covered by `idx_chat_room_created (room, created_at DESC, id DESC)`. The shorter index is likely redundant.
- `idx_notif_unread (user_id, read) WHERE read = FALSE` includes `read` as an index key even though the predicate makes it constant. Its useful key is effectively only `user_id`.
- `idx_notifications_user_unread (user_id, created_at DESC) WHERE read = FALSE` overlaps both `idx_notif_unread` and the general `idx_notif_user (user_id, created_at DESC)`, but its smaller partial index may still benefit unread-notification queries.
- `idx_notifications_unread_messages` is more selective than the general unread index and may remain worthwhile if message notifications dominate.

Keep the smallest index set that supports measured queries. Do not remove overlapping indexes solely from structural similarity.

## 3. Slow-query detection

### Current activity

At audit time, no other active database query had been running for more than one second.

### Historical visibility limitation

`pg_stat_statements` is not installed, so the database cannot currently answer which normalized queries consumed the most total time, had the highest mean latency, read the most blocks, or ran most often. Therefore, this audit cannot conclude that there are no historical slow queries.

Recommended observability work:

1. Enable `pg_stat_statements` using the PostgreSQL/Railway configuration supported by the deployment.
2. Collect at least 24 hours of representative traffic, preferably including an administration session and matchmaking activity.
3. Review queries by total execution time, mean execution time, calls, rows, and shared blocks read.
4. Record when statistics are reset so comparisons use a known window.

Example analysis query after the extension is enabled:

```sql
SELECT
    queryid,
    calls,
    total_exec_time,
    mean_exec_time,
    rows,
    shared_blks_read,
    LEFT(query, 300) AS query
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 25;
```

Potential growth hotspots identified from real backend SQL:

- Queue expiry and ordering on `queue_entries.joined_at`.
- Online-user predicates on `users.last_seen`.
- Report status plus newest-first ordering.
- Administration log search uses multiple leading-wildcard `ILIKE` expressions and `details::text ILIKE`. B-tree indexes cannot accelerate those expressions. If the log table becomes large, consider `pg_trgm` GIN indexes for selected searchable text, or narrow the search contract.
- Administration list endpoints calculate totals and return a page separately. This is acceptable now; for very large tables, measure whether filtered counts become a significant cost.

## 4. Unnecessary or redundant columns

No live column can be classified as safely unnecessary based only on current values. Several `users` columns are currently all null—`last_steam_check`, `reset_token`, `reset_token_expires`, `steam_avatar`, `vip_expires_at`, `vip_method`, and `vip_since`—but each is referenced by active authentication, Steam, or VIP functionality. Empty values in a three-user database are not evidence of dead schema.

The following schema shapes deserve planned consolidation:

### `game_servers.ip` and `game_servers.ip_address`

The backend writes both columns to the same value. `ip_address` is the current public-host field; `ip` remains a compatibility field from earlier migrations. There were no live server rows and therefore no drift to detect.

Recommendation: choose `ip_address` as the canonical field, migrate every remaining reader, add a temporary consistency constraint if needed, then remove `ip` in a later reviewed migration.

### `game_servers.slots` and `game_servers.max_slots`

The backend also writes these together. `max_slots` is the current administration field, while `slots` is retained for compatibility.

Recommendation: standardize on `max_slots`, migrate readers, and remove `slots` only after a compatibility review.

### `tournaments.current_participants`

This value duplicates `COUNT(*)` from `tournament_participants`. No drift was found in the live data, and current administration paths actively resynchronize it. It still creates a long-term consistency risk because other paths increment it manually.

Recommendation: either derive the count in queries, as the administration API already does, or maintain the cached count centrally with a database trigger. Avoid multiple application code paths implementing different counter logic.

## 5. Duplicate-data checks

No duplicate groups were found for:

- Case-insensitive user email.
- Case-insensitive username.
- Undirected friendship pairs.
- Tournament participant `(tournament_id, user_id)` pairs.
- Notification `related_chat_message_id`.
- Notification `related_friendship_id`.
- Server `(ip_address, port)` pairs.

These checks cover the principal identity and relationship keys used by the current application. They do not attempt fuzzy matching of display names, free text, or semantically similar audit details.

## 6. Table statistics and maintenance observations

The main live-row estimates observed during the audit were:

| Table | Live rows | Dead rows | Sequential scans | Index scans |
|---|---:|---:|---:|---:|
| `users` | 3 | 11 | 651 | 0 |
| `notifications` | 3 | 2 | 103 | 3 |
| `chat_messages` | 4 | 0 | 0 | 20 |
| `login_history` | 5 | 0 | 0 | 7 |
| `admin_audit_logs` | 1 | 0 | 17 | 10 |
| `frames` | 1 | 0 | 23 | 1 |

These counters have no recorded manual reset timestamp. With very small tables, high sequential-scan counts and zero index scans are normal and should not be treated as proof of a missing or unused index.

`users` has a high dead-to-live tuple ratio, although the absolute count is tiny. Confirm autovacuum is enabled and inspect the table after normal activity. A manual `VACUUM (ANALYZE) users` is reasonable during an approved maintenance window if statistics remain stale, but was not run during this audit.

## 7. Prioritized optimization plan

### Now

1. Enable historical query telemetry with `pg_stat_statements`.
2. Add `idx_queue_entries_joined_at` before the queue becomes materially active.
3. Verify autovacuum/analyze behavior for `users`.
4. Keep collecting real workload data; the current database is too small for scan ratios to be diagnostic.

### After representative workload data exists

1. Remove the three redundant non-unique `users` indexes.
2. Decide whether `idx_chat_room` is redundant based on scans and query plans.
3. Simplify the overlapping notification indexes.
4. Add the reports and presence indexes only if their queries appear in the expensive-query set.
5. Add foreign-key indexes selectively based on table growth and parent-row maintenance patterns.

### Planned schema cleanup

1. Consolidate `game_servers.ip` into `ip_address`.
2. Consolidate `game_servers.slots` into `max_slots`.
3. Replace application-managed tournament participant counters with either derived counts or centralized database maintenance.

## 8. Validation queries for a future maintenance window

Before removing an index, inspect its usage over a known statistics window:

```sql
SELECT
    schemaname,
    relname,
    indexrelname,
    idx_scan,
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan, relname, indexrelname;
```

Before adding an index, compare the target query with and without the candidate in a safe environment using representative data:

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM queue_entries
ORDER BY joined_at;
```

`EXPLAIN ANALYZE` executes the statement. Use it only for safe `SELECT` statements in an appropriate environment, never casually on mutating SQL.
