const DRAFT_KEY = 'realtime-sync-editor:draft'

export function loadDraft(): string {
  return localStorage.getItem(DRAFT_KEY) ?? ''
}

export function saveDraft(content: string): void {
  localStorage.setItem(DRAFT_KEY, content)
}

export function clearDraft(): void {
  localStorage.removeItem(DRAFT_KEY)
}
