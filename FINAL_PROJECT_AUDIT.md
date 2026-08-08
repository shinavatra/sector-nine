# Sector Nine Final Project Audit

> Historical snapshot from 2026-07-19. Many findings were resolved afterward; use `PRODUCTION_CHECKLIST.md` and `RELEASE_STATUS_2026-07-22.md` for current release decisions.

Audit date: 2026-07-19  
Scope: React frontend, Express backend, PostgreSQL schema and migrations, Steam,
friends, chat, notifications, store, VIP, badges, frames, servers, matchmaking,
administration, and deployment.

## Audit method and limitations

This was a static, repository-wide audit. Application code, SQL migrations,
configuration, and the existing focused audit reports were inspected. No build,
server, migration, backup, database mutation, commit, or push was performed.

The findings distinguish between:

- **Confirmed**: directly demonstrated by the current source.
- **Schema risk**: the ordered repository migrations contain the referenced
  columns, but the deployed Railway schema cannot be confirmed from static files.
- **Operational risk**: requires production traffic, infrastructure, or live
  PostgreSQL evidence to quantify.

No column referenced by the reviewed application code is conclusively absent
from the complete ordered migration set through `017`. That does **not** prove
the Railway database has every column: the repository has no migration ledger or
complete migration runner, and prior project history records live-schema drift.

## Executive assessment

Sector Nine is not production-ready. Core account, profile, friend, direct-chat,
notification, administration, and PostgreSQL paths are substantially implemented,
but security and state-integrity blockers remain in Steam verification, VIP
payments, moderation enforcement, matchmaking, tournament registration, and
deployment.

The most important architectural inconsistency is that PostgreSQL is presented
as the source of truth while several user-facing flows still use static arrays,
browser simulation, or in-memory state. Administration can update PostgreSQL
successfully without those changes necessarily appearing in the public product.

### Severity summary

| Severity | Count | Release effect |
|---|---:|---|
| Critical | 4 | Block production deployment |
| High | 12 | Resolve before a public beta |
| Medium | 17 | Resolve during stabilization |
| Low | 10 | Cleanup and consistency work |

## Critical issues

### FIN-001 — Steam ownership can be assigned without proving account ownership

**Areas:** Steam, authentication, matchmaking  
**Status:** Confirmed

`POST /steam/verify-game` accepts a caller-provided `steamId`, fetches that
profile's ownership and ban data, and writes it to the authenticated user's row.
Unlike `/steam/auth`, this route does not validate a signed Steam OpenID response.
A user can therefore submit another person's 17-digit Steam ID and inherit that
account's `owns_hl1`, ban, and verification result.

Evidence:

- `src/server/index.ts:1606-1646`
- `src/utils/steamAuth.tsx` calls the verification API using a supplied Steam ID.
- `src/pages/SteamGameVerification.tsx:48-56` verifies the currently stored ID,
  but the backend contract remains independently exploitable.

Impact:

- Steam ownership proof is bypassable.
- Steam-linked identity can be overwritten.
- Matchmaking eligibility can be obtained from somebody else's Steam account.
- A unique `steam_id` collision can also cause confusing server errors.

Required correction:

1. Never accept a different Steam ID in `/steam/verify-game`.
2. Read the linked Steam ID from the authenticated database row only.
3. Permit initial linking and relinking only through signed OpenID verification.
4. Add tests for arbitrary-ID submission, relinking, collision, and stale-cache
   refresh behavior.

### FIN-002 — Money-based VIP is granted without payment verification

**Areas:** VIP, store, backend, deployment  
**Status:** Confirmed

`POST /user/vip/purchase` accepts an arbitrary `method`. Points are deducted only
when the value equals `points`; any other value, including `payment`, grants VIP
without payment-provider proof. The frontend explicitly sends `payment` after an
artificial delay.

Evidence:

- `src/server/index.ts:472-490`
- `src/pages/VIPSubscription.tsx:154-203`
- `src/pages/VIPSubscription.tsx:425-456` collects card number, expiry, and CVV
  in the application UI without an integrated processor.

