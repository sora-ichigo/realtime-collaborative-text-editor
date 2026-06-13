export const USER_NAME_KEY = 'rcte:userName'

/**
 * This tab's display name, defaulting to `User-xxxx` from the user id. Stored in
 * sessionStorage so each tab has its own name (matching the per-tab user id).
 */
export function getUserName(userId: string): string {
  const existing = sessionStorage.getItem(USER_NAME_KEY)
  if (existing) return existing
  const name = `User-${userId.slice(0, 4)}`
  sessionStorage.setItem(USER_NAME_KEY, name)
  return name
}

/** Persist a new display name. Empty/whitespace names are ignored. */
export function setUserName(name: string): void {
  const trimmed = name.trim()
  if (!trimmed) return
  sessionStorage.setItem(USER_NAME_KEY, trimmed)
}
