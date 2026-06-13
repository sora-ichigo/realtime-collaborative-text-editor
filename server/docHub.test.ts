import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import { createDocHub } from './docHub'

describe('createDocHub', () => {
  it('applies a client update and can reproduce the state', () => {
    const hub = createDocHub()
    const client = new Y.Doc()
    client.getText('content').insert(0, 'hello')

    hub.applyUpdate(Y.encodeStateAsUpdate(client), 'client-1')

    const fresh = new Y.Doc()
    Y.applyUpdate(fresh, hub.stateAsUpdate())
    expect(fresh.getText('content').toString()).toBe('hello')
  })

  it('notifies listeners with the originating client id', () => {
    const hub = createDocHub()
    const seen: unknown[] = []
    hub.onUpdate((_update, origin) => seen.push(origin))

    const client = new Y.Doc()
    client.getText('content').insert(0, 'hi')
    hub.applyUpdate(Y.encodeStateAsUpdate(client), 'client-42')

    expect(seen).toContain('client-42')
  })

  it('returns only the diff when given a state vector', () => {
    const hub = createDocHub()
    const c1 = new Y.Doc()
    c1.getText('content').insert(0, 'abc')
    hub.applyUpdate(Y.encodeStateAsUpdate(c1), 'c1')

    const caughtUp = new Y.Doc()
    Y.applyUpdate(caughtUp, hub.stateAsUpdate())

    // further change on the hub
    const c2 = new Y.Doc()
    Y.applyUpdate(c2, hub.stateAsUpdate())
    c2.getText('content').insert(3, 'def')
    hub.applyUpdate(Y.encodeStateAsUpdate(c2), 'c2')

    const diff = hub.stateAsUpdate(Y.encodeStateVector(caughtUp))
    Y.applyUpdate(caughtUp, diff)
    expect(caughtUp.getText('content').toString()).toBe('abcdef')
  })
})
