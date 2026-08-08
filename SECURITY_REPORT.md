# Sector Nine Security Audit

> Historical audit from 2026-07-19. Subsequent work resolved or changed many findings, including rate limits, CORS, Helmet, JWT startup validation, encrypted RCON, Steam ownership proof, password reset, UUID validation, and safe error contracts. Use `PRODUCTION_CHECKLIST.md` and `RELEASE_STATUS_2026-07-22.md` for current release decisions.

Audit date: 2026-07-19  
Scope: React frontend, Express API, PostgreSQL access, JWT authentication, Steam integration, administration API, RCON handling, local environment configuration, and repository secret hygiene.

## Method and limitations

This was a static source and configuration audit. Trust boundaries were traced from browser inputs through API middleware and PostgreSQL queries, including authentication and administration paths. Environment-variable values were not printed or copied into this report.

No build, server, exploit, dependency download, external scan, commit, or push was performed. No live accounts or data were modified. Package vulnerability intelligence and deployed HTTP/TLS headers were not tested, so dependency CVEs, reverse-proxy behavior, and production-only infrastructure controls require separate verification.

## Executive summary

Four critical vulnerabilities were confirmed and fixed under the user's critical-vulnerability exception:

1. Direct Steam linking accepted a caller-provided SteamID without ownership proof.
2. Any authenticated account could finalize any match and submit arbitrary winner/stat values.
3. Production could silently fall back to a publicly known JWT signing secret.
4. Password-reset bearer tokens were written to application logs.

Open findings are primarily high- and medium-severity hardening gaps:

- No authentication or abuse rate limiting.
- Seven-day JWTs have no server-side revocation mechanism.
- Deactivated users can retain API access until their JWT expires because general authentication does not re-check account state.
- Steam OpenID lacks application state/nonce and explicit return URL/realm validation.
- RCON secrets are protected from API responses but stored as plaintext in PostgreSQL.
- JWTs are stored in `localStorage`, increasing the impact of any future XSS.
- CORS is unrestricted and security headers/CSP are absent from Express.
- Password reset tokens are stored in plaintext and reset passwords lack server-side length validation.
- Many API errors disclose raw database or internal error messages.

## Severity overview

| Severity | Confirmed | Fixed during audit | Open |
|---|---:|---:|---:|
| Critical | 4 | 4 | 0 |
| High | 8 | 0 | 8 |
| Medium | 10 | 0 | 10 |
| Low / informational | 6 | 0 | 6 |

Severity reflects the source currently in this workspace. Production controls not represented in the repository may change practical risk.

## Critical vulnerabilities fixed

### SEC-001: Steam account linking without ownership proof

Severity: Critical  
Status: Fixed in `src/server/index.ts`

The legacy `POST /steam/link` and `/user/steam/link` handlers accepted any syntactically valid 17-digit SteamID64, fetched that account's Steam data, and attached it to the authenticated Sector Nine account. SteamID knowledge is not ownership proof.

Impact:

- A user could claim another person's eligible Steam profile.
- Matchmaking ownership and ban checks could be applied to an unrelated Steam account.
- A later genuine Steam OpenID login for the claimed Steam account could resolve to the attacker's Sector Nine account, causing identity confusion or account exposure.

Fix:

- Direct ID linking now returns `410 STEAM_OPENID_REQUIRED`.
- Linking remains available only through `/steam/auth`, which verifies Steam's signed OpenID response server-side.

Follow-up:

- Remove obsolete frontend calls to direct linking in a separate compatibility cleanup.
- Add an integration test asserting that a raw SteamID can never alter `users.steam_id`.

### SEC-002: Broken authorization and integrity on match result submission

Severity: Critical  
Status: Fixed in `src/server/index.ts`

`POST /match/:id/result` previously required only a valid JWT. It did not require the caller to be a match participant, did not constrain the winner to the two players, accepted unbounded/invalid statistics, and performed match/player updates outside a transaction.

Impact:

- Any user could finish another match.
- Arbitrary users could be assigned as winners.
- Attackers could inflate or corrupt scores, XP, points, wins, losses, kills, and deaths.
- Concurrent submissions or partial failures could double-apply or split statistics.

Fix:

- The caller must be player one or player two.
- The match must be `in_progress`.
- The winner must be one of the match participants.
- All submitted statistics must be integers from 0 through 100,000.
- Match and player changes now run in one transaction with the match row locked.

