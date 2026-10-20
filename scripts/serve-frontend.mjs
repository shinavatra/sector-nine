import express from 'express'
import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const hopByHop = new Set(['connection','keep-alive','proxy-authenticate','proxy-authorization','te','trailer','transfer-encoding','upgrade'])

export const createFrontendApp = ({ backendOrigin, buildDirectory = path.resolve('build') }) => {
  const target = new URL(backendOrigin)
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password || target.pathname !== '/' || target.search || target.hash) {
    throw new Error('BACKEND_ORIGIN must be a fixed HTTP(S) origin without credentials, path, query, or fragment')
  }
  if (process.env.NODE_ENV === 'production' && target.protocol !== 'https:') throw new Error('BACKEND_ORIGIN must use HTTPS in production')
  const indexFile = path.join(buildDirectory, 'index.html')
  if (!fs.existsSync(indexFile)) throw new Error('Frontend build is missing. Run npm run build first.')
  const app = express()
  app.set('trust proxy', 1)
  app.disable('x-powered-by')
  app.get('/health', (_req, res) => res.json({ ok: true, service: 'frontend' }))
  app.use('/api', (req, res) => {
    const requestPath = req.originalUrl.slice('/api'.length)
    const upstreamPath = requestPath.startsWith('/') ? requestPath : `/${requestPath}`
    const headers = Object.fromEntries(Object.entries(req.headers).filter(([name]) => !hopByHop.has(name.toLowerCase()) && name.toLowerCase() !== 'host'))
    headers.host = target.host
    headers['x-forwarded-host'] = req.headers.host || ''
    headers['x-forwarded-proto'] = req.protocol
    const transport = target.protocol === 'https:' ? https : http
    const upstream = transport.request({ protocol: target.protocol, hostname: target.hostname, port: target.port || undefined, method: req.method, path: upstreamPath, headers }, upstreamResponse => {
      const responseHeaders = []
      for (let index = 0; index < upstreamResponse.rawHeaders.length; index += 2) {
        if (!hopByHop.has(upstreamResponse.rawHeaders[index].toLowerCase())) responseHeaders.push(upstreamResponse.rawHeaders[index], upstreamResponse.rawHeaders[index + 1])
      }
      res.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.statusMessage, responseHeaders)
      upstreamResponse.pipe(res)
    })
    upstream.setTimeout(30_000, () => upstream.destroy(new Error('Backend proxy timeout')))
    upstream.on('error', () => { if (!res.headersSent) res.status(502).json({ error: 'Backend unavailable', code: 'BACKEND_PROXY_ERROR' }); else res.destroy() })
    req.pipe(upstream)
  })
  app.use(express.static(buildDirectory, { index: false, maxAge: '1y', immutable: true }))
  app.get('*', (req, res, next) => {
    if (!String(req.headers.accept || '').includes('text/html')) return next()
    res.setHeader('Cache-Control', 'no-cache')
    return res.sendFile(indexFile)
  })
  app.use((_req, res) => res.status(404).json({ error: 'Route not found', code: 'NOT_FOUND' }))
  return app
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const backendOrigin = process.env.BACKEND_ORIGIN
  if (!backendOrigin) throw new Error('BACKEND_ORIGIN is required')
  const port = Number(process.env.PORT || 3000)
  createFrontendApp({ backendOrigin }).listen(port, '0.0.0.0', () => console.log(JSON.stringify({ event: 'frontend_started', port })))
}
