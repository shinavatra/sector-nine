import assert from 'node:assert/strict'
import fs from 'node:fs'

const server = fs.readFileSync('src/server/index.ts', 'utf8')
const api = fs.readFileSync('src/utils/api.tsx', 'utf8')
const steamAuth = fs.readFileSync('src/utils/steamAuth.tsx', 'utf8')
const authPage = fs.readFileSync('src/pages/Auth.tsx', 'utf8')
const callbackPage = fs.readFileSync('src/pages/SteamCallback.tsx', 'utf8')
const integration = fs.readFileSync('src/components/SteamIntegration.tsx', 'utf8')
const setup = fs.readFileSync('src/pages/SteamSetup.tsx', 'utf8')
const verification = fs.readFileSync('src/pages/SteamGameVerification.tsx', 'utf8')
const migration = fs.readFileSync('src/server/040_steam_auth_login_and_link.sql', 'utf8')

const steamAuthRoute = server.slice(
  server.indexOf("app.post('/steam/auth'"),
  server.indexOf("// Steam accounts may only be linked"),
)

assert.match(server, /INSERT INTO steam_auth_nonces\(nonce_hash,origin,expires_at,intent,user_id\)/, 'nonce stores server-side intent and link user id')
assert.match(server, /DELETE FROM steam_auth_nonces[\s\S]+RETURNING nonce_hash,intent,user_id/, 'nonce is consumed once and returns bound intent')
assert.match(server, /intent === 'link'[\s\S]+authenticatedUserId !== verified\.userId/, 'link callback requires matching authenticated session')
assert.match(server, /STEAM_ACCOUNT_ALREADY_LINKED/, 'linking rejects SteamID already linked to another user')
assert.match(server, /const linkedResult = await pool\.query\('SELECT \* FROM users WHERE steam_id=\$1/, 'Steam auth looks up existing users by steam_id')
assert.match(server, /else if \(linkedUser\)[\s\S]+saveSteamProfileSummary/, 'existing linked SteamID signs in without creating duplicate user')
assert.match(server, /else \{[\s\S]+createSteamUser\(steamId, summary\)/, 'unknown SteamID creates a Steam-only user')
assert.match(server, /email,username,password_hash[\s\S]+VALUES \(NULL,\$1,NULL/, 'Steam-only user is created without fake email or password')
assert.match(server, /role,auth_provider,[\s\S]+'user','steam'/, 'new Steam users are normal users with steam auth provider')
assert.doesNotMatch(steamAuthRoute, /fetchSteamData\(/, 'Steam login does not run ownership/VAC verification path')
assert.doesNotMatch(steamAuthRoute, /owns_hl1\s*=\s*true|verified_game_ids\s*=/, 'Steam login does not grant game ownership')
assert.match(steamAuthRoute, /session: \{ access_token: token \}/, 'Steam auth returns normal JWT session')
assert.match(server, /INVALID_STEAM_CALLBACK/, 'invalid OpenID callback is rejected')
assert.match(migration, /ALTER COLUMN email DROP NOT NULL/, 'migration allows Steam-only users without email')
assert.match(migration, /ALTER COLUMN password_hash DROP NOT NULL/, 'migration allows Steam-only users without password')
assert.match(api, /startAuthentication: async \(intent: 'login' \| 'link' = 'login'\)/, 'frontend Steam API passes explicit intent')
assert.match(steamAuth, /initiateSteamLogin = async \(intent: SteamAuthIntent = 'login'\)/, 'shared Steam helper supports explicit intent')
assert.match(authPage, /initiateSteamLogin\('login'\)/, 'login/register Steam button starts login intent')
assert.match(integration, /initiateSteamLogin\('link'\)/, 'profile Steam integration starts link intent')
assert.match(setup, /initiateSteamLogin\('link'\)/, 'Steam setup starts link intent')
assert.match(verification, /initiateSteamLogin\('link'\)/, 'Steam verification starts link intent')
assert.doesNotMatch(callbackPage, /This Steam account is not linked\. Register or sign in with email\/password, then connect Steam\./, 'login callback no longer shows link-only failure')
assert.match(server, /bcrypt\.compare\(password, user\.password_hash\)/, 'email/password signin path remains present')

console.log('Steam auth flow regression checks passed')