Residual risk:

A participant can still lie about the result. A trustworthy final design should ingest results from an authenticated game-server/RCON agent, require both players to confirm matching results, or place disputed results into administrative review.

### SEC-003: Known JWT fallback secret in production

Severity: Critical  
Status: Fixed in `src/server/index.ts`

The server previously used a hard-coded, repository-visible JWT secret whenever `JWT_SECRET` was absent. A production misconfiguration would allow anyone knowing that value to forge user and administrator JWTs.

Fix:

- Production startup now fails unless `JWT_SECRET` is present, differs from the development fallback, and is at least 32 characters.
- The development fallback remains limited to non-production execution.

Configuration observation:

The locally configured JWT secret is present and is not the documented default, but it is 31 characters. If this configuration is used with `NODE_ENV=production`, the new safety check intentionally rejects startup. Replace it with a cryptographically random secret of at least 32 bytes before production deployment.

### SEC-004: Password-reset token disclosure in logs

Severity: Critical  
Status: Fixed in `src/server/index.ts`

Password reset tokens are bearer credentials. The reset endpoint logged the email address and full token, allowing anyone with log access to reset that account's password before expiration.

Fix:

- The token is no longer logged.
- The remaining development message records only that a reset was requested and that delivery is not configured.

Follow-up:

Password email delivery is not implemented. Do not restore token logging as a substitute.

## SQL injection

Overall result: No confirmed SQL injection.

Positive controls:

- User-controlled values are generally passed as PostgreSQL parameters.
- Dynamic user-list sorting is constrained by `allowedSort`.
- Dynamic administration update columns come from fixed field maps.
- Dynamic store table names are restricted to `badges` or `frames`.
- Dynamic profile update columns are selected from a server-owned map.

Items to preserve:

- Never allow raw request values to enter `ORDER BY`, table names, column names, predicates, or interval expressions.
- Continue treating every dynamic SQL identifier as safe only when selected from a closed server-side allowlist.
- Add regression tests for administration sort, catalog type, settings key, and filter parameters.

The SQL expressions that interpolate duration text still bind the underlying number as a parameter. They are not currently injectable, although direct interval arithmetic would be clearer.

## XSS

Overall result: No confirmed exploitable XSS, but impact would be high because JWTs are in `localStorage`.

Positive controls:

- React escapes text interpolation by default.
- User bios, names, report text, announcements, chat messages, and audit details are rendered as React text rather than injected HTML.
- Profile URLs are normalized to HTTPS.
- Custom data-image avatars allow raster formats and do not allow SVG.

Findings:

### SEC-005: Browser JWT persistence increases XSS impact

Severity: High

The access token is persisted as `localStorage.session_token`. Any successful same-origin XSS can read and exfiltrate it, including an administrator token.

Recommendation:

- Prefer a `Secure`, `HttpOnly`, `SameSite` session cookie with short-lived access sessions and server-managed refresh rotation.
- If bearer tokens remain, keep them only in memory where practical, shorten their lifetime, and implement refresh-token rotation.

### SEC-006: Dynamic CSS uses `dangerouslySetInnerHTML`

Severity: Medium

`src/components/ui/chart.tsx` generates CSS with `dangerouslySetInnerHTML`. Current chart configuration appears application-owned, so no exploit path was confirmed. If future API or user values reach chart keys/colors, CSS injection becomes possible.

Recommendation:

- Restrict keys to safe identifier characters.
- Validate colors against an explicit CSS color grammar or allowlist.
- Do not pass user-controlled values into `ChartConfig`.

### SEC-007: No Content Security Policy

Severity: Medium

No Express security-header middleware or repository CSP was found.

Recommendation:

- Add a production CSP covering scripts, styles, images, connections, frames, objects, base URIs, and form actions.
- Add `X-Content-Type-Options`, clickjacking protection via `frame-ancestors`, a strict referrer policy, and an appropriate permissions policy.
- Test the policy against Vite's production output before enforcement.

## CSRF and CORS

Overall result: Traditional authenticated CSRF risk is currently low because authentication uses an explicit `Authorization: Bearer` header rather than cookies. Browsers do not attach that header cross-site automatically.

### SEC-008: Unrestricted CORS

