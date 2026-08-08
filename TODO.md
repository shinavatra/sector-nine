# Unfinished or Blocked Work

> Superseded by the unchecked items in `PRODUCTION_CHECKLIST.md`. This older list is retained only as historical context.

- Reconcile and apply migrations `017`-`025` to local `sectornine` and Railway
  `railway` using backups and a staging clone.
- Run the prohibited-in-this-session TypeScript/build/test passes.
- Runtime-test every new admin action, modal, responsive breakpoint, audit row,
  notification flow, Store purchase, Steam flow, theme, and game context.
- Manually verify every page at 375, 600, 768, 900, 1024, 1200, 1366, and
  1920 pixels, including mobile tab scrolling, dialogs, Global Chat, and all
  internally scrolling tables.
- Review whether deleted `src/pages/ServerHosting.tsx` is a planned product
  feature; restore/preserve it if so.
- Bind Steam game verification to the OpenID-proven account.
- Replace simulated/unverified payment VIP with a real provider and ledger.
- Fix permanent-ban predicates and enforce mutes in chat.
- Add active-user/session revocation checks to authentication.
- Make PostgreSQL the sole, transactionally locked matchmaking authority.
- Add active-match uniqueness and idempotent result processing.
- Reconcile admin match changes into `user_game_stats`.
- Make tournament registration capacity atomic and add generic DB tournament
  detail routing.
- Remove the non-HL1 restriction from the generic admin server PATCH or make
  that field explicitly unsupported in its contract.
- Add notification cursor pagination and enforce notification preferences.
- Finish privacy enforcement and precise chat-delete responses.
- Enable/test CS 1.6, L4D2, and COD4 only after ownership, map, server,
  matchmaking, and statistics validation.
- Decide whether legacy Settings should be retired or merged into
  Configuration; do not expose both.
- Add the future News comments UI/API only when product requirements are ready.
- Add JWT revocation, rate limits, explicit CORS/CSP/security headers, startup
  environment validation, Steam request timeouts/state binding, and encrypted
  RCON storage.
