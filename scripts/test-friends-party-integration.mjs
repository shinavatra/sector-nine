import assert from'node:assert/strict'
import fs from'node:fs'

const read=file=>fs.readFileSync(file,'utf8')
const friends=read('src/components/Friends.tsx'),party=read('src/components/PartyPanel.tsx'),notifications=read('src/pages/Notifications.tsx'),server=read('src/server/index.ts')

assert.match(friends,/PartyFriendAction/)
assert.match(friends,/partyAPI\.invite\(friend\.userId\)/)
assert.match(friends,/INVITE TO PARTY/)
assert.match(friends,/IN PARTY/)
assert.match(friends,/INVITED/)
assert.match(party,/INVITE FRIENDS/)
assert.match(party,/placeholder="Search friends\.\.\."/)
assert.match(party,/state\.outgoingInvites/)
assert.match(party,/presence==='in_match'\?'IN MATCH'/)
assert.match(party,/notifyNotificationsChanged/)
assert.match(notifications,/handlePartyInvite/)
assert.match(notifications,/related_party_invite_id/)
assert.match(notifications,/party_invite_actionable/)
assert.match(server,/PARTY_LEADER_REQUIRED/)
assert.match(server,/Party invites are limited to unblocked friends/)
assert.match(server,/PARTY_INVITE_PENDING/)
assert.match(server,/Party is full for the selected mode/)
assert.match(server,/SELECT \* FROM parties WHERE id=\$1 FOR UPDATE/)
assert.match(server,/event_key='party-invite:'\|\|pi\.id::text/)
assert.match(server,/DELETE FROM notifications WHERE user_id=\$1 AND event_key=\$2/)
assert.match(server,/PARTY_NOT_ALLOWED_IN_1V1/)

console.log('Friends and party integration contracts: PASS (21 assertions)')
