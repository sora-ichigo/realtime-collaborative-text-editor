import * as Y from 'yjs'
import { toBase64, fromBase64 } from './encoding'
import { observeLocalUpdates, REMOTE_ORIGIN } from './observeLocal'
import { websocketUrl, roomParams } from './serverUrl'
import type { SyncTransport, TransportDeps } from './types'

export function createWebSocketTransport({
  doc,
  owner,
  file,
  setStatus,
  onRejected,
}: TransportDeps): SyncTransport {
  let socket: WebSocket | null = null
  let unobserve = () => {}
  let disposed = false

  const connect = () => {
    if (typeof WebSocket === 'undefined') {
      setStatus('disconnected')
      return
    }
    setStatus('connecting')
    socket = new WebSocket(`${websocketUrl()}?${roomParams(owner, file)}`)

    socket.onopen = () => {
      setStatus('connected')
      // share what we already have, then stream future local edits
      socket?.send(JSON.stringify({ t: 'update', u: toBase64(Y.encodeStateAsUpdate(doc)) }))
      unobserve = observeLocalUpdates(doc, (update) => {
        socket?.send(JSON.stringify({ t: 'update', u: toBase64(update) }))
      })
    }

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data) as { t: string; u?: string; reason?: string }
      if ((message.t === 'sync' || message.t === 'update') && message.u) {
        Y.applyUpdate(doc, fromBase64(message.u), REMOTE_ORIGIN)
      } else if (message.t === 'rejected') {
        onRejected?.(message.reason)
      }
    }

    socket.onclose = () => {
      unobserve()
      if (!disposed) setStatus('disconnected')
    }
    socket.onerror = () => setStatus('disconnected')
  }

  const disconnect = () => {
    disposed = true
    unobserve()
    socket?.close()
    socket = null
  }

  return { connect, disconnect }
}
