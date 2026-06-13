import * as Y from 'yjs'
import { toBase64, fromBase64 } from '../sync/encoding'

/**
 * Encode a document's full state as a base64 string for offline storage.
 * Restoring this (see {@link applyDocDraft}) is idempotent: re-applying the same
 * Yjs history merges without duplicating content, unlike re-inserting the text.
 */
export function encodeDocDraft(doc: Y.Doc): string {
  return toBase64(Y.encodeStateAsUpdate(doc))
}

export function applyDocDraft(doc: Y.Doc, draft: string): void {
  if (!draft) return
  try {
    Y.applyUpdate(doc, fromBase64(draft))
  } catch {
    // Ignore invalid or legacy (plain-text) drafts; content syncs from the server.
  }
}
