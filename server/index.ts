import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { createNodeWebSocket } from '@hono/node-ws'
import { streamSSE } from 'hono/streaming'
import { cors } from 'hono/cors'
import { createDocHub } from './docHub.ts'
import { toBase64, fromBase64 } from '../src/sync/encoding.ts'

const PORT = Number(process.env.PORT ?? 8787)
const hub = createDocHub()

const app = new Hono()
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app })

// Allow the packaged Electron app (file:// origin) to reach the API.
app.use('/api/*', cors())

app.get('/api/health', (c) => c.json({ ok: true }))

// Polling + SSE clients pull the current state (or a diff since their state vector).
app.get('/api/state', (c) => {
  const svParam = c.req.query('sv')
  const update = hub.stateAsUpdate(svParam ? fromBase64(svParam) : undefined)
  return c.text(toBase64(update))
})

// Polling + SSE clients push their local updates here.
app.post('/api/update', async (c) => {
  const clientId = c.req.query('clientId') ?? 'anon'
  const body = await c.req.text()
  if (body) hub.applyUpdate(fromBase64(body), clientId)
  return c.body(null, 204)
})

// SSE: initial sync event, then live updates from every other client.
app.get('/api/events', (c) => {
  const clientId = c.req.query('clientId') ?? 'anon'
  const svParam = c.req.query('sv')
  return streamSSE(c, async (stream) => {
    const initial = hub.stateAsUpdate(svParam ? fromBase64(svParam) : undefined)
    await stream.writeSSE({ event: 'sync', data: toBase64(initial) })

    const unsub = hub.onUpdate((update, origin) => {
      if (origin === clientId) return
      void stream.writeSSE({ event: 'update', data: toBase64(update) })
    })
    stream.onAbort(unsub)

    while (!stream.aborted) {
      await stream.sleep(30000)
    }
    unsub()
  })
})

// WebSocket: bidirectional relay. A unique token per connection identifies its origin.
app.get(
  '/ws',
  upgradeWebSocket(() => {
    const origin = {}
    let unsub = () => {}
    return {
      onOpen(_event, ws) {
        ws.send(JSON.stringify({ t: 'sync', u: toBase64(hub.stateAsUpdate()) }))
        unsub = hub.onUpdate((update, updateOrigin) => {
          if (updateOrigin === origin) return
          ws.send(JSON.stringify({ t: 'update', u: toBase64(update) }))
        })
      },
      onMessage(event) {
        const raw = typeof event.data === 'string' ? event.data : event.data.toString()
        const message = JSON.parse(raw) as { t: string; u: string }
        if (message.t === 'update') hub.applyUpdate(fromBase64(message.u), origin)
      },
      onClose() {
        unsub()
      },
    }
  }),
)

const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`sync server listening on http://localhost:${info.port}`)
})
injectWebSocket(server)
