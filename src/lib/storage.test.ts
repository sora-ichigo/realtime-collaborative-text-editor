import { describe, it, expect, beforeEach } from 'vitest'
import { loadDraft, saveDraft, clearDraft, draftKey } from './storage'

describe('draft storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('builds a per-room draft key from owner and file', () => {
    expect(draftKey('alice', 'notes.txt')).toBe('rcte:draft:alice/notes.txt')
  })

  it('returns an empty string when no draft is saved', () => {
    expect(loadDraft('rcte:draft:alice/a.txt')).toBe('')
  })

  it('saves a draft and loads it back', () => {
    saveDraft('rcte:draft:alice/a.txt', 'hello')
    expect(loadDraft('rcte:draft:alice/a.txt')).toBe('hello')
  })

  it('keeps drafts for different rooms separate', () => {
    saveDraft(draftKey('alice', 'a.txt'), 'A')
    saveDraft(draftKey('bob', 'a.txt'), 'B')
    expect(loadDraft(draftKey('alice', 'a.txt'))).toBe('A')
    expect(loadDraft(draftKey('bob', 'a.txt'))).toBe('B')
  })

  it('clears a saved draft', () => {
    saveDraft('rcte:draft:alice/a.txt', 'hello')
    clearDraft('rcte:draft:alice/a.txt')
    expect(loadDraft('rcte:draft:alice/a.txt')).toBe('')
  })
})
