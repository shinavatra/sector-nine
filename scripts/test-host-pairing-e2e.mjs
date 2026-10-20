import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import net from 'node:net'
import process from 'node:process'
import {spawn,spawnSync} from 'node:child_process'
import pg from 'pg'
import bcrypt from 'bcryptjs'

const {Pool}=pg
const runId=crypto.randomUUID()
const shortId=runId.replaceAll('-','').slice(0,12)
const containerName=`sector-nine-pairing-e2e-${shortId}`
const databaseName='sector_nine_pairing_e2e'
const databaseUser='sector_nine_test'
const databasePassword=crypto.randomBytes(24).toString('hex')
const image='postgres:16-alpine'
let pool
let backend
let databaseUrl
let baseUrl
let passed=0

const docker=(args,options={})=>{
  const result=spawnSync('docker',args,{encoding:'utf8',windowsHide:true,...options})
  if(result.status!==0)throw new Error(`docker ${args[0]} failed: ${(result.stderr||result.stdout||'unknown error').trim()}`)
  return result.stdout.trim()
}
const sha256=value=>crypto.createHash('sha256').update(value).digest('hex')
const pairingCode=()=>{const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let value='';for(let index=0;index<8;index+=1)value+=alphabet[crypto.randomInt(alphabet.length)];return`SN-${value.slice(0,4)}-${value.slice(4)}`}
const uuid=()=>crypto.randomUUID()
const sleep=milliseconds=>new Promise(resolve=>setTimeout(resolve,milliseconds))

async function test(name,fn){
  try{await fn();passed+=1;console.log(`PASS ${name}`)}catch(error){console.error(`FAIL ${name}`);throw error}
}

async function freePort(){
  return new Promise((resolve,reject)=>{const server=net.createServer();server.unref();server.on('error',reject);server.listen(0,'127.0.0.1',()=>{const address=server.address();const port=typeof address==='object'&&address?address.port:0;server.close(error=>error?reject(error):resolve(port))})})
}

function assertIsolatedContainer(){
  const metadata=JSON.parse(docker(['inspect',containerName]))[0]
  assert.equal(metadata?.Config?.Labels?.['com.sectornine.test'],'host-pairing-e2e')
  assert.equal(metadata?.Config?.Labels?.['com.sectornine.run'],runId)
  assert.equal(metadata?.Config?.Env?.includes(`POSTGRES_DB=${databaseName}`),true)
}

async function waitForPostgres(){
  for(let attempt=0;attempt<60;attempt+=1){
    const ready=spawnSync('docker',['exec',containerName,'pg_isready','-U',databaseUser,'-d',databaseName],{encoding:'utf8',windowsHide:true})
    if(ready.status===0)return
    await sleep(500)
  }
  throw new Error('Isolated PostgreSQL did not become ready')
}

async function migrate(){
  assertIsolatedContainer()
  const result=spawnSync(process.execPath,['scripts/migrate-postgres.mjs'],{cwd:process.cwd(),encoding:'utf8',windowsHide:true,env:{...process.env,DATABASE_URL:databaseUrl,NODE_ENV:'test'}})
  if(result.status!==0)throw new Error(`Test migrations failed:\n${result.stdout}\n${result.stderr}`)
  console.log(result.stdout.trim())
}

async function startBackend(){
  const port=await freePort();baseUrl=`http://127.0.0.1:${port}`
  backend=spawn(process.execPath,['dist/server/index.js'],{cwd:process.cwd(),windowsHide:true,stdio:['ignore','pipe','pipe'],env:{...process.env,NODE_ENV:'test',PORT:String(port),DATABASE_URL:databaseUrl,JWT_SECRET:crypto.randomBytes(48).toString('hex'),APP_ORIGIN:'http://127.0.0.1:4173',PUBLIC_APP_URL:'http://127.0.0.1:4173',AUTH_COOKIE_SAME_SITE:'lax',AUTH_COOKIE_SECURE:'false',AUTH_COOKIE_PATH:'/auth',PASSWORD_RESET_ENABLED:'false',SERVE_FRONTEND:'false',LOG_LEVEL:'error'}})
  let output='';backend.stdout.on('data',chunk=>{output+=chunk});backend.stderr.on('data',chunk=>{output+=chunk})
  for(let attempt=0;attempt<80;attempt+=1){
    if(backend.exitCode!==null)throw new Error(`Backend exited during startup:\n${output}`)
    try{const response=await fetch(`${baseUrl}/health/ready`);if(response.ok)return}catch{}
    await sleep(250)
  }
  throw new Error(`Backend readiness timed out:\n${output}`)
}

