import * as Y from 'yjs'
import { toBase64, fromBase64 } from './encoding'
import { observeLocalUpdates, REMOTE_ORIGIN } from './observeLocal'
import { apiPath, roomParams } from './serverUrl'
import type { SyncTransport, TransportDeps } from './types'

export function createSseTransport({
  doc,
  clientId,
  owner,
  file,
  setStatus,
  onRejected,
}: TransportDeps): SyncTransport {
  let source: EventSource | null = null
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

  const connect = () => {
    if (typeof EventSource === 'undefined') {
      setStatus('disconnected')
      return
    }
    setStatus('connecting')
    const sv = toBase64(Y.encodeStateVector(doc))
    source = new EventSource(apiPath(`/api/events?${room}&clientId=${clientId}&sv=${encodeURIComponent(sv)}`))

    source.addEventListener('sync', (event) => {
      Y.applyUpdate(doc, fromBase64((event as MessageEvent).data), REMOTE_ORIGIN)
      setStatus('connected')
      postUpdate(Y.encodeStateAsUpdate(doc))
      unobserve = observeLocalUpdates(doc, postUpdate)
    })

    source.addEventListener('update', (event) => {
      Y.applyUpdate(doc, fromBase64((event as MessageEvent).data), REMOTE_ORIGIN)
    })

    source.onerror = () => setStatus('disconnected')
  }

  const disconnect = () => {
    unobserve()
    source?.close()
    source = null
  }

  return { connect, disconnect }
}
