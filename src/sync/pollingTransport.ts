import * as Y from 'yjs'
import { toBase64, fromBase64 } from './encoding'
import { observeLocalUpdates, REMOTE_ORIGIN } from './observeLocal'
import { apiPath } from './serverUrl'
import type { SyncTransport, TransportDeps } from './types'

const POLL_INTERVAL_MS = 1000

export function createPollingTransport({ doc, clientId, setStatus }: TransportDeps): SyncTransport {
  let timer: ReturnType<typeof setInterval> | null = null
  let unobserve = () => {}

  const postUpdate = (update: Uint8Array) => {
    void fetch(apiPath(`/api/update?clientId=${clientId}`), { method: 'POST', body: toBase64(update) })
  }

  const pull = async () => {
    const sv = toBase64(Y.encodeStateVector(doc))
    const res = await fetch(apiPath(`/api/state?sv=${encodeURIComponent(sv)}`))
    const text = await res.text()
    if (text) Y.applyUpdate(doc, fromBase64(text), REMOTE_ORIGIN)
  }

  const connect = async () => {
    setStatus('connecting')
    try {
      const res = await fetch(apiPath('/api/state'))
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
