# Sector Nine Project Standards

This document is the canonical convention for new code and for incremental refactors. It
standardizes formatting, naming, folder ownership, TypeScript interfaces, HTTP APIs, and
PostgreSQL objects without changing existing runtime contracts.

## 1. Formatting

The repository formatting contract is defined by `.editorconfig` and `.prettierrc.json`.

### TypeScript, TSX, JSON, CSS, and Markdown

- UTF-8 files with LF line endings and one final newline.
- Two-space indentation; never tabs except in a `Makefile`.
- Single quotes in TypeScript and TSX.
- Semicolons enabled.
- Trailing commas wherever the language supports them.
- Maximum target line length of 100 characters.
- One declaration or logical operation per line.
- Blank lines separate imports, declarations, control-flow sections, and returns.
- Imports are ordered:
  1. React and third-party packages.
  2. Absolute project imports.
  3. Relative parent imports.
  4. Relative sibling imports.
  5. Type-only imports.
  6. Styles and assets.
- Use `import type` when an import is erased at runtime.
- Do not mechanically format generated UI primitives, generated CSS, build output, or
  historical migrations.

Prettier is not currently installed in the project. Do not add a `format` script until the
formatter and lockfile are added together in an approved dependency change.

## 2. Naming

### Files and folders

| Item | Convention | Example |
|---|---|---|
| React component file | PascalCase | `AdminDashboard.tsx` |
| React hook file | camelCase beginning with `use` | `useOnlineFriends.ts` |
| Non-React TypeScript module | camelCase | `apiClient.ts` |
| Type-only module | camelCase under `types/` | `admin.ts` |
| Test file | source name plus `.test` | `apiClient.test.ts` |
| SQL migration | zero-padded sequence plus snake_case | `018_add_session_version.sql` |
| CSS module | component name plus `.module.css` | `AdminDashboard.module.css` |
| General folder | lowercase plural noun | `components`, `pages`, `types` |

Do not use `.tsx` for modules that contain no JSX. Existing examples to migrate separately
include `api.tsx`, `badgeData.tsx`, `initializeData.tsx`, `steamAuth.tsx`, and
`steamDebug.tsx`.

### TypeScript identifiers

- Components, classes, interfaces, type aliases, and enums use `PascalCase`.
- Variables, functions, hooks, object properties, and module instances use `camelCase`.
- True application constants use `UPPER_SNAKE_CASE`.
- Boolean names begin with `is`, `has`, `can`, `should`, or `show`.
- Event handlers begin with `handle`; callback props begin with `on`.
- Async retrieval functions use `get`, `list`, or `find`; mutations use a precise verb such
  as `create`, `update`, `delete`, `grant`, `remove`, `equip`, or `cancel`.
- Avoid single-letter identifiers outside tight mathematical/index scopes.
- Avoid generic names such as `data`, `item`, `row`, `result`, or `value` when the domain
  name is known.

### Acronyms

Acronyms follow normal word casing:

- `apiClient`, not `APIClient`.
- `adminApi`, not `adminAPI`.
- `steamId`, not `steamID`.
- `rconPassword`, not `RCONPassword`.
- `vipExpiresAt`, not `VIPExpiresAt`.

Existing exported names such as `authAPI`, `userAPI`, and `adminAPI` are compatibility
contracts. Rename them only in one dedicated, type-checked change that updates every import.

## 3. Folder structure

New code should follow this ownership model:

```text
src/
  api/                 Shared browser API client and domain API modules
  assets/              Bundled images, fonts, and static media
  components/
    admin/             Administration-only components
    ui/                Generated/shared presentation primitives
  contexts/            React context providers only
  features/            Domain-specific UI, hooks, and local types
    auth/
    chat/
    friends/
    matchmaking/
    notifications/
    store/
    tournaments/
  hooks/               Truly cross-feature React hooks
  pages/               Route-level composition only
  server/
    routes/            Express routers grouped by domain
    services/          Domain operations independent of Express
    repositories/      PostgreSQL query ownership
    middleware/        Authentication, authorization, errors, logging
    migrations/        New ordered SQL migrations
  styles/              Shared global styles
  types/               Cross-feature DTOs and shared domain types
  utils/               Small stateless cross-feature utilities only
```

### Folder rules

