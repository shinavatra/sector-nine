# Confirmed Remaining Bugs

Only defects confirmed by current source and runtime inspection as of 2026-07-24
are listed. Deployment tasks remain in `PRODUCTION_CHECKLIST.md`.

## Critical

No unresolved critical code defect is currently confirmed.

## High

- CS 1.6 Fast Cup 5v5, L4D2 Versus 4v4, and CoD4 Promod 5v5 still require
  team rosters, team scoring, side changes, and game-specific completion
  handling. Migration `039` keeps those queues disabled so the legacy
  placeholder one-versus-one modes cannot create incorrect matches.
- Administrative match completion/edit/deletion recalculates legacy user
  totals but does not fully rebuild `user_game_stats` and `rating_history`.
  Per-game ranking can therefore drift after an administrator rewrites a
  completed match.

## Medium

- Notification creation does not consistently honor every stored notification
  preference.
- `GET /notifications` returns only the newest 50 records and has no cursor
  pagination.
- A participant can submit the final result for an in-progress match without
  opponent confirmation. Game-server/agent results are authoritative when that
  integration is available, but player-reported disputes need a workflow.
- Legacy HL1 totals in `users` and per-game totals in `user_game_stats` can
  diverge after administrative corrections.

## Operational

- The local database predates the migration runner. `schema_migrations` exists
  but migrations `001-039` are not baselined, so `db:migrate:status` reports
  them as pending. Do not run the full migration set against this database
  until schema comparison, backup, and baseline are completed.
- No real game server is configured in `game_servers`. Local HLDS is supported,
  but allocation and `changelevel` need a live end-to-end test once HLDS is
  running.
