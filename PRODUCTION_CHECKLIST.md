# Sector Nine Production Checklist

Last verified: 2026-07-24

This checklist describes the current release state. Detailed evidence and known external blockers are recorded in `RELEASE_STATUS_2026-07-22.md`.

## Application

- [x] Frontend production build passes.
- [x] Backend TypeScript production build passes.
- [x] Production backend serves the fingerprinted Vite build and direct SPA routes.
- [x] Frontend API clients default to the deployment origin in production.
- [x] Unmatched API requests return structured JSON 404 responses.
- [x] Legacy random map-selection, map-veto, and localStorage ban prototypes are removed.
- [x] Support tickets and admin responses use PostgreSQL-backed workflows.
- [x] Cash VIP activation is blocked until a verified payment provider is integrated.
- [x] Password reset requires configured SMTP in production.
- [x] Password-reset tokens are hash-persisted, expiring, single-use, and revoke prior sessions after completion.
- [x] Unsupported CS 1.6/L4D2/CoD4 placeholder queues are disabled until their team formats are implemented.
- [x] Permanent bans and administrative chat mutes are enforced by public workflows.
- [x] Player-reported completion releases the assigned game server.

## Security

- [x] Production rejects missing, weak, or development JWT secrets.
- [x] Production requires an explicit CORS origin allowlist.
- [x] Production requires HTTPS for the public application URL.
- [x] Helmet security headers and scoped rate limits are enabled.
- [x] Steam identity is verified through signed OpenID responses.
- [x] Steam OpenID state is origin-bound, browser-session-bound, expiring, hash-persisted, and one-time-use.
- [x] Deactivated accounts and stale pre-password-change JWTs are rejected through server-side session version checks.
- [x] Matchmaking requires verified ownership/access for the selected game.
- [x] RCON secrets are encrypted at rest and excluded from API responses.
- [x] Database and unhandled error details are not returned to clients.
- [x] Dependency audit reports zero known vulnerabilities.

## Database

- [x] Ordered migrations through `039_disable_unimplemented_team_matchmaking.sql` exist.
- [x] Migration runner uses a PostgreSQL advisory lock, transactions, and SHA-256 checksums.
- [x] Existing-schema baseline mode is dry-run by default and requires explicit execution confirmation.
- [x] Local PostgreSQL custom-format backup completed successfully.
- [x] Backup archive passed `pg_restore --list` validation.
- [x] Restore drill passed against an isolated temporary database and removed it afterward.
- [ ] Compare the live Railway schema with the migration set.
- [ ] Back up Railway PostgreSQL before baseline or migration.
- [ ] Baseline the reconciled Railway schema, then verify zero unexpected pending migrations.

## Operations

- [x] `/health/live` reports process liveness.
- [x] `/health/ready` verifies PostgreSQL readiness.
- [x] Graceful shutdown drains HTTP and closes database/game-server monitoring resources.
- [x] HTTP logs are structured JSON and include request ID, status, and duration.
- [x] Local compiled production load baseline passes at concurrency 50 with zero HTTP errors.
- [x] Railway build, start, health-check, and restart policy are checked in.
- [ ] Provision the Railway application service and PostgreSQL attachment.
- [ ] Configure centralized log/error ingestion and uptime checks.
- [ ] Schedule off-service backups and retention.
- [ ] Configure domain, DNS, and TLS.

## Required Production Variables

- [ ] `NODE_ENV=production`
- [ ] `LOG_LEVEL=info` (or `warn` after log ingestion is verified)
- [ ] `DATABASE_URL`
- [ ] unique `JWT_SECRET` with at least 32 characters
- [ ] `APP_ORIGIN`
- [ ] `PUBLIC_APP_URL`
- [ ] `STEAM_API_KEY`
- [ ] 64-character hexadecimal `RCON_ENCRYPTION_KEY`
- [ ] `PASSWORD_RESET_ENABLED=true`
- [ ] `SMTP_HOST`, `SMTP_PORT`, `SMTP_FROM`
- [ ] `SMTP_USER` and `SMTP_PASS` when required by the provider

`VITE_API_URL` is optional for the default same-origin Railway deployment.

## External Integrations

- [ ] Verify real password-reset delivery and token completion through the selected SMTP provider.
- [ ] Add a payment provider with signed, idempotent webhooks before enabling cash VIP.
- [ ] Configure real HL1, CS 1.6, L4D2, and CoD4 server endpoints and encrypted RCON credentials.
- [ ] Run one full staging match per supported game, including allocation, map veto, completion, telemetry, and demo/stat import where supported.

## Staging Release Gate

- [ ] Authentication and account recovery pass on the public staging origin.
- [ ] Steam connection, ownership verification, and banned-account rejection pass.
- [ ] Notifications, friends, direct chat, comments, reports, and support pass across two accounts.
- [ ] Store points purchases, frames, themes, purchase history, and VIP restrictions pass.
- [ ] Matchmaking 5+5 map pool, alternating veto, server allocation, match completion, and history pass.
- [ ] Tournament registration, seasons, leaderboard movement, and admin CRUD pass.
- [ ] Desktop checks pass in current Chrome, Firefox, and Edge.
- [ ] Mobile checks pass on representative iOS and Android viewport/device sessions.
- [ ] Production-like load test meets agreed latency and error-rate thresholds.
- [ ] Backup restore drill passes using a staging copy of the Railway backup.

Do not open public registration or enable cash payments until every unchecked release-gate item is completed and recorded with current evidence.