- Pages compose features; they do not own reusable API clients or database-shaped types.
- Components used by one feature live inside that feature.
- `components/ui` remains presentation-only and contains no domain behavior.
- Context files contain provider/state ownership, not unrelated API DTO definitions.
- `utils` is not a catch-all. Domain-specific helpers stay with their domain.
- Backend route handlers do not own reusable SQL strings once a domain repository exists.
- Frontend and backend may share JSON DTO types only when they have the same compilation
  boundary and no server-only dependency leaks into the browser.

### Incremental migration order

The existing source tree should be migrated in small, behavior-preserving passes:

1. Create `src/api` and move the browser API client out of `utils`.
2. Create `src/types` and extract cross-feature user, administration, and API DTOs.
3. Move chat, friends, notifications, matchmaking, and store UI into `src/features`.
4. Keep route-level files in `pages` as thin composition components.
5. Split `src/server/index.ts` into routers, services, repositories, and middleware.
6. Split `src/server/admin.ts` by administration domain.
7. Place new migrations under `src/server/migrations`; preserve the existing migration
   locations until the migration runner supports the new path.

Do not combine these moves into one patch. Each pass must update imports, run type checking
when permitted, and preserve API and SQL behavior.

## 4. Interfaces and types

### Ownership

- Component-only props are named `<ComponentName>Props` and remain beside the component.
- Cross-feature domain types live under `src/types`.
- Transport types end in `Request`, `Response`, or `Dto`.
- PostgreSQL row types end in `Row` and use database `snake_case` properties.
- Frontend domain models use `camelCase`.
- Conversion between `Row` and domain/DTO shapes happens at an explicit mapper boundary.

### Shape rules

- Prefer `interface` for extensible object contracts.
- Prefer `type` for unions, intersections, mapped types, and function signatures.
- Never use `Record<string, any>` for a known domain object.
- Use `unknown` at untrusted boundaries and validate before narrowing.
- Avoid duplicate interfaces with the same domain meaning.
- Use discriminated unions for action/modal state instead of parallel nullable fields.
- Dates crossing JSON boundaries are ISO-8601 strings, not `Date` objects.
- Optional means omitted; nullable means present with `null`. Do not use them
  interchangeably.
- API list responses use one pagination shape:

```ts
interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}
```

### Current interface consolidation targets

- `SteamProfile` is declared separately in Steam utilities and Steam UI.
- User profile, notification preferences, and online-friend types currently live in
  `UserContext.tsx`; cross-feature consumers should import them from `src/types/user.ts`.
- Administration rows currently use `Record<string, any>`; replace this incrementally with
  domain DTOs such as `AdminUserDto`, `AdminServerDto`, and `AdminMatchDto`.
- Chat and friend transport objects are recreated locally in components; centralize their
  DTOs when their API modules move to `src/api`.
- API methods accepting `Record<string, any>` should receive named request types.

## 5. API naming

### Resource paths

New endpoints use:

- Lowercase plural nouns for resources.
- Hyphens only for multiword path segments.
- Path parameters named `:id` when the resource is unambiguous.
- Nested resources when the relationship is meaningful.
- Query parameters for filtering, sorting, searching, and pagination.
- HTTP methods for intent; avoid verbs in paths unless modeling a non-CRUD command.

Preferred examples:

```text
GET    /users/:id
PATCH  /users/:id
GET    /matches/:id
POST   /matches/:id/results
GET    /tournaments/:id/participants
POST   /tournaments/:id/participants
DELETE /tournaments/:id/participants/:userId
GET    /notifications
PATCH  /notifications/:id
```

Command endpoints use a consistent subresource:

```text
POST /matches/:id/actions/cancel
POST /users/:id/actions/deactivate
POST /servers/:id/actions/assign-match
```

### Response envelope

Successful single-resource responses:

```json
{
  "data": {}
}
```