Severity: Medium

Express allows every origin for all supported API methods. This does not by itself expose bearer-authenticated data, but it unnecessarily broadens the browser trust surface and makes future cookie migration unsafe without additional controls.

Recommendation:

- Allow only the production frontend origin and explicitly configured development origins.
- Restrict allowed headers and review preflight caching.
- If authentication moves to cookies, add CSRF tokens or strict origin validation and use `SameSite` cookies.

### SEC-009: Steam login lacks application state binding

Severity: High

The Steam callback signature is checked with Steam, which prevents forged Steam identities. However, the application does not maintain a one-time state/nonce tying the initiated login to the callback browser, and the backend does not explicitly compare signed `openid.return_to` and `openid.realm` values against configured trusted origins.

Impact:

- Login CSRF/account-confusion scenarios are harder to rule out.
- A valid Steam assertion intended for an unexpected return target may not be rejected by application policy.

Recommendation:

- Generate a cryptographically random, short-lived, single-use state value when login starts.
- Store it server-side or in an HttpOnly, SameSite cookie and verify it on callback.
- Validate `openid.op_endpoint`, `openid.ns`, `openid.return_to`, and realm/host against exact configured values in addition to Steam's `check_authentication`.

## JWT, authentication, and sessions

### SEC-010: No JWT revocation or session version

Severity: High

JWTs last seven days. Password changes, account deactivation, role changes, and suspected compromise do not invalidate already issued general user tokens.

Recommendation:

- Add a per-user session version or `token_valid_after` timestamp and verify it during authentication.
- Rotate it on password change, deactivation, permanent deletion, and security-sensitive account changes.
- Use short-lived access tokens and rotated refresh tokens.
- Set and verify explicit issuer, audience, and allowed algorithm values.

### SEC-011: Deactivated users remain authenticated

Severity: High

General `requireAuth` verifies only the JWT signature and copies `sub`; it does not confirm that the user still exists and has `deleted_at IS NULL`. Individual routes are inconsistent about checking account state.

Recommendation:

- Make authentication load a minimal active-user/session record, or use a revocation cache/session table.
- Reject deleted, deactivated, banned-from-platform, or session-invalidated accounts centrally.

The administrator middleware is stronger: every administration request rechecks that the token subject is a live user with `role='admin'`.

### SEC-012: No brute-force or abuse rate limiting

Severity: High

No rate limiter was found for:

- Sign in and sign up.
- Password reset and password update.
- Steam authentication and Steam Web API refresh.
- Reports, chat, friend requests, or self-ban actions.
- Administration endpoints.

Recommendation:

- Add per-IP and per-account limits with stricter rules for authentication and reset paths.
- Add progressive delay or temporary lockout for repeated login failures.
- Rate-limit expensive Steam calls separately.
- Place complementary limits at the reverse proxy.

### SEC-013: Password reset implementation needs hardening

Severity: High

Reset tokens are random 256-bit values and expire after one hour, which is good. Remaining problems:

- Tokens are stored in plaintext, so read-only database compromise exposes usable credentials.
- `newPassword` on `/auth/update-password` has no type, minimum, or maximum length validation before bcrypt.
- Reset completion does not revoke existing JWTs.
- Email delivery is not implemented.

Recommendation:

- Store only a SHA-256 hash of the reset token.
- Validate password type and enforce the same 8–128 character policy used by password change.
- Consume the token atomically in a transaction.
- Invalidate all existing sessions after reset.
- Rate-limit both reset request and completion.

### Password hashing

Passwords use bcrypt with cost 12, and sign-in uses `bcrypt.compare`. This is acceptable. Enforce a maximum input size before every bcrypt operation and document bcrypt's effective input-length limitations. Consider Argon2id for a future planned migration, not an emergency change.

### Authentication responses

Sign-in uses a generic invalid-credentials response, which avoids direct account enumeration. Sign-up reports a combined “email or username taken” result. Password reset returns a generic success message regardless of account existence.

## Authorization and object access

### Administration endpoints

Overall result: Strong central role gate, with several defense-in-depth concerns.

Positive controls:

- The entire `/admin` router has middleware that verifies JWTs and queries PostgreSQL for a current, non-deleted administrator role.
- Administrative writes are generally transactional and audited.
- Dynamic fields and state transitions are mostly allowlisted and validated.
- The final administrator cannot be deleted through the reviewed user action.