Impact:

- Anyone with an authenticated account can activate VIP for free.
- The UI handles sensitive card data without a PCI-compliant hosted payment flow.
- There is no signed webhook, transaction ID, idempotency protection, or
  fulfillment ledger.

Required correction:

- Disable money activation and remove raw card inputs immediately.
- Grant paid VIP only from a verified, idempotent server-side payment webhook.
- Keep points purchases as a separate, enumerated backend operation.

### FIN-003 — Permanent platform bans are not enforced

**Areas:** bans, matchmaking, permissions  
**Status:** Confirmed

Administration represents a permanent ban with `expires_at IS NULL`, but both the
matchmaking ban check and `/ban/status` require `expires_at > NOW()`. Permanent
bans therefore do not block matchmaking and are reported to the client as
inactive.

Evidence:

- `src/server/index.ts:694-705`
- `src/server/index.ts:1325-1341`
- Administration correctly uses `(expires_at IS NULL OR expires_at > NOW())` in
  `src/server/admin.ts:46`, `:62`, and `:85`.

Impact:

- The strongest moderation action is ineffective in the primary gameplay flow.
- The admin dashboard and the user-facing ban state can disagree.

Required correction:

- Centralize one active-ban predicate:
  `is_active AND (expires_at IS NULL OR expires_at > NOW())`.
- Apply it in authentication-sensitive and matchmaking routes.
- Add permanent, temporary, expired, lifted, and overlapping-ban tests.

### FIN-004 — Administrative mutes do not restrict chat

**Areas:** reports, bans/mutes, chat, permissions  
**Status:** Confirmed

Admins can create `user_mutes` records through report actions and user actions,
and the dashboard counts active mutes. The chat send endpoint never reads
`user_mutes`, so a muted user can continue messaging.

Evidence:

- Mute creation: `src/server/admin.ts:118` and `:164`
- Chat send: `src/server/index.ts:1047-1087`
- No `user_mutes` check exists in the non-admin backend.

Impact:

- A visible moderation control has no enforcement effect.
- Report resolution can claim action was taken while abusive messaging continues.

Required correction:

- Enforce active permanent and temporary mutes before every message write.
- Return a stable `MUTED` error with reason and expiration.
- Define whether mutes apply only to direct messages or future global channels.

## High priority

### FIN-101 — Deactivated users retain valid sessions

**Areas:** authentication, permissions, admin  
**Status:** Confirmed

`requireAuth` validates only the JWT signature and expiry; it does not check that
the user still exists or that `deleted_at IS NULL`. Deactivation consequently
does not revoke an existing seven-day token. Some downstream routes happen to
filter deleted users, while others update by ID without that condition.

Evidence: `src/server/index.ts:54-68`.

Recommendation: introduce a session/user-status check, a token/session version,
and explicit revocation on password reset, deactivation, permanent deletion, and
security-sensitive Steam changes.

### FIN-102 — Matchmaking has two unsynchronized queue authorities

**Areas:** matchmaking, database, deployment  
**Status:** Confirmed

Queue entries are written to PostgreSQL but opponent selection reads only the
process-local `Map`. PostgreSQL entries are not rehydrated after restart.
Multiple backend replicas have independent maps, so users on different instances
cannot match even though administration sees them in the shared queue.

Evidence: `src/server/index.ts:637-753`.

Recommendation: make PostgreSQL the only queue authority and perform opponent
claiming in a transaction using row locks or `SKIP LOCKED`.

### FIN-103 — Opponent matching can create duplicate matches

**Areas:** matchmaking, database integrity  
**Status:** Confirmed

Join, opponent selection, match insertion, queue deletion, and notification
creation are not one transaction. Concurrent joins can select the same opponent
before either request removes it. A failure after match insertion can also leave
the queue and notifications inconsistent.

Evidence: `src/server/index.ts:710-747`.

