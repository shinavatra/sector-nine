import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
require('ts-node/register/transpile-only')
const { resolveSteamLoginUser } = require('../src/server/steamAuthAccount.ts')

const server = fs.readFileSync('src/server/index.ts', 'utf8')
const api = fs.readFileSync('src/utils/api.tsx', 'utf8')
const steamAuth = fs.readFileSync('src/utils/steamAuth.tsx', 'utf8')
const authPage = fs.readFileSync('src/pages/Auth.tsx', 'utf8')
const callbackPage = fs.readFileSync('src/pages/SteamCallback.tsx', 'utf8')
const app = fs.readFileSync('src/App.tsx', 'utf8')
const userContext = fs.readFileSync('src/contexts/UserContext.tsx', 'utf8')
const integration = fs.readFileSync('src/components/SteamIntegration.tsx', 'utf8')
const setup = fs.readFileSync('src/pages/SteamSetup.tsx', 'utf8')
const verification = fs.readFileSync('src/pages/SteamGameVerification.tsx', 'utf8')
const migration = fs.readFileSync('src/server/040_steam_auth_login_and_link.sql', 'utf8')
const baseSchema = fs.readFileSync('src/server/001_schema.sql', 'utf8')

const steamAuthRoute = server.slice(
  server.indexOf("app.post('/steam/auth'"),
  server.indexOf("// Steam accounts may only be linked"),
)

