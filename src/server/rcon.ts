import crypto from 'crypto'
import type {Pool,PoolClient} from 'pg'
import SourceRcon from 'rcon-srcds'

type Db=Pool|PoolClient
type ServerRow={id:string;game_id:string;rcon_host:string;rcon_port:number;rcon_secret_encrypted:string;current_match_id?:string|null}

const encryptionKey=()=>{
  const raw=process.env.RCON_ENCRYPTION_KEY||''
  if(!/^[0-9a-f]{64}$/i.test(raw))throw new Error('RCON_ENCRYPTION_KEY must contain 64 hexadecimal characters')
  return Buffer.from(raw,'hex')
}

export const encryptRconSecret=(secret:string)=>{
  const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',encryptionKey(),iv)
  const encrypted=Buffer.concat([cipher.update(secret,'utf8'),cipher.final()]),tag=cipher.getAuthTag()
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`
}

export const decryptRconSecret=(value:string)=>{
  const [version,ivValue,tagValue,ciphertext]=String(value||'').split(':')
  if(version!=='v1'||!ivValue||!tagValue||!ciphertext)throw new Error('Stored RCON secret is invalid')
  const decipher=crypto.createDecipheriv('aes-256-gcm',encryptionKey(),Buffer.from(ivValue,'base64'))
  decipher.setAuthTag(Buffer.from(tagValue,'base64'))
  return Buffer.concat([decipher.update(Buffer.from(ciphertext,'base64')),decipher.final()]).toString('utf8')
}

const importGoldSrc=()=>Function('return import("goldsrc-rcon")')() as Promise<{rconCommand:(host:string,port:number,password:string,command:string,options?:Record<string,number>)=>Promise<string>}>

const quakeCommand=(host:string,port:number,password:string,command:string)=>new Promise<string>((resolve,reject)=>{
  // quake3-rcon has no TypeScript declarations and uses a callback API.
  const Q3Rcon=require('quake3-rcon')
  const client=new Q3Rcon({address:host,port,password,debug:false})
  const timer=setTimeout(()=>reject(new Error('RCON command timed out')),5000)
  client.send(command,(response:string)=>{clearTimeout(timer);resolve(String(response||''))})
})

export const sendRconCommand=async(server:ServerRow,command:string)=>{
  const password=decryptRconSecret(server.rcon_secret_encrypted)
  if(['hl1','cs16'].includes(server.game_id)){
    const {rconCommand}=await importGoldSrc()
    return rconCommand(server.rcon_host,Number(server.rcon_port),password,command,{challengeTimeoutMs:3000,quietMs:500,commandTimeoutMs:5000})
  }
  if(server.game_id==='l4d2'){
    const client=new SourceRcon({host:server.rcon_host,port:Number(server.rcon_port),timeout:5000,encoding:'utf8'})
    try{await client.authenticate(password);return String(await client.execute(command)||'')}finally{await client.disconnect().catch(()=>{})}
  }
  if(server.game_id==='cod4')return quakeCommand(server.rcon_host,Number(server.rcon_port),password,command)
  throw new Error('Unsupported RCON game protocol')
}

export const parseServerStatus=(raw:string)=>{
  const map=raw.match(/(?:^|\n)map\s*:\s*([^\s\r\n]+)/i)?.[1]||raw.match(/mapname[\\\s]+([^\\\s\r\n]+)/i)?.[1]||null
  const declared=raw.match(/players\s*:\s*(\d+)/i)
  const quoted=[...raw.matchAll(/^#?\s*\d+\s+"([^"]+)".*$/gm)].map(match=>({name:match[1]}))
  const cod=[...raw.matchAll(/^\s*\d+\s+-?\d+\s+\d+\s+\S+\s+(.+?)\s+\d+\s+\S+\s+\d+\s+\d+\s*$/gm)].map(match=>({name:match[1].replace(/^"|"$/g,'')}))
  const players=quoted.length?quoted:cod
  return{map,playerCount:declared?Number(declared[1]):players.length,players,raw:raw.slice(0,20000)}
}

const serverColumns='id,game_id,rcon_host,rcon_port,rcon_secret_encrypted,current_match_id'

export const probeServer=async(db:Db,server:ServerRow)=>{
  try{
    const parsed=parseServerStatus(await sendRconCommand(server,'status'))
    await db.query(
      `UPDATE game_servers SET current_players=$1,current_map=$2,last_heartbeat=NOW(),last_error=NULL,
       telemetry=$3,status=CASE WHEN current_match_id IS NULL THEN 'online' ELSE 'in_use' END,updated_at=NOW() WHERE id=$4`,
      [parsed.playerCount,parsed.map,JSON.stringify({players:parsed.players}),server.id])
    await db.query('INSERT INTO game_server_player_snapshots(server_id,player_count,map_name,players) VALUES($1,$2,$3,$4)',[server.id,parsed.playerCount,parsed.map,JSON.stringify(parsed.players)])
    return parsed
  }catch(error:any){await db.query("UPDATE game_servers SET current_players=0,last_error=$1,status=CASE WHEN status='maintenance' THEN status ELSE 'offline' END,updated_at=NOW() WHERE id=$2",[String(error?.message||error).slice(0,1000),server.id]);throw error}
}

export const provisionMatchServer=async(db:Db,matchId:string)=>{
  const row=(await db.query(
    `SELECT s.${serverColumns.split(',').join(',s.')},m.selected_map,m.game_mode,m.status match_status
     FROM matches m JOIN game_servers s ON s.id=m.server_id WHERE m.id=$1`,[matchId])).rows[0]
  if(!row||!row.rcon_secret_encrypted||!row.selected_map||row.match_status!=='pending')return false
  if(!/^[a-zA-Z0-9_]+$/.test(row.selected_map))throw new Error('Selected map contains unsupported characters')
  try{await sendRconCommand(row,`changelevel ${row.selected_map}`)}catch(error:any){await db.query("UPDATE game_servers SET status='offline',last_error=$1,updated_at=NOW() WHERE id=$2",[String(error?.message||error).slice(0,1000),row.id]);return false}
  await db.query("UPDATE matches SET status='in_progress',started_at=NOW(),result_source='game_server' WHERE id=$1 AND status='pending'",[matchId])
  await db.query("INSERT INTO match_events(match_id,sequence,event_type,occurred_at,details) VALUES($1,1,'match_started',NOW(),jsonb_build_object('map',$2,'gameMode',$3,'source','rcon')) ON CONFLICT(match_id,sequence) DO UPDATE SET occurred_at=EXCLUDED.occurred_at,details=EXCLUDED.details",[matchId,row.selected_map,row.game_mode])
  return true
}

export const startGameServerMonitor=(db:Pool)=>{
  const poll=async()=>{const servers=(await db.query(`SELECT ${serverColumns} FROM game_servers WHERE rcon_secret_encrypted IS NOT NULL`)).rows;await Promise.allSettled(servers.map(server=>probeServer(db,server)))}
  const interval=setInterval(()=>void poll().catch(error=>console.error('game server monitor:',error.message)),Number(process.env.GAME_SERVER_POLL_MS)||15000)
  interval.unref()
  void poll().catch(error=>console.error('game server monitor:',error.message))
  return ()=>clearInterval(interval)
}
