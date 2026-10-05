import crypto from 'crypto'

export const PAIRING_TTL_MINUTES=20
const pairingAlphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function createPairingCode(){
  let value=''
  for(let index=0;index<8;index+=1)value+=pairingAlphabet[crypto.randomInt(pairingAlphabet.length)]
  return `SN-${value.slice(0,4)}-${value.slice(4)}`
}
export function normalizePairingCode(value:unknown){return typeof value==='string'?value.trim().toUpperCase():''}
export function hashSecret(value:string){return crypto.createHash('sha256').update(value).digest('hex')}
export function issueHostCredential(){const credential=crypto.randomBytes(32).toString('base64url');return{credential,hash:hashSecret(credential)}}
export function timingSafeHashMatches(plain:string,expectedHash:string){const actual=Buffer.from(hashSecret(plain),'hex'),expected=Buffer.from(expectedHash||'','hex');return actual.length===expected.length&&crypto.timingSafeEqual(actual,expected)}
export function validCapabilities(value:unknown):value is Record<string,string[]>{
  if(!value||typeof value!=='object'||Array.isArray(value))return false
  return Object.entries(value).every(([game,modes])=>/^[a-z0-9-]{2,32}$/.test(game)&&Array.isArray(modes)&&modes.length>0&&modes.length<=20&&modes.every(mode=>typeof mode==='string'&&/^[a-z0-9-]{2,64}$/.test(mode)))
}
