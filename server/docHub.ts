import * as Y from 'yjs'

export type UpdateListener = (update: Uint8Array, origin: unknown) => void

export interface DocHub {
  doc: Y.Doc
  applyUpdate(update: Uint8Array, origin: unknown): void
  stateAsUpdate(stateVector?: Uint8Array): Uint8Array
  stateVector(): Uint8Array
  onUpdate(listener: UpdateListener): () => void
}

/**
 * Owns the single authoritative Y.Doc and fans every update out to listeners
 * (one per connected client transport), tagged with the origin that caused it.
 */
export function createDocHub(): DocHub {
  const doc = new Y.Doc()
  const listeners = new Set<UpdateListener>()

  doc.on('update', (update: Uint8Array, origin: unknown) => {
    for (const listener of listeners) listener(update, origin)
  })

  return {
    doc,
    applyUpdate(update, origin) {
      Y.applyUpdate(doc, update, origin)
    },
    stateAsUpdate(stateVector) {
      return Y.encodeStateAsUpdate(doc, stateVector)
    },
    stateVector() {
      return Y.encodeStateVector(doc)
    },
    onUpdate(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