Recommendation: atomically claim two queue rows, create the match, remove both
entries, and create notifications in one database transaction. Add a database
invariant preventing more than one active match per player.

### FIN-104 — Storefront catalog is static while administration edits PostgreSQL

**Areas:** store, badges, frames, admin, frontend  
**Status:** Confirmed

The public Store imports `avatarBadges` and `profileFrames` from
`src/utils/badgeData.tsx`. It does not load `/badges` or `/frames`. Admin catalog
create/edit/delete/featured/hidden actions update PostgreSQL, but those changes do
not change the public catalog without a code edit and reload.

Evidence:

- `src/pages/Store.tsx:1-18`
- `src/utils/badgeData.tsx`
- Database catalog endpoints: `src/server/index.ts:511-527`
- Admin catalog endpoints: `src/server/admin.ts:172-174`

Recommendation: fetch the database catalog, map one shared DTO, and use the
static definitions only as seed migration data—not runtime product data.

### FIN-105 — VIP expiration is stored but not enforced consistently

**Areas:** VIP, store, tournaments  
**Status:** Confirmed

Public access checks rely on `users.is_premium`. They do not require
`vip_expires_at IS NULL OR vip_expires_at > NOW()`. Expired accounts can retain
VIP catalog and tournament access until another process clears the flag, but no
such process exists in the repository.

Evidence:

- Profile mapping: `src/server/index.ts:93`
- Store purchase checks: `src/server/index.ts:535-556`
- Tournament registration: `src/server/index.ts:915`
- Only the admin dashboard applies expiration semantics:
  `src/server/admin.ts:64`.

Recommendation: centralize active-VIP semantics and return an `isPremium` value
derived from both fields. Decide whether expiration revokes equipped VIP items.

### FIN-106 — Tournament registration is non-atomic and under-validated

**Areas:** tournaments, database  
**Status:** Confirmed

Capacity check, duplicate check, participant insert, and participant-counter
increment are separate queries without locking. Concurrent registrations can
overfill a tournament or drift `current_participants`. Registration status,
deadline, start/end state, Steam eligibility, bans, and entry-fee deduction are
not enforced.

Evidence: `src/server/index.ts:904-931`.

Recommendation: register in one transaction with a locked tournament row,
unique participant constraint, derived participant count, explicit registration
state/deadline checks, and atomic points deduction where required.

### FIN-107 — Password reset is incomplete

**Areas:** authentication, deployment  
**Status:** Confirmed

Reset tokens are created, but no email provider sends the link. The backend logs
that delivery is not configured, leaving the feature unusable outside direct
database/log-assisted testing.

Evidence: `src/server/index.ts:218-234`.

Recommendation: add email delivery, single-use hashed tokens, rate limits,
generic responses, expiry tests, and token/session invalidation after reset.

### FIN-108 — No complete migration runner or migration history

**Areas:** migrations, PostgreSQL, Railway  
**Status:** Confirmed

`npm run db:setup` applies only `001_schema.sql`. There is no
`schema_migrations` ledger, checksum validation, transactional ordered runner, or
deployment gate. Two files use migration number `016`, one of which is a
read-only verification script.

Evidence:

- `package.json:76`
- `src/server/001_schema.sql` through `017_tournament_administration.sql`
- `src/server/016_schema_consistency_and_notifications.sql`
- `src/server/016_schema_consistency_verification.sql`

Recommendation: create a deterministic runner with unique versions, checksums,
history, failure recovery, and a read-only verification phase.

### FIN-109 — Production deployment topology is undefined

**Areas:** deployment, Railway  
**Status:** Confirmed

No `Dockerfile`, `Procfile`, `railway.json`, `railway.toml`, `nixpacks.toml`, or
equivalent service definition exists. Express does not serve the Vite `build`
directory, and no static host configuration provides SPA fallback.

Recommendation: define separate frontend/backend services or a reviewed combined
image, health checks, SPA rewrites, migration release command, HTTPS origins,
service-to-service variables, and rollback procedure.

