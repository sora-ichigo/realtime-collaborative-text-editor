import * as Y from 'yjs'
import { toBase64, fromBase64 } from './encoding'
import { observeLocalUpdates, REMOTE_ORIGIN } from './observeLocal'
import { apiPath } from './serverUrl'
import type { SyncTransport, TransportDeps } from './types'

export function createSseTransport({ doc, clientId, setStatus }: TransportDeps): SyncTransport {
  let source: EventSource | null = null
  let unobserve = () => {}

  const postUpdate = (update: Uint8Array) => {
    void fetch(apiPath(`/api/update?clientId=${clientId}`), { method: 'POST', body: toBase64(update) })
  }

  const connect = () => {
    if (typeof EventSource === 'undefined') {
      setStatus('disconnected')
      return
    }
    setStatus('connecting')
    const sv = toBase64(Y.encodeStateVector(doc))
    source = new EventSource(apiPath(`/api/events?clientId=${clientId}&sv=${encodeURIComponent(sv)}`))

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
