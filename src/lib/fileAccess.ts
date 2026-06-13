import { ensureTxtExtension } from './textFile'

const TXT_PICKER_TYPES = [
  { description: 'Plain text', accept: { 'text/plain': ['.txt'] } },
]

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function'
}

export interface OpenedFile {
  handle: FileSystemFileHandle
  name: string
  content: string
}

export async function openFileWithPicker(): Promise<OpenedFile | null> {
  if (!window.showOpenFilePicker) return null
  const [handle] = await window.showOpenFilePicker({ types: TXT_PICKER_TYPES })
  const file = await handle.getFile()
  return { handle, name: file.name, content: await file.text() }
}

export async function writeFile(handle: FileSystemFileHandle, content: string): Promise<void> {
  const writable = await handle.createWritable()
  await writable.write(content)
  await writable.close()
}

export async function saveFileWithPicker(
  suggestedName: string,
  content: string,
): Promise<FileSystemFileHandle | null> {
  if (!window.showSaveFilePicker) return null
  const handle = await window.showSaveFilePicker({
    suggestedName: ensureTxtExtension(suggestedName),
    types: TXT_PICKER_TYPES,
  })
  await writeFile(handle, content)
  return handle
}
