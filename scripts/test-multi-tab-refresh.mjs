import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({ module: 'CommonJS', moduleResolution: 'Node' })
const require = createRequire(import.meta.url)
require('ts-node/register/transpile-only')
const { CrossTabRefreshCoordinator } = require('../src/utils/refreshCoordinator.ts')

class Mutex {
  tail = Promise.resolve()
  runExclusive(work) {
    const result = this.tail.then(work)
    this.tail = result.catch(() => undefined)
    return result
  }
}

const listeners = new Set()
const subscribe = listener => { listeners.add(listener); return () => listeners.delete(listener) }
const publish = result => { for (const listener of listeners) listener(result) }
const lock = new Mutex()
let rotations = 0
let release
const gate = new Promise(resolve => { release = resolve })
const tokens = [null, null]
const makeTab = index => new CrossTabRefreshCoordinator({
  lock,
  subscribe,
  publish,
  acceptResult: token => { tokens[index] = token },
  performRefresh: async () => { rotations += 1; await gate; return 'access-token-1' },
})

const tabA = makeTab(0), tabB = makeTab(1)
const requests = [tabA.refresh(), tabB.refresh()]
await Promise.resolve()
assert.equal(rotations, 1, 'only the lock owner may begin refresh rotation')
release()
assert.deepEqual(await Promise.all(requests), ['access-token-1', 'access-token-1'])
assert.equal(rotations, 1, 'the waiting tab consumes the broadcast result instead of rotating again')
assert.deepEqual(tokens, ['access-token-1', 'access-token-1'], 'both tabs keep the access token in memory')

const source = require('node:fs').readFileSync(new URL('../src/utils/refreshCoordinator.ts', import.meta.url), 'utf8')
assert.match(source, /navigator\.locks\.request/)
assert.match(source, /indexedDB\.open/)
assert.match(source, /coordination is unavailable/, 'unsupported browsers fail closed instead of racing refresh tokens')
assert.doesNotMatch(source, /grace|reuse window/i, 'client coordination does not weaken server-side reuse detection')
tabA.close(); tabB.close()
console.log('Deterministic two-tab refresh coordination checks passed.')
