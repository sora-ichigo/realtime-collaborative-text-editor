import type * as Y from 'yjs'

export const REMOTE_ORIGIN = 'remote'

/**
 * Call `send` for every update that originated locally (typing), skipping
 * updates we applied from the server (tagged with REMOTE_ORIGIN). Returns an
 * unsubscribe function.
 */
export function observeLocalUpdates(
  doc: Y.Doc,
  send: (update: Uint8Array) => void,
): () => void {
  const handler = (update: Uint8Array, origin: unknown) => {
    if (origin === REMOTE_ORIGIN) return
    send(update)
  }
  doc.on('update', handler)
  return () => doc.off('update', handler)
}
