import { describe, it, expect, beforeEach } from 'vitest'
import { getUserName, setUserName, USER_NAME_KEY } from './userName'

describe('user name', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('derives a default name from the user id on first use', () => {
    const name = getUserName('abcd1234-xxxx')
    expect(name).toBe('User-abcd')
    expect(sessionStorage.getItem(USER_NAME_KEY)).toBe('User-abcd')
  })

  it('returns a previously chosen name', () => {
    sessionStorage.setItem(USER_NAME_KEY, 'Alice')
    expect(getUserName('any-id')).toBe('Alice')
  })

  it('persists a new name and trims it', () => {
    setUserName('  Bob  ')
    expect(sessionStorage.getItem(USER_NAME_KEY)).toBe('Bob')
    expect(getUserName('any-id')).toBe('Bob')
  })

  it('ignores an empty name', () => {
    sessionStorage.setItem(USER_NAME_KEY, 'Keep')
    setUserName('   ')
    expect(getUserName('any-id')).toBe('Keep')
  })
})
