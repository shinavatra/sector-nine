import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { createFrontendApp } from './serve-frontend.mjs'

const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)))
const close = server => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
const request = (port, requestPath, options = {}) => new Promise((resolve, reject) => {
  const req = http.request({ hostname: '127.0.0.1', port, path: requestPath, method: options.method || 'GET', headers: options.headers }, res => {
    const chunks = []
    res.on('data', chunk => chunks.push(chunk))
    res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }))
  })
  req.on('error', reject)
  if (options.body) req.write(options.body)
  req.end()
})

const buildDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'sector-nine-proxy-'))
await fs.writeFile(path.join(buildDirectory, 'index.html'), '<!doctype html><title>Sector Nine</title>')
const seen = []
const backend = http.createServer((req, res) => {
  const chunks = []
  req.on('data', chunk => chunks.push(chunk))
  req.on('end', () => {
    seen.push({ url: req.url, method: req.method, authorization: req.headers.authorization, cookie: req.headers.cookie, body: Buffer.concat(chunks).toString('utf8') })
    res.statusCode = 201
    res.setHeader('Set-Cookie', ['sn_refresh=secret; Path=/api/auth; HttpOnly; Secure; SameSite=Lax', 'secondary=value; Path=/; Secure'])
    res.end('proxied')
  })
})
const backendPort = await listen(backend)
const frontend = http.createServer(createFrontendApp({ backendOrigin: `http://127.0.0.1:${backendPort}`, buildDirectory }))
const frontendPort = await listen(frontend)

try {
  const response = await request(frontendPort, '/api/auth/refresh?source=test', { method: 'POST', headers: { authorization: 'Bearer access', cookie: 'sn_refresh=old', 'content-type': 'application/json' }, body: '{"ok":true}' })
  assert.equal(response.status, 201)
  assert.equal(response.body, 'proxied')
  assert.deepEqual(seen[0], { url: '/auth/refresh?source=test', method: 'POST', authorization: 'Bearer access', cookie: 'sn_refresh=old', body: '{"ok":true}' })
  assert.deepEqual(response.headers['set-cookie'], ['sn_refresh=secret; Path=/api/auth; HttpOnly; Secure; SameSite=Lax', 'secondary=value; Path=/; Secure'])
  await request(frontendPort, '/api//example.com/steal')
  assert.equal(seen[1].url, '//example.com/steal', 'user paths stay on the fixed backend connection')
  assert.equal((await request(frontendPort, '/profile', { headers: { accept: 'text/html' } })).status, 200)
  assert.equal((await request(frontendPort, '/health')).status, 200)
} finally {
  await close(frontend)
  await close(backend)
  await fs.rm(buildDirectory, { recursive: true, force: true })
}
console.log('Frontend same-origin proxy routing and cookie checks passed.')