Successful collection responses:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "pageSize": 25,
    "total": 0
  }
}
```

Error responses:

```json
{
  "error": {
    "code": "MATCH_NOT_FOUND",
    "message": "Match not found",
    "details": null
  }
}
```

Do not migrate existing responses piecemeal. Introduce a versioned API or a coordinated
frontend/backend migration so functionality remains unchanged.

### Current API consolidation targets

- Singular `/match/:id` and `/tournament/:id` paths coexist with plural resource paths.
- `/report` and `/ban` are singular while administration uses plural collections.
- Friend-request actions use mixed body IDs and path IDs.
- Notifications use `PUT` for partial read-state changes; choose `PATCH` for future APIs.
- `signup`/`signin` should be consistently named either `signUp`/`signIn` in TypeScript or
  `register`/`login` across both client and server.
- `getAll`, `getById`, and domain-specific names are mixed; prefer `list` and `get`.
- API module constants use uppercase acronym suffixes; future modules use `authApi`,
  `userApi`, `adminApi`, and so on.
- Direct `fetch` calls in components should move behind domain API modules.

## 6. SQL naming

### PostgreSQL objects

| Object | Convention | Example |
|---|---|---|
| Schema | snake_case | `public` |
| Table | plural snake_case | `tournament_participants` |
| Column | snake_case | `created_at` |
| Primary key | `id` | `id UUID PRIMARY KEY` |
| Foreign key column | singular resource plus `_id` | `tournament_id` |
| Boolean column | `is_` or `has_` prefix | `is_active` |
| Timestamp | `_at` suffix | `deleted_at` |
| Count | `_count` suffix | `participant_count` |
| Check constraint | `<table>_<column>_check` | `users_role_check` |
| Unique constraint | `<table>_<columns>_key` | `users_email_key` |
| Foreign key | `<table>_<column>_fkey` | `matches_winner_id_fkey` |
| Index | `idx_<table>_<columns>` | `idx_matches_status_created_at` |
| Trigger | `trg_<table>_<event>` | `trg_users_updated_at` |
| Function | verb-first snake_case | `set_updated_at` |

### Query formatting

- SQL keywords are uppercase.
- Tables and columns are lowercase snake_case.
- One selected column per line when a projection is long.
- Put each clause on its own line.
- Use explicit aliases with `AS`.
- Never use `SELECT *` in API response queries.
- Always qualify ambiguous columns.
- Bind values as parameters.
- Dynamic identifiers must come from a closed server-side allowlist.
- Use transactions for multi-table state changes.

Example:

```sql
SELECT
  u.id,
  u.username,
  u.created_at
FROM users AS u
WHERE u.deleted_at IS NULL
  AND u.role = $1
ORDER BY u.created_at DESC
LIMIT $2
OFFSET $3;
```

### Migration rules

- Applied migrations are immutable.
- A correction is a new migration, never an edit to an applied migration.
- New migrations are idempotent only where retry semantics require it.
- Destructive changes include explicit preconditions and rollback/restore instructions.
- Indexes on large live tables use `CONCURRENTLY` outside a transaction when appropriate.
- Every new foreign key is reviewed for a supporting index.
- Repository and Railway migration state must be reconciled before assuming a migration is
  applied.

### Current SQL consolidation targets

- Index prefixes vary between abbreviated and full table names, such as `idx_notif_*` and
  `idx_notifications_*`.
- Compatibility columns use both `ip`/`ip_address` and `slots`/`max_slots`.
- `current_participants` is a denormalized count alongside `tournament_participants`.
- Some migrations repeat earlier definitions for consistency verification.
- Long SQL statements embedded in route handlers are difficult to format and reuse.

Do not rename live constraints or indexes only for aesthetics. Rename or consolidate them in
explicit migrations after checking live usage and Railway schema state.

## 7. Current exceptions

The following are intentional temporary exceptions:

- Existing generated UI primitives keep their upstream formatting.
- Existing migrations remain untouched.
- Current endpoint paths and response envelopes remain unchanged until a coordinated API
  migration is approved.
- Existing API export names remain unchanged to preserve imports.
- Existing dirty administration/security files are not mechanically reformatted during
  unrelated work.

Each exception should be removed through a dedicated, reviewable change rather than broad
repository churn.

## 8. Review checklist

Before adding or changing code:

- [ ] Is the file in the correct ownership folder?
- [ ] Does its filename match its contents?
- [ ] Are domain types imported from one canonical module?
- [ ] Are untrusted values typed as `unknown` and validated?
- [ ] Does the API name describe the resource and operation consistently?
- [ ] Does the response follow the selected API version's envelope?
- [ ] Are SQL identifiers snake_case and constraints/indexes predictably named?
- [ ] Are SQL values parameterized?
- [ ] Is a schema change represented by a new migration?
- [ ] Does formatting match `.editorconfig` and `.prettierrc.json`?
- [ ] Are generated and historical files left untouched?
- [ ] Has the change preserved runtime behavior?