### FIN-110 — RCON passwords are plaintext at rest

**Areas:** servers, security, database  
**Status:** Confirmed

The admin read contract correctly returns only `has_rcon`, never the password,
but server updates write the RCON password directly to `game_servers.rcon_password`.

Evidence: `src/server/admin.ts:128-140` and
`src/server/015_permanent_user_delete_and_rcon.sql`.

Recommendation: encrypt RCON secrets with a versioned server-side key, exclude
them from logs/backups where appropriate, and implement audited rotation.

### FIN-111 — Server hosting is a password-logging simulation

**Areas:** servers, frontend, deployment  
**Status:** Confirmed

`ServerHosting` has no backend workflow. Submitting logs the entire form,
including the server password, to the browser console.

Evidence: `src/pages/ServerHosting.tsx:57-76`.

Recommendation: remove or feature-flag the page until provisioning exists, and
rotate any real password used during testing.

### FIN-112 — Match result trust model is incomplete

**Areas:** matches, statistics, permissions  
**Status:** Confirmed

Either participant can submit the final result once, immediately completing the
match and updating both players. There is no opponent confirmation, server/RCON
attestation, dispute state, or signed result source. Scores are range-checked,
but consistency with the declared winner is not enforced.

Evidence: `src/server/index.ts:779-859`.

Recommendation: define an authoritative result source, require score/winner
consistency, preserve raw evidence, and make result processing idempotent.

## Medium priority

### FIN-201 — Authentication lacks abuse controls

No route-level rate limiting, login throttling, reset throttling, or credential
stuffing defense is present. Add per-IP and per-account limits with proxy-aware
client IP configuration.

### FIN-202 — Steam requests have no explicit timeout

Steam Web API and OpenID `fetch` calls can wait indefinitely at the application
layer. Add abort timeouts, bounded retries for safe reads, and stable upstream
error mapping. Evidence: `src/server/index.ts:1407-1470` and `:1520-1538`.

### FIN-203 — Steam OpenID flow lacks application state binding

The signed OpenID assertion is verified, but the application does not bind the
login attempt to a short-lived state/nonce created before redirect. Add a
server-managed one-time state record to reduce login CSRF/session-confusion risk.

### FIN-204 — Match details are readable by any authenticated user

`GET /match/:id` returns the full match row without checking participant or admin
membership. Restrict non-public fields or explicitly define matches as public.
Evidence: `src/server/index.ts:769-777`.

### FIN-205 — Report creation lacks validation

`POST /report` does not validate the target ID, prevent self-reporting, confirm
the target exists, constrain reason categories, bound description length, or
rate-limit repeated reports. Evidence: `src/server/index.ts:1312-1323`.

### FIN-206 — Notification preferences do not control delivery

Preferences are persisted on the profile, but notification insert paths for
friends, messages, matchmaking, moderation, and tournaments do not consult them.
The settings currently affect stored configuration, not notification creation.

Recommendation: define mandatory security/moderation notices separately from
optional categories and enforce preferences at creation or delivery.

### FIN-207 — Notifications have no cursor pagination or retention

The endpoint always returns the newest 50 rows, while the header polls the full
payload every seven seconds. Older unread records can become unreachable, and
the table can grow indefinitely. Evidence: `src/server/index.ts:1260-1284` and
`src/App.tsx:88`.

### FIN-208 — Chat deletion response can claim success for no deletion

The route ignores `rowCount` and returns `{ok:true}` even when the message does
not exist or belongs to another user. The unused `:room` parameter also implies
validation that never occurs. Evidence: `src/server/index.ts:1111-1119`.

### FIN-209 — Active mutes and bans are not centralized

Admin, dashboard, ban status, matchmaking, and future chat enforcement use or
would use separate SQL fragments. Existing permanent-ban divergence proves the
risk. Centralize these predicates in shared query helpers or database views.

### FIN-210 — Level and experience can diverge

Match completion increments experience but does not recalculate `level`.
Administration can edit experience and level independently. There is no database
constraint or central progression function tying them together.

