export interface PublicServerEndpoint {
  host: string
  port: number
  endpoint: string
}

const hostnameLabel=/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i

export function normalizeServerEndpoint(hostValue:unknown,portValue:unknown):PublicServerEndpoint|null {
  const host=typeof hostValue==='string'?hostValue.trim():''
  const port=Number(portValue)
  if(!host||host.length>253||!Number.isInteger(port)||port<1||port>65535)return null
  if(/[\s\u0000-\u001f\u007f/:?#@\\]/.test(host))return null
  const labels=host.split('.')
  if(labels.some(label=>!hostnameLabel.test(label)))return null
  if(labels.every(label=>/^\d+$/.test(label))&&labels.some(label=>Number(label)>255))return null
  return{host,port,endpoint:`${host}:${port}`}
}

export const normalizePublicServerEndpoint=normalizeServerEndpoint

export function buildConnectCommand(hostValue:unknown,portValue:unknown):string|null {
  const endpoint=normalizePublicServerEndpoint(hostValue,portValue)
  return endpoint?`connect ${endpoint.endpoint}`:null
}

export function buildSteamConnectUri(gameId:unknown,hostValue:unknown,portValue:unknown):string|null {
  if(gameId!=='hl1')return null
  const endpoint=normalizePublicServerEndpoint(hostValue,portValue)
  return endpoint?`steam://connect/${endpoint.endpoint}`:null
}
