import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import { replaceText } from './ytext'

function textWith(initial: string): Y.Text {
  const doc = new Y.Doc()
  const text = doc.getText('content')
  if (initial) text.insert(0, initial)
  return text
}

describe('replaceText', () => {
  it('appends text at the end', () => {
    const text = textWith('hello')
    replaceText(text, 'hello world')
    expect(text.toString()).toBe('hello world')
  })

  it('inserts text in the middle', () => {
    const text = textWith('hed')
    replaceText(text, 'helloed')
    expect(text.toString()).toBe('helloed')
  })

  it('deletes text', () => {
    const text = textWith('hello world')
    replaceText(text, 'hello')
    expect(text.toString()).toBe('hello')
  })

  it('replaces a middle slice', () => {
    const text = textWith('hello world')
    replaceText(text, 'hello brave world')
    expect(text.toString()).toBe('hello brave world')
  })

  it('does nothing when the text is unchanged', () => {
    const text = textWith('same')
    let fired = false
    text.observe(() => {
      fired = true
    })
    replaceText(text, 'same')
    expect(fired).toBe(false)
    expect(text.toString()).toBe('same')
  })
})

describe('CRDT merge', () => {
  it('converges when two replicas make concurrent edits', () => {
    const docA = new Y.Doc()
    const docB = new Y.Doc()
    docA.getText('t').insert(0, 'abc')
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA))

    // concurrent edits on separate replicas
    replaceText(docA.getText('t'), 'Xabc') // prepend X
    replaceText(docB.getText('t'), 'abcY') // append Y

    // exchange updates both ways
    Y.applyUpdate(docB, Y.encodeStateAsUpdate(docA))
    Y.applyUpdate(docA, Y.encodeStateAsUpdate(docB))

    expect(docA.getText('t').toString()).toBe(docB.getText('t').toString())
    expect(docA.getText('t').toString()).toBe('XabcY')
  })
})
