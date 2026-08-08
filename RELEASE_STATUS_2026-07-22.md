# Sector Nine Release Status

Date: 2026-07-22

## Local follow-up verified 2026-07-24

- Frontend and backend production builds pass after the follow-up fixes.
- Dependency audit still reports zero known vulnerabilities.
- Permanent bans are enforced by matchmaking and ban status, including
  `expires_at IS NULL`; permanent status is also displayed correctly in Lobby.
- Active administrative mutes reject direct chat with `403 USER_MUTED`.
- Deleting a missing or non-owned chat message returns
  `404 CHAT_MESSAGE_NOT_FOUND`.
- Match server assignment remains pending until RCON successfully starts the
  selected map. Player-reported completion releases the assigned server.
- RCON AES-256-GCM encryption/decryption and GoldSrc status parsing passed a
  local unit smoke test.
- An isolated two-user runtime test passed permanent-ban, mute, chat-delete,
  and CS queue-gate behavior. All temporary rows were removed.
- Migration `039_disable_unimplemented_team_matchmaking.sql` disables the
  placeholder CS 1.6, L4D2, and CoD4 queues. The local database now has only
  HL1 matchmaking enabled.
- Local HLDS operation is documented in `README.md`; a live allocation and
  `changelevel` test remains pending until HLDS is running.

## Locally verified

- Frontend production build passes (`npm run build`).
- Backend TypeScript build passes (`npm run build:server`).
- Dependency audit reports zero known vulnerabilities (`npm audit --audit-level=low`).
- `git diff --check` passes; Git only reports expected CRLF conversion notices.
- Local migrations through `038_password_reset_token_hashes.sql` are applied.
- Authenticated desktop route smoke tests pass for Profile, Configuration, Store, Stats, Tournaments, Notifications, and Admin.
- Mobile checks at 390x844 pass for Hub, Profile, Configuration, Store, Stats, Tournaments, Notifications, and Admin with no horizontal document overflow or unnamed visible controls.
- Profile visibility runtime tests pass for public, friends, and private access. Temporary test users were removed.
- CORS allowlisting, Helmet headers, rate limit middleware, production JWT checks, Steam ownership proof, write-only encrypted RCON storage, and API input validation are present.
- Separate liveness and database-backed readiness endpoints pass in an isolated runtime; SIGTERM/SIGINT shutdown stops the RCON monitor, drains the HTTP server, and closes PostgreSQL.
- Notification read-all, unread synchronization, live polling, friend-request cleanup, and empty state are PostgreSQL-backed.
- Matchmaking requires a verified supported Steam game and implements 5+5 map selection followed by alternating veto to one map.
- Store catalog, purchase history, profile frames, news/comments, community activity, seasons, tournaments, rating history, match timeline/replays, and game-server telemetry are PostgreSQL-backed.
- Support ticket submission, personal history, admin queue, audited status changes, and admin responses are PostgreSQL-backed and passed full user/admin runtime verification.
- Player blocks are PostgreSQL-backed across devices and prevent regular matchmaking in either direction; block, list, unblock, blocked pairing, and post-unblock pairing passed a two-user runtime test.
- Legacy simulated map-selection and map-veto routes now resolve to the canonical backend-driven Lobby workflow.
- Disconnected random-opponent `MapSelection`/`MapBanning` prototypes and the localStorage-only `BanSystem` prototype were removed from the repository.
- Production Steam authentication no longer imports the diagnostic logger or probes a localhost Steam-client port.
- Password reset uses configurable SMTP delivery, clears tokens after delivery failure, and refuses production startup until email delivery is enabled and configured.
- Hub hero transfer size was reduced from 1.36 MB PNG to a 141 KB JPEG derivative.
- The production backend serves the Vite build from the same origin, preserves direct SPA navigation, applies immutable caching to fingerprinted assets, and returns JSON for unmatched API requests.
- `railway.json` defines the Railpack build, production start command, `/health/ready` deployment health check, and failure restart policy.
- A compiled `NODE_ENV=production` smoke test passed: `/health/ready` returned HTTP 200 with PostgreSQL ready, `/hub` returned the application shell with `Cache-Control: no-cache`, and an unmatched JSON request returned the structured HTTP 404 contract.
- Production startup now fails fast for a missing PostgreSQL URL, missing/placeholder Steam key, invalid RCON encryption key, disabled or incomplete SMTP, non-HTTPS public URL, placeholder SMTP host, weak JWT secret, or missing CORS origins. Negative validation cases and a valid positive startup were runtime-tested.
- HTTP requests emit structured JSON logs with correlation IDs, response status, and duration; clients receive the same `X-Request-Id`, while raw database and unhandled error details remain server-side.
- Generic API, administration, Steam-provider, and RCON-probe failures return stable public error contracts instead of raw exception or PostgreSQL messages; detailed failures are emitted only as correlated structured logs.
- A runtime error-contract test deliberately triggered PostgreSQL UUID parsing failure through an authenticated match request. The client received only `INTERNAL_ERROR`, the public message, and a matching request ID; the database exception text was absent.
- UUID route parameters are now rejected centrally with `400 INVALID_UUID_PARAMETER` before database access. Runtime verification passed on a public route, while the admin router preserved authentication-first behavior.
- Authenticated requests re-check that the account is active and that the JWT `auth_version` matches PostgreSQL. Deactivation, administrative/user password changes, and password reset revoke existing tokens immediately; restoring an account does not revive pre-deactivation tokens.
- Session revocation passed a full runtime lifecycle test: active token, deactivation rejection, restore rejection for the old token, fresh login success, password-change rejection for the prior token, and new-password login success.
- Steam OpenID starts from a server-generated ten-minute signed state bound to the configured origin and exact callback URL. The browser binds it to the initiating tab through `sessionStorage`, and PostgreSQL stores only a one-time SHA-256 nonce hash that is consumed after successful Steam signature verification.
- Steam state runtime tests passed for origin/return URL binding, altered-state rejection, valid-state OpenID enforcement, hashed nonce persistence, expiry state, raw nonce absence, and non-consumption by an invalid callback.
- Password-reset bearer tokens are stored only as SHA-256 hashes; migration `038` invalidates legacy plaintext reset tokens. Successful reset clears token state and increments `auth_version` so prior sessions are revoked.
- Password-reset hashing passed runtime verification for raw-token absence, hash equality, wrong-token rejection, correct-token completion, hash/expiry cleanup, session-version increment, and login with the new password.
- Structured logging supports validated `LOG_LEVEL=info|warn|error`; error logs cannot be suppressed by a lower-priority setting.
- A compiled local production load baseline completed 2,000 mixed PostgreSQL-readiness and SPA-shell requests at concurrency 50 with 0 errors: 837.19 requests/second, p50 51.49 ms, p95 117.88 ms, p99 265.57 ms, and max 831.63 ms. Railway network/database load testing remains a separate staging gate.
- The post-`038` PostgreSQL 18 custom-format backup `sectornine-2026-07-22T20-04-19-668Z.dump` completed and passed archive inspection (991,195 bytes, 283 entries, SHA-256 `AA118F07445859DC5B659DB7AD81A8AD5830340A4A81C4EB0D83F2742405D159`). `npm run db:restore:drill` restored it into an isolated temporary database, verified six required application tables plus `users.auth_version` and `users.reset_token_hash`, and removed the drill database afterward.

