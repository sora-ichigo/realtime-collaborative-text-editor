import { describe, it, expect } from 'vitest'
import * as Y from 'yjs'
import { createDocRegistry } from './docRegistry'

function updateSetting(text: string): Uint8Array {
  const doc = new Y.Doc()
  doc.getText('content').insert(0, text)
  return Y.encodeStateAsUpdate(doc)
}

describe('createDocRegistry', () => {
  it('keeps a separate document per (owner, file)', () => {
    const reg = createDocRegistry()
    reg.applyUpdate('alice', 'a.txt', updateSetting('hello'), 'c1')
    const hubA = reg.getOrCreate('alice', 'a.txt')
    const hubB = reg.getOrCreate('alice', 'b.txt')
    expect(hubA.doc.getText('content').toString()).toBe('hello')
    expect(hubB.doc.getText('content').toString()).toBe('')
  })

  it('accepts an update within the quota', () => {
    const reg = createDocRegistry({ quotaBytes: 10 })
    const result = reg.applyUpdate('alice', 'a.txt', updateSetting('hello'), 'c1')
    expect(result.accepted).toBe(true)
    expect(reg.ownerUsage('alice')).toBe(5)
  })

  it('rejects an update that would exceed the quota and does not apply it', () => {
    const reg = createDocRegistry({ quotaBytes: 3 })
    const result = reg.applyUpdate('alice', 'a.txt', updateSetting('hello'), 'c1')
    expect(result.accepted).toBe(false)
    expect(result.reason).toBe('quota')
    expect(reg.getOrCreate('alice', 'a.txt').doc.getText('content').toString()).toBe('')
  })

  it('enforces the quota across all files of one owner', () => {
    const reg = createDocRegistry({ quotaBytes: 10 })
    expect(reg.applyUpdate('alice', 'a.txt', updateSetting('aaaa'), 'c1').accepted).toBe(true)
    expect(reg.applyUpdate('alice', 'b.txt', updateSetting('bbbbb'), 'c1').accepted).toBe(true)
    expect(reg.applyUpdate('alice', 'c.txt', updateSetting('cc'), 'c1').accepted).toBe(false)
  })

  it('gives each owner an independent quota', () => {
    const reg = createDocRegistry({ quotaBytes: 5 })
    expect(reg.applyUpdate('alice', 'a.txt', updateSetting('aaaaa'), 'c1').accepted).toBe(true)
    expect(reg.applyUpdate('bob', 'a.txt', updateSetting('bbbbb'), 'c2').accepted).toBe(true)
  })

  it('lists an owner\'s files with their byte sizes', () => {
    const reg = createDocRegistry()
    reg.applyUpdate('alice', 'a.txt', updateSetting('aaaa'), 'c1')
    reg.applyUpdate('alice', 'b.txt', updateSetting('bb'), 'c1')
    reg.applyUpdate('bob', 'c.txt', updateSetting('c'), 'c2')
    const files = reg.listFiles('alice')
    expect(files).toContainEqual({ file: 'a.txt', bytes: 4 })
    expect(files).toContainEqual({ file: 'b.txt', bytes: 2 })
    expect(files).toHaveLength(2)
  })

  it('does not list an empty room (merely viewing a file)', () => {
    const reg = createDocRegistry()
    reg.getOrCreate('alice', 'opened-but-empty.txt') // viewed, never edited
    reg.applyUpdate('alice', 'real.txt', updateSetting('content'), 'c1')
    const files = reg.listFiles('alice')
    expect(files).toEqual([{ file: 'real.txt', bytes: 7 }])
  })

  it('lists the distinct owners that have rooms', () => {
    const reg = createDocRegistry()
    reg.applyUpdate('alice', 'a.txt', updateSetting('x'), 'c1')
    reg.applyUpdate('alice', 'b.txt', updateSetting('y'), 'c1')
    reg.applyUpdate('bob', 'c.txt', updateSetting('z'), 'c2')
    expect(reg.listOwners().sort()).toEqual(['alice', 'bob'])
  })

  it('notifies when a new room is created', () => {
    const created: string[] = []
    const reg = createDocRegistry({ onRoomCreated: (owner, file) => created.push(`${owner}/${file}`) })
    reg.getOrCreate('alice', 'a.txt')
    reg.getOrCreate('alice', 'a.txt') // same room, no second notification
    reg.applyUpdate('bob', 'b.txt', updateSetting('x'), 'c1')
    expect(created).toEqual(['alice/a.txt', 'bob/b.txt'])
  })
})
