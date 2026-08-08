# Sector Nine Application Performance Review

Review date: 2026-07-19  
Scope: React rendering, Express API behavior, PostgreSQL queries, chat/friend/notification polling, and matchmaking.

## Method and limitations

This is a static code and query-path review. It traces component effects and state changes through API calls into PostgreSQL. No build, development server, load test, browser profiler, database mutation, commit, or push was performed.

The application currently has no general API timing instrumentation and PostgreSQL does not have `pg_stat_statements` enabled, so this report distinguishes code-derived request/query counts from measured latency. All latency and throughput improvements should be verified with production-like data before deployment.

## Executive summary

The largest performance risks are:

1. Polling is duplicated across the application and continues at fixed rates regardless of visibility, focus, or whether data changed.
2. Active chat polling repeats three database queries every three seconds and retransmits the latest 50 messages.
3. Matchmaking polling calls a write-heavy “join” endpoint every three seconds instead of a read-only status endpoint.
4. `UserContext` recreates its provider value and functions on every render; its 15-second friend polling causes broad consumer rerenders.
5. Several endpoints issue sequential queries that can be combined or run concurrently.
6. Search and administration queries rely on leading-wildcard `ILIKE`, full counts, broad `SELECT *`, and repeated reference-data queries.
7. There is no end-to-end latency telemetry, request correlation, query timing, cache visibility, or performance budget.

The current database is very small, so these patterns will not necessarily appear slow in development. They primarily affect scaling behavior, Railway resource usage, mobile clients, and perceived latency over higher network round trips.

## Polling load estimate

For one authenticated, otherwise idle browser:

| Poller | Interval | Requests per minute |
|---|---:|---:|
| Application notifications | 7 seconds | 8.6 |
| Chat unread notifications | 7 seconds | 8.6 |
| Online friends | 15 seconds | 4.0 |
| Presence heartbeat | 90 seconds | 0.7 |
| **Idle total** | | **21.9** |

When one chat conversation is open:

| Additional work | Interval | Per minute |
|---|---:|---:|
| Conversation API requests | 3 seconds | 20 |
| Database queries per conversation request | 3 | 60 |

When matchmaking is active:

| Additional work | Interval | Per minute |
|---|---:|---:|
| Matchmaking join requests | 3 seconds | 20 |
| Typical database operations per unmatched poll | 4–5 | 80–100 |

At 1,000 simultaneously idle authenticated clients, fixed polling alone is approximately 21,900 API requests per minute, or 365 requests per second, before chat and matchmaking. This is a code-derived estimate, not a load-test result.

## 1. React rendering

### PERF-001: Broad `UserContext` invalidation

Priority: High

`UserProvider` exposes one newly created object on every render. Functions such as `refreshProfile`, `refreshOnlineFriends`, `updateProfile`, `logout`, and `adoptProfile` are also recreated. Any state update in the provider can rerender every component using the context, even if that component only consumes `user`.

The 15-second online-friends poll changes:

- `onlineFriendsLoading` to `true`.
- `onlineFriends` to a newly allocated array.
- `onlineFriendsError`.
- `onlineFriendsLoading` back to `false`.

This can create multiple provider-wide render passes per poll.

Recommendations:

- Split identity/session state from online-presence state into separate contexts or an external store with selectors.
- Wrap provider callbacks in `useCallback`.
- Memoize provider values with `useMemo`.
- Do not toggle a globally exposed loading state for silent background refreshes.
- Compare stable friend identifiers/status timestamps and skip state replacement when the response is unchanged.

### PERF-002: Chat state is monolithic

Priority: High

Every unread or conversation poll calls `setChatRooms`, maps all rooms, and creates new room objects. Even an unchanged unread response returns a new array. A changed conversation rerenders the full chat surface, including room navigation and message history.

Recommendations:

- Store room metadata and messages separately.
- Normalize rooms by ID.
- Update only the affected room.
- Skip `setState` when unread counts and IDs are unchanged.
- Extract and memoize room list rows and message rows.

### PERF-003: Conversation messages grow in browser memory

Priority: High

The backend returns the most recent 50 messages, but `mergeMessages` retains older messages already held by the client. As new messages move through the 50-message window, the browser-side array can grow for the lifetime of the page. Each poll rebuilds a `Map`, converts it to an array, parses timestamps, and sorts the entire retained history.

Recommendations:

- Keep a bounded per-room window unless the user explicitly loads older history.
- Use cursor pagination for older messages.
- Poll only messages after the latest `(created_at, id)` cursor.
- Append already ordered deltas rather than sorting the full history.

