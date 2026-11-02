import assert from 'node:assert/strict'
import fs from 'node:fs'
import ts from 'typescript'

const source=fs.readFileSync('src/components/partyPolling.ts','utf8')
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText
const {createPartyPoller,classifyPartyPollingError}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)

const flush=()=>new Promise(resolve=>setImmediate(resolve))
const timers=[]
const cleared=[]
const timerApi={
  setTimer(callback){const handle={callback};timers.push(handle);return handle},
  clearTimer(handle){cleared.push(handle)},
}

{
  let attempt=0,recovered=0
  const failures=[],values=[]
  const poller=createPartyPoller({
    poll:async()=>{attempt+=1;if(attempt<3)throw new TypeError('network down');return{party:null,invites:[]}},
    intervalMs:5000,onSuccess:value=>values.push(value),
    onFailure:(_error,count,issue)=>failures.push([count,issue]),onRecovery:()=>recovered+=1,...timerApi,
  })
  poller.start();await flush();timers.at(-1).callback();await flush();timers.at(-1).callback();await flush()
  assert.deepEqual(failures,[[1,'temporary'],[2,'temporary']])
  assert.equal(values.length,1);assert.equal(recovered,1)
  poller.stop()
}

{
  let calls=0,resolveRequest
  const poller=createPartyPoller({poll:()=>{calls+=1;return new Promise(resolve=>{resolveRequest=resolve})},intervalMs:5000,onSuccess:()=>{},onFailure:()=>{},...timerApi})
  poller.start();const first=poller.pollNow();const second=poller.pollNow()
  assert.equal(calls,1,'overlapping poll requests must be deduplicated')
  resolveRequest({party:null,invites:[]});await Promise.all([first,second]);poller.stop()
}

{
  let aborted=false,failures=0
  const poller=createPartyPoller({poll:signal=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>{aborted=true;reject(new DOMException('Aborted','AbortError'))})),intervalMs:5000,onSuccess:()=>{},onFailure:()=>failures+=1,...timerApi})
  poller.start();poller.stop();await flush()
  assert.equal(aborted,true,'unmount cleanup must abort the active request')
  assert.equal(failures,0,'an intentional unmount abort must not surface as a failure')
}

{
  let scheduledHandle
  const poller=createPartyPoller({poll:async()=>({party:null,invites:[]}),intervalMs:5000,onSuccess:()=>{},onFailure:()=>{},setTimer(callback){scheduledHandle={callback};return scheduledHandle},clearTimer(handle){assert.equal(handle,scheduledHandle);cleared.push(handle)}})
  poller.start();await poller.waitForIdle();poller.stop()
  assert.ok(cleared.includes(scheduledHandle),'unmount cleanup must clear the scheduled timer')
}

assert.equal(classifyPartyPollingError({status:401}),'authentication')
assert.equal(classifyPartyPollingError({status:403}),'authentication')
assert.equal(classifyPartyPollingError({status:500}),'temporary')
assert.equal(classifyPartyPollingError(new TypeError('offline')),'temporary')

console.log('Party polling reliability: PASS (failure recovery, cleanup, deduplication, authentication classification)')
