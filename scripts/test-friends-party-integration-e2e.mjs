import assert from'node:assert/strict'
import crypto from'node:crypto'
import net from'node:net'
import{spawn}from'node:child_process'
import pg from'pg'
import bcrypt from'bcryptjs'
import dotenv from'dotenv'
dotenv.config()

if(!process.env.TEST_DATABASE_URL){console.log('Friends and party E2E: SKIP (TEST_DATABASE_URL is not configured for an isolated PostgreSQL database)');process.exit(0)}
const{Pool}=pg,pool=new Pool({connectionString:process.env.TEST_DATABASE_URL}),run=crypto.randomUUID().replaceAll('-','').slice(0,10),created=[]
let backend,baseUrl,backendOutput=''
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const freePort=()=>new Promise((resolve,reject)=>{const server=net.createServer();server.unref();server.on('error',reject);server.listen(0,'127.0.0.1',()=>{const address=server.address();server.close(error=>error?reject(error):resolve(address.port))})})
async function request(path,{method='GET',token,body,ip=`127.71.0.${crypto.randomInt(2,250)}`}={}){const headers={'X-Forwarded-For':ip};if(token)headers.Authorization=`Bearer ${token}`;if(body!==undefined)headers['Content-Type']='application/json';const response=await fetch(`${baseUrl}${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});let data;try{data=await response.json()}catch{data=null}return{status:response.status,data}}
async function account(index){const id=crypto.randomUUID(),email=`friends-party-${run}-${index}@example.test`,password=`Party-${run}-${index}!`,hash=await bcrypt.hash(password,4);await pool.query(`INSERT INTO users(id,email,username,password_hash,steam_id,steam_verified,owns_hl1,verified_game_ids) VALUES($1,$2,$3,$4,$5,true,true,ARRAY['hl1']::text[])`,[id,email,`fp_${run}_${index}`,hash,`7656120${String(index).padStart(10,'0')}`]);created.push(id);const login=await request('/auth/signin',{method:'POST',body:{email,password}});assert.equal(login.status,200);return{id,token:login.data.session.access_token,username:`fp_${run}_${index}`}}
const befriend=(a,b)=>pool.query(`INSERT INTO friendships(user_id,friend_id,status) VALUES($1,$2,'accepted')`,[a.id,b.id])
async function start(){const port=await freePort();baseUrl=`http://127.0.0.1:${port}`;backend=spawn(process.execPath,['dist/server/index.js'],{cwd:process.cwd(),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,DATABASE_URL:process.env.TEST_DATABASE_URL,PORT:String(port),JWT_SECRET:`friends-party-${crypto.randomBytes(32).toString('hex')}`,NODE_ENV:'test',SERVE_FRONTEND:'false',LOG_LEVEL:'error'}});backend.stdout.on('data',chunk=>backendOutput+=chunk);backend.stderr.on('data',chunk=>backendOutput+=chunk);for(let i=0;i<60;i++){try{if((await fetch(`${baseUrl}/health/ready`)).ok)return}catch{}await sleep(200)}throw new Error(`backend did not become ready\n${backendOutput}`)}
async function cleanup(){if(backend&&!backend.killed)backend.kill();if(created.length)await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[created]);await pool.end()}

try{
  await start();const leader=await account(1),friend=await account(2),other=await account(3),blocked=await account(4);await befriend(leader,friend);await befriend(leader,other);await befriend(leader,blocked);await befriend(friend,other)
  assert.equal((await request('/party',{method:'POST',token:leader.token})).status,201)
  const invited=await request('/party/invite',{method:'POST',token:leader.token,body:{userId:friend.id}});assert.equal(invited.status,201)
  const duplicate=await request('/party/invite',{method:'POST',token:leader.token,body:{userId:friend.id}});assert.equal(duplicate.status,409);assert.equal(duplicate.data.code,'PARTY_INVITE_PENDING')
  const leaderState=await request('/party',{token:leader.token});assert.ok(leaderState.data.outgoingInvites.some(item=>item.invitee_id===friend.id))
  const friendState=await request('/party',{token:friend.token});assert.equal(friendState.data.invites[0].id,invited.data.inviteId);assert.equal(friendState.data.invites[0].display_name,leader.username)
  const notice=await request('/notifications?filter=all',{token:friend.token});const partyNotice=notice.data.notifications.find(item=>item.type==='party_invite');assert.equal(partyNotice.related_party_invite_id,invited.data.inviteId);assert.equal(partyNotice.party_invite_actionable,true);assert.match(partyNotice.message,new RegExp(leader.username))
  assert.equal((await request(`/party/invites/${invited.data.inviteId}/decline`,{method:'POST',token:friend.token})).status,200);assert.equal((await request('/notifications?filter=all',{token:friend.token})).data.notifications.some(item=>item.type==='party_invite'),false)
  const acceptedInvite=await request('/party/invite',{method:'POST',token:leader.token,body:{userId:friend.id}});assert.equal((await request(`/party/invites/${acceptedInvite.data.inviteId}/accept`,{method:'POST',token:friend.token})).status,200);assert.equal((await request('/notifications?filter=all',{token:friend.token})).data.notifications.some(item=>item.type==='party_invite'),false)
  const unauthorized=await request('/party/invite',{method:'POST',token:friend.token,body:{userId:other.id}});assert.equal(unauthorized.status,403);assert.equal(unauthorized.data.code,'PARTY_LEADER_REQUIRED')
  await request('/party',{method:'DELETE',token:leader.token});await pool.query('INSERT INTO user_blocks(blocker_id,blocked_user_id) VALUES($1,$2)',[blocked.id,leader.id]);await request('/party',{method:'POST',token:leader.token});const denied=await request('/party/invite',{method:'POST',token:leader.token,body:{userId:blocked.id}});assert.equal(denied.status,403);assert.equal(denied.data.code,'PARTY_INVITE_NOT_ALLOWED')
  await pool.query('DELETE FROM user_blocks WHERE blocker_id=$1 AND blocked_user_id=$2',[blocked.id,leader.id]);const partyId=(await request('/party',{token:leader.token})).data.party.id;await pool.query("UPDATE parties SET selected_game_id='hl1',selected_game_mode='classic-deathmatch',selected_team_size=2 WHERE id=$1",[partyId]);const first=await request('/party/invite',{method:'POST',token:leader.token,body:{userId:friend.id}}),second=await request('/party/invite',{method:'POST',token:leader.token,body:{userId:other.id}});assert.equal(first.status,201);assert.equal(second.status,201)
  const raced=await Promise.all([request(`/party/invites/${first.data.inviteId}/accept`,{method:'POST',token:friend.token}),request(`/party/invites/${second.data.inviteId}/accept`,{method:'POST',token:other.token})]);assert.deepEqual(raced.map(item=>item.status).sort(),[200,409]);assert.equal(raced.find(item=>item.status===409).data.code,'PARTY_FULL');assert.equal(Number((await pool.query('SELECT COUNT(*) count FROM party_members WHERE party_id=$1',[partyId])).rows[0].count),2)
  const options=(await request('/matchmaking/options?game_id=hl1',{token:leader.token})).data,maps=options.mapPools.find(row=>row.game_mode==='classic-deathmatch').maps.slice(0,5),queue=await request('/matchmaking/join',{method:'POST',token:leader.token,body:{gameId:'hl1',gameMode:'classic-deathmatch',teamSize:1,selectedMaps:maps,preferredRegion:'eu'}});assert.equal(queue.status,409);assert.equal(queue.data.code,'PARTY_NOT_ALLOWED_IN_1V1')
  console.log('Friends and party E2E: PASS (invite UI contract backend, notifications, decline/accept, duplicate, leader/block, capacity race, 1v1 restriction)')
}finally{await cleanup()}
