import { useRef, useState } from 'react'
import { downloadText, readTextFile } from '../lib/textFile'
import {
  isFileSystemAccessSupported,
  openFileWithPicker,
  saveFileWithPicker,
  writeFile,
} from '../lib/fileAccess'
import { useCollab } from '../hooks/useCollab'
import { SYNC_MODE_LABELS, type SyncMode } from '../sync/types'
import './Editor.css'

const SYNC_MODES: SyncMode[] = ['ws', 'sse', 'polling']

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

export function Editor() {
  const { content, setText, mode, setMode, status } = useCollab()
  const [savedContent, setSavedContent] = useState('')
  const [filename, setFilename] = useState('untitled.txt')
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isDirty = content !== savedContent

  const loadFromFile = (text: string, name: string, handle: FileSystemFileHandle | null) => {
    setText(text)
    setSavedContent(text)
    setFilename(name)
    setFileHandle(handle)
  }

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value)
  }

  const handleOpenClick = async () => {
    if (isFileSystemAccessSupported()) {
      try {
        const opened = await openFileWithPicker()
        if (!opened) return
        loadFromFile(opened.content, opened.name, opened.handle)
      } catch (error) {
        if (!isAbortError(error)) throw error
      }
      return
    }
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    loadFromFile(await readTextFile(file), file.name, null)
    event.target.value = ''
  }

  const handleSave = async () => {
    if (fileHandle) {
      await writeFile(fileHandle, content)
      setSavedContent(content)
      return
    }
    try {
      const handle = await saveFileWithPicker(filename, content)
      if (handle) {
        setFileHandle(handle)
        setSavedContent(content)
        return
      }
    } catch (error) {
      if (!isAbortError(error)) throw error
      return
    }
    downloadText(filename, content)
    setSavedContent(content)
  }

  return (
    <div className="editor">
      <div className="editor__toolbar">
        <button type="button" onClick={handleOpenClick}>
          Open
        </button>
        <button type="button" onClick={handleSave}>
          Save
        </button>
        <input
          ref={fileInputRef}
          className="editor__file-input"
          type="file"
          accept=".txt,text/plain"
          onChange={handleFileChange}
          data-testid="file-input"
        />

        <span className="editor__sync" role="group" aria-label="Sync mode">
          {SYNC_MODES.map((m) => (
            <button
              key={m}
              type="button"
              className={`editor__mode ${mode === m ? 'is-active' : ''}`}
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
            >
              {SYNC_MODE_LABELS[m]}
            </button>
          ))}
          <span className={`editor__conn editor__conn--${status}`}>{status}</span>
        </span>

        <span className="editor__filename">{filename}</span>
        <span
          className={`editor__status ${isDirty ? 'is-dirty' : 'is-saved'}`}
          role="status"
        >
          {isDirty ? '● Unsaved changes' : 'Saved'}
        </span>
      </div>
      <textarea
        className="editor__textarea"
        aria-label="Editor"
        value={content}
        onChange={handleChange}
        placeholder="Start typing, or open a .txt file…"
      />
    </div>
  )
}
