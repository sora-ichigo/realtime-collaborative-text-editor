import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import { encodeDocDraft, applyDocDraft } from './docState'

describe('document draft state', () => {
  it('round-trips the text content', () => {
    const doc = new Y.Doc()
    doc.getText('content').insert(0, 'hello')
    const fresh = new Y.Doc()
    applyDocDraft(fresh, encodeDocDraft(doc))
    expect(fresh.getText('content').toString()).toBe('hello')
  })

  it('ignores an invalid or legacy draft instead of throwing', () => {
    const doc = new Y.Doc()
    expect(() => applyDocDraft(doc, 'legacy plain text draft')).not.toThrow()
    expect(() => applyDocDraft(doc, '!!! not base64 !!!')).not.toThrow()
    expect(doc.getText('content').toString()).toBe('')
  })

  it('does not duplicate content when the same server state is merged in', () => {
    const local = new Y.Doc()
    local.getText('content').insert(0, 'hello')
    const draft = encodeDocDraft(local)
    const serverState = Y.encodeStateAsUpdate(local) // server shares the same history

    const fresh = new Y.Doc()
    applyDocDraft(fresh, draft)
    Y.applyUpdate(fresh, serverState)

    expect(fresh.getText('content').toString()).toBe('hello')
  })

  it('stays stable across repeated open/save cycles', () => {
    const seed = new Y.Doc()
    seed.getText('content').insert(0, 'hi')
    let draft = encodeDocDraft(seed)

    for (let i = 0; i < 5; i++) {
      const doc = new Y.Doc()
      applyDocDraft(doc, draft) // restore offline copy
      applyDocDraft(doc, draft) // server sends the same history again
      expect(doc.getText('content').toString()).toBe('hi')
      draft = encodeDocDraft(doc)
    }
  })
})