Evidence: `src/server/index.ts:822-852` and `src/server/admin.ts:98-107`.

### FIN-211 — Map selection and banning simulate the opponent

The UI uses random timers and hardcoded default player identities rather than
shared match state. It can display progress and transition independently of the
real opponent.

Evidence:

- `src/pages/MapSelection.tsx:41-109`
- `src/pages/MapBanning.tsx:48-110`
- `src/components/GameQueue.tsx`

Recommendation: persist selection/ban turns server-side with deadlines and
participant authorization.

### FIN-212 — Several visible features remain placeholders

Confirmed unfinished UI includes:

- server hosting submission;
- support links and ticket submission;
- profile activity tracking;
- dedicated server selection messaging;
- simulated matchmaking/map flows.

Evidence: `src/components/GameQueue.tsx`, `src/pages/Support.tsx:158-261`,
`src/pages/Profile.tsx:645`, and `src/pages/Lobby.tsx:278`.

### FIN-213 — CORS is unrestricted

The API allows every origin and broad methods. Bearer-token use reduces classic
cookie CSRF exposure, but unrestricted origin access remains inappropriate for a
production identity and administration API. Evidence: `src/server/index.ts:45`.

### FIN-214 — Error contracts and status codes remain inconsistent

Some handlers use `{error}`, some include `code`, and some return `{ok:true}`.
Database error messages are often returned directly. Duplicate conflicts
sometimes use `400` and sometimes `409`; successful creation is not consistently
`201`.

Recommendation: define a single success/error envelope and centralized error
mapping without exposing PostgreSQL or upstream internals.

### FIN-215 — API origin configuration is duplicated

`src/utils/api.tsx`, `src/utils/adminApi.ts`, `ActiveMatches`, `Leaderboard`, and
`MatchHistory` independently resolve `VITE_API_URL` and fall back to localhost.
Production can partially point at the wrong backend.

### FIN-216 — Polling load and duplicate ownership remain high

Notifications poll every 7 seconds, chat unread every 7 seconds, active
conversation every 3 seconds, presence every 15/90 seconds, and active matches
every 15 seconds. Pollers do not consistently pause for page visibility or
offline state.

Recommendation: consolidate ownership, add visibility/network backoff, introduce
count/cursor endpoints, and later move time-sensitive events to SSE or WebSocket.

### FIN-217 — Database indexes do not fully match active queries

High-confidence missing index:

```sql
CREATE INDEX CONCURRENTLY idx_queue_entries_joined_at
ON queue_entries (joined_at);
```

Candidates after workload measurement:

- `reports (status, created_at DESC)`;
- partial `users (last_seen DESC)` for active visible users;
- supporting indexes on selected foreign keys, especially
  `notifications.related_user_id`, `matches.winner_id`, and `reports.match_id`.

Existing redundant candidates include `idx_users_email`, `idx_users_username`,
and `idx_users_steam_id`, which overlap unique constraints. Confirm usage before
removal. See `DATABASE_REPORT.md` for the live audit evidence previously
captured.

## Low priority

### FIN-301 — Planned product components remain disconnected

Static reference inspection found no runtime imports for at least:

- `src/components/BanSystem.tsx`
- `src/components/GameQueue.tsx`
- `src/components/Leaderboard.tsx`
- `src/components/MatchHistory.tsx`
- `src/components/Settings.tsx`

These files are intentionally preserved product work, not dead code. Keep
unfinished components disconnected or behind explicit feature flags. Activation
requirements and duplication risks are documented in `FINAL_REPORT.md`.

### FIN-302 — Debug logging remains in production paths

`src/utils/steamDebug.tsx` contains extensive browser diagnostics and is imported
by Steam auth utilities. Store and Server Hosting log runtime activity.
Backend logging is unstructured.

### FIN-303 — Mojibake is present in source and command output strings

