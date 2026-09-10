import assert from 'node:assert/strict'
import fs from 'node:fs'

const server = fs.readFileSync('src/server/index.ts', 'utf8')
const adminServer = fs.readFileSync('src/server/admin.ts', 'utf8')
const displayUtil = fs.readFileSync('src/utils/displayName.ts', 'utf8')
const userContext = fs.readFileSync('src/contexts/UserContext.tsx', 'utf8')
const header = fs.readFileSync('src/components/Header.tsx', 'utf8')
const profile = fs.readFileSync('src/pages/Profile.tsx', 'utf8')
const config = fs.readFileSync('src/pages/Configuration.tsx', 'utf8')
const friends = fs.readFileSync('src/components/Friends.tsx', 'utf8')
const gameQueue = fs.readFileSync('src/components/GameQueue.tsx', 'utf8')
const activeMatches = fs.readFileSync('src/components/ActiveMatches.tsx', 'utf8')
const leaderboard = fs.readFileSync('src/components/Leaderboard.tsx', 'utf8')
const matchHistory = fs.readFileSync('src/components/MatchHistory.tsx', 'utf8')
const adminTable = fs.readFileSync('src/components/admin/AdminTable.tsx', 'utf8')
const adminPage = fs.readFileSync('src/pages/Admin.tsx', 'utf8')

assert.match(server, /const resolveDisplayName = \(user: any\) =>[\s\S]+steam_verified && user\?\.steam_persona_name[\s\S]+user\?\.display_name[\s\S]+user\?\.username/, 'backend resolver prioritizes verified Steam persona, then local display_name, then username')
assert.match(server, /displayName: resolveDisplayName\(u\)/, '/user/profile uses canonical displayName')
assert.match(server, /accountUsername: u\.username/, 'profile keeps internal username separate from public displayName')
assert.match(server, /localDisplayName: u\.display_name \|\| null/, 'profile exposes local display name separately')
assert.match(server, /const displayNameSql = \(alias: string\) =>[\s\S]+steam_verified=true[\s\S]+steam_persona_name[\s\S]+display_name[\s\S]+username/, 'backend SQL resolver uses the same precedence')
assert.match(server, /steam_persona_name=COALESCE\(\$5,steam_persona_name\)/, 'Steam profile refresh updates stored Steam persona name')
assert.match(server, /summary\.personaName \|\| username/, 'Steam-only account creation stores Steam persona as local display seed without requiring uniqueness in public name')
assert.doesNotMatch(server, /owns_hl1\s*=\s*true[\s\S]+createSteamUser/, 'Steam login does not grant game ownership')

assert.match(server, /app\.get\('\/leaderboard'[\s\S]+\$\{displayNameSql\('u'\)\} AS display_name/, 'leaderboard returns canonical display_name')
assert.match(server, /app\.get\('\/matches\/active'[\s\S]+player1_display_name[\s\S]+player2_display_name/, 'active matches return canonical player display names')
assert.match(server, /app\.get\('\/matches\/history'[\s\S]+player1_display_name[\s\S]+player2_display_name/, 'match history returns canonical player display names')
assert.match(server, /const getMatchmakingState[\s\S]+opponent_display_name/, 'matchmaking state returns canonical opponent display name')
assert.match(server, /app\.get\('\/friends'[\s\S]+AS "displayName"/, 'friends endpoint returns canonical displayName')
assert.match(server, /app\.get\('\/chat\/unread'[\s\S]+sender_name/, 'chat unread endpoint returns canonical sender name')
assert.match(server, /app\.get\('\/notifications'[\s\S]+sender_name/, 'notifications endpoint returns canonical sender name')

assert.match(adminServer, /safeUserColumns = `id,email,username,display_name AS local_display_name,\$\{displayNameSql\('users'\)\} AS display_name/, 'admin user serializer exposes canonical and local display names separately')
assert.match(adminServer, /router\.get\('\/queue'[\s\S]+\$\{displayNameSql\('u'\)\} AS display_name/, 'admin queue uses canonical display names')
assert.match(adminServer, /safeMatchColumns=`[\s\S]+player1_display_name[\s\S]+player2_display_name[\s\S]+winner_display_name/, 'admin match rows expose canonical player and winner names')
assert.match(adminServer, /router\.get\('\/tournaments\/:id'[\s\S]+\$\{displayNameSql\('u'\)\} AS display_name/, 'admin tournament participant data uses canonical names')

assert.match(displayUtil, /export const sanitizeDisplayName/, 'frontend shared display-name sanitizer exists')
assert.match(displayUtil, /normalize\(["']NFKC["']\)[\s\S]+replace\(\/\[\\u0000-\\u001f\\u007f\]/, 'frontend sanitizer strips control characters')
assert.match(displayUtil, /sanitizeDisplayName\(player\?\.displayName\)[\s\S]+sanitizeDisplayName\(player\?\.display_name\)[\s\S]+sanitizeDisplayName\(player\?\.name\)[\s\S]+sanitizeDisplayName\(player\?\.username\)/, 'frontend resolver uses canonical field before fallbacks')
assert.match(userContext, /accountUsername:[\s\S]+raw\.accountUsername[\s\S]+localDisplayName:[\s\S]+raw\.localDisplayName/, 'frontend user context normalizes accountUsername and localDisplayName')

for (const [name, source] of [
  ['Header', header],
  ['Profile', profile],
  ['Configuration', config],
  ['Friends', friends],
  ['GameQueue', gameQueue],
  ['ActiveMatches', activeMatches],
  ['Leaderboard', leaderboard],
  ['MatchHistory', matchHistory],
  ['AdminTable', adminTable],
  ['Admin', adminPage],
]) {
  assert.match(source, /displayPlayerName/, `${name} uses shared displayPlayerName resolver`)
}

assert.match(config, /steamDisplayNameAuthoritative[\s\S]+SYNCED FROM STEAM/, 'settings marks verified Steam display name as authoritative')
assert.doesNotMatch(header + profile + config + friends + gameQueue + activeMatches + leaderboard + matchHistory + adminTable + adminPage, /dangerouslySetInnerHTML/, 'player-name surfaces render as plain React text')

console.log('Display-name consistency regression checks passed')