assert.match(server, /INSERT INTO steam_auth_nonces\(nonce_hash,origin,expires_at,intent,user_id\)/, 'nonce stores server-side intent and link user id')
assert.match(server, /DELETE FROM steam_auth_nonces[\s\S]+RETURNING nonce_hash,intent,user_id/, 'nonce is consumed once and returns bound intent')
assert.match(server, /intent === 'link'[\s\S]+authenticatedUserId !== verified\.userId/, 'link callback requires matching authenticated session')
assert.match(server, /STEAM_ACCOUNT_ALREADY_LINKED/, 'linking rejects SteamID already linked to another user')
assert.match(server, /SELECT \* FROM users WHERE steam_id=\$1 LIMIT 1/, 'Steam auth looks up every SteamID owner before insert')
assert.doesNotMatch(steamAuthRoute, /WHERE steam_id=\$1 AND deleted_at IS NULL/, 'Steam owner lookup matches users_steam_id_key scope')
assert.match(server, /resolveSteamLoginUser\(/, 'login intent uses race-safe Steam account resolution')
assert.match(server, /steam_login_race_existing_user/, 'race recovery is logged explicitly')
assert.match(server, /steam_link_succeeded/, 'successful linking is logged explicitly')
assert.match(server, /steam_auth_succeeded/, 'successful Steam auth is logged explicitly')
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

const summary = { personaName: 'Gordon' }
const makeHarness = (initialUsers = []) => {
  const users = [...initialUsers]
  let creates = 0
  return {
    users,
    get creates() { return creates },
    findBySteamId: async steamId => users.find(user => user.steam_id === steamId),
    createUser: async steamId => {
      await Promise.resolve()
      if (users.some(user => user.steam_id === steamId)) {
        throw Object.assign(new Error('duplicate'), { code: '23505', constraint: 'users_steam_id_key' })
      }
      creates += 1
      const user = { id: `steam-${creates}`, steam_id: steamId, auth_provider: 'steam', owns_hl1: false }
      users.push(user)
      return user
    },
    updateProfile: async user => ({ ...user, profileUpdated: true }),
  }
}

const existing = { id: 'existing-user', steam_id: '76561198000000001', owns_hl1: false }
const existingHarness = makeHarness([existing])
const existingResult = await resolveSteamLoginUser({ steamId: existing.steam_id, summary, ...existingHarness })
assert.equal(existingResult.user.id, existing.id, 'existing SteamID logs into its exact owner')
assert.equal(existingHarness.creates, 0, 'existing SteamID is never inserted again')

const newHarness = makeHarness()
const firstLogin = await resolveSteamLoginUser({ steamId: '76561198000000002', summary, ...newHarness })
const secondLogin = await resolveSteamLoginUser({ steamId: '76561198000000002', summary, ...newHarness })
assert.equal(firstLogin.createdAccount, true, 'unknown SteamID creates a Steam-only account')
assert.equal(secondLogin.user.id, firstLogin.user.id, 'second login reuses the existing Steam account')
assert.equal(newHarness.creates, 1, 'repeated login creates only one account')
assert.equal(firstLogin.user.owns_hl1, false, 'Steam login does not grant game ownership')

let releaseCreate
const createGate = new Promise(resolve => { releaseCreate = resolve })
const raceUsers = []
let raceAttempts = 0
const raceHarness = {
  findBySteamId: async steamId => raceUsers.find(user => user.steam_id === steamId),
  createUser: async steamId => {
    raceAttempts += 1
    await createGate
    if (raceUsers.length) throw Object.assign(new Error('duplicate'), { code: '23505', constraint: 'users_steam_id_key' })
    const user = { id: 'race-winner', steam_id: steamId, owns_hl1: false }
    raceUsers.push(user)
    return user
  },
  updateProfile: async user => user,
}
const concurrent = [
  resolveSteamLoginUser({ steamId: '76561198000000003', summary, ...raceHarness }),
  resolveSteamLoginUser({ steamId: '76561198000000003', summary, ...raceHarness }),
]
await Promise.resolve()
releaseCreate()
const raceResults = await Promise.all(concurrent)
assert.equal(raceAttempts, 2, 'concurrent callbacks both reach the attempted first insert')
assert.equal(raceUsers.length, 1, 'concurrent first login creates only one user')
assert.deepEqual(raceResults.map(result => result.user.id), ['race-winner', 'race-winner'], '23505 loser re-queries and authenticates the winner')

assert.match(steamAuthRoute, /if \(intent === 'link'\)/, 'link behavior remains isolated to link intent')
assert.match(steamAuthRoute, /linkedUser && linkedUser\.id !== verified\.userId/, 'link refuses a SteamID owned by another user')
assert.match(steamAuthRoute, /STEAM_ACCOUNT_ALREADY_LINKED/, 'link conflict keeps its stable error code')
const loginBranch = steamAuthRoute.slice(steamAuthRoute.indexOf('} else {'), steamAuthRoute.indexOf('const token ='))
assert.doesNotMatch(loginBranch, /getOptionalUserId\(req\)/, 'login ignores a stale or unrelated browser JWT')
assert.match(baseSchema, /steam_id\s+TEXT\s+UNIQUE/, 'users.steam_id remains uniquely constrained')
assert.match(migration, /users_email_or_steam_auth_check/, 'email/password and Steam account invariants remain present')
assert.match(api, /if \(data\.session\?\.access_token\) \{[\s\S]+setSessionToken\(data\.session\.access_token\)/, 'frontend replaces an old local session with the Steam session')
assert.match(api, /steam_callback_token_stored/, 'token replacement emits safe frontend diagnostics')
assert.match(callbackPage, /await onLogin\(false\)/, 'successful callback awaits normal login completion instead of an unobserved timer')
assert.match(app, /steam_callback_profile_loading[\s\S]+await refreshProfile\(isSteamCallback \? 'steam_callback' : undefined\)[\s\S]+steam_callback_profile_loaded/, 'successful callback verifies the stored token through profile loading')
assert.match(app, /steam_callback_login_completed/, 'successful callback records completed login')
assert.match(app, /const handleLogin[\s\S]+await refreshProfile\(isSteamCallback \? 'steam_callback' : undefined\)[\s\S]+steam_callback_navigation_started[\s\S]+navigate\('hub', isSteamCallback\)/, 'normal login completion loads authenticated state before Hub navigation')
assert.match(userContext, /localStorage\.getItem\('session_token'\)[\s\S]+await refreshProfile\(\)/, 'page refresh restores the Steam session through the normal profile path')
assert.match(userContext, /if \(getSessionToken\(\) === token\) authAPI\.signout\(\{ reason: 'initial_profile_request_failed'/, 'failed stale-token initialization cannot clear a newer Steam JWT')
assert.match(callbackPage, /if \(window\.location\.pathname === '\/auth\/steam\/callback'\)/, 'callback cleanup cannot overwrite a completed Hub URL')
assert.doesNotMatch(callbackPage.slice(callbackPage.indexOf('setStatus("success")'), callbackPage.indexOf('} catch')), /setTimeout[\s\S]+onLogin/, 'successful callback cannot remain indefinitely behind a navigation timer')
assert.match(steamAuth, /STEAM_CALLBACK_COMPLETED_KEY[\s\S]+markSteamCallbackCompleted[\s\S]+wasSteamCallbackCompleted/, 'completed callback state is tracked separately from the one-time OpenID nonce')
assert.match(steamAuth, /activeSteamCallbackStates = new Set<string>\(\)[\s\S]+claimSteamCallback[\s\S]+activeSteamCallbackStates\.has\(state\)/, 'duplicate component instances cannot process the same callback state')
assert.match(callbackPage, /!claimSteamCallback\(window\.location\.href\)[\s\S]+steam_callback_duplicate_ignored/, 'a duplicate callback instance exits without a second terminal result or auth redirect')
assert.match(steamAuth, /createSteamLogin[\s\S]+removeItem\(STEAM_CALLBACK_COMPLETED_KEY\)/, 'a new Steam login clears the prior callback completion marker')
assert.match(callbackPage, /wasSteamCallbackCompleted\(\) && getSessionToken\(\)[\s\S]+onLogin\(false\)/, 'refresh after a completed callback restores the valid session without replaying OpenID')
assert.match(callbackPage, /if \(!steamAuthenticationSucceeded && getSessionToken\(\)\)[\s\S]+reason: 'existing_session'[\s\S]+await onLogin\(false\)/, 'expired callback with an existing valid session resolves through normal login completion')
assert.match(app, /navigate\('hub', isSteamCallback\)/, 'Steam callback completion replaces the callback URL while unmounting the callback page')
assert.ok(callbackPage.indexOf('await onLogin(false)') < callbackPage.indexOf('toast.success('), 'success toast is emitted only after profile and Hub completion')
assert.equal((callbackPage.match(/toast\.success\(/g) || []).length, 1, 'Steam callback has exactly one success terminal toast')
assert.equal((callbackPage.match(/toast\.error\(/g) || []).length, 1, 'Steam callback has exactly one failure terminal toast')
assert.match(userContext, /requestRevision !== profileRequestRevision\.current \|\| getSessionToken\(\) !== requestToken/, 'stale profile success cannot overwrite the current Steam session')
assert.match(userContext, /requestRevision === profileRequestRevision\.current && getSessionToken\(\) === requestToken\)[\s\S]+setUser\(null\)/, 'stale profile failure cannot clear the authenticated Steam user')
for (const event of [
  'steam_callback_mounted', 'steam_callback_processing_started', 'steam_callback_auth_success',
  'steam_callback_profile_request_started', 'steam_callback_profile_request_success',
  'steam_callback_user_state_updated', 'steam_callback_navigate_hub', 'steam_callback_unmounted',
  'app_current_page_changed', 'app_path_changed', 'app_authenticated_user_changed',
  'session_token_changed', 'session_token_cleared', 'steam_callback_success_toast',
  'steam_callback_failure_toast', 'navigate_auth', 'user_cleared',
]) {
  assert.ok([callbackPage, app, userContext, api].some(source => source.includes(event)), `safe transition log ${event} is present`)
}
assert.match(callbackPage, /callbackAttemptId[\s\S]+steam_callback_success_toast[\s\S]+callbackAttemptId/, 'terminal callback logs identify the component attempt without exposing credentials')
assert.match(callbackPage, /post_auth_login_completion_failed/, 'post-auth callback fallback records the exact auth navigation reason')
assert.match(app, /reason: 'unauthenticated_protected_page'[\s\S]+source: 'App\.unauthenticated_redirect_effect'/, 'App auth redirect records its exact reason and source')
assert.match(userContext, /reason: 'profile_request_failed'[\s\S]+requestRevision/, 'profile failures record why and which request cleared the user')
assert.match(api, /session_token_cleared'[\s\S]+\.\.\.metadata/, 'token clearing logs include caller-provided reason metadata')

console.log('Steam auth flow regression checks passed')