Several comments, symbols, emojis, and UI strings are stored or rendered as
mis-decoded text (for example `â€”`, `â€¦`, and corrupted emoji sequences).
This is visible in `package.json`, `badgeData.tsx`, admin UI strings, and multiple
pages. Standardize repository encoding as UTF-8 and repair user-visible content.

### FIN-304 — API naming is inconsistent

Routes mix singular and plural forms:

- `/match/:id` versus `/matches/history`;
- `/tournament/:id/register` versus `/tournaments/:id`;
- `/report` versus `/admin/reports`.

Adopt a versioned plural-resource convention for future endpoints without
silently breaking existing clients.

### FIN-305 — Compatibility columns remain duplicated

`game_servers.ip`/`ip_address` and `slots`/`max_slots` are written together.
`tournaments.current_participants` duplicates participant rows. These are not
safe to remove immediately, but they should be consolidated after deployment
schema reconciliation.

### FIN-306 — Broad `SELECT *` contracts create schema coupling

Authentication, profile, tournaments, matches, catalog, and administration still
use broad row selection in places. Explicit columns reduce accidental exposure
and response drift.

### FIN-307 — Public profile visibility is not enforced

`profile_visibility` is editable, but `GET /users/:userId/profile` returns the
same public profile regardless of `public`, `friends`, or `private`. Online
visibility is handled separately. Evidence: `src/server/index.ts:589`.

### FIN-308 — Search is unbounded or expensive in several paths

Leading-wildcard `ILIKE` is used for friends and administration, and audit-log
search includes `details::text`. This is acceptable at the current small scale
but needs minimum query length, rate limits, and measured trigram indexing later.

### FIN-309 — Health endpoint does not test PostgreSQL

`GET /health` returns `{db:'postgresql'}` without executing a query, so it can
report healthy while the database is unavailable. Evidence:
`src/server/index.ts:152`.

### FIN-310 — Automated tests and CI gates are absent

No unit, integration, migration, API-contract, or end-to-end test scripts are
defined. There is no checked-in CI workflow. High-risk transaction and
permission behavior currently depends on manual testing.

## Technical debt

### Frontend architecture

- `App.tsx` uses a custom page-state router and eagerly imports nearly every page.
- Large components such as `Profile`, `Admin`, and `GlobalChat` combine data,
  orchestration, and presentation responsibilities.
- `UserContext` is broad; routine profile/presence changes can invalidate many
  consumers.
- Catalog and map metadata have multiple sources of truth.
- Some admin optimistic updates are carefully implemented, but non-admin flows
  frequently refetch whole profiles or full collections.

### Backend architecture

- `src/server/index.ts` is a monolithic route file covering unrelated domains.
- Validation is handwritten and inconsistent instead of schema-driven.
- Authorization rules are embedded per route.
- Active-ban, active-mute, active-VIP, presence, and user-status semantics are
  not centralized.
- There is no request ID, structured logger, latency instrumentation, or global
  error boundary.
- External calls lack a consistent timeout/retry policy.

### Database and migrations

- No migration ledger, checksum, or release command.
- Migration numbering is not unique.
- Compatibility columns and cached counters permit drift.
- Important active-state rules live only in application SQL fragments.
- Historical slow-query telemetry is unavailable without
  `pg_stat_statements`.
- RCON encryption and secret-rotation metadata are absent.

### Security and operations

- JWTs live in browser storage, increasing the impact of any XSS.
- There is no CSP, comprehensive security-header policy, or origin allowlist.
- There is no rate limiting or session revocation.
- Production environment validation covers JWT only.
- Secrets, service origins, logging, monitoring, and deployment contracts are
  incomplete.

## Area-by-area disposition

