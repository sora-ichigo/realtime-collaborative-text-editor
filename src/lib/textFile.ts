const DEFAULT_FILENAME = 'untitled.txt'

export function ensureTxtExtension(name: string): string {
  const trimmed = name.trim()
  if (trimmed === '') return DEFAULT_FILENAME
  if (trimmed.toLowerCase().endsWith('.txt')) return trimmed
  return `${trimmed}.txt`
}

export function readTextFile(file: File): Promise<string> {
  return file.text()
}

export function downloadText(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = ensureTxtExtension(filename)
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}