### PERF-004: Friends online-status remapping

Priority: Medium

Both `Friends` and `GlobalChat` map their full local friend array whenever `onlineFriends` changes. The online poll creates a new array every 15 seconds even if membership is identical.

Recommendations:

- Expose a memoized `Set` or status map from the presence store.
- Preserve array/object identity for unchanged status.
- Memoize individual friend rows.

### PERF-005: Friend search requests on every keystroke

Priority: High

`Friends.search` calls `/friends/search` immediately for every input change after two characters. Responses are not cancelled or ordered, so rapid typing creates overlapping queries and a slower old response may replace a newer result.

Recommendations:

- Debounce by 250–350 ms.
- Cancel superseded requests with `AbortController`.
- Associate each response with the current query before applying it.
- Cache recent exact query results briefly.

### PERF-006: Large page components and eager page imports

Priority: Medium

Large components such as `Profile`, `Admin`, `GlobalChat`, and tournament pages contain substantial state and markup. `App` imports page modules directly and switches them manually, which prevents route-level lazy loading.

Recommendations:

- Use `React.lazy`/dynamic imports at page boundaries.
- Add route-level suspense states.
- Split large pages by independently changing sections.
- Keep modal and administration management modules lazy until invoked.

This should be validated with a bundle analyzer in a separately approved build workflow.

### PERF-007: Static collections allocated during render

Priority: Low

`Lobby` recreates server, mode, and map arrays on every render; mode entries also recreate icon elements. Similar static configuration exists in several pages.

Recommendation:

- Move immutable collections outside components.
- Use memoization only where allocation or child identity is measurably relevant.

### PERF-008: Frequent animation state updates

Priority: Medium

`AnimatedBackground` runs a state-driven interval every 50 ms. If it remains mounted while other pages are active, it can cause approximately 20 React updates per second.

Recommendations:

- Use CSS animations or `requestAnimationFrame` with direct canvas/DOM rendering where appropriate.
- Pause animation when `document.hidden` is true.
- Respect `prefers-reduced-motion`.
- Avoid propagating animation state through large component subtrees.

## 2. Notification polling

### Current behavior

`App` requests the latest 50 notifications every seven seconds to compute an unread count and show friend-request toasts. The Notifications page separately requests the same endpoint on mount. Chat has another seven-second request to `/chat/unread`.

Approximate traffic from `App` alone:

- 8.6 requests per minute per authenticated browser.
- Up to 428 notification rows transferred per minute if the response remains at the 50-row limit.

### PERF-009: Full notification payload used for a count

Priority: High

The application-wide header needs an unread count and a small set of new notification events, but downloads complete notification records and joins chat/user rows every seven seconds.

Recommendations:

- Add a lightweight notification summary endpoint returning:
  - total unread count;
  - events after a cursor/version;
  - latest event cursor.
- Return `304 Not Modified` or an empty delta when nothing changed.
- Consolidate chat and friend notification delivery into the same event stream.

### PERF-010: Duplicate notification ownership

Priority: High

`App`, `GlobalChat`, and `Notifications` independently own overlapping notification data. This duplicates requests, parsing, deduplication sets, and update behavior.

Recommendations:

- Create one notification/event service or context.
- Let the header, toast system, chat badge, and Notifications page subscribe to derived slices.
- Prefer Server-Sent Events or WebSocket delivery, with a single reconnecting connection per browser.
- Keep a lower-frequency visibility-aware poll as fallback.

### PERF-011: Polling ignores page visibility and network state

Priority: Medium

Fixed intervals continue while the tab is in the background. Browser timer throttling reduces frequency unpredictably but does not provide controlled backoff.

Recommendations:

- Pause or substantially slow polls when `document.hidden`.
- Resume with one immediate delta fetch.
- Back off exponentially after failures and reset after success.
- Add jitter so clients do not synchronize requests after deploys or outages.
- Avoid starting a new request while the previous request is active.

`GlobalChat` protects its three-second conversation poll from overlap, but the application notification and online-friend pollers do not.

## 3. Chat polling and queries

### PERF-012: Three queries for every conversation poll

Priority: High

Every `GET /chat/:recipientId` performs:

1. Recipient existence lookup.
2. Accepted-friendship lookup.
3. Latest-50-message lookup.

At a three-second interval this is 60 database queries per minute for one open conversation.

Recommendations:

- Combine recipient/access validation into one query.
- Cache accepted-friendship authorization briefly, invalidated on friendship changes.
- Fetch only messages newer than the client's cursor.
- Consider SSE/WebSocket push for new messages.
- If polling remains, lengthen the interval when idle and poll immediately after send/focus.

