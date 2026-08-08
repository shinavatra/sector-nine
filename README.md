# Sector Nine Initiative

Sector Nine is a Half-Life 1 matchmaking and community platform built with React,
TypeScript, Vite, Express, and PostgreSQL. It includes account management, Steam OpenID
authentication, game-ownership and ban verification, matchmaking, direct chat, friends,
notifications, tournaments, cosmetics, VIP features, and a PostgreSQL-backed
administration panel.

> Production note: read [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) before
> deploying. The repository currently requires an explicit frontend static-server
> configuration, a complete migration release process, and replacement of unfinished
> payment/server-hosting flows before public launch.

## Contents

- [Architecture](#architecture)
- [Requirements](#requirements)
- [Installation](#installation)
- [Local development](#local-development)
- [Environment variables](#environment-variables)
- [PostgreSQL](#postgresql)
- [Migrations](#migrations)
- [Steam setup](#steam-setup)
- [Railway deployment](#railway-deployment)
- [Admin panel](#admin-panel)
- [Matchmaking](#matchmaking)
- [Chat and friends](#chat-and-friends)
- [Notifications](#notifications)
- [Backups and restore](#backups-and-restore)
- [Available commands](#available-commands)
- [Troubleshooting](#troubleshooting)
- [Operational documentation](#operational-documentation)

## Architecture

```text
Browser
  React 18 + TypeScript + Vite
  src/App.tsx
  src/pages/
  src/components/
  src/contexts/UserContext.tsx
  src/utils/api.tsx
          |
          | JSON over HTTP
          | Authorization: Bearer <JWT>
          v
Express API
  src/server/index.ts
  src/server/admin.ts
          |
          | node-postgres
          v
PostgreSQL
  src/server/001_schema.sql
  src/server/002...017 migrations
```

External services:

- Steam OpenID verifies Steam identity.
- Steam Web API provides profile, Half-Life ownership, VAC-ban, and game-ban data.
- Railway can host the API and PostgreSQL.
- The Vite frontend must be served by a static SPA server or static-hosting provider.

The frontend and backend are separate processes during development. The Express server
does not currently serve the Vite output.

## Requirements

- Node.js 20 or newer is recommended.
- npm with lockfile support.
- PostgreSQL.
- `psql` for applying all migrations manually.
- `pg_dump` and `pg_restore` for backup and restore operations.
- A Steam Web API key for Steam verification.

Windows users can install PostgreSQL with the standard PostgreSQL installer. Ensure its
`bin` directory is available on `PATH`, or call `psql`, `pg_dump`, and `pg_restore` using
their full paths.

## Installation

Clone or open the repository, then install the locked dependency set:

```powershell
npm ci
```

Create a local environment file:

```powershell
Copy-Item .env.example .env
```

Edit `.env` and replace every example credential:

```dotenv
DATABASE_URL=postgresql://postgres:your-password@localhost:5432/sectornine
JWT_SECRET=replace-with-at-least-32-random-characters
PORT=3001
VITE_API_URL=http://localhost:3001
STEAM_API_KEY=replace-with-your-steam-web-api-key
STEAM_RETURN_URL=http://localhost:3000/auth/steam/callback
```

`STEAM_RETURN_URL` is currently documented for deployment clarity, but the frontend builds
the callback URL from `window.location.origin`. See [Steam setup](#steam-setup).

Create the database:

```powershell
createdb --username postgres sectornine
```

Apply every migration in order. Do not rely on `npm run db:setup` for a complete database;
that command applies only `001_schema.sql`.

```powershell
$env:DATABASE_URL = "postgresql://postgres:your-password@localhost:5432/sectornine"

Get-ChildItem -LiteralPath "src/server" -Filter "*.sql" |
  Sort-Object Name |
  ForEach-Object {
    psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f $_.FullName
    if ($LASTEXITCODE -ne 0) {
      throw "Migration failed: $($_.Name)"
    }
  }
```

The ordered list includes both `016_schema_consistency_and_notifications.sql` and
`016_schema_consistency_verification.sql`; lexical filename ordering applies the
consistency migration before its verification script.

Confirm PostgreSQL connectivity:

```powershell
npm run db:test
```

## Local development

Run the backend and frontend in separate terminals.

Terminal 1:

```powershell
npm run dev:server
```

The Express API listens on `PORT`, which defaults to `3001`.

Terminal 2:

```powershell
npm run dev
```

The Vite frontend listens on port `3000` according to `vite.config.ts`.

Open:

```text
http://localhost:3000
```

The browser calls the URL configured in `VITE_API_URL`. Vite variables are build-time
values; restart the Vite process after changing them.

### Local request flow

1. Register with email, password, and username.
2. Sign in to receive a JWT.
3. Connect through Steam OpenID.
4. The backend verifies the signed callback with Steam.
5. The backend fetches Steam profile, ownership, VAC-ban, and game-ban data.
6. Eligible users can enter matchmaking.

### Health endpoint

```powershell
Invoke-RestMethod http://localhost:3001/health
```

The current `/health` response is a process liveness response; it does not perform a deep
PostgreSQL readiness check.

## Environment variables

### Application variables

| Variable | Service | Required | Description |
|---|---|---:|---|
| `NODE_ENV` | Backend | Production | Must be `production` in production. Activates production JWT-secret validation. |
| `DATABASE_URL` | Backend | Yes | PostgreSQL connection string used by `pg`. |
| `JWT_SECRET` | Backend | Yes | JWT signing secret. Production requires a unique value of at least 32 characters. |
| `PORT` | Backend | Railway supplies it | Express listening port. Defaults to `3001` locally. |
| `STEAM_API_KEY` | Backend | For Steam | Steam Web API key used for profile, ownership, and ban checks. |
| `VITE_API_URL` | Frontend build | Yes | Public browser-accessible API origin, without a trailing slash. |
| `STEAM_RETURN_URL` | Documentation only currently | No | Present in `.env.example`, but current frontend callback construction uses `window.location.origin`. |

Do not expose `DATABASE_URL`, `JWT_SECRET`, or `STEAM_API_KEY` through `VITE_*` variables.
All `VITE_*` values are available to browser code.

### Backup variables

The backup script supports:

| Variable | Purpose |
|---|---|
| `BACKUP_DATABASE_URL` | Highest-priority explicit backup connection string. |
| `DATABASE_PUBLIC_URL` | Railway public/TCP-proxy connection for backups outside Railway. |
| `DATABASE_URL` | Normal application or local connection fallback. |
| `PGDATABASE` | Optional database-name override. |
| `PGSSLMODE` | Optional PostgreSQL SSL mode. |
| `BACKUP_DIR` | Backup output directory; defaults to `scripts/backups`. |
| `PG_DUMP_PATH` | Path to `pg_dump` when it is not on `PATH`. |

See [BACKUP.md](./BACKUP.md) for the full contract.

### Secret handling

- Keep `.env` and `.env.local` out of Git.
- Use Railway service variables for deployed secrets.
- Seal sensitive Railway variables where operationally appropriate.
- Rotate secrets after accidental disclosure.
- Never place real secrets in `.env.example`, documentation, screenshots, or issue reports.

## PostgreSQL

The application uses PostgreSQL directly through `pg`; there is no ORM.

The pool is configured in `src/db.ts`:

- maximum 20 connections;
- 30-second idle timeout;
- 2-second connection timeout.

Core data areas include:

- `users`: accounts, roles, Steam data, profile settings, cosmetics, points, and XP;
- `matches`: competitors, scores, result, map, server, and XP changes;
- `queue_entries`: persisted matchmaking queue state;
- `tournaments` and `tournament_participants`;
- `friendships`;
- `chat_messages`;
- `notifications`;
- `reports`, `bans`, and `user_mutes`;
- `game_servers`, including write-only RCON configuration;
- `badges` and `frames`;
- `admin_audit_logs`;
- `platform_settings`;
- login history and ladder tables.

### PostgreSQL conventions

- Tables and columns use `snake_case`.
- Application JSON uses mostly `camelCase`.
- Backend mappers translate PostgreSQL rows into frontend profiles.
- SQL values must remain parameterized.
- Applied migration files should be treated as immutable.

See [PROJECT_STANDARDS.md](./PROJECT_STANDARDS.md) for naming and query conventions.

### Database audit

[DATABASE_REPORT.md](./DATABASE_REPORT.md) contains the current index, duplicate-data,
query-observability, column, and maintenance audit.

Important current observations:

- The database is small, so sequential scans are often normal.
- `pg_stat_statements` is not currently available for historical query analysis.
- `queue_entries(joined_at)` is a high-confidence future index candidate.
- Exact duplicate indexes were not detected during the audit.

## Migrations

Migration files live in `src/server`.

| Migration | Purpose |
|---|---|
| `001_schema.sql` | Base users, matches, tournaments, queue, chat, friends, notifications, moderation, and ladder schema. |
| `002_add_missing_user_columns.sql` | Additional user/profile columns. |
| `003_multigame_and_servers.sql` | Game identifiers and game-server support. |
| `004_steam_cache.sql` | Cached Steam verification/profile fields. |
| `005_profile_customization.sql` | Avatar, profile, social, and customization support. |
| `006_notification_preferences.sql` | Notification preference storage. |
| `007_admin_panel.sql` | Administration schema and compatibility fields. |
| `008_notification_preferences_keys.sql` | Notification preference defaults/backfill. |
| `009_direct_chat_messages.sql` | Direct-message relationships. |
| `010_friend_request_workflow.sql` | Friend-request lifecycle support. |
| `011_profile_frame_consistency.sql` | Profile frame consistency. |
| `012_chat_message_notifications.sql` | Chat notification linking/deduplication. |
| `013_admin_crud_extensions.sql` | Extended administration CRUD fields. |
| `014_server_match_relationships.sql` | Match and server assignment relationships. |
| `015_permanent_user_delete_and_rcon.sql` | Permanent deletion support and RCON storage. |
| `016_schema_consistency_and_notifications.sql` | Idempotent schema consistency and notification reconciliation. |
| `016_schema_consistency_verification.sql` | Verification checks for the consistency migration. |
| `017_tournament_administration.sql` | Tournament administration consistency. |

### Important migration limitation

There is no migration history table or complete automated runner in the current repository.
`npm run db:setup` applies only the base `001` file. Until a proper runner exists:

1. Back up the database.
2. Compare live Railway schema state with the repository.
3. Apply missing files in filename order.
4. Use `psql -v ON_ERROR_STOP=1`.
5. Stop immediately on failure.
6. Record manually which migrations were applied.

Do not blindly replay migrations against Railway without reconciling prior manually applied
SQL. The project has previously had live Railway schema changes that were not initially
represented by repository files.

### Applying one migration

```powershell
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f src/server/017_tournament_administration.sql
```

### Inspecting migration verification

```powershell
psql $env:DATABASE_URL -v ON_ERROR_STOP=1 -f src/server/016_schema_consistency_verification.sql
```

## Steam setup

### Obtain a Steam Web API key

1. Sign in to Steam.
2. Open [Steam Web API key registration](https://steamcommunity.com/dev/apikey).
3. Register the domain that will host the production frontend.
4. Store the key as `STEAM_API_KEY` in the backend environment only.

### OpenID callback

The frontend initiates Steam OpenID using:

```text
<frontend-origin>/auth/steam/callback
```

Local callback:

```text
http://localhost:3000/auth/steam/callback
```

Production callback example:

```text
https://app.example.com/auth/steam/callback
```

The current frontend derives the callback and OpenID realm from
`window.location.origin`. `STEAM_RETURN_URL` is not read by the current implementation.
Production must therefore serve the frontend from its canonical HTTPS origin.

### Verification flow

1. Steam redirects the browser with signed OpenID parameters.
2. `SteamCallback.tsx` forwards only `openid.*` parameters to `POST /steam/auth`.
3. The backend sends the assertion to Steam with
   `openid.mode=check_authentication`.
4. The claimed identity must be an HTTPS Steam Community OpenID URL containing a
   17-digit SteamID64.
5. The backend fetches Steam profile, owned games, VAC bans, and game bans.
6. `steam_verified` becomes true only when the account owns Half-Life 1 and has no VAC or
   game ban.
7. The result is cached for 24 hours.

Direct caller-supplied Steam ID linking is disabled. `/steam/link` and
`/user/steam/link` return `STEAM_OPENID_REQUIRED`; use the signed OpenID flow.

### Steam troubleshooting

- Steam OpenID requires a normal top-level browser window or allowed popup.
- Production Steam login requires HTTPS.
- Check that the browser-visible origin matches the expected callback origin.
- Confirm `STEAM_API_KEY` is configured on the backend service, not the frontend.
- Private Steam game details can affect owned-game results depending on Steam API behavior.
- Use the Administration System section to confirm whether the backend sees the Steam API
  key as configured.

## Railway deployment

The recommended Railway topology is:

```text
Railway project
  PostgreSQL service
  Backend API service
  Frontend SPA service (or host the frontend elsewhere)
```

Railway provisions PostgreSQL connection variables such as `DATABASE_URL`, `PGHOST`,
`PGPORT`, `PGUSER`, `PGPASSWORD`, and `PGDATABASE`. Use a Railway reference variable from
the backend service to the PostgreSQL service rather than copying credentials manually.
Railway documents service variables and references in its
[Variables guide](https://docs.railway.com/variables) and PostgreSQL provisioning in its
[PostgreSQL guide](https://docs.railway.com/databases/postgresql).

### 1. Create PostgreSQL

1. Create a Railway project.
2. Add a PostgreSQL database service.
3. Wait for it to become healthy.
4. Note the service name; the examples below assume `Postgres`.

Railway PostgreSQL is managed as a separate service. Prefer private networking/reference
variables for application-to-database traffic. Use the public TCP proxy only for approved
external administration or backup workflows.

### 2. Create the backend service

Connect the Git repository to a Railway service.

Suggested backend build command:

```text
npm ci && npm run build:server
```

Suggested backend start command:

```text
npm run start:server
```

Backend variables:

```dotenv
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
JWT_SECRET=<at-least-32-random-characters>
STEAM_API_KEY=<steam-web-api-key>
```

Railway supplies `PORT`; do not hardcode a production port.

Generate a public backend domain from the service Networking settings. Test:

```text
https://<backend-domain>/health
```

### 3. Apply migrations

Apply migrations before serving production traffic.

The repository does not currently provide a complete automated migration runner. Use a
controlled release task or an administrator machine with `psql`, the correct Railway
connection URL, and the ordered migration command from [Installation](#installation).

For external `psql`, use the Railway public database URL/TCP proxy. For commands running
inside the Railway project, use the private `DATABASE_URL` reference.

Always back up and reconcile the live schema first.

### 4. Create the frontend service

The Vite output directory is `build`, as configured in `vite.config.ts`.

Frontend build command:

```text
npm ci && npm run build
```

Frontend build variable:

```dotenv
VITE_API_URL=https://<backend-domain>
```

`VITE_API_URL` must be available during the build. Changing it requires a new frontend
deployment.

The repository does not currently include Caddy, Nginx, or another production static
server. Before using Railway for the frontend, add a static-server configuration that:

- serves the `build` directory;
- listens on Railway's `PORT`;
- falls back to `index.html` for client-side routes;
- enables compression;
- applies suitable cache headers.

Railway's
[SPA routing guide](https://docs.railway.com/guides/spa-routing-configuration) documents
Caddy and Nginx patterns. Its examples commonly use `dist`; this project must use `build`.

Alternatively, deploy `build/` to a static-hosting provider with SPA fallback support.

### 5. Configure the production origin

- Generate the frontend domain.
- Ensure Steam uses the frontend HTTPS origin.
- Set the backend's allowed CORS origins when restricted CORS configuration is added.
- Rebuild the frontend if the backend domain changes.
- Confirm no browser request points to `localhost`.

### 6. Deployment verification

Verify:

- backend starts with `NODE_ENV=production`;
- JWT secret passes production validation;
- PostgreSQL connects;
- all migrations are present;
- frontend routes fall back to `index.html`;
- `VITE_API_URL` points to the public backend;
- signup/signin work;
- Steam callback works;
- administration routes require a live administrator;
- chat, notifications, and matchmaking update;
- backups are scheduled.

See [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) for the full release gate.

## Admin panel

The administration shell is available at:

```text
/admin
```

Nested sections use paths such as:

```text
/admin/users
/admin/servers
/admin/matches
/admin/tournaments
/admin/reports
/admin/bans
/admin/logs
/admin/system
```

The backend mounts administration routes at `/admin`. Every request:

1. requires a bearer JWT;
2. verifies the JWT;
3. queries PostgreSQL for a non-deleted user with `role='admin'`;
4. rejects non-administrators.

Administrative actions are recorded in `admin_audit_logs`. Audit records include the
administrator, action, target, details, IP address, and timestamp.

### Create the first administrator

There is no public “create first admin” endpoint. Register a normal user, then promote it
through a controlled PostgreSQL session:

```sql
UPDATE users
SET role = 'admin',
    updated_at = NOW()
WHERE email = 'administrator@example.com'
  AND deleted_at IS NULL;
```

Confirm exactly one intended row changed:

```sql
SELECT id, email, username, role, deleted_at
FROM users
WHERE email = 'administrator@example.com';
```

Use a real registered email and protect database access. Subsequent role changes should be
performed through the audited Administration Panel.

### Administration areas

- Dashboard: real PostgreSQL statistics.
- Users/VIP: account fields, points, XP, roles, cosmetics, bans, deactivation, restore,
  and permanent deletion.
- Servers: public endpoint, game, region, slots, status, Playit tunnel, write-only RCON,
  and current match.
- Matchmaking: queue inspection, removal, clearing, and forced matching.
- Matches: players, scores, winner, status, server, cancel, finish, and deletion.
- Tournaments: settings, rewards, maps, participants, registration, lifecycle, and
  deletion.
- Store: badges and frames, visibility, featured state, and deletion.
- Reports/Bans: moderation actions, notes, durations, search, and removal.
- Logs: search, filters, details, and pagination.
- System: platform settings, database/API state, Steam configuration state, and cache
  controls.

RCON passwords are never returned to the frontend. The UI receives only `has_rcon`.
See [SECURITY_REPORT.md](./SECURITY_REPORT.md) for the remaining encryption-at-rest
recommendation.

## Matchmaking

Users must satisfy all eligibility checks:

- authenticated Sector Nine account;
- linked Steam account;
- Half-Life 1 ownership;
- current Steam verification;
- no VAC ban;
- no Steam game ban;
- no active matchmaking ban.

Supported modes currently include:

- `classic-deathmatch`;
- `instagib-mode`.

### Queue flow

1. The Lobby posts mode and selected maps to `/matchmaking/join`.
2. The backend checks platform settings, Steam eligibility, and active bans.
3. The entry is stored in an in-process map and `queue_entries`.
4. The backend looks for another queued user in the same game mode.
5. A common/random map is selected.
6. A match is created and both queue entries are removed.
7. Both users receive match-found notifications.

The Lobby currently polls the join endpoint every three seconds while searching.

### Scaling limitation

The current matcher uses process-local memory as well as PostgreSQL. Multiple backend
replicas do not share the in-memory queue, and persisted entries are not the sole matching
authority. Run a single backend instance until matchmaking is redesigned around
transactional PostgreSQL claiming or another shared coordination service.

See [PERFORMANCE_REPORT.md](./PERFORMANCE_REPORT.md) for the recommended join/status split
and push-delivery design.

## Chat and friends

Direct chat is available only between accepted friends.

### Friend workflow

- Search users.
- Send a friend request.
- Accept, decline, or cancel a pending request.
- Remove an accepted friend.
- Poll online friends.

Friendship mutations update related notifications so stale requests do not remain visible.

### Chat workflow

- `/chat/unread` returns unread direct-message notifications.
- `/chat/:recipientId` returns the latest 50 messages for an accepted-friend conversation.
- Posting to the same path creates a message and notification in one transaction.
- `/chat/:recipientId/read` marks that sender's message notifications read.
- A user may delete only their own message.

Current browser behavior:

- unread chat polling every seven seconds;
- open-conversation polling every three seconds;
- online-friend polling every 15 seconds;
- presence heartbeat every 90 seconds.

Chat message and notification IDs are deduplicated client-side. For production scale,
replace overlapping polling with a shared SSE/WebSocket event stream and cursor-based
fallback.

## Notifications

Notifications are stored in PostgreSQL and include:

- chat messages;
- friend requests;
- match-found events;
- reports/moderation messages;
- bans;
- tournament/platform events where created by the application.

The application header polls `/notifications` every seven seconds to update the unread
badge and friend-request toasts. The Notifications page loads the latest 50 records and can
mark one or all records read.

Notification preferences are stored in `users.notification_preferences` and are updated
through the authenticated `PUT /user/profile` endpoint.

If preferences fail with a migration error, confirm migrations `006` and `008` have been
applied.

## Backups and restore

The project includes a compressed PostgreSQL custom-format backup script:

```powershell
npm run db:backup
```

The script:

- supports local PostgreSQL;
- supports Railway connection variables;
- creates compressed custom-format archives;
- uses timestamped filenames;
- writes to `scripts/backups` by default;
- never overwrites a known filename.

Backup files are ignored by Git.

Do not test restore procedures against the only production database. Restore into an empty
database first and verify the result.

Complete instructions:

- [BACKUP.md](./BACKUP.md)

Examples:

```powershell
$env:DATABASE_URL = "postgresql://postgres:password@localhost:5432/sectornine"
npm run db:backup
```

Railway from an external machine:

```powershell
$env:BACKUP_DATABASE_URL = "<Railway public PostgreSQL URL>"
npm run db:backup
```

The backup script does not run automatically. Use Railway Cron, Windows Task Scheduler, or
another scheduler as documented in `BACKUP.md`.

## Available commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the Vite development frontend. |
| `npm run dev:server` | Start the Express API through `ts-node`. |
| `npm run build` | Produce the Vite frontend in `build/`. |
| `npm run build:server` | Compile backend TypeScript into `dist/`. |
| `npm run preview` | Preview a completed Vite build. |
| `npm run start:server` | Run the compiled backend from `dist/server/index.js`. |
| `npm run db:test` | Test the configured PostgreSQL connection. |
| `npm run db:setup` | Apply only `001_schema.sql`; not a complete migration command. |
| `npm run db:backup` | Create a compressed PostgreSQL backup. |

## Troubleshooting

### Frontend opens but API requests fail

Symptoms:

- network errors;
- requests going to `localhost:3001`;
- Administration Panel cannot load;
- authentication appears unavailable.

Check:

1. Backend process is running.
2. `VITE_API_URL` points to the browser-accessible backend origin.
3. Vite was restarted/rebuilt after the variable changed.
4. The backend domain uses HTTPS in production.
5. Browser developer tools show the expected request URL.

### `DATABASE_URL not set`

Create `.env`, ensure the key is spelled exactly, and start the backend from the repository
root.

```powershell
Copy-Item .env.example .env
npm run db:test
```

### PostgreSQL connection refused

- Confirm PostgreSQL is running.
- Confirm host and port.
- Confirm database name, user, and password.
- Confirm firewall rules.
- On Railway, confirm the backend uses the PostgreSQL service reference variable.
- Use Railway's public/TCP-proxy URL only from outside the project.

### `DATABASE_MIGRATION_REQUIRED`

The backend expected a table or column that is missing.

1. Back up the database.
2. Identify the missing object from the error.
3. Compare applied/live schema with the migration list.
4. Apply the missing migration and subsequent verification migration.
5. Restart or retry the request.

Do not assume `npm run db:setup` applied migrations after `001`.

### JWT production startup failure

Production intentionally refuses to start when:

- `JWT_SECRET` is missing;
- it equals the known development fallback;
- it is shorter than 32 characters.

Generate and set a unique cryptographically random secret, then redeploy. Existing tokens
become invalid when the secret changes.

### Sign-in succeeds but the profile appears logged out

- Confirm `session_token` exists in browser local storage.
- Check `/user/profile` in the Network panel.
- A `401` indicates an invalid/expired JWT.
- A `404` can indicate a deleted/deactivated account.
- A migration error indicates schema drift.

### Steam login fails

- Use HTTPS outside localhost.
- Allow redirects/popups.
- Confirm the frontend canonical origin.
- Confirm `STEAM_API_KEY` on the backend.
- Confirm Steam's callback returns to `/auth/steam/callback`.
- Check for `INVALID_STEAM_CALLBACK`, `STEAM_OPENID_UNAVAILABLE`, or
  `STEAM_ACCOUNT_NOT_LINKED`.
- If the Steam account is not linked, first register/sign in with email and then complete
  Steam OpenID.
- Do not call `/steam/link` directly; it is intentionally disabled.

### Steam verification says Half-Life is not owned

- Confirm the Steam account owns app ID `70`.
- Retry after Steam API availability is restored.
- The backend caches Steam verification for 24 hours.
- An administrator can clear the Steam cache from the System section.
- Review Steam privacy/API behavior if owned games are unavailable.

### Administration Panel returns `401` or `403`

- `401`: token is missing, invalid, or expired.
- `403`: the current non-deleted PostgreSQL user does not have `role='admin'`.

Verify:

```sql
SELECT id, email, username, role, deleted_at
FROM users
WHERE email = 'administrator@example.com';
```

### Administration page loads the wrong section

Use canonical URLs under `/admin/*`. The administration shell derives section state from
the current path and listens to browser history changes.

### Notifications or chat are duplicated

- Confirm migrations `009`, `010`, and `012`.
- Check uniqueness constraints for related chat and friendship notification IDs.
- Confirm only one frontend application instance is mounted.
- Inspect browser polling in the Network panel.

### Chat returns `403`

Direct chat requires an accepted friendship. Confirm the friendship exists and is
`accepted`.

### Matchmaking never finds another user

- Confirm both accounts are Steam-eligible.
- Confirm both selected the same supported game mode.
- Confirm compatible maps.
- Confirm neither account has an active ban.
- Confirm both clients reach the same PostgreSQL-backed platform.
- Queue pairing uses a PostgreSQL advisory transaction lock and locked queue
  rows, so process-local matchmaking is not required.
- CS 1.6, L4D2, and CoD4 queues are intentionally disabled until their team
  formats are implemented.

### Match result submission is rejected

- The caller must be one of the two match participants.
- The match must be `in_progress`.
- The winner must be one of the participants.
- Scores/kills/deaths must be non-negative bounded integers.
- Completed matches cannot be submitted twice.

### RCON password is not visible

This is intentional. The API returns only whether RCON is configured. Enter a replacement
password to change it or use the explicit clear option.

### Local HLDS setup

Local Half-Life HLDS is supported while the platform backend runs on the same PC.

1. Configure HLDS normally and set a strong `rcon_password` in the HLDS
   `server.cfg`. Do not commit that password.
2. Start HLDS on a known port, for example `27015`, with an installed map such
   as `dm_crossfire`.
3. In Administration > Servers, create an `hl1` server using
   `127.0.0.1`, the HLDS port, and the intended slot count.
4. Use the dedicated write-only RCON action to store the same password. The
   backend requires `RCON_ENCRYPTION_KEY` to be a 64-character hexadecimal key.
5. Run the server probe. A successful `status` response marks the server online.
6. After matchmaking leaves one selected map, the backend reserves the server,
   sends `changelevel <map>`, and only then marks the match in progress.

When hosted game infrastructure is available, replace the server's public host,
port, and optional tunnel value. The encrypted password can be replaced without
changing the match workflow.

CS 1.6 can also use the GoldSrc RCON transport, but its Fast Cup 5v5 queue stays
disabled until team roster and round-scoring support is complete. L4D2 and CoD4
use different RCON transports and are also disabled for matchmaking.

### Backup fails because `pg_dump` is missing

Install PostgreSQL client tools or set:

```powershell
$env:PG_DUMP_PATH = "C:\Program Files\PostgreSQL\<version>\bin\pg_dump.exe"
```

See `BACKUP.md` for version compatibility and Railway SSL notes.

### SPA route returns 404 after deployment

The static server must fall back to `index.html` for routes such as `/profile`,
`/notifications`, and `/admin/users`. Configure Caddy, Nginx, or the selected host for SPA
routing. The output directory is `build`.

### Money-based VIP or Server Hosting

These flows are not production-ready:

- money-based VIP does not have verified provider fulfillment;
- the card form is a simulation;
- Server Hosting does not provision infrastructure.

Disable them before launch or complete the integrations described in
`PRODUCTION_CHECKLIST.md`.

## Operational documentation

- [BACKUP.md](./BACKUP.md): backup scheduling, archive verification, and restore.
- [DATABASE_REPORT.md](./DATABASE_REPORT.md): PostgreSQL audit and optimization candidates.
- [SECURITY_REPORT.md](./SECURITY_REPORT.md): security findings and critical fixes.
- [PERFORMANCE_REPORT.md](./PERFORMANCE_REPORT.md): rendering, polling, API, and query review.
- [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md): launch blockers and release sequence.
- [PROJECT_STANDARDS.md](./PROJECT_STANDARDS.md): formatting, naming, folders, interfaces,
  API, and SQL conventions.

## Project origin

The original UI design source is available in
[Figma](https://www.figma.com/design/ShW4WO48SDF3ua5q4RQji8/Esport-Matchmaking-Platform).
