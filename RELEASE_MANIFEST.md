# Sector Nine HL1 MVP Release Manifest

Release candidate: `sector-nine-hl1-mvp-rc1`  
Audit date: 2026-10-19  
Branch: `main`  
Base commit: `b3fe8cddb37e1685cab0a42613067ab1eb051ac9` (`admin update blur`, 2026-10-05)  
Release commit: **UNVERIFIED / not created**

Legend: **VERIFIED** means checked directly during this audit; **REPORTED** comes from the previous local readiness run; **UNVERIFIED** requires external or production evidence.

## Git state — VERIFIED

- 208 tracked files total.
- 18 modified tracked files, 11 pre-existing untracked files, zero staged files at audit start.
- This manifest and `DEPLOYMENT_RUNBOOK.md` add two permitted untracked documentation files; final state is therefore 13 untracked files.
- `git diff --cached` is empty. No add, commit, push, reset or checkout was performed.
- Local `.env` exists and is ignored. Its values were not printed or copied.

## Required release set

| File | State | Purpose | Required | Risk |
|---|---|---|---|---|
| `.env.example` | Tracked, modified | Safe env contract including `/api/auth` cookie path | Yes | LOW; examples only |
| `README.md` | Tracked, modified | Operations and two-service configuration | Yes | LOW; review for consistency |
| `package.json` | Tracked, modified | Frontend/backend/proxy/test scripts | Yes | HIGH if omitted |
| `package-lock.json` | Tracked | Deterministic npm dependency graph | Yes | MEDIUM if stale |
| `railway.json` | Tracked, unchanged | Railpack/runtime/restart policy | Yes | HIGH: does not encode per-service commands/health paths |
| `scripts/serve-frontend.mjs` | **Untracked** | Fixed same-origin `/api` reverse proxy and SPA server | Yes | CRITICAL if omitted from Git release |
| `scripts/test-frontend-proxy.mjs` | **Untracked** | Proxy/cookie regression | Yes | MEDIUM |
| `scripts/test-multi-tab-refresh.mjs` | **Untracked** | Cross-tab refresh concurrency regression | Yes | MEDIUM |
| `scripts/test-secure-sessions.mjs` | **Untracked** | Secure-session regression | Yes | MEDIUM |
| `scripts/test-host-pairing.mjs` | Tracked, modified | Pairing contract/security regression | Yes | MEDIUM |
| `scripts/test-host-pairing-e2e.mjs` | **Untracked** | Real disposable PostgreSQL/HTTP pairing and match E2E | Yes | HIGH verification asset |
| `scripts/test-host-agent-protocol.mjs` | Tracked, modified | Agent protocol regression | Yes | MEDIUM |
| `scripts/test-trusted-match-results.mjs` | **Untracked** | Trusted completion regression | Yes | HIGH verification asset |
| `scripts/test-competitive-result-security.mjs` | Tracked, modified | Result authorization regression | Yes | MEDIUM |
| `src/App.tsx` | Tracked, modified | Session initialization/routing | Yes | HIGH |
| `src/contexts/UserContext.tsx` | Tracked, modified | In-memory access session lifecycle | Yes | HIGH |
| `src/utils/api.tsx` | Tracked, modified | Relative API, refresh/retry and credentials | Yes | CRITICAL |
| `src/utils/adminApi.ts` | Tracked, modified | Admin authenticated requests | Yes | HIGH |
| `src/utils/refreshCoordinator.ts` | **Untracked** | Web Locks/BroadcastChannel/IndexedDB coordination | Yes | CRITICAL if omitted |
| `src/server/index.ts` | Tracked, modified | Backend auth, proxy-compatible cookies, Host API, matchmaking/finalization | Yes | CRITICAL |
| `src/server/admin.ts` | Tracked, modified | Admin host provisioning/RBAC | Yes | HIGH |
| `src/server/authSession.ts` | Tracked, modified | Session authorization checks | Yes | HIGH |
| `src/server/secureSessions.ts` | **Untracked** | Refresh hashing, rotation, reuse detection and revocation | Yes | CRITICAL if omitted |
| `src/server/hostAgentAuth.ts` | Tracked, modified | Pairing code and credential rules | Yes | HIGH |
| `src/server/hostAgentProtocol.ts` | Tracked, modified | Agent payload validation | Yes | HIGH |
| `src/server/trustedMatchResult.ts` | **Untracked** | Server-authoritative result validation | Yes | CRITICAL if omitted |
| `src/server/045_hosts_and_pairing.sql` | Tracked, modified | Hosts, pairing and server linkage | Yes | HIGH checksum gate |
| `src/server/046_secure_auth_sessions.sql` | **Untracked** | Hashed refresh sessions | Yes | CRITICAL if omitted |
| `docs/STAGING_READINESS_REPORT.md` | Untracked | Prior readiness evidence | Recommended | LOW |
| `RELEASE_MANIFEST.md` | New, untracked | Audited release inventory | Yes | LOW |
| `DEPLOYMENT_RUNBOOK.md` | New, untracked | Controlled rollout and rollback | Yes | LOW |