| Area | Current disposition | Main remaining work |
|---|---|---|
| Frontend | Functional shell with unfinished flows | Replace simulations, DB-drive catalog, reduce duplicate polling |
| Backend | Broad API coverage | Central validation, permissions, transactions, error contracts |
| Database | Substantial schema and repair migrations | Reliable runner, indexes, invariants, live reconciliation |
| Steam | Signed OpenID path exists | Close verify-game identity bypass; add state and timeouts |
| Friends | Core request lifecycle works | Rate limits, block/privacy semantics, query optimization |
| Chat | Direct friend chat works | Enforce mutes, delivery model, pagination, deletion truthfulness |
| Notifications | PostgreSQL-backed and polled | Enforce preferences, cursor/count APIs, retention/push |
| Store | Purchases hit PostgreSQL | Public catalog must read PostgreSQL |
| VIP | Points activation exists | Disable fake payment and enforce expiration |
| Badges | Purchase/equip/admin CRUD exists | Unify DTO/catalog source and expired-VIP policy |
| Frames | Purchase/equip/admin CRUD exists | Same as badges; consolidate seed/runtime data |
| Servers | Admin CRUD and safe RCON reads exist | Encrypt RCON; implement or hide hosting |
| Matchmaking | Basic match creation exists | Single DB queue authority and atomic claims |
| Admin panel | Extensive CRUD and auditing exist | Close semantic gaps; test every permission/action |
| Migrations | 001–017 files exist | Unique ordered runner, ledger, checksum, Railway reconciliation |
| Deployment | Documentation exists | Add executable topology, release phase, health and rollback |

## Recommended next milestones

### Milestone 1 — Security release blockers

1. Close the Steam verification identity bypass.
2. Disable money VIP and remove raw card inputs.
3. Enforce permanent bans and all active mutes.
4. Reject deactivated users in authentication middleware.
5. Add rate limits, origin allowlisting, security headers, Steam timeouts, and
   session revocation.

Exit criterion: adversarial API tests prove that identity, entitlement,
moderation, and account-status controls cannot be bypassed.

### Milestone 2 — Transactional game integrity

1. Move matchmaking entirely to PostgreSQL.
2. Atomically claim opponents and create matches.
3. Define an authoritative match-result protocol.
4. Make tournament registration atomic.
5. Add database invariants for active matches, participant uniqueness, and
   capacity-sensitive writes.

Exit criterion: concurrency tests cannot create duplicate matches, overfilled
tournaments, duplicate rewards, or drifted counters.

### Milestone 3 — One source of truth for product data

1. Make Store read badges and frames from PostgreSQL.
2. Centralize active VIP, ban, mute, presence, and profile-visibility semantics.
3. Replace simulated map selection/banning with server state.
4. Hide unfinished hosting/support/payment controls behind explicit feature
   flags until complete.

Exit criterion: every admin mutation is reflected in the user UI without reload
and no production-facing control simulates success.

### Milestone 4 — Migration and deployment reliability

1. Introduce a migration ledger and ordered checksum runner.
2. Reconcile Railway with all repository migrations read-only before change.
3. Add the high-confidence queue index and measure other candidates.
4. Define frontend/backend Railway services, migration release phase, real DB
   health check, SPA fallback, monitoring, and rollback.
5. Exercise documented backup and restore in an isolated non-production
   database.

Exit criterion: a clean database can be created, migrated, verified, deployed,
backed up, restored, and rolled back from documented commands.

### Milestone 5 — Product stabilization

1. Add API integration tests for auth, Steam, friends, chat, moderation, store,
   matches, tournaments, and every admin mutation.
2. Add frontend tests for routing, modal behavior, optimistic updates, and
   permission failures.
3. Consolidate polling and add visibility/offline backoff, then introduce
   SSE/WebSocket delivery where justified.
4. Remove dead components, diagnostics, mojibake, stale comments, and duplicate
   API-origin logic.
5. Capture API latency and `pg_stat_statements` under representative load.

Exit criterion: CI enforces type checking, tests, migration verification,
security checks, and deployment configuration before release.

## Final recommendation

Do not expose Sector Nine to public production traffic yet. The correct next
step is not broad cosmetic cleanup; it is a short security milestone followed by
transactional matchmaking/tournament work and a reproducible migration/deployment
pipeline. Once those are complete, the existing admin and community foundations
are strong enough for a controlled beta.
