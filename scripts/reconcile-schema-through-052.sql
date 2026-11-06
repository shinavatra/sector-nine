-- One-time, idempotent pre-baseline reconciliation for an existing database.
-- Keep this aligned with 055_reconcile_game_server_schema.sql. It intentionally
-- does not write schema_migrations; the normal runner records migration 055.
\ir ../src/server/055_reconcile_game_server_schema.sql
