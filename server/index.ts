import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { createNodeWebSocket } from '@hono/node-ws'
import { streamSSE } from 'hono/streaming'
import { cors } from 'hono/cors'
import type { Context } from 'hono'
import { join } from 'node:path'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { createDocRegistry, PERSISTENCE_ORIGIN, DEFAULT_QUOTA_BYTES } from './docRegistry.ts'
import { createFileDocStore } from './docStore.ts'
import { createDebouncedSaver, type DebouncedSaver } from './persistence.ts'
import { toBase64, fromBase64 } from '../src/sync/encoding.ts'

const PORT = Number(process.env.PORT ?? 8787)
const DATA_DIR = process.env.DATA_DIR ?? join(import.meta.dirname, 'data')
const QUOTA_BYTES = Number(process.env.QUOTA_BYTES ?? DEFAULT_QUOTA_BYTES)

const store = createFileDocStore(DATA_DIR)
const savers = new Map<string, DebouncedSaver>()

const registry = createDocRegistry({
  quotaBytes: QUOTA_BYTES,
  onRoomCreated: (owner, file, hub) => {
    const saver = createDebouncedSaver(() => store.save(owner, file, hub.stateAsUpdate()), 500)
    savers.set(`${owner}/${file}`, saver)
    hub.onUpdate((_update, origin) => {
      if (origin !== PERSISTENCE_ORIGIN) saver.schedule()
    })
  },
})

// Restore every persisted document so quotas and content survive a restart.
for (const { owner, file } of await store.list()) {
  const data = await store.load(owner, file)
  if (data) registry.applyUpdate(owner, file, data, PERSISTENCE_ORIGIN)
}

// Display names: owner id -> name, persisted alongside the documents.
const PROFILES_FILE = join(DATA_DIR, 'profiles.json')
const profiles = new Map<string, string>()
try {
  const raw = JSON.parse(await readFile(PROFILES_FILE, 'utf8')) as Record<string, string>
  for (const [owner, name] of Object.entries(raw)) profiles.set(owner, name)
} catch {
  /* no profiles yet */
}
async function saveProfiles() {
  await mkdir(DATA_DIR, { recursive: true })
  await writeFile(PROFILES_FILE, JSON.stringify(Object.fromEntries(profiles)))
}

function roomOf(c: Context): { owner: string; file: string } {
  const owner = (c.req.query('owner') ?? '').trim() || 'public'
  const file = (c.req.query('file') ?? '').trim() || 'untitled.txt'
  return { owner, file }
}

const app = new Hono()
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app })

app.use('/api/*', cors())

app.get('/api/health', (c) => c.json({ ok: true }))

// All known filesystems (owners) with their display names and usage.
app.get('/api/users', (c) => {
  const owners = new Set<string>([...registry.listOwners(), ...profiles.keys()])
  const users = [...owners].map((owner) => ({
    owner,
    name: profiles.get(owner) ?? owner,
    files: registry.listFiles(owner).length,
    usage: registry.ownerUsage(owner),
  }))
  return c.json({ users })
})

// Register/update an owner's display name.
app.post('/api/profile', async (c) => {
  const owner = (c.req.query('owner') ?? '').trim()
  const body = (await c.req.json().catch(() => ({}))) as { name?: string }
  const name = body.name?.trim()
  if (owner && name) {
    profiles.set(owner, name)
    void saveProfiles()
  }
  return c.json({ ok: true })
})

// List a filesystem (one owner's files) plus their quota usage.
app.get('/api/files', (c) => {
  const owner = (c.req.query('owner') ?? '').trim() || 'public'
  return c.json({
    owner,
    files: registry.listFiles(owner),
    usage: registry.ownerUsage(owner),
    quota: registry.quotaBytes,
  })
})

// Pull a room's state (or a diff since a state vector).
app.get('/api/state', (c) => {
  const { owner, file } = roomOf(c)
  const sv = c.req.query('sv')
  const hub = registry.getOrCreate(owner, file)
  return c.text(toBase64(hub.stateAsUpdate(sv ? fromBase64(sv) : undefined)))
})

// Push an update to a room; returns whether it was accepted (quota) + usage.
app.post('/api/update', async (c) => {
  const { owner, file } = roomOf(c)
  const clientId = c.req.query('clientId') ?? 'anon'
  const body = await c.req.text()
  const result = body
    ? registry.applyUpdate(owner, file, fromBase64(body), clientId)
    : { accepted: true as const }
  return c.json({
    accepted: result.accepted,
    reason: result.reason,
    usage: registry.ownerUsage(owner),
    quota: registry.quotaBytes,
  })
})

// SSE: initial state then live updates for one room.
app.get('/api/events', (c) => {
  const { owner, file } = roomOf(c)
  const clientId = c.req.query('clientId') ?? 'anon'
  const sv = c.req.query('sv')
  const hub = registry.getOrCreate(owner, file)
  return streamSSE(c, async (stream) => {
    const initial = hub.stateAsUpdate(sv ? fromBase64(sv) : undefined)
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

// WebSocket: bidirectional relay for one room.
app.get(
  '/ws',
  upgradeWebSocket((c) => {
    const { owner, file } = roomOf(c)
    const hub = registry.getOrCreate(owner, file)
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
      onMessage(event, ws) {
        const raw = typeof event.data === 'string' ? event.data : event.data.toString()
        const message = JSON.parse(raw) as { t: string; u: string }
        if (message.t !== 'update') return
        const result = registry.applyUpdate(owner, file, fromBase64(message.u), origin)
        if (!result.accepted) {
          ws.send(JSON.stringify({ t: 'rejected', reason: result.reason }))
        }
      },
      onClose() {
        unsub()
      },
    }
  }),
)

const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`sync server listening on http://localhost:${info.port} (quota ${QUOTA_BYTES} bytes/owner)`)
})
injectWebSocket(server)

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void Promise.all([...savers.values()].map((s) => s.flush())).finally(() => process.exit(0))
  })
}
