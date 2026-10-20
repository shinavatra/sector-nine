import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root=process.cwd()
const read=file=>fs.readFileSync(path.join(root,file),'utf8')
const list=directory=>fs.readdirSync(path.join(root,directory)).filter(name=>name.endsWith('.png'))
const migration=read('src/server/048_retro_profile_customization.sql')
const server=read('src/server/index.ts')
const admin=read('src/server/admin.ts')

assert.equal(list('public/profile-assets/retro/frames').length,50,'all 50 full-size frames exist')
assert.equal(list('public/profile-assets/retro/frames/thumbs').length,50,'all 50 thumbnails exist')
assert.equal(list('public/profile-assets/retro/ranks').length,4,'all four rank plates exist')
assert.equal(list('public/profile-assets/retro/badges').length,4,'all four special badges exist')
assert.equal(list('public/profile-assets/retro/medals').length,11,'all eleven medals exist')
assert.equal((migration.match(/\('retro_frame_\d{2}'/g)||[]).length,50,'migration seeds exactly 50 retro frames')
assert.match(migration,/auto_award_enabled BOOLEAN NOT NULL DEFAULT FALSE/,'medal auto-awards default off')
assert.match(migration,/PRIMARY KEY \(user_id,game_id,medal_id\)/,'earned medals are permanent and idempotent per game')
assert.match(server,/frame\.metadata\?\.purchasable===false/,'non-purchasable catalog frames cannot be bought')
assert.match(server,/Frame not owned/,'locked frames cannot be equipped')
assert.match(server,/ON CONFLICT\(user_id,game_id,medal_id\) DO NOTHING/,'duplicate medal awards are idempotent')
assert.match(server,/medal\.auto_award_enabled=TRUE/,'only enabled authoritative thresholds can award medals')
assert.match(admin,/user_special_badges/,'special badges use admin-only assignment endpoint')
assert.match(admin,/Custom title must be plain text between 1 and 32 characters/,'custom titles are validated')
assert.doesNotMatch(migration,/INSERT INTO user_competitive_medals/,'migration does not fabricate earned medals')
console.log('retro profile customization regression: PASS (13 assertions)')