async function request(path,{method='GET',credential,body,ip=`127.10.${crypto.randomInt(1,250)}.${crypto.randomInt(1,250)}`}={}){
  const headers={'X-Forwarded-For':ip}
  if(body!==undefined)headers['Content-Type']='application/json'
  if(credential)headers.Authorization=`Bearer ${credential}`
  const response=await fetch(`${baseUrl}${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)})
  const text=await response.text();let data=null
  if(text)try{data=JSON.parse(text)}catch{data=text}
  return{status:response.status,data,headers:response.headers}
}

async function createLoginAccount({index,role='user'}){
  const id=uuid(),email=`host-admin-e2e-${shortId}-${index}@example.test`,password=`Pairing-E2E-${shortId}-${index}!`
  const passwordHash=await bcrypt.hash(password,4)
  await pool.query('INSERT INTO users(id,email,username,password_hash,role) VALUES($1,$2,$3,$4,$5)',[id,email,`host_admin_e2e_${shortId}_${index}`,passwordHash,role])
  return{id,email,password,role}
}

async function signIn(account,ip){
  const response=await request('/auth/signin',{method:'POST',body:{email:account.email,password:account.password},ip})
  assert.equal(response.status,200)
  assert.ok(response.data?.session?.access_token)
  return response.data.session.access_token
}

async function createHost({name=`HOST-${shortId}`,enabled=true,expiresAt=new Date(Date.now()+600_000),usedAt=null,code=pairingCode()}={}){
  const id=uuid();await pool.query('INSERT INTO hosts(id,name,region,enabled,pairing_code_hash,pairing_expires_at,pairing_used_at) VALUES($1,$2,\'eu\',$3,$4,$5,$6)',[id,name,enabled,sha256(code),expiresAt,usedAt]);return{id,code,name}
}

async function pair(host,ip){
  const response=await request('/host-agent/pair',{method:'POST',body:{pairingCode:host.code,agentVersion:'e2e-test'},ip})
  return response
}

async function heartbeat(credential,profiles,ip){
  const capabilities={};for(const profile of profiles)(capabilities[profile.gameId]??=[]).push(profile.gameMode)
  return request('/host-agent/heartbeat',{method:'POST',credential,ip,body:{agentVersion:'e2e-test',capabilities,profiles}})
}

async function createServer({hostId,profileId,name,gameMode,port}){
  const id=uuid()
  await pool.query(`INSERT INTO game_servers(id,game,game_id,game_mode,region,name,ip,ip_address,port,public_host,public_port,rcon_host,rcon_port,slots,max_slots,status,host_id,host_profile_id)
    VALUES($1,'Half-Life 1','hl1',$2,'eu',$3,'127.0.0.1','127.0.0.1',$4,'127.0.0.1',$4,'127.0.0.1',$4,2,2,'online',$5,$6)`,[id,gameMode,name,port,hostId,profileId])
  await pool.query("UPDATE host_server_profiles SET approval_status='approved',matchmaking_enabled=TRUE,game_server_id=$1 WHERE host_id=$2 AND profile_id=$3",[id,hostId,profileId])
  return id
}

async function createUser(index,steamId){
  const id=uuid();await pool.query('INSERT INTO users(id,email,username,password_hash,steam_id) VALUES($1,$2,$3,$4,$5)',[id,`pairing-e2e-${shortId}-${index}@example.test`,`pairing_e2e_${shortId}_${index}`,'not-a-login-secret',steamId]);return id
}

async function createMatch({serverId,mode,player1Id,player2Id}){
  const id=uuid();await pool.query(`INSERT INTO matches(id,match_type,game_mode,game_id,matchmaking_region,player1_id,player2_id,selected_map,status,server_id)
    VALUES($1,$2,$2,'hl1','eu',$3,$4,'dm_crossfire','in_progress',$5)`,[id,mode,player1Id,player2Id,serverId]);await pool.query('UPDATE game_servers SET current_match_id=$1,status=\'in_use\' WHERE id=$2',[id,serverId]);return id
}

async function main(){
  if(process.env.DATABASE_URL||process.env.TEST_DATABASE_URL)console.log('Ignoring ambient database URLs: E2E harness accepts only its own Docker PostgreSQL container.')
  docker(['version','--format','{{.Server.Version}}'])
  docker(['image','inspect',image])
  docker(['run','--rm','-d','--name',containerName,'--label','com.sectornine.test=host-pairing-e2e','--label',`com.sectornine.run=${runId}`,'-e',`POSTGRES_DB=${databaseName}`,'-e',`POSTGRES_USER=${databaseUser}`,'-e',`POSTGRES_PASSWORD=${databasePassword}`,'-p','127.0.0.1::5432',image])
  assertIsolatedContainer();await waitForPostgres();assertIsolatedContainer()
  const port=docker(['port',containerName,'5432/tcp']).match(/:(\d+)$/)?.[1];assert.ok(port,'Docker did not publish an isolated PostgreSQL port')
  databaseUrl=`postgresql://${databaseUser}:${databasePassword}@127.0.0.1:${port}/${databaseName}`
  pool=new Pool({connectionString:databaseUrl,max:12})
  const identity=(await pool.query('SELECT current_database() database,current_user')).rows[0]
  assert.deepEqual(identity,{database:databaseName,current_user:databaseUser})
  await pool.query('CREATE TABLE e2e_isolation_marker(run_id UUID PRIMARY KEY,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())')
  await pool.query('INSERT INTO e2e_isolation_marker(run_id) VALUES($1)',[runId])
  await migrate()
  assert.equal((await pool.query('SELECT run_id::text FROM e2e_isolation_marker')).rows[0]?.run_id,runId)
  await startBackend()

  await test('admin provisions, pairs, links, revokes, re-pairs, disables, and enables a host through HTTP',async()=>{
    const admin=await createLoginAccount({index:'admin',role:'admin'}),user=await createLoginAccount({index:'user'})
    const [adminToken,userToken]=await Promise.all([signIn(admin,'127.15.0.1'),signIn(user,'127.15.0.2')])
    assert.equal((await request('/admin/hosts',{ip:'127.15.0.3'})).status,401)
    assert.equal((await request('/admin/hosts',{credential:userToken,ip:'127.15.0.4'})).status,403)

    const created=await request('/admin/hosts',{method:'POST',credential:adminToken,ip:'127.15.0.5',body:{name:`ADMIN-HOST-${shortId}`,region:'eu',description:'Disposable HTTP provisioning E2E'}})
    assert.equal(created.status,201)
    const hostId=created.data.host.id
    const issued=await request(`/admin/hosts/${hostId}/pairing-code`,{method:'POST',credential:adminToken,ip:'127.15.0.6'})
    assert.equal(issued.status,200)
    assert.match(issued.data.pairingCode,/^SN-[A-Z2-9]{4}-[A-Z2-9]{4}$/)
    const paired=await pair({id:hostId,code:issued.data.pairingCode},'127.15.0.7')
    assert.equal(paired.status,200)
    const firstCredential=paired.data.credential
    assert.equal((await request('/admin/hosts',{credential:firstCredential,ip:'127.15.0.8'})).status,401)

    const profiles=[
      {id:'admin-classic',name:'Admin Classic',gameId:'hl1',gameMode:'classic-deathmatch',localPort:27215,telemetryPort:27700,state:'ready',currentMatchId:null},
      {id:'admin-instagib',name:'Admin Instagib',gameId:'hl1',gameMode:'instagib-mode',localPort:27216,telemetryPort:27701,state:'ready',currentMatchId:null},
    ]
    assert.equal((await heartbeat(firstCredential,profiles,'127.15.0.9')).status,200)
    assert.equal((await heartbeat(firstCredential,profiles,'127.15.0.9')).status,200)
    const discovered=await pool.query('SELECT profile_id,approval_status FROM host_server_profiles WHERE host_id=$1 ORDER BY profile_id',[hostId])
    assert.equal(discovered.rowCount,2)
    assert.ok(discovered.rows.every(profile=>profile.approval_status==='pending_approval'))
    const rejected=await request(`/admin/hosts/${hostId}/profiles/admin-instagib/reject`,{method:'POST',credential:adminToken,ip:'127.15.1.1',body:{}})
    assert.equal(rejected.status,200);assert.equal(rejected.data.profile.approval_status,'rejected')
    const approved=await request(`/admin/hosts/${hostId}/profiles/admin-classic/approve`,{method:'POST',credential:adminToken,ip:'127.15.1.2',body:{displayName:'ADMIN-Admin Classic',publicHost:'127.0.0.1',publicPort:27215,rconHost:'127.0.0.1',rconPort:27215,maxPlayers:2}})
    assert.equal(approved.status,200);assert.equal(approved.data.profile.approval_status,'approved')
    const server=await request('/admin/servers',{method:'POST',credential:adminToken,ip:'127.15.1.3',body:{game:'Half-Life 1',gameId:'hl1',gameMode:'instagib-mode',region:'eu',name:'ADMIN-Admin Instagib',publicHost:'127.0.0.1',publicPort:27216,rconHost:'127.0.0.1',rconPort:27216,slots:2,status:'online',hostId,hostProfileId:'admin-instagib'}})
    assert.equal(server.status,201);assert.equal(server.data.server.host_id,hostId)
    const assignments=await request('/host-agent/assignments',{credential:firstCredential,ip:'127.15.0.10'})
    assert.equal(assignments.status,200)
    assert.equal(assignments.data.assignments.length,2)
    assert.equal((await heartbeat(firstCredential,[profiles[0]],'127.15.0.10')).status,200)
    const removed=(await pool.query("SELECT removed_at,approval_status,matchmaking_enabled FROM host_server_profiles WHERE host_id=$1 AND profile_id='admin-instagib'",[hostId])).rows[0]
    assert.ok(removed.removed_at);assert.equal(removed.approval_status,'pending_approval');assert.equal(removed.matchmaking_enabled,false)
    assert.equal((await request('/host-agent/assignments',{credential:firstCredential,ip:'127.15.0.10'})).data.assignments.length,1)
    assert.equal((await heartbeat(firstCredential,profiles,'127.15.0.10')).status,200)

    const revoked=await request(`/admin/hosts/${hostId}/revoke`,{method:'POST',credential:adminToken,ip:'127.15.0.11'})
    assert.equal(revoked.status,200)
    assert.equal((await request('/host-agent/assignments',{credential:firstCredential,ip:'127.15.0.12'})).status,401)
    const reissued=await request(`/admin/hosts/${hostId}/pairing-code`,{method:'POST',credential:adminToken,ip:'127.15.0.13'})
    assert.equal(reissued.status,200)
    const repaired=await pair({id:hostId,code:reissued.data.pairingCode},'127.15.0.14')
    assert.equal(repaired.status,200)
    assert.notEqual(repaired.data.credential,firstCredential)
    assert.equal((await request('/host-agent/assignments',{credential:firstCredential,ip:'127.15.0.15'})).status,401)
    assert.equal((await request('/host-agent/assignments',{credential:repaired.data.credential,ip:'127.15.0.16'})).status,200)

    const disabled=await request(`/admin/hosts/${hostId}/enabled`,{method:'POST',credential:adminToken,ip:'127.15.0.17',body:{enabled:false}})
    assert.equal(disabled.status,200)
    assert.equal((await request('/host-agent/assignments',{credential:repaired.data.credential,ip:'127.15.0.18'})).status,401)
    const enabled=await request(`/admin/hosts/${hostId}/enabled`,{method:'POST',credential:adminToken,ip:'127.15.0.19',body:{enabled:true}})
    assert.equal(enabled.status,200)
    assert.equal((await request('/host-agent/assignments',{credential:repaired.data.credential,ip:'127.15.0.20'})).status,200)
  })

  await test('matchmaking through trusted completion updates exactly one match and releases its server',async()=>{
    const admin=await createLoginAccount({index:'match-admin',role:'admin'}),adminToken=await signIn(admin,'127.16.0.1')
    const created=await request('/admin/hosts',{method:'POST',credential:adminToken,ip:'127.16.0.2',body:{name:`MATCH-HOST-${shortId}`,region:'eu'}})
    assert.equal(created.status,201)
    const hostId=created.data.host.id
    const issued=await request(`/admin/hosts/${hostId}/pairing-code`,{method:'POST',credential:adminToken,ip:'127.16.0.3'})
    const paired=await pair({id:hostId,code:issued.data.pairingCode},'127.16.0.4')
    assert.equal(paired.status,200)
    const hostCredential=paired.data.credential,profile={id:'match-classic',name:'Match Classic',gameId:'hl1',gameMode:'classic-deathmatch',localPort:27315,telemetryPort:27800,state:'ready',currentMatchId:null}
    assert.equal((await heartbeat(hostCredential,[profile],'127.16.0.5')).status,200)
    const serverResponse=await request('/admin/servers',{method:'POST',credential:adminToken,ip:'127.16.0.6',body:{game:'Half-Life 1',gameId:'hl1',gameMode:'classic-deathmatch',region:'eu',name:`MATCH-SERVER-${shortId}`,publicHost:'127.0.0.1',publicPort:27315,rconHost:'127.0.0.1',rconPort:27315,slots:2,status:'online',hostId,hostProfileId:profile.id}})
    assert.equal(serverResponse.status,201)
    const serverId=serverResponse.data.server.id

    const playerOne=await createLoginAccount({index:'match-p1'}),playerTwo=await createLoginAccount({index:'match-p2'})
    await pool.query("UPDATE users SET steam_id=$1,steam_verified=TRUE,owns_hl1=TRUE,verified_game_ids=ARRAY['hl1']::text[] WHERE id=$2",['76561198000001000',playerOne.id])
    await pool.query("UPDATE users SET steam_id=$1,steam_verified=TRUE,owns_hl1=TRUE,verified_game_ids=ARRAY['hl1']::text[] WHERE id=$2",['76561198000001001',playerTwo.id])
    const [tokenOne,tokenTwo]=await Promise.all([signIn(playerOne,'127.16.1.1'),signIn(playerTwo,'127.16.1.2')])
    const optionsResponse=await request('/matchmaking/options?game_id=hl1',{credential:tokenOne,ip:'127.16.1.3'})
    assert.equal(optionsResponse.status,200)
    const mapPool=optionsResponse.data.mapPools.find(item=>item.game_mode==='classic-deathmatch').maps
    assert.ok(mapPool.length>=10)
    const joinBody={gameId:'hl1',gameMode:'classic-deathmatch',selectedMaps:mapPool.slice(0,5),preferredRegion:'eu'}
    assert.equal((await request('/matchmaking/join',{method:'POST',credential:tokenOne,body:joinBody,ip:'127.16.1.4'})).status,200)
    const found=await request('/matchmaking/join',{method:'POST',credential:tokenTwo,body:joinBody,ip:'127.16.1.5'})
    assert.equal(found.status,200)
    assert.equal(found.data.state,'found')
    const matchId=found.data.match.id
    assert.equal((await request('/matchmaking/accept',{method:'POST',credential:tokenOne,body:{},ip:'127.16.1.6'})).status,200)
    assert.equal((await request('/matchmaking/accept',{method:'POST',credential:tokenTwo,body:{},ip:'127.16.1.7'})).status,200)
    assert.equal((await request('/matchmaking/maps',{method:'POST',credential:tokenOne,body:{selectedMaps:mapPool.slice(0,5)},ip:'127.16.1.8'})).status,200)
    assert.equal((await request('/matchmaking/maps',{method:'POST',credential:tokenTwo,body:{selectedMaps:mapPool.slice(5,10)},ip:'127.16.1.9'})).status,200)

    for(let sequence=0;sequence<9;sequence+=1){
      const state=(await request('/matchmaking/status',{credential:tokenOne,ip:`127.16.2.${sequence+1}`})).data
      const currentUserId=state.mapBan.currentTurnUserId,token=currentUserId===playerOne.id?tokenOne:tokenTwo
      const mapId=state.mapBan.remainingMaps.find(map=>map!=='dm_crossfire')??state.mapBan.remainingMaps[0]
      const banned=await request('/matchmaking/ban-map',{method:'POST',credential:token,body:{mapId},ip:`127.16.3.${sequence+1}`})
      assert.equal(banned.status,200,JSON.stringify(banned.data))
    }
    const assignedState=await request('/matchmaking/status',{credential:tokenOne,ip:'127.16.4.1'})
    assert.equal(assignedState.status,200)
    assert.equal(assignedState.data.state,'server_assigned')
    assert.equal(assignedState.data.match.id,matchId)
    assert.equal(assignedState.data.server.id,serverId)
    assert.equal(assignedState.data.match.selected_map,'dm_crossfire')
    const assignments=await request('/host-agent/assignments',{credential:hostCredential,ip:'127.16.4.2'})
    assert.equal(assignments.status,200)
    const assignment=assignments.data.assignments.find(item=>item.serverId===serverId).assignment
    assert.equal(assignment.matchId,matchId)
    assert.equal(assignment.selectedMap,'dm_crossfire')
    assert.equal(assignment.hldsMap,'crossfire')
    assert.deepEqual(new Set([assignment.player1.steamId,assignment.player2.steamId]),new Set(['76561198000001000','76561198000001001']))

    const before=(await pool.query('SELECT id,points,is_premium,vip_since,vip_expires_at FROM users WHERE id=ANY($1::uuid[]) ORDER BY id',[[playerOne.id,playerTwo.id]])).rows
    const players=[{name:'Player 1',steamId:assignment.player1.steamId},{name:'Player 2',steamId:assignment.player2.steamId}]
    const running=await request(`/game-server/${serverId}/heartbeat`,{method:'POST',credential:hostCredential,ip:'127.16.4.3',body:{type:'match_running',playerCount:2,players,map:'crossfire',observedAt:new Date().toISOString(),demoUrl:null}})
    assert.equal(running.status,200)
    const completion={type:'match_completed',reportId:uuid(),winnerId:assignment.player1.userId,playerCount:2,players,map:'crossfire',stats:{score_p1:10,score_p2:5,p1_kills:10,p1_deaths:5,p2_kills:5,p2_deaths:10},observedAt:new Date().toISOString(),demoUrl:null}
    const completed=await request(`/game-server/${serverId}/heartbeat`,{method:'POST',credential:hostCredential,ip:'127.16.4.4',body:completion})
    assert.equal(completed.status,200)
    assert.equal(completed.data.idempotent,false)
    const replay=await request(`/game-server/${serverId}/heartbeat`,{method:'POST',credential:hostCredential,ip:'127.16.4.5',body:completion})
    assert.equal(replay.status,200)
    assert.equal(replay.data.idempotent,true)
    const match=(await pool.query('SELECT status,winner_id,score_p1,score_p2,server_id FROM matches WHERE id=$1',[matchId])).rows[0]
    assert.deepEqual(match,{status:'completed',winner_id:assignment.player1.userId,score_p1:10,score_p2:5,server_id:serverId})
    const server=(await pool.query('SELECT status,current_match_id FROM game_servers WHERE id=$1',[serverId])).rows[0]
    assert.deepEqual(server,{status:'online',current_match_id:null})
    assert.equal(Number((await pool.query('SELECT COUNT(*) count FROM game_server_agent_reports WHERE match_id=$1',[matchId])).rows[0].count),1)
    assert.equal(Number((await pool.query('SELECT COUNT(*) count FROM rating_history WHERE match_id=$1',[matchId])).rows[0].count),2)
    const after=(await pool.query('SELECT id,points,is_premium,vip_since,vip_expires_at FROM users WHERE id=ANY($1::uuid[]) ORDER BY id',[[playerOne.id,playerTwo.id]])).rows
    assert.deepEqual(after.map(row=>({id:row.id,is_premium:row.is_premium,vip_since:row.vip_since,vip_expires_at:row.vip_expires_at})),before.map(row=>({id:row.id,is_premium:row.is_premium,vip_since:row.vip_since,vip_expires_at:row.vip_expires_at})))
  })

  await test('valid pairing stores hashes but not plaintext',async()=>{const host=await createHost(),result=await pair(host,'127.20.0.1');assert.equal(result.status,200);assert.ok(result.data.credential);const row=(await pool.query('SELECT pairing_code_hash,credential_hash,pairing_used_at FROM hosts WHERE id=$1',[host.id])).rows[0];assert.equal(row.pairing_code_hash,sha256(host.code));assert.notEqual(row.pairing_code_hash,host.code);assert.equal(row.credential_hash,sha256(result.data.credential));assert.notEqual(row.credential_hash,result.data.credential);assert.ok(row.pairing_used_at)})
  await test('invalid pairing code is rejected',async()=>{const result=await request('/host-agent/pair',{method:'POST',body:{pairingCode:'SN-AAAA-AAAA',agentVersion:'e2e-test'},ip:'127.20.0.2'});assert.equal(result.status,400);assert.equal(result.data.code,'PAIRING_INVALID')})
  await test('expired code is rejected',async()=>{const host=await createHost({expiresAt:new Date(Date.now()-1000)}),result=await pair(host,'127.20.0.3');assert.equal(result.status,410);assert.equal(result.data.code,'PAIRING_EXPIRED')})
  await test('already-used code is rejected',async()=>{const host=await createHost({usedAt:new Date()}),result=await pair(host,'127.20.0.4');assert.equal(result.status,409);assert.equal(result.data.code,'PAIRING_USED')})
  await test('disabled host is rejected',async()=>{const host=await createHost({enabled:false}),result=await pair(host,'127.20.0.5');assert.equal(result.status,403);assert.equal(result.data.code,'HOST_DISABLED')})

  await test('PostgreSQL row lock permits exactly one concurrent pairing winner',async()=>{
    for(let iteration=0;iteration<12;iteration+=1){const host=await createHost({name:`RACE-${iteration}-${shortId}`}),ip=`127.30.${iteration}.1`,results=await Promise.all([pair(host,ip),pair(host,ip)]);assert.deepEqual(results.map(result=>result.status).sort((a,b)=>a-b),[200,409]);assert.equal(results.find(result=>result.status===409)?.data?.code,'PAIRING_USED');const winner=results.find(result=>result.status===200).data.credential,row=(await pool.query('SELECT credential_hash,pairing_used_at FROM hosts WHERE id=$1',[host.id])).rows[0];assert.equal(row.credential_hash,sha256(winner));assert.ok(row.pairing_used_at);const audits=await pool.query("SELECT COUNT(*)::int count FROM admin_audit_logs WHERE action='host.paired' AND target_id=$1",[host.id]);assert.equal(audits.rows[0].count,1)}
  })

  let hostA,hostB,credentialA,credentialB,newCredentialA,serverA1,serverA2,serverB1,matchA1,matchA2
  const profilesA=[
    {id:'hl1-classic',name:'HL1 Classic',gameId:'hl1',gameMode:'classic-deathmatch',localPort:27015,telemetryPort:27500,state:'ready',currentMatchId:null},
    {id:'hl1-instagib',name:'HL1 Instagib',gameId:'hl1',gameMode:'instagib-mode',localPort:27016,telemetryPort:27501,state:'ready',currentMatchId:null},
  ]
  const profilesB=[{id:'hl1-classic-b',name:'HL1 Classic B',gameId:'hl1',gameMode:'classic-deathmatch',localPort:27115,telemetryPort:27600,state:'ready',currentMatchId:null}]

  await test('two hosts pair independently and report isolated heartbeats',async()=>{hostA=await createHost({name:`HOST-A-${shortId}`});hostB=await createHost({name:`HOST-B-${shortId}`});const [pairedA,pairedB]=await Promise.all([pair(hostA,'127.40.0.1'),pair(hostB,'127.40.0.2')]);assert.equal(pairedA.status,200);assert.equal(pairedB.status,200);credentialA=pairedA.data.credential;credentialB=pairedB.data.credential;assert.notEqual(credentialA,credentialB);assert.equal((await heartbeat(credentialA,profilesA,'127.40.0.3')).status,200);assert.equal((await heartbeat(credentialB,profilesB,'127.40.0.4')).status,200);const rows=(await pool.query('SELECT id,status,profiles FROM hosts WHERE id=ANY($1::uuid[]) ORDER BY id',[ [hostA.id,hostB.id] ])).rows;assert.equal(rows.length,2);assert.ok(rows.every(row=>row.status==='online'));assert.equal(rows.find(row=>row.id===hostA.id).profiles.length,2)})

  await test('one host receives two separate server assignments and not another host server',async()=>{serverA1=await createServer({hostId:hostA.id,profileId:'hl1-classic',name:'A Classic',gameMode:'classic-deathmatch',port:27015});serverA2=await createServer({hostId:hostA.id,profileId:'hl1-instagib',name:'A Instagib',gameMode:'instagib-mode',port:27016});serverB1=await createServer({hostId:hostB.id,profileId:'hl1-classic-b',name:'B Classic',gameMode:'classic-deathmatch',port:27115});const a=await request('/host-agent/assignments',{credential:credentialA,ip:'127.40.0.5'}),b=await request('/host-agent/assignments',{credential:credentialB,ip:'127.40.0.6'});assert.equal(a.status,200);assert.equal(b.status,200);assert.deepEqual(new Set(a.data.assignments.map(item=>item.serverId)),new Set([serverA1,serverA2]));assert.deepEqual(new Set(b.data.assignments.map(item=>item.serverId)),new Set([serverB1]))})

  const userIds=[]
  await test('matches and events remain isolated between two profiles',async()=>{for(const [index,steam] of ['76561198000000000','76561198000000001','76561198000000002','76561198000000003'].entries())userIds.push(await createUser(index,steam));matchA1=await createMatch({serverId:serverA1,mode:'classic-deathmatch',player1Id:userIds[0],player2Id:userIds[1]});matchA2=await createMatch({serverId:serverA2,mode:'instagib-mode',player1Id:userIds[2],player2Id:userIds[3]});const event={type:'kill',eventId:uuid(),sequence:7,occurredAt:new Date().toISOString(),actorUserId:userIds[0],targetUserId:userIds[1],weapon:'weapon_gauss'};const accepted=await request(`/game-server/${serverA1}/events`,{method:'POST',credential:credentialA,body:event,ip:'127.40.0.7'});assert.equal(accepted.status,201);assert.equal(Number((await pool.query('SELECT COUNT(*) count FROM match_events WHERE match_id=$1 AND source_event_id=$2',[matchA1,event.eventId])).rows[0].count),1);assert.equal(Number((await pool.query('SELECT COUNT(*) count FROM match_events WHERE match_id=$1 AND source_event_id=$2',[matchA2,event.eventId])).rows[0].count),0)})

  await test('another host cannot read or report to foreign game servers',async()=>{const assignment=await request(`/game-server/${serverA1}/assignment`,{credential:credentialB,ip:'127.40.0.8'});assert.equal(assignment.status,401);const report=await request(`/game-server/${serverA1}/heartbeat`,{method:'POST',credential:credentialB,ip:'127.40.0.9',body:{type:'heartbeat',playerCount:0,players:[],map:null}});assert.equal(report.status,401);const event=await request(`/game-server/${serverA1}/events`,{method:'POST',credential:credentialB,ip:'127.40.0.10',body:{type:'kill',eventId:uuid(),sequence:8,occurredAt:new Date().toISOString(),actorUserId:userIds[0],targetUserId:userIds[1],weapon:'weapon_gauss'}});assert.equal(event.status,401)})

  await test('completion releases only its assigned server',async()=>{const completion={type:'match_completed',reportId:uuid(),winnerId:userIds[0],playerCount:2,players:[{name:'p1',steamId:'STEAM_0:0:19867136'},{name:'p2',steamId:'[U:1:39734273]'}],map:'crossfire',stats:{score_p1:10,score_p2:5,p1_kills:10,p1_deaths:5,p2_kills:5,p2_deaths:10},observedAt:new Date().toISOString()};const response=await request(`/game-server/${serverA1}/heartbeat`,{method:'POST',credential:credentialA,body:completion,ip:'127.40.0.11'});assert.equal(response.status,200);const rows=(await pool.query('SELECT id,current_match_id,status FROM game_servers WHERE id=ANY($1::uuid[])',[ [serverA1,serverA2] ])).rows,a1=rows.find(row=>row.id===serverA1),a2=rows.find(row=>row.id===serverA2);assert.equal(a1.current_match_id,null);assert.equal(a1.status,'online');assert.equal(a2.current_match_id,matchA2);assert.equal(a2.status,'in_use');assert.equal((await pool.query('SELECT status FROM matches WHERE id=$1',[matchA2])).rows[0].status,'in_progress')})

  await test('revoke blocks old credential and re-pair activates only the new credential',async()=>{await pool.query("UPDATE hosts SET credential_hash=NULL,credential_revoked_at=NOW(),status='offline' WHERE id=$1",[hostA.id]);assert.equal((await request('/host-agent/assignments',{credential:credentialA,ip:'127.40.0.12'})).status,401);const newCode=pairingCode();await pool.query('UPDATE hosts SET pairing_code_hash=$1,pairing_expires_at=NOW()+INTERVAL \'10 minutes\',pairing_used_at=NULL WHERE id=$2',[sha256(newCode),hostA.id]);const paired=await pair({...hostA,code:newCode},'127.40.0.13');assert.equal(paired.status,200);newCredentialA=paired.data.credential;assert.notEqual(newCredentialA,credentialA);assert.equal((await request('/host-agent/assignments',{credential:credentialA,ip:'127.40.0.14'})).status,401);assert.equal((await request('/host-agent/assignments',{credential:newCredentialA,ip:'127.40.0.15'})).status,200);assert.equal((await pair({...hostA,code:newCode},'127.40.0.16')).status,409);const row=(await pool.query('SELECT credential_hash,credential_revoked_at,pairing_code_hash FROM hosts WHERE id=$1',[hostA.id])).rows[0];assert.equal(row.credential_hash,sha256(newCredentialA));assert.equal(row.credential_revoked_at,null);assert.equal(row.pairing_code_hash,sha256(newCode))})

  const migrations=(await pool.query('SELECT name FROM schema_migrations ORDER BY name')).rows.map(row=>row.name)
  assert.ok(migrations.includes('045_hosts_and_pairing.sql'));assert.ok(migrations.includes('046_secure_auth_sessions.sql'));assert.ok(migrations.includes('047_host_server_profiles.sql'))
  console.log(`E2E COMPLETE: ${passed} HTTP/PostgreSQL scenarios passed; 12/12 pairing races produced exactly one winner.`)
  console.log(`MIGRATIONS: ${migrations.length} applied (${migrations[0]} through ${migrations.at(-1)}).`)
}

async function cleanup(){
  if(backend&&!backend.killed){backend.kill();await Promise.race([new Promise(resolve=>backend.once('exit',resolve)),sleep(3000)])}
  if(pool)await pool.end().catch(()=>undefined)
  try{const metadata=JSON.parse(docker(['inspect',containerName]))[0];if(metadata?.Config?.Labels?.['com.sectornine.run']!==runId)throw new Error('Refusing to remove a container without the current E2E run label');docker(['rm','-f',containerName])}catch(error){if(!String(error).includes('No such object'))console.error(`Cleanup warning: ${error.message}`)}
}

main().catch(error=>{console.error(error.stack||error);process.exitCode=1}).finally(cleanup)
