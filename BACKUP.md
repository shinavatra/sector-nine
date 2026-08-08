# PostgreSQL backups

Sector Nine includes `scripts/backup-postgres.mjs`, a cross-platform wrapper
around PostgreSQL's official `pg_dump` utility. It supports Railway PostgreSQL
and local PostgreSQL installations.

It creates timestamped archives such as:

```text
scripts/backups/sectornine-2026-07-19T14-32-08-417Z.dump
```

The PostgreSQL custom archive format is compressed internally at level 9.
Restore these `.dump` files with `pg_restore`, not as plain SQL.

## Prerequisites

Install PostgreSQL client tools and ensure `pg_dump` and `pg_restore` are on
`PATH`. Use a client version that is the same as or newer than the server.

On Windows the tools are normally located under:

```text
C:\Program Files\PostgreSQL\<version>\bin
```

Set `PG_DUMP_PATH` to the full `pg_dump` executable path when it is not on
`PATH`.

## Connection configuration

The script checks connection settings in this order:

1. `BACKUP_DATABASE_URL`
2. `DATABASE_PUBLIC_URL`
3. `DATABASE_URL`
4. `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, and optional
   `PGSSLMODE`

Passwords are passed through the child process environment and are not added
to the `pg_dump` command line.

### Railway PostgreSQL

Run from a trusted local machine or persistent backup runner using Railway's
public PostgreSQL URL:

```powershell
$env:BACKUP_DATABASE_URL = "postgresql://user:password@host:port/database"
npm run db:backup
Remove-Item Env:BACKUP_DATABASE_URL
```

For Bash:

```bash
BACKUP_DATABASE_URL='postgresql://user:password@host:port/database' npm run db:backup
```

`DATABASE_PUBLIC_URL` is also recognized. Do not commit either value.
Railway's private `DATABASE_URL` only works from services that can access the
same private network.

Railway service filesystems are ephemeral unless a persistent volume is
attached. When scheduling the script inside Railway, point `BACKUP_DIR` at a
mounted volume and copy archives to durable off-site storage.

### Local PostgreSQL

The existing `.env` connection works directly:

```dotenv
DATABASE_URL=postgresql://postgres:password@localhost:5432/sectornine
```

Run:

```powershell
npm run db:backup
```

Alternatively, configure standard PostgreSQL variables:

```powershell
$env:PGHOST = "localhost"
$env:PGPORT = "5432"
$env:PGUSER = "postgres"
$env:PGPASSWORD = "password"
$env:PGDATABASE = "sectornine"
npm run db:backup
```

## Output and compression

The default output directory is `scripts/backups/`, which is already excluded
by `.gitignore`. Override it with `BACKUP_DIR`:

```powershell
$env:BACKUP_DIR = "D:\SectorNineBackups"
npm run db:backup
```

```bash
BACKUP_DIR=/var/backups/sector-nine npm run db:backup
```

The script writes a `.partial` archive first and only renames it to the final
timestamped filename after `pg_dump` succeeds. Failed partial files are
removed.

## Automatic scheduling

The command can be invoked by Windows Task Scheduler, cron, or another job
runner. The scheduler must provide the connection variables and a durable
`BACKUP_DIR`.

Example daily cron entry for 02:30:

```cron
30 2 * * * cd /opt/sector-nine && BACKUP_DIR=/var/backups/sector-nine /usr/bin/npm run db:backup >> /var/log/sector-nine-backup.log 2>&1
```

For Windows Task Scheduler:

- Program: `npm.cmd`
- Arguments: `run db:backup`
- Start in: the Sector Nine repository directory
- Configure database variables and `BACKUP_DIR` for the task account

Copy backups to encrypted off-site storage and define retention in that
storage system. This script deliberately does not silently delete archives.

## Verify an archive

This reads the archive catalog without changing a database:

```powershell
pg_restore --list scripts/backups/sectornine-<timestamp>.dump
```

## Restore instructions

Restoration can overwrite database objects. Stop the application, verify the
destination, and take a fresh backup before using `--clean`.

### Restore into an empty local database

```powershell
createdb --host=localhost --port=5432 --username=postgres sectornine_restore
$env:PGPASSWORD = "password"
pg_restore --host=localhost --port=5432 --username=postgres --dbname=sectornine_restore --no-owner --no-privileges --exit-on-error scripts/backups/sectornine-<timestamp>.dump
Remove-Item Env:PGPASSWORD
```

### Replace an existing local database

The destination database must already exist:

```powershell
$env:PGPASSWORD = "password"
pg_restore --host=localhost --port=5432 --username=postgres --dbname=sectornine --clean --if-exists --no-owner --no-privileges --exit-on-error scripts/backups/sectornine-<timestamp>.dump
Remove-Item Env:PGPASSWORD
```

### Restore to Railway

Use Railway's public connection details from a trusted machine:

```powershell
$env:PGHOST = "railway-public-host"
$env:PGPORT = "railway-public-port"
$env:PGUSER = "railway-user"
$env:PGPASSWORD = "railway-password"
$env:PGDATABASE = "railway-database"
$env:PGSSLMODE = "prefer"
pg_restore --clean --if-exists --no-owner --no-privileges --exit-on-error scripts/backups/sectornine-<timestamp>.dump
```

This is destructive. Confirm the Railway project, environment, service, and
database before restoring. Existing application connections may need to be
stopped.

After restoration:

1. Run a read-only connectivity check.
2. Verify critical row counts and recent records.
3. Reconnect the application.
4. Confirm authentication and administration operations.
