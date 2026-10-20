# Sector Nine HL1 MVP Controlled Deployment Runbook

This runbook is documentation only. It does not authorize deployment, Git mutation, Railway changes or production database writes.

## Hard gates

- Two-person review of the exact Git release set and diff.
- No secrets, `.env`, identity files, dumps, logs or build outputs in Git.
- Railway Dashboard settings and auto-deploy behavior verified before any push.
- Production backup plus successful isolated restore drill.
- Migration 045 checksum decision recorded.
- Migration 046 verified pending before new backend.
- At least one successful original-Steam HLDS staging match using the exact candidate Agent/backend contract.

## 1. Review Git release set

```powershell
git status --short
git diff --check
git diff
git diff --cached
git ls-files
```

Compare against `RELEASE_MANIFEST.md`. Explicitly account for every untracked file. Do not use broad `git add .`; stage only reviewed paths after separate human approval. Record branch, base SHA and final release SHA.

## 2. Verify Railway auto-deploy

In both services, record the connected repository, branch, root directory, auto-deploy trigger, watch paths and whether a push immediately deploys. Pause auto-deploy before creating/pushing a release commit unless the rollout window has been approved. **UNVERIFIED until captured from Dashboard.**

## 3. Verify build/start/health settings

Frontend `sector-nine`:

- Build `npm ci && npm run build`
- Start `npm run start:frontend`
- Health `/health`
- `VITE_API_URL=/api`
- `BACKEND_ORIGIN=https://sector-nine-api-production.up.railway.app`

Backend `sector-nine-api`:

- Build `npm ci && npm run build:server`
- Start `npm run start:server`
- Health `/health/ready` (liveness `/health`)
- `APP_ORIGIN=https://sector-nine-production.up.railway.app`
- `PUBLIC_APP_URL=https://sector-nine-production.up.railway.app`
- `AUTH_COOKIE_PATH=/api/auth`
- `AUTH_COOKIE_SAME_SITE=lax`
- `AUTH_COOKIE_SECURE=true`
- secret/reference values for `DATABASE_URL`, `JWT_SECRET`, Steam and SMTP; never paste them into Git or the runbook.

`railway.json` does not encode service commands or health paths, so Dashboard evidence is mandatory.

## 4. PostgreSQL backup

During the approved maintenance window, use the repository backup command with production credentials supplied only through the secure operator environment:

```powershell
npm.cmd run db:backup
```

Record timestamp, database identity, backup path, size, checksum, tool version and retention location without recording credentials. Verify the backup command exits zero.

## 5. Restore drill

Restore the new backup only into a newly created isolated PostgreSQL instance, never development or production:

```powershell
npm.cmd run db:restore:drill -- <backup-path>
```

Confirm user/host/match/stat counts, schema ownership, constraints and application read queries. The drill must finish before migration approval.

## 6. Read-only schema/checksum preflight

Run with a read-only production connection:

```sql
SELECT current_database(), current_user, version(), pg_is_in_recovery();

SELECT name, checksum, applied_at
FROM schema_migrations
WHERE name IN ('045_hosts_and_pairing.sql','046_secure_auth_sessions.sql')
ORDER BY name;

SELECT to_regclass('public.hosts') AS hosts,
       to_regclass('public.auth_sessions') AS auth_sessions,
       to_regclass('public.game_servers') AS game_servers,
       to_regclass('public.users') AS users;

SELECT table_name,column_name,data_type,is_nullable
FROM information_schema.columns
WHERE table_schema='public'
  AND ((table_name='game_servers' AND column_name IN ('host_id','host_profile_id'))
    OR (table_name='users' AND column_name='auth_version')
    OR (table_name='hosts' AND column_name IN ('credential_hash','pairing_code_hash','pairing_expires_at','pairing_used_at'))
    OR (table_name='auth_sessions' AND column_name IN ('family_id','user_id','refresh_token_hash','auth_version','expires_at','revoked_at','replaced_by')))
ORDER BY table_name,column_name;

SELECT schemaname,tablename,indexname,indexdef
FROM pg_indexes
WHERE schemaname='public' AND tablename IN ('hosts','game_servers','auth_sessions')
ORDER BY tablename,indexname;

SELECT conrelid::regclass AS table_name,conname,pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid IN (to_regclass('public.hosts'),to_regclass('public.game_servers'),to_regclass('public.auth_sessions'))
ORDER BY 1,2;

SELECT c.relname,c.reltuples::bigint AS estimated_rows,pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname IN ('users','game_servers','matches');

SELECT pid,state,wait_event_type,wait_event,query_start,left(query,160) AS query
FROM pg_stat_activity
WHERE datname=current_database() AND pid<>pg_backend_pid()
ORDER BY query_start;

SELECT locktype,mode,granted,pid,relation::regclass
FROM pg_locks
WHERE database=(SELECT oid FROM pg_database WHERE datname=current_database()) AND NOT granted;
```