### PERF-013: OR predicates in friendship and chat queries

Priority: Medium

Queries repeatedly use:

```sql
(user_id = $1 AND friend_id = $2)
OR (user_id = $2 AND friend_id = $1)
```

and:

```sql
(user_id = $1 AND recipient_id = $2)
OR (user_id = $2 AND recipient_id = $1)
```

Separate directional indexes can support these conditions, but the planner may use bitmap combinations and the query remains more complex than a canonical pair/room lookup.

Recommendations:

- Use the existing deterministic direct-message `room` identifier as the primary conversation key.
- Maintain a canonical friendship pair key for lookup.
- Verify plans with production-like cardinality before changing schema.

### PERF-014: Unread polling returns one row per unread message

Priority: Medium

The client usually needs counts and the newest event, but `/chat/unread` returns every unread message joined to notifications, messages, and users.

Recommendations:

- Aggregate counts by sender.
- Return only the newest unread event per sender plus a total count.
- Use a cursor for toast/event delivery.

### PERF-015: Message send repeats authorization queries

Priority: Medium

A send performs recipient lookup, friendship lookup, sender lookup, message insert, and notification insert. Correctness is more important than minimizing writes, but the initial reads can be combined.

Recommendations:

- Select the active recipient, accepted relationship, and sender projection with one statement or one transaction-scoped query.
- Preserve the message/notification transaction.
- Keep response projections narrow.

## 4. Friends polling and queries

### Current behavior

- `UserContext` polls `/friends/online` every 15 seconds.
- Opening Global Chat fetches `/friends`.
- Mounting the Friends component also fetches `/friends`.
- Friend accept/decline/cancel calls `refreshProfile`, adding a full profile read and presence write even though the action does not necessarily change profile data.

### PERF-016: Presence poll causes frequent database reads and renders

Priority: High

Every authenticated client queries joined friendship/user state four times per minute. The response is applied even when unchanged and loading state is toggled for background requests.

Recommendations:

- Use push presence with debounced transitions, or increase the fallback interval.
- Return a version/ETag and short-circuit unchanged responses.
- Do not expose background-refresh loading changes to all context consumers.
- Poll only while UI that displays presence is visible, unless global presence is a hard requirement.

### PERF-017: Duplicate full friend-list fetches

Priority: Medium

Friends and Global Chat maintain separate friend lists and fetch the same endpoint independently.

Recommendation:

- Centralize friend relationship data in one store.
- Derive the chat-compatible friend list from the shared data.
- Apply mutation responses locally rather than refreshing unrelated profile data.

### PERF-018: Two sequential queries in `/friends`

Priority: Medium

Accepted friends and pending requests are queried sequentially although they are independent.

Recommendations:

- Run them concurrently using separate pool queries, or return a tagged `UNION ALL` result if measurement justifies it.
- Keep the existing separation if concurrency would pressure a small pool under high traffic; measure both approaches.

### PERF-019: Leading-wildcard friend search

Priority: Medium

`username ILIKE '%query%'` cannot use a normal B-tree prefix efficiently. Combined with per-keystroke calls, it will scan more rows as the user table grows.

Recommendations:

- Prefer prefix search where product behavior allows.
- Otherwise add a measured `pg_trgm` GIN index on username.
- Debounce and cap query length.

## 5. Matchmaking

### PERF-020: Write-heavy polling endpoint

Priority: Critical for scale

The Lobby calls `POST /matchmaking/join` every three seconds while searching. Each unmatched poll:

1. Reads all runtime platform settings.
2. Reads Steam eligibility from `users`.
3. Reads active bans.
4. Iterates the in-process queue to remove stale entries.
5. Deletes stale rows from the entire persistent queue.
6. Upserts the caller and resets `joined_at`.
7. Copies and filters the in-memory queue looking for an opponent.

This can create 80–100 database operations per minute per searching client and produces unnecessary writes, WAL, locks, and index churn.

Recommendations:

- Separate commands from status:
  - `POST /matchmaking/join` once;
  - `GET /matchmaking/status` for read-only fallback polling;
  - `DELETE /matchmaking/leave` once.
- Prefer push delivery when a match is created.
- Do not reset `joined_at` on status checks.
- Move stale-queue cleanup to a scheduled, bounded operation rather than every caller poll.
- Cache validated platform settings in process with invalidation on administration changes.

### PERF-021: Queue exists in two unsynchronized stores

Priority: Critical for correctness and horizontal scaling

The queue is held in both an in-memory `Map` and PostgreSQL. Matching scans only the process-local `Map`; persisted rows are not rehydrated into it in the reviewed path.

