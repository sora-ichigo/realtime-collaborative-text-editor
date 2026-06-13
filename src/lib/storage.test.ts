import { describe, it, expect, beforeEach } from 'vitest'
import { loadDraft, saveDraft, clearDraft } from './storage'

describe('draft storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns an empty string when no draft is saved', () => {
    expect(loadDraft()).toBe('')
  })

  it('saves a draft and loads it back', () => {
    saveDraft('hello')
    expect(loadDraft()).toBe('hello')
  })

  it('overwrites a previously saved draft', () => {
    saveDraft('first')
    saveDraft('second')
    expect(loadDraft()).toBe('second')
  })

  it('clears the saved draft', () => {
    saveDraft('hello')
    clearDraft()
    expect(loadDraft()).toBe('')
  })
})
