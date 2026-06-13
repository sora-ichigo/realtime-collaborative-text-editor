import * as Y from 'yjs'
import { toBase64, fromBase64 } from './encoding'
import { observeLocalUpdates, REMOTE_ORIGIN } from './observeLocal'
import { apiPath, roomParams } from './serverUrl'
import type { SyncTransport, TransportDeps } from './types'

const POLL_INTERVAL_MS = 1000

export function createPollingTransport({
  doc,
  clientId,
  owner,
  file,
  setStatus,
  onRejected,
}: TransportDeps): SyncTransport {
  let timer: ReturnType<typeof setInterval> | null = null
  let unobserve = () => {}
  const room = roomParams(owner, file)

  const postUpdate = (update: Uint8Array) => {
    void (async () => {
      const res = await fetch(apiPath(`/api/update?${room}&clientId=${clientId}`), {
        method: 'POST',
        body: toBase64(update),
      })
      const result = (await res.json()) as { accepted: boolean; reason?: string }
      if (!result.accepted) onRejected?.(result.reason)
    })().catch(() => setStatus('disconnected'))
  }

  const pull = async () => {
    const sv = toBase64(Y.encodeStateVector(doc))
    const res = await fetch(apiPath(`/api/state?${room}&sv=${encodeURIComponent(sv)}`))
    const text = await res.text()
    if (text) Y.applyUpdate(doc, fromBase64(text), REMOTE_ORIGIN)
  }

  const connect = async () => {
    setStatus('connecting')
    try {
      const res = await fetch(apiPath(`/api/state?${room}`))
      const text = await res.text()
      if (text) Y.applyUpdate(doc, fromBase64(text), REMOTE_ORIGIN)
      postUpdate(Y.encodeStateAsUpdate(doc))
      setStatus('connected')
    } catch {
      setStatus('disconnected')
      return
    }
    unobserve = observeLocalUpdates(doc, postUpdate)
    timer = setInterval(() => {
      void pull().catch(() => setStatus('disconnected'))
    }, POLL_INTERVAL_MS)
  }

  const disconnect = () => {
    if (timer) clearInterval(timer)
    timer = null
    unobserve()
  }

  return { connect, disconnect }
}
