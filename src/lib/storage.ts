export function draftKey(owner: string, file: string): string {
  return `rcte:draft:${owner}/${file}`
}

export function loadDraft(key: string): string {
  return localStorage.getItem(key) ?? ''
}

export function saveDraft(key: string, content: string): void {
  localStorage.setItem(key, content)
}

export function clearDraft(key: string): void {
  localStorage.removeItem(key)
}