## Migration process

`npm run db:migrate` applies ordered SQL files transactionally and records SHA-256 checksums in `schema_migrations`. `npm run db:migrate:status` reports applied and pending files.

The existing local and Railway databases predate this runner. Do not run it against either existing database until their current schema is reconciled and the already-applied migrations are baselined in `schema_migrations`. A clean production database can run the full ordered set directly after staging verification.

For an existing reconciled database, preview the exact baseline records with `npm run db:migrate:baseline -- --through=038_password_reset_token_hashes.sql`. Execution additionally requires `--execute-baseline` and `MIGRATION_BASELINE_CONFIRM=BASELINE_EXISTING_SCHEMA`; this guard must only be enabled after an independent schema comparison and backup.

## External release blockers

- Reconcile the live Railway schema and establish the migration baseline before any production migration.
- Configure production `NODE_ENV`, `DATABASE_URL`, a new 32+ character `JWT_SECRET`, `APP_ORIGIN`, `PUBLIC_APP_URL`, `STEAM_API_KEY`, `RCON_ENCRYPTION_KEY`, and SMTP variables documented in `.env.example`. `VITE_API_URL` is optional for the default same-origin deployment.
- Create the Railway service from the checked-in configuration, attach PostgreSQL, then configure the public domain, DNS, and TLS.
- Connect and verify a real SMTP provider; the implementation is complete but live delivery cannot be verified without provider credentials.
- Add a payment provider with signed, idempotent webhooks before enabling cash VIP. Current API intentionally permits points purchases only.
- Add real game-server endpoints, encrypted RCON credentials, and agent tokens, then run staging matches for each supported game.
- Connect the structured production logs to a centralized error/log provider, configure uptime monitoring, and schedule the verified backup/restore commands against Railway storage.
- Run staging cross-browser tests and a production-like load test after deployment configuration is known.

## Release rule

Do not expose the platform publicly until every external blocker above has an owner and the staging deployment passes authentication, Steam verification, matchmaking, map veto, match completion, notifications, Store, Admin, backup, and restore smoke tests.
