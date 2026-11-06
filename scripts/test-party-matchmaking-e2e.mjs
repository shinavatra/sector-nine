import assert from'node:assert/strict'
import crypto from'node:crypto'
import net from'node:net'
import{spawn}from'node:child_process'
import pg from'pg'
import bcrypt from'bcryptjs'
import dotenv from'dotenv'
dotenv.config()
const{Pool}=pg,pool=new Pool({connectionString:process.env.DATABASE_URL})
const run=crypto.randomUUID().replaceAll('-','').slice(0,10),created=[]
let backend,baseUrl,backendOutput=''
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))
const freePort=()=>new Promise((resolve,reject)=>{const server=net.createServer();server.unref();server.on('error',reject);server.listen(0,'127.0.0.1',()=>{const address=server.address();server.close(error=>error?reject(error):resolve(address.port))})})
async function request(path,{method='GET',token,body,ip=`127.70.0.${crypto.randomInt(2,250)}`}={}){const headers={'X-Forwarded-For':ip};if(token)headers.Authorization=`Bearer ${token}`;if(body!==undefined)headers['Content-Type']='application/json';const response=await fetch(`${baseUrl}${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});let data;try{data=await response.json()}catch{data=null}return{status:response.status,data}}
async function account(index){const id=crypto.randomUUID(),email=`party-${run}-${index}@example.test`,password=`Party-${run}-${index}!`,hash=await bcrypt.hash(password,4);await pool.query(`INSERT INTO users(id,email,username,password_hash,steam_id,steam_verified,owns_hl1,verified_game_ids) VALUES($1,$2,$3,$4,$5,true,true,ARRAY['hl1','cs16']::text[])`,[id,email,`party_${run}_${index}`,hash,`7656119${String(index).padStart(10,'0')}`]);created.push(id);const login=await request('/auth/signin',{method:'POST',body:{email,password}});assert.equal(login.status,200,`${JSON.stringify(login.data)}\n${backendOutput}`);return{id,token:login.data.session.access_token}}
async function befriend(a,b){await pool.query(`INSERT INTO friendships(user_id,friend_id,status) VALUES($1,$2,'accepted')`,[a.id,b.id])}
async function createPair(a,b){assert.equal((await request('/party',{method:'POST',token:a.token})).status,201);const invited=await request('/party/invite',{method:'POST',token:a.token,body:{userId:b.id}});assert.equal(invited.status,201);assert.equal((await request(`/party/invites/${invited.data.inviteId}/accept`,{method:'POST',token:b.token})).status,200);assert.equal((await request('/party/ready',{method:'PATCH',token:b.token,body:{ready:true}})).status,200)}
async function queue(user,teamSize=1){const options=(await request('/matchmaking/options?game_id=hl1',{token:user.token})).data;const maps=options.mapPools.find(row=>row.game_mode==='classic-deathmatch').maps.slice(0,5);return request('/matchmaking/join',{method:'POST',token:user.token,body:{gameId:'hl1',gameMode:'classic-deathmatch',teamSize,selectedMaps:maps,preferredRegion:'eu'}})}
async function start(){const port=await freePort();baseUrl=`http://127.0.0.1:${port}`;backend=spawn(process.execPath,['dist/server/index.js'],{cwd:process.cwd(),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,PORT:String(port),JWT_SECRET:`party-e2e-${crypto.randomBytes(32).toString('hex')}`,NODE_ENV:'test',SERVE_FRONTEND:'false',LOG_LEVEL:'error'}});backend.stdout.on('data',chunk=>backendOutput+=chunk);backend.stderr.on('data',chunk=>backendOutput+=chunk);for(let i=0;i<60;i++){try{if((await fetch(`${baseUrl}/health/ready`)).ok)return}catch{}await sleep(200)}throw new Error(`backend did not become ready\n${backendOutput}`)}
async function cleanup(){if(backend&&!backend.killed)backend.kill();if(created.length){await pool.query(`DELETE FROM matches WHERE id IN(SELECT match_id FROM match_participants WHERE user_id=ANY($1::uuid[]))`,[created]);await pool.query('DELETE FROM users WHERE id=ANY($1::uuid[])',[created])}await pool.end()}
try{
  await start()
  const users=[];for(let index=0;index<14;index++)users.push(await account(index))
  for(let i=0;i<12;i++)for(let j=i+1;j<12;j++)await befriend(users[i],users[j])
  await createPair(users[0],users[1])
  const denied=await queue(users[0],1);assert.equal(denied.status,409,`${JSON.stringify(denied.data)}\n${backendOutput}`);assert.equal(denied.data.code,'PARTY_NOT_ALLOWED_IN_1V1')
  assert.equal((await request(`/party/members/${users[1].id}`,{method:'DELETE',token:users[0].token})).status,200)
  let invite=await request('/party/invite',{method:'POST',token:users[0].token,body:{userId:users[1].id}});await request(`/party/invites/${invite.data.inviteId}/accept`,{method:'POST',token:users[1].token});await request('/party/ready',{method:'PATCH',token:users[1].token,body:{ready:true}})
  assert.equal((await request('/party/leader',{method:'PATCH',token:users[0].token,body:{userId:users[1].id}})).status,200)
  assert.equal((await request('/party',{method:'DELETE',token:users[1].token})).status,200)
  await pool.query('INSERT INTO user_blocks(blocker_id,blocked_user_id) VALUES($1,$2)',[users[0].id,users[1].id]);await request('/party',{method:'POST',token:users[0].token});const blocked=await request('/party/invite',{method:'POST',token:users[0].token,body:{userId:users[1].id}});assert.equal(blocked.status,403);assert.equal(blocked.data.code,'PARTY_INVITE_NOT_ALLOWED');await request('/party',{method:'DELETE',token:users[0].token});await pool.query('DELETE FROM user_blocks WHERE blocker_id=$1',[users[0].id])
  await createPair(users[0],users[1]);const hl1Options=(await request('/matchmaking/options?game_id=hl1',{token:users[0].token})).data;const twoVTwo=hl1Options.modeRules.find(rule=>rule.rule_id==='hl1-ag-2v2');assert.equal(twoVTwo.team_size,2);assert.equal(twoVTwo.total_players,4);assert.equal(twoVTwo.max_party_size,2);assert.equal(twoVTwo.matchmaking_available,false);assert.equal(twoVTwo.server_pipeline_ready,false);const disabled2v2=await queue(users[0],2);assert.equal(disabled2v2.status,409);assert.equal(disabled2v2.data.code,'MODE_UNAVAILABLE')
  assert.equal((await queue(users[12],1)).data.state,'searching');const soloFound=await queue(users[13],1);assert.equal(soloFound.data.totalPlayers,2);assert.ok(['found','accepting'].includes(soloFound.data.state))
  const csOptions=(await request('/matchmaking/options?game_id=cs16',{token:users[0].token})).data;assert.equal(csOptions.modeRules.find(rule=>rule.rule_id==='cs16-clan-war').max_party_size,5);const unavailable=await request('/matchmaking/join',{method:'POST',token:users[0].token,body:{gameId:'cs16',gameMode:'competitive-1v1',teamSize:5,selectedMaps:[],preferredRegion:'eu'}});assert.equal(unavailable.data.code,'GAME_MATCHMAKING_DISABLED')
  for(const game of ['cod4','l4d2']){const options=(await request(`/matchmaking/options?game_id=${game}`,{token:users[0].token})).data;assert.equal(options.enabled,false);assert.ok(options.modeRules.every(rule=>!rule.matchmaking_available))}
  console.log('party matchmaking E2E: PASS (party lifecycle, block rules, disabled HL1 2v2, HL1 1v1, unavailable games)')
}finally{await cleanup()}
