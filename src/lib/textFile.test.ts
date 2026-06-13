import { describe, it, expect } from 'vitest'
import { ensureTxtExtension, readTextFile } from './textFile'

describe('ensureTxtExtension', () => {
  it('appends .txt when the name has no extension', () => {
    expect(ensureTxtExtension('memo')).toBe('memo.txt')
  })

  it('keeps the name unchanged when it already ends with .txt', () => {
    expect(ensureTxtExtension('memo.txt')).toBe('memo.txt')
  })

  it('is case-insensitive about the existing extension', () => {
    expect(ensureTxtExtension('memo.TXT')).toBe('memo.TXT')
  })

  it('falls back to a default name when the input is empty', () => {
    expect(ensureTxtExtension('')).toBe('untitled.txt')
    expect(ensureTxtExtension('   ')).toBe('untitled.txt')
  })
})

describe('readTextFile', () => {
  it('resolves with the text content of the file', async () => {
    const file = new File(['hello world'], 'sample.txt', { type: 'text/plain' })
    await expect(readTextFile(file)).resolves.toBe('hello world')
  })

  it('reads an empty file as an empty string', async () => {
    const file = new File([''], 'empty.txt', { type: 'text/plain' })
    await expect(readTextFile(file)).resolves.toBe('')
  })
})