Findings:

### SEC-014: No step-up authentication for destructive administration

Severity: Medium

A stolen seven-day administrator JWT is sufficient for role changes, bans, server secret replacement, platform settings changes, and permanent deletion.

Recommendation:

- Require recent reauthentication or MFA for permanent deletion, administrator-role changes, RCON replacement, and platform-wide security settings.
- Use shorter administrator sessions and separate administrator permissions rather than one broad role.

### SEC-015: Administration errors expose internals

Severity: Medium

Several error helpers return `error.message`, potentially disclosing SQL, schema, constraint, or infrastructure details to an authenticated administrator. Numerous public routes do the same.

Recommendation:

- Return stable public error codes/messages.
- Log detailed errors server-side with secret redaction and a correlation ID.

### SEC-016: Some object reads are broader than necessary

Severity: Medium

For example, authenticated users can request a match by arbitrary ID. The returned `SELECT *` may reveal fields to non-participants. Similar object-level access should be reviewed route by route.

Recommendation:

- Define explicit safe response columns.
- Require participant, friend, public-visibility, or administrator access according to the object.

## Steam verification

Positive controls:

- `/steam/auth` sends the signed OpenID fields back to Steam using `openid.mode=check_authentication`.
- Claimed identity must exactly match the HTTPS Steam Community OpenID ID format and contain a 17-digit SteamID64.
- Profile, game ownership, VAC status, and game-ban status are fetched server-side using the configured Steam API key.
- Matchmaking checks server-owned Steam eligibility fields.
- The Steam API key is not returned to the frontend.

Open risks:

- Add state/nonce and return-target validation as described in SEC-009.
- Steam Web API requests have no explicit timeout or abort signal. Add short timeouts and bounded retries.
- Cached verification lasts 24 hours. Define whether that delay is acceptable for newly applied VAC/game bans.
- Ensure a database uniqueness conflict while linking a Steam ID returns a controlled conflict without internal error leakage.

## RCON exposure

Overall result: The real RCON password is not exposed to the frontend by reviewed administration responses.

Positive controls:

- Server response columns return only `has_rcon`.
- Edit forms use a blank write-only password field.
- Audit details record only that the RCON password changed, not its value.
- Server delete audits use the same safe server projection.

### SEC-017: RCON password stored as plaintext

Severity: High

`game_servers.rcon_password` stores the operational secret directly. Database read access or a sufficiently privileged SQL injection elsewhere would expose every RCON credential.

Recommendation:

- Encrypt RCON passwords at the application boundary with authenticated encryption such as AES-256-GCM.
- Store the encryption key outside PostgreSQL in Railway/environment secret management.
- Use per-record nonces and key-version metadata to support rotation.
- Never hash RCON passwords if the application must recover them to connect; use encryption.
- Rotate all RCON credentials after implementing encryption or after any suspected database exposure.

## Sensitive logging and audit data

Positive controls:

- The database URL startup message masks the password.
- RCON values are excluded from response and audit projections.
- The reset token logging vulnerability was removed.

Findings:

### SEC-018: Raw error logging may capture sensitive upstream details

Severity: Medium

Steam and PostgreSQL error messages are logged directly. Current messages do not intentionally include API keys or passwords, but upstream/library changes can include URLs or connection details.

Recommendation:

- Use structured logging with an explicit redaction list for authorization headers, cookies, tokens, passwords, database URLs, Steam keys, RCON values, and reset credentials.
- Avoid logging full request bodies.
- Apply retention and access controls to `login_history` and `admin_audit_logs`, which contain IP addresses and user agents.

### SEC-019: User-controlled audit content

Severity: Low

Administrative reasons, notes, and selected before/after values enter JSON audit details. React rendering currently escapes them, but exports or future log viewers must also treat them as untrusted data.

## Environment variables and deployment configuration

Positive controls:

- `.env` and `.env.local` are ignored by Git.
- The inspected Git index does not track those files.
- `DATABASE_URL`, `JWT_SECRET`, and `STEAM_API_KEY` are server-side names rather than `VITE_*`, so Vite should not expose them.
- Only `VITE_API_URL` is intended for the frontend bundle.

Findings:

### SEC-020: Local secret does not meet new production minimum

Severity: Medium

