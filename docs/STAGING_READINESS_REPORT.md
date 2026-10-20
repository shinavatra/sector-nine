# Sector Nine staging readiness report

Updated: 2026-10-19

## Executive status

- Local Admin/Host HTTP/PostgreSQL E2E: PASS.
- Local matchmaking -> assignment -> trusted completion E2E: PASS.
- Two-port UDP telemetry simulator: PASS; this is not live HLDS.
- Windows package: STAGING CANDIDATE, not production-verified.
- Railway production rollout: NO-GO until deployment gates below are closed.

## Completed

1. Disposable PostgreSQL 16 harness with all migrations, real Express HTTP, transactions, labelled-container verification and cleanup.
2. Admin login; host create; pairing-code issue; pairing; heartbeat/capabilities; two server links; revoke; re-pair; disable/enable; unauthenticated/user/Host-credential RBAC rejection.
3. Twelve concurrent pairing races: exactly one winner and one `PAIRING_USED` response each.
4. Two users: queue, accept, map selection/veto, hosted server allocation, Host assignment, `match_running`, trusted completion, idempotent replay, stats/rating/history and server release.
5. Completion replay does not duplicate receipt/rating history or alter VIP fields.
6. Completion spool now drains after restart with no active assignment; transient production retries no longer permanently stop after eight failures. 401/403/409 remain terminal.
7. GoldSrc binary `0xFFFFFFFF` is stripped before UTF-8 decoding.
8. Parser drops an identical retransmit inside 50 ms but preserves a legitimate identical same-second event after that window.
9. Two simultaneous loopback UDP listeners drive source -> parser -> tracker -> reporter without cross-profile leakage.
10. Migration 045 nested transaction removed; runner owns the atomic transaction.
11. Cookie example corrected to `AUTH_COOKIE_PATH=/api/auth`.

## Defects fixed

- Matchmaking allocation used unrestricted `FOR UPDATE` across `LEFT JOIN hosts`, so final map-ban returned PostgreSQL 500. It now uses `FOR UPDATE OF s SKIP LOCKED`.
- Real GoldSrc UDP prefix was decoded into replacement characters before stripping and could prevent parsing.
- Completion spool retry depended on an active match session.
- Permanent content-hash identity discarded legitimate repeated same-second kills.

## Test results

- `test:host-pairing:e2e`: PASS, 14 real HTTP/PostgreSQL scenarios; 12/12 races; 47 migrations through 046.
- Backend TypeScript build: PASS.
- Frontend Vite production build: PASS, 2,418 modules.
- `test:game-server-mode`: PASS.
- `test:host-agent`: PASS.
- `test:trusted-match-results`: PASS.
- `test:competitive-result-security`: PASS.
- `test:host-agent-events`: PASS.
- `test:hl1-assignment`: PASS.
- `test:host-pairing`: PASS.
- `test:secure-sessions`: PASS.
- `test:steam-auth`: PASS.
- `test:multi-tab-refresh`: PASS.
- `test:frontend-proxy`: PASS.
- Host Agent typecheck/build: PASS.
- Host Agent Vitest: PASS, 11 files / 51 tests.
- Controlled UDP two-profile integration: PASS.
- C# compile and `Setup.exe --self-test`: PASS.
- `git diff --check`: PASS; only LF/CRLF warnings.
- Partner-PC GUI walkthrough: NOT TESTED.
- Original Steam HLDS: NOT TESTED.
- Railway runtime/production DB: NOT TESTED.

## Windows staging candidate

- ZIP: `D:\keshaaa\sector-nine-host-agent\release\SectorNine-Host-Agent-Windows-x64.zip`
- Size: 48,635,189 bytes.
- SHA-256: `11A234ACDC86A26031076EAEC8F790F943F96388F79A6C04EF74A803C0E616B1`
- Entries: 2,212; required telemetry 4/4; forbidden `.env`, `identity.dat`, `.dump`, `.bak`: 0.

## Files changed in this sprint

Platform:

