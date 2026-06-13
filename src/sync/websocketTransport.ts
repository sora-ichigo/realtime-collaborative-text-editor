import * as Y from 'yjs'
import { toBase64, fromBase64 } from './encoding'
import { observeLocalUpdates, REMOTE_ORIGIN } from './observeLocal'
import { websocketUrl } from './serverUrl'
import type { SyncTransport, TransportDeps } from './types'

export function createWebSocketTransport({ doc, setStatus }: TransportDeps): SyncTransport {
  let socket: WebSocket | null = null
  let unobserve = () => {}
  let disposed = false

  const connect = () => {
    if (typeof WebSocket === 'undefined') {
      setStatus('disconnected')
      return
    }
    setStatus('connecting')
    socket = new WebSocket(websocketUrl())

    socket.onopen = () => {
      setStatus('connected')
      // share what we already have, then stream future local edits
      socket?.send(JSON.stringify({ t: 'update', u: toBase64(Y.encodeStateAsUpdate(doc)) }))
      unobserve = observeLocalUpdates(doc, (update) => {
        socket?.send(JSON.stringify({ t: 'update', u: toBase64(update) }))
      })
    }

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data) as { t: string; u: string }
      if (message.t === 'sync' || message.t === 'update') {
        Y.applyUpdate(doc, fromBase64(message.u), REMOTE_ORIGIN)
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