The configured JWT secret is 31 characters. Its value was not displayed. Replace it with at least 32 cryptographically random bytes before running in production.

### SEC-021: Database TLS is deployment-dependent

Severity: Medium

`src/db.ts` does not explicitly configure SSL verification. Whether the database connection is encrypted depends on the connection string and provider/network behavior.

Recommendation:

- For Railway public networking, require TLS and verify the expected certificate chain.
- Prefer Railway private networking when the API and database share the project/network.
- Do not use `rejectUnauthorized: false` as a permanent production configuration.

### SEC-022: Environment validation is incomplete

Severity: Medium

Only the critical JWT production check now fails fast. Other required configuration is validated lazily.

Recommendation:

- Validate all required variables at startup with separate development/production schemas.
- Reject placeholder values.
- Validate `STEAM_RETURN_URL` as HTTPS in production and against the permitted frontend origin.
- Ensure `NODE_ENV=production` is set in production so safety checks activate.
- Rotate secrets through the provider rather than editing repository files.

## Additional observations

### Security headers and proxy configuration

No `helmet` middleware or explicit `trust proxy` policy was found. On Railway, proxy-aware IP handling should be configured narrowly so rate limits and audit IPs are accurate without trusting attacker-supplied forwarding headers.

### Input validation

Validation quality varies significantly. Administration routes are generally stricter than public endpoints. Reports, signup, reset completion, chat, and some match-related inputs need centralized schema validation and consistent length limits.

### Raw `SELECT *`

Several backend queries fetch entire rows, including password hashes or reset-token columns, before mapping or using a subset. These values are not necessarily returned, but retaining them in application objects increases accidental disclosure risk. Replace with explicit column lists.

### Account privacy

Review public-profile and leaderboard projections against `profile_visibility` and `show_online_status`. Privacy flags should be enforced in SQL/API responses, not only in React.

## Remediation priorities

### Immediate deployment checklist

1. Replace the JWT secret with at least 32 random bytes and ensure `NODE_ENV=production`.
2. Deploy the four critical fixes.
3. Confirm direct Steam linking returns `410` and only signed OpenID can attach an identity.
4. Confirm non-participants cannot submit match results and concurrent submissions cannot double-award statistics.
5. Confirm password-reset tokens are absent from all new logs.
6. Rotate any reset tokens that may have appeared in retained logs and restrict access to those logs.

### Next security iteration

1. Add authentication and abuse rate limiting.
2. Add central active-user/session validation and JWT revocation.
3. Harden the Steam OpenID flow with state and exact return-target checks.
4. Hash stored reset tokens and validate reset passwords.
5. Encrypt RCON credentials at rest.
6. Restrict CORS and add CSP/security headers.
7. Replace public raw error messages with stable codes.
8. Add object-level authorization tests and explicit response projections.

### Architecture follow-up

1. Move browser sessions to secure HttpOnly cookies or a short-lived token/rotated-refresh design.
2. Add trustworthy game-server result authentication rather than trusting either participant.
3. Add MFA or recent reauthentication for destructive administration.
4. Add automated dependency, secret, SAST, and container/deployment scanning in CI.

## Verification matrix

| Area | Result |
|---|---|
| SQL injection | No confirmed injection; dynamic identifiers are allowlisted |
| XSS | No confirmed exploit; CSP absent and localStorage makes future XSS high impact |
| CSRF | Low with bearer headers; Steam state binding and future cookie migration need controls |
| JWT | Critical fallback fixed; revocation, claims, algorithm restrictions remain |
| Authentication | bcrypt cost 12; reset validation, rate limits, and session invalidation remain |
| Authorization | Admin gate is strong; critical match-result authorization fixed; broader object access remains |
| Steam verification | Server-side OpenID verification exists; insecure direct linking fixed; state/return validation remains |
| Admin endpoints | Central live-admin database check and auditing present; step-up auth absent |
| RCON exposure | Not returned or audited; plaintext at rest remains high risk |
| Password handling | bcrypt used; reset token storage and validation need hardening |
| Sensitive logging | Reset credential leak fixed; structured redaction still needed |
| Environment variables | `.env` ignored; production validation and DB TLS need hardening |

## Files changed by this audit

- `src/server/index.ts`: four critical security fixes only.
- `SECURITY_REPORT.md`: this report.