Impact:

- Multiple Railway instances see different queues.
- A restart preserves rows but not the matching state that reads them.
- Database writes provide persistence cost without serving as the authoritative matching source.

Recommendations:

- Choose one authoritative queue.
- For PostgreSQL, claim opponents transactionally with row locks and `SKIP LOCKED`.
- For higher scale, use a dedicated queue/coordination store.
- Make match creation, queue removal, and notifications one transaction.

### PERF-022: Non-atomic opponent matching

Priority: High

Opponent selection, match insert, queue deletion, and notification inserts are separate pool operations. Concurrent joins can race and partial failures can leave inconsistent queue state.

Recommendation:

- Perform opponent claim and match creation in one transaction.
- Lock or atomically delete claimed queue entries before creating a match.
- Use a unique invariant preventing one user from entering multiple active matches.

### PERF-023: Linear in-memory queue scans

Priority: Medium

Every poll copies the entire `Map` to an array and filters it by game mode. Complexity is O(n) per request, making aggregate work O(n²) during synchronized polling.

Recommendations:

- Partition queues by game mode.
- Maintain FIFO ordering without copying all entries.
- Match compatible maps during opponent claim rather than after selecting the first same-mode entry.

### PERF-024: Platform settings queried repeatedly

Priority: High

`getPlatformSettings` reads PostgreSQL for every matchmaking join and other settings-dependent operations.

Recommendations:

- Cache settings in memory for a short TTL or update a shared cache when administrators save settings.
- Preserve PostgreSQL as source of truth.
- Include a settings version or `updated_at` to make invalidation reliable.

### PERF-025: Queue timestamp index

Priority: High

The queue expiry delete and administration ordering use `queue_entries.joined_at`, but the live database audit found no index on that column.

Recommended candidate:

```sql
CREATE INDEX CONCURRENTLY idx_queue_entries_joined_at
    ON queue_entries (joined_at);
```

Validate with representative data before production creation.

## 6. Database query review

### Positive findings

- Most lookup values are parameterized.
- Chat history is limited to the newest 50 messages.
- Notifications are limited to 50.
- Leaderboards and ladder entries are limited to 100.
- Many independent administration dashboard counts run in one SQL statement.
- Administration writes generally use transactions.
- Key relationship tables have uniqueness constraints and several supporting indexes.

### PERF-026: Broad `SELECT *`

Priority: Medium

Multiple endpoints fetch entire rows even when only a small projection is needed. This increases database-to-Node transfer, object creation, and accidental coupling to wide columns such as JSON, arrays, avatar data, password hashes, or reset fields.

Recommendations:

- Use endpoint-specific column lists.
- Never select large custom-avatar data for responses that only need identity.
- Keep administration list and detail projections separate.

### PERF-027: Repeated full counts and offset pagination

Priority: Medium

Administration lists often run a filtered row query plus `COUNT(*)`, and use `LIMIT/OFFSET`. Large offsets still scan/discard preceding rows, and exact counts can dominate filtered queries.

Recommendations:

- Use keyset pagination for large, append-oriented tables such as audit logs.
- Cache or defer counts when an exact number is not required.
- Retain offset pagination for small administration datasets until measurement shows a problem.

### PERF-028: Administration text search

Priority: Medium

Audit and ban searches use multiple leading-wildcard `ILIKE` predicates; audit search also casts JSON details to text. These will become scan-heavy.

Recommendations:

- Add `pg_trgm` indexes only for fields proven hot by query telemetry.
- Avoid searching full JSON text by default.
- Separate exact action/admin/date filters from optional free-text search.

### PERF-029: Missing composite and foreign-key indexes

Priority: Medium

The database audit identified:

- Missing `queue_entries(joined_at)`.
- A likely future need for `reports(status, created_at DESC)`.
- A possible partial `users(last_seen DESC)` index for visible active users.
- Eight foreign keys without left-prefix supporting indexes.

Avoid adding every index immediately. The database is currently approximately 11 MB, and additional indexes add write cost. Enable query telemetry and prioritize measured paths.

### PERF-030: Dead tuples and statistics

Priority: Low at current size

The live audit observed 11 estimated dead `users` rows versus 3 live rows. The absolute count is negligible, but it reinforces the need to verify autovacuum/analyze behavior before using planner statistics to diagnose performance.

## 7. API latency

### Current visibility

Only the administration system endpoint measures a simple elapsed time around a database health query. There is no general:

- Request-duration histogram.
- Route/status latency breakdown.
- PostgreSQL query-duration histogram.
- External Steam-call timing.
- Pool wait-time metric.
- Payload-size metric.
- Trace or correlation ID.