If a referenced table does not exist, omit its `regclass`-dependent inspection until existence is confirmed.

## 7. Decide migration 045 handling

Local candidate checksum: `86bc134077deb9e7f1bf2c1f34f62c9590e4603754eb198b317477e4bbb0adbf`. Legacy HEAD checksum: `f40a78b608d89edf2114f8f0c8905fff7808c8047a9f244a7bd2d44375f5b06b`.

- No 045 row and no objects: use the reviewed local 045 normally.
- 045 row equals local checksum: proceed.
- 045 row has another checksum: stop. Never update/delete the production row. Reconcile the actual objects. Preserve the exact historical 045 bytes matching production in the release branch and place any required schema correction in a new, immutable follow-up migration.
- Objects exist but no row: stop and perform a separately reviewed baseline/reconciliation; do not blindly execute or manually mark it applied.

## 8. Apply migration 046

Only after backup/restore/preflight and 045 decision, execute the repository migration runner once under maintenance control. Expected local 046 checksum: `2bf9c0b8a5a58ec1d8de183c35212a1abe7df60e3ca35f99bd3208a7d79042ed`. Verify `auth_sessions`, constraints and indexes read-only afterward.

## 9. Deploy backend first

Deploy the exact approved release SHA to `sector-nine-api`. Do not deploy frontend yet. Keep previous backend artifact/revision available. Watch build logs for migration/checksum errors without exposing environment values.

## 10. Backend validation

- `/health` returns 200.
- `/health/ready` returns 200 and database-ready JSON.
- Verify CORS allows exactly the frontend origin with credentials.
- Verify logs contain no tokens, cookies, Steam IDs beyond approved metadata, database URLs or SMTP secrets.

## 11. Deploy frontend

Deploy the same approved release SHA to `sector-nine`. Confirm `/health`, static asset loading, SPA fallback, `/api` forwarding and no redirect loop. Verify `Set-Cookie` survives proxying and is scoped to `/api/auth`.

## 12. Browser email/Steam smoke

Use approved staging/test accounts only. Test email login and Steam OpenID callback; ensure no token appears in URL, storage or logs. Confirm direct backend callback returns to the frontend origin.

## 13. Refresh/logout/multi-tab

Open two tabs, wait for access expiry or use the approved test mechanism, and confirm one coordinated refresh without family revocation. Test logout, refresh-cookie removal, revoked-session rejection and a second independent device session.

## 14. Host Agent pairing

On the staging Windows host, use the audited ZIP SHA `11A234ACDC86A26031076EAEC8F790F943F96388F79A6C04EF74A803C0E616B1`. Create a host in Admin, issue one code, pair once, verify DPAPI identity storage, heartbeat, capabilities, two profiles, revoke and controlled re-pair.

## 15. Mandatory original-Steam HLDS staging match

Before production GO, run at least one original-Steam HLDS/AG 6.6 match end-to-end: two Steam users, queue, accept, map veto, assignment, engine map, both authenticated, running, kills/suicide/reconnect, final frag, durable completion, idempotent replay, history/rating/stats and correct server release. Verify VIP/FL values are unchanged unless an explicit business rule applies. A simulator does not satisfy this gate.

## 16. Monitoring

Monitor readiness, 5xx/401/409 rates, refresh reuse events, pairing failures, Host heartbeat freshness, completion retries, queue/server allocation, PostgreSQL locks/connections and secret-safe logs. Define an observation window and named rollback owner before starting.

## 17. Rollback

1. Stop further frontend/backend deploys and disable auto-deploy.
2. Roll frontend back to the prior known-good revision.
3. Roll backend back to its prior revision; old backend is expected to tolerate additive 045/046.
4. Do not drop `hosts` or `auth_sessions` and do not reverse migration rows during incident response.
5. Revoke only affected sessions/Host credentials through reviewed operational procedures; do not rotate unrelated secrets automatically.
6. Restore the database only for proven data corruption and only from the verified backup after incident approval. Normal code rollback should leave additive schema intact.
7. Verify health/readiness, login, Steam, admin, matchmaking and Host isolation after rollback.
8. Preserve logs and incident timestamps without copying secrets into tickets.

