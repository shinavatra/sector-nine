import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createRequire} from 'node:module'

const require=createRequire(import.meta.url)
require('ts-node/register/transpile-only')
const {buildConnectCommand,buildSteamConnectUri,normalizePublicServerEndpoint}=require('../src/shared/serverEndpoint.ts')

assert.deepEqual(normalizePublicServerEndpoint('147.185.221.215',6561),{host:'147.185.221.215',port:6561,endpoint:'147.185.221.215:6561'})
assert.equal(buildConnectCommand('147.185.221.215',6561),'connect 147.185.221.215:6561')
assert.equal(buildSteamConnectUri('hl1','147.185.221.215',6561),'steam://connect/147.185.221.215:6561')
assert.equal(buildSteamConnectUri('cod4','147.185.221.215',6561),null,'Steam launch is limited to verified HL1 behavior')
for(const host of ['https://evil.example','evil.example/path','evil.example?x=1','evil.example:27015','bad host','1.2.3.999'])assert.equal(normalizePublicServerEndpoint(host,27015),null,`unsafe host rejected: ${host}`)
for(const port of [0,65536,-1,1.5,'not-a-port'])assert.equal(normalizePublicServerEndpoint('server.example',port),null,`unsafe port rejected: ${port}`)

const backend=fs.readFileSync('src/server/index.ts','utf8')
const queue=fs.readFileSync('src/components/GameQueue.tsx','utf8')
assert.match(backend,/normalizePublicServerEndpoint\(match\.server_host,match\.server_port\)/,'match response validates the assigned backend endpoint')
assert.match(queue,/COPY CONNECT COMMAND/)
assert.match(queue,/CONNECT TO SERVER/)
assert.match(queue,/Waiting for game server\.\.\./)
assert.doesNotMatch(queue,/exec\(|spawn\(|child_process|executable/i,'player action never executes local processes')

console.log('Player server-connect action checks passed')
