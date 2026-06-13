export const USER_ID_KEY = 'rcte:userId'

/**
 * Returns this tab's user id, generating one on first use. Stored in
 * sessionStorage so each browser tab is a separate user (and the id survives a
 * reload of that tab).
 */
export function getUserId(): string {
  const existing = sessionStorage.getItem(USER_ID_KEY)
  if (existing) return existing
  const id = crypto.randomUUID()
  sessionStorage.setItem(USER_ID_KEY, id)
  return id
}