### PERF-031: No latency observability

Priority: High

Without percentile data, optimizations cannot be prioritized reliably and regressions cannot be distinguished from network/provider variance.

Recommendations:

- Record API latency by normalized route, method, and status.
- Track p50, p95, and p99 rather than averages alone.
- Measure database query duration by stable operation name, never raw parameter values.
- Track connection-pool active, idle, waiting, timeout, and error counts.
- Time Steam OpenID and Web API calls separately.
- Add response byte counts and request cancellation metrics.
- Propagate a correlation ID from API request to structured logs.

Suggested initial service-level objectives:

| Operation | Initial target |
|---|---:|
| Cached/simple API read p95 | under 150 ms |
| Normal PostgreSQL-backed API read p95 | under 300 ms |
| Administration list p95 | under 500 ms |
| Chat send acknowledgement p95 | under 300 ms |
| Matchmaking join/status p95 | under 300 ms |
| Steam external verification | tracked separately; explicit timeout |

Targets should be adjusted after observing Railway region and real-user network data.

### PERF-032: No HTTP caching or compression policy in Express

Priority: Medium

No explicit compression, ETag strategy, cache headers, or immutable asset policy was found in the API server.

Recommendations:

- Enable response compression for sufficiently large JSON payloads at Express or the reverse proxy.
- Use ETags/version cursors for friend, notification, catalog, settings, and tournament reads.
- Cache public, slowly changing endpoints with conservative `Cache-Control`.
- Never cache private authenticated responses in shared caches.

### PERF-033: External Steam requests lack explicit timeouts

Priority: High

Steam profile, ownership, and ban requests are parallelized, which is good, but do not use an abort timeout. A slow upstream can hold API work and pool-independent Node resources indefinitely.

Recommendations:

- Add `AbortSignal.timeout` or an `AbortController`.
- Use a bounded total deadline.
- Retry only safe transient failures with jitter.
- Keep the existing 24-hour cache and expose cache hit/miss metrics.

## 8. Prioritized improvement plan

### Phase 1: Measure and remove duplicated work

1. Add API, query, pool, external-call, and payload telemetry.
2. Centralize notifications and chat unread events.
3. Debounce/cancel friend search.
4. Stabilize `UserContext` values and split presence from identity state.
5. Pause/background-throttle polling and add backoff/jitter.

### Phase 2: Fix high-amplification endpoints

1. Split matchmaking join from status.
2. Make PostgreSQL or a dedicated coordination layer the authoritative queue.
3. Make match creation atomic.
4. Replace full chat-window polling with cursor deltas.
5. Combine chat authorization reads.
6. Add `queue_entries(joined_at)` after plan verification.

### Phase 3: Introduce push delivery

1. Use one authenticated SSE or WebSocket connection for:
   - notification count/events;
   - chat messages and unread changes;
   - friend presence;
   - matchmaking completion.
2. Keep visibility-aware, low-frequency polling as recovery fallback.
3. Add reconnect backoff, cursor replay, and idempotent event IDs.

### Phase 4: Database and frontend refinement

1. Enable `pg_stat_statements` and review top queries after representative traffic.
2. Add only measured composite/trigram/foreign-key indexes.
3. Introduce keyset pagination for growing administration tables.
4. Add route-level lazy loading and profile React commits with the DevTools Profiler.
5. Set bundle, render, API, and query performance budgets in CI.

## Verification plan

The following should be performed only in a separately approved testing workflow:

1. Capture React Profiler commits for login, header polling, chat open/send, Friends search, and Administration navigation.
2. Record a browser network trace for five idle minutes, five chat minutes, and five matchmaking minutes.
3. Load test polling and matchmaking at 100, 500, and 1,000 concurrent clients.
4. Inspect `EXPLAIN (ANALYZE, BUFFERS)` for chat history, unread notifications, online friends, queue expiry, reports, and audit search using production-like data.
5. Compare API p50/p95/p99, query counts, bytes transferred, React commits, database CPU, WAL, and pool waits before and after each change.

`EXPLAIN ANALYZE` executes its statement. Use it only for safe reads in an appropriate environment.

## Final assessment

The application is likely responsive with its current tiny dataset, but the architecture performs much more repeated work than user activity requires. The most valuable improvement is to replace independent fixed polling loops with a single event-delivery layer and cursor-based fallback. Matchmaking should be addressed next because its polling path performs repeated writes and depends on process-local state, creating both performance and scaling correctness problems.

No application functionality was changed during this review.
