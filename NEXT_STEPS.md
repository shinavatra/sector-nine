# Next Development Session

> Superseded by `PRODUCTION_CHECKLIST.md` and `RELEASE_STATUS_2026-07-22.md`. The priorities below are retained only as historical context.

## Priority 0 - Preserve and reconcile

1. Review the five handoff files and the complete diff.
2. Decide whether `ServerHosting.tsx` must be restored.
3. Back up local/Railway, clone data, and reconcile migrations `001`-`025`.
4. Apply only missing migrations to the clone.
5. Run type-checks/tests and the ordered checklist in `FINAL_REPORT.md`.
6. Run the responsive viewport matrix and capture regressions before changing
   any additional layout CSS.

## Priority 1 - Release-blocking security

1. Bind Steam verification to the authenticated proven Steam account.
2. Disable unverified payment VIP until a real provider exists.
3. Fix permanent-ban semantics and enforce administrative mutes.
4. Reject deleted/deactivated users during authenticated requests.
5. Add regression integration tests for each control.

## Priority 2 - Transactional integrity

1. Replace process-local matchmaking coordination with locked PostgreSQL rows.
2. Prevent duplicate active matches and make result processing idempotent.
3. Reconcile admin match operations into per-game statistics.
4. Make tournament capacity/counters atomic.

## Priority 3 - Multi-game completion

1. Correct the generic admin server game-update contract.
2. Add generic database tournament detail routing.
3. Verify per-game queue, matches, history, leaderboard, stats, tournaments,
   maps, and server assignment end to end.
4. Enable one additional game at a time only after its tests pass.

## Priority 4 - Product hardening

1. Add notification pagination/preference enforcement.
2. Complete privacy enforcement and chat-delete semantics.
3. Runtime-test Store, achievements, profile, Steam, news, and themes.
4. Resolve Settings versus Configuration ownership.

## Priority 5 - Production operations

1. Add environment startup validation, rate limits, CORS/CSP/security headers,
   JWT revocation, external-request timeouts, and RCON encryption.
2. Establish migration, backup-restore, observability, and rollback runbooks.
3. Commit only after the reviewed diff and staging checklist are clean.
