import { describe, it, expect, afterEach } from 'vitest'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createFileDocStore } from './docStore'

const ROOT = join(tmpdir(), 'rcte-docstore-test')

afterEach(async () => {
  await rm(ROOT, { recursive: true, force: true })
})

describe('createFileDocStore', () => {
  it('returns null for a file that was never saved', async () => {
    const store = createFileDocStore(ROOT)
    expect(await store.load('alice', 'notes.txt')).toBeNull()
  })

  it('saves and loads a document by (owner, file)', async () => {
    const store = createFileDocStore(ROOT)
    const data = new Uint8Array([10, 20, 30])
    await store.save('alice', 'notes.txt', data)
    expect(await store.load('alice', 'notes.txt')).toEqual(data)
  })

  it('keeps the same filename under different owners separate', async () => {
    const store = createFileDocStore(ROOT)
    await store.save('alice', 'notes.txt', new Uint8Array([1]))
    await store.save('bob', 'notes.txt', new Uint8Array([2]))
    expect(await store.load('alice', 'notes.txt')).toEqual(new Uint8Array([1]))
    expect(await store.load('bob', 'notes.txt')).toEqual(new Uint8Array([2]))
  })

  it('handles owners and filenames with unsafe characters', async () => {
    const store = createFileDocStore(ROOT)
    await store.save('a/b', 'we ird.txt', new Uint8Array([9]))
    expect(await store.load('a/b', 'we ird.txt')).toEqual(new Uint8Array([9]))
  })

  it('lists all stored documents', async () => {
    const store = createFileDocStore(ROOT)
    await store.save('alice', 'a.txt', new Uint8Array([1]))
    await store.save('alice', 'b.txt', new Uint8Array([1]))
    await store.save('bob', 'c.txt', new Uint8Array([1]))
    const list = await store.list()
    expect(list).toContainEqual({ owner: 'alice', file: 'a.txt' })
    expect(list).toContainEqual({ owner: 'alice', file: 'b.txt' })
    expect(list).toContainEqual({ owner: 'bob', file: 'c.txt' })
    expect(list).toHaveLength(3)
  })
})