- `.env.example`
- `scripts/test-game-server-mode-isolation.mjs`
- `scripts/test-host-pairing-e2e.mjs`
- `src/server/045_hosts_and_pairing.sql`
- `src/server/index.ts`
- `docs/STAGING_READINESS_REPORT.md`

Host Agent:

- `src/telemetry/GoldSrcLogSource.ts`
- `src/telemetry/GoldSrcParser.ts`
- `src/telemetry/Hl1TelemetryRuntime.ts`
- `src/telemetry/SectorNineMatchReporter.ts`
- `tests/goldsrc-parser.test.ts`
- `tests/match-reporter.test.ts`
- `tests/udp-telemetry.test.ts`
- `build-windows-package.ps1`

The platform worktree contains additional earlier P0 auth/proxy/trusted-result changes. Do not discard or attribute them to this sprint.

## Remaining blockers and risks

HIGH deployment gates:

1. Secure-session/proxy files are untracked; Git deployment omits them unless the complete reviewed set is committed.
2. `railway.json` lacks per-service build/start/health settings. Verify both Railway dashboard service overrides before any auto-deploying push.
3. Production `schema_migrations` state is unknown. Migration 045 checksum changed, so read-only preflight must determine whether it was previously recorded before choosing the rollout procedure.
4. No original-Steam HLDS match or clean partner-PC Setup GUI test has run.

Residual risks:

- Kill-event HTTP delivery is best-effort; durable completion remains authoritative, but timelines can be incomplete during outages.
- GoldSrc UDP has no sequence ID; 50 ms dedupe is deterministic but cannot mathematically classify every replay/event pair.
- Keep UDP loopback-bound; wildcard/LAN bind permits forged telemetry without firewall/source restriction.
- Setup Stop uses hard process termination instead of the runtime graceful shutdown path.
- Multi-replica in-memory rate limiting was not tested.

## Migration readiness and preflight

- 046 is additive, non-destructive and passed disposable PostgreSQL E2E. It must precede the new backend.
- 045 is additive and passed after transaction cleanup. Production readiness depends on checksum/state preflight.
- Old backend tolerates both schemas; new backend requires 046. No new migration was added in this sprint.

Run read-only first:

```sql
SELECT current_database(), current_user, version();
SELECT name, checksum, applied_at FROM schema_migrations
WHERE name IN ('045_hosts_and_pairing.sql','046_secure_auth_sessions.sql') ORDER BY name;
SELECT to_regclass('public.hosts') AS hosts,
       to_regclass('public.auth_sessions') AS auth_sessions;
```

## Railway settings to verify

Backend: build `npm ci && npm run build:server`; start `npm run start:server`; health `/health/ready`; `APP_ORIGIN=https://sector-nine-production.up.railway.app`; `PUBLIC_APP_URL=https://sector-nine-production.up.railway.app`; `AUTH_COOKIE_SAME_SITE=lax`; `AUTH_COOKIE_PATH=/api/auth`; `AUTH_COOKIE_SECURE=true`; `DATABASE_URL=<reference>`; `JWT_SECRET=<secret>`; existing Steam/SMTP secrets.

Frontend: build `npm ci && npm run build`; start `npm run start:frontend`; health `/health`; build-time `VITE_API_URL=/api`; runtime `BACKEND_ORIGIN=https://sector-nine-api-production.up.railway.app`.

Host Agent continues to call the backend directly.

## Manual next steps

1. Read-only production migration/checksum and Railway dashboard preflight.
2. Extract the ZIP on clean Windows x64 without Node.js.
3. Walk through Serbian Setup, pairing, DPAPI persistence, two profiles, autostart/restart and logs.
4. Run original Steam HLDS/AG 6.6 and complete Classic plus Instagib matches.
5. Include suicide, reconnect, rename, delayed duplicate/reordered logs and final frag.
6. Verify history/rating/stats/server release and no VIP/FL mutation.
7. Test backend outage during completion plus Agent restart, then confirm one eventual finalization.

Do not deploy until these gates are reviewed and explicitly approved.
