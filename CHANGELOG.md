# Changelog

## Unreleased - session ending 2026-07-21

Only changes present in the current working tree are listed.

### Added

- Full PostgreSQL-backed administration managers for matches, moderation,
  Store catalog, news, and tournaments.
- Administration details/actions for users, servers, VIP, logs, dashboard,
  settings, reports, and bans.
- Achievements page and NewsFeed.
- Independent GameContext and ThemeContext.
- Notification state event helper.
- Migrations `017`-`025` for tournaments, notification conversations,
  leaderboard country, matchmaking state, Steam detail, news, Store catalog,
  theme preferences, and multi-game isolation.
- Compressed timestamped PostgreSQL backup script and `BACKUP.md`.
- README, database/security/performance/production/final audit documents,
  standards documentation, and repository formatting configuration.

### Changed

- Admin routing, responsive shell, sidebar drawer/backdrop, modals, tables,
  and immediate post-mutation state updates.
- Tournament, VIP, and log details now use section-owned request state.
- Tournament audit updates use `admin_audit_logs.details`, not nonexistent
  tournament metadata.
- Platform settings load globally, refresh after save, display announcements,
  and enforce maintenance for registration/matchmaking.
- Notifications now update unread counts immediately, merge polling by ID,
  and deduplicate unread conversation notifications.
- Friend accept/decline/cancel removes related request notifications.
- Public Store now reads PostgreSQL catalog and validates price/availability/
  ownership server-side.
- Badge purchase is disabled; owned badge data/admin APIs remain.
- Profile/social/chat/leaderboard cosmetics no longer display badges.
- Leaderboard, match history, queue, Steam, profile, and news use expanded
  PostgreSQL/backend state.
- Selected game and selected theme are stored and managed independently.
- Matchmaking, matches, tournaments, leaderboards, stats, and servers gained
  game context/filtering.
- Documentation, naming, API helpers, React state/calls, and CSS were cleaned.
- Profile cards were tightened, Match History repositioned, Friends management
  consolidated under Configuration, profile-frame rendering/selection restored,
  and theme controls kept in Configuration through the existing ThemeContext.
- Hub, leaderboard, match history, queue, tournament, Steam, Configuration,
  Store, and administration interfaces received scoped UI polish without
  changing their backend contracts.
- Shared responsive containment now prevents page-level horizontal overflow;
  crowded tabs and tables own their scrolling, dialogs fit the viewport,
  Global Chat fits mobile screens, and the footer uses safer breakpoints.

### Restored/preserved

- `ActiveMatches.tsx`, `BanSystem.tsx`, `GameQueue.tsx`, `Leaderboard.tsx`,
  `MatchHistory.tsx`, `Settings.tsx`, and `Leagues.tsx`.

### Removed

- `AdminExtendedActions.tsx`, 26 unreferenced generated UI primitive files,
  `globals.css`, `badgeData.tsx`, `initializeData.tsx`, and
  `ServerHosting.tsx`.
- Hardcoded public news/Store data, fake queue countdown behavior, and public
  badge purchase UI.

### Verification

- Confirmed protected feature files exist.
- Confirmed no current source references deleted paths.
- Confirmed all statically parsed relative imports resolve.
- Confirmed no temporary session console logging was present.
- `git diff --check` passed with line-ending warnings only.
- No build, server, migration, backup, commit, or push was run.