The Host Agent directory has no `.git`. Its release source must include `package.json`, `package-lock.json`, `tsconfig.json`, `Setup.cs`, `build-windows-package.ps1`, `README.md`, `README-SR.txt`, all `src/**`, `config/**`, `scripts/**`, and `tests/**`. In particular, multi-HLDS and telemetry require `HostAssignmentsRuntime`, `GameServerManager`, `GoldSrcLogSource`, `GoldSrcParser`, `Hl1MatchSession`, `Hl1TelemetryRuntime`, `MatchTracker`, `SectorNineMatchReporter`, and `steamIdentity`.

Safe source-versioning recommendation: create a new private remote repository or approved monorepo subtree; first copy only source/config templates/tests, add a deny-list `.gitignore`, run secret and generated-artifact scans, review the initial diff, and only then initialize/version it manually. Do not import `release/`, `dist/`, `node_modules/`, `.env`, `identity.dat`, `data/` or `logs/`. This audit did not run `git init`.

## Secrets audit — VERIFIED

- Scanned current tracked/untracked release candidates and 35 available commits without printing values.
- No committed sensitive filenames (`.env`, `identity.dat`, private-key files, dumps or backups) were found in history.
- No private-key headers or literal bearer credentials were found.
- Matches for JWT/Steam/SMTP/database/pairing patterns were placeholders, `process.env` references, documentation, or generated test fixtures.
- No confirmed exposed secret was found; no rotation is requested by this audit.

## Migrations — VERIFIED locally, production state UNVERIFIED

| Migration | Local SHA-256 | State | Notes |
|---|---|---|---|
| `045_hosts_and_pairing.sql` | `86bc134077deb9e7f1bf2c1f34f62c9590e4603754eb198b317477e4bbb0adbf` | Modified tracked | Additive; runner-owned transaction; potential production checksum mismatch |
| HEAD/legacy 045 | `f40a78b608d89edf2114f8f0c8905fff7808c8047a9f244a7bd2d44375f5b06b` | Historical base | Included internal `BEGIN/COMMIT` |
| `046_secure_auth_sessions.sql` | `2bf9c0b8a5a58ec1d8de183c35212a1abe7df60e3ca35f99bd3208a7d79042ed` | Untracked | Additive; required before new backend |

Both migrations passed in disposable PostgreSQL 16 during the previous readiness run (**REPORTED**). Production `schema_migrations`, object state, locks and table sizes are **UNVERIFIED**.

## Railway contract

Frontend — VERIFIED locally:

- Build: `npm ci && npm run build`
- Start: `npm run start:frontend`
- Health: `/health`
- Build-time `VITE_API_URL=/api`
- Runtime `BACKEND_ORIGIN=https://sector-nine-api-production.up.railway.app`

Backend — VERIFIED locally:

- Build: `npm ci && npm run build:server`
- Start: `npm run start:server`
- Liveness: `/health`
- Readiness: `/health/ready`
- `APP_ORIGIN=https://sector-nine-production.up.railway.app`
- `AUTH_COOKIE_PATH=/api/auth`, `AUTH_COOKIE_SAME_SITE=lax`, `AUTH_COOKIE_SECURE=true`

`railway.json` selects Railpack/runtime/restart policy but does not define build/start commands or health paths. Actual Dashboard settings and auto-deploy branch are **UNVERIFIED** and can materially affect deployment.

Compatibility: old backend tolerates additive 045/046; new backend requires 046. New frontend requires the `/api` proxy/new backend. Old frontend with the new backend is rollout-sensitive because it may use the previous token/storage/origin contract.

## Host Agent artifact — VERIFIED

- `D:\keshaaa\sector-nine-host-agent\release\SectorNine-Host-Agent-Windows-x64.zip`
- Size: 48,635,189 bytes; 2,212 entries.
- SHA-256: `11A234ACDC86A26031076EAEC8F790F943F96388F79A6C04EF74A803C0E616B1` — exact expected match.
- `Setup.exe`, bundled `node.exe`, and all required telemetry artifacts are present.
- No `.env`, `.env.production`, `identity.dat`, logs, dumps or backups detected.
- MEDIUM hygiene issue: compiled `dist/tests` and development/test content from the full `node_modules` copy are included. Do not change this signed candidate in this audit; remove dev-only content in a future rebuilt candidate with a new hash.

## Validation evidence

VERIFIED in this audit: backend TypeScript build, frontend production build (2,418 modules), secure-session regression, frontend proxy regression, Steam auth regression, Host Agent protocol regression, trusted-result regression, and `git diff --check` all PASS.

REPORTED from the immediately preceding readiness run: real disposable PostgreSQL E2E (14 scenarios, 12/12 pairing races), all 47 migrations, Host Agent 51/51 tests, two-port UDP simulation, C# compile/self-test, and ZIP generation.

UNVERIFIED: Railway Dashboard/runtime, production database, browser E2E, clean partner-PC Setup walkthrough, and original-Steam HLDS/AG 6.6 match.

## Known blockers and rollback requirements

- HIGH: untracked runtime-critical files must be intentionally included in the reviewed release commit.
- HIGH: 045 production checksum/object state must be resolved without editing production migration history.
- HIGH: Railway Dashboard commands, health paths and auto-deploy branch must be verified.
- HIGH gate: at least one successful original-Steam HLDS staging match is mandatory before production.
- Rollback requires a verified database backup/restore drill, retention of the prior backend/frontend artifacts and env snapshot, backend-first rollback, and leaving additive 045/046 schema in place unless a separately reviewed data-safe rollback migration is prepared.

