import { describe, it, expect, beforeEach } from 'vitest'
import { getUserId, USER_ID_KEY } from './userId'

describe('getUserId', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('generates and persists a user id on first use', () => {
    const id = getUserId()
    expect(id).toBeTruthy()
    expect(sessionStorage.getItem(USER_ID_KEY)).toBe(id)
  })

  it('returns the same id on subsequent calls (same tab)', () => {
    const first = getUserId()
    const second = getUserId()
    expect(second).toBe(first)
  })

  it('reuses an id already stored in sessionStorage', () => {
    sessionStorage.setItem(USER_ID_KEY, 'fixed-id')
    expect(getUserId()).toBe('fixed-id')
  })
})
