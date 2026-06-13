import { useEffect, useRef, useState } from 'react'
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

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

export function Editor() {
  const {
    userId,
    userName,
    updateName,
    owner,
    ownerName,
    users,
    file,
    openRoom,
    content,
    setText,
    mode,
    setMode,
    status,
    quota,
    files,
    quotaError,
    clearQuotaError,
  } = useCollab()

  const [savedContent, setSavedContent] = useState('')
  const [fileHandle, setFileHandle] = useState<FileSystemFileHandle | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isDirty = content !== savedContent

  const [nameInput, setNameInput] = useState(userName)
  const [fileInput, setFileInput] = useState(file)
  useEffect(() => setNameInput(userName), [userName])
  useEffect(() => setFileInput(file), [file])

  // Owners offered in the picker: everyone known, plus yourself.
  const ownerOptions = users.some((u) => u.owner === owner)
    ? users
    : [...users, { owner, name: ownerName, files: 0, usage: 0 }]

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value)
  }

  const handleOpenFile = (event: React.FormEvent) => {
    event.preventDefault()
    openRoom(owner, fileInput)
  }

  const commitName = () => {
    if (nameInput.trim() && nameInput.trim() !== userName) updateName(nameInput)
  }

  const loadLocalFile = (text: string, handle: FileSystemFileHandle | null) => {
    setText(text)
    setSavedContent(text)
    setFileHandle(handle)
  }

  const handleImportClick = async () => {
    if (isFileSystemAccessSupported()) {
      try {
        const opened = await openFileWithPicker()
        if (!opened) return
        loadLocalFile(opened.content, opened.handle)
      } catch (error) {
        if (!isAbortError(error)) throw error
      }
      return
    }
    fileInputRef.current?.click()
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const local = event.target.files?.[0]
    if (!local) return
    loadLocalFile(await readTextFile(local), null)
    event.target.value = ''
  }

  const handleExport = async () => {
    if (fileHandle) {
      await writeFile(fileHandle, content)
      setSavedContent(content)
      return
    }
    try {
      const handle = await saveFileWithPicker(file, content)
      if (handle) {
        setFileHandle(handle)
        setSavedContent(content)
        return
      }
    } catch (error) {
      if (!isAbortError(error)) throw error
      return
    }
    downloadText(file, content)
    setSavedContent(content)
  }

  const usagePercent = Math.min(100, Math.round((quota.usage / quota.quota) * 100))

  return (
    <div className="editor">
      <div className="editor__toolbar">
        <button type="button" onClick={handleImportClick}>
          Import .txt
        </button>
        <button type="button" onClick={handleExport}>
          Export .txt
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

        <span
          className={`editor__status ${isDirty ? 'is-dirty' : 'is-saved'}`}
          role="status"
        >
          {isDirty ? '● Unsaved (local)' : 'Saved (local)'}
        </span>
      </div>

      <form className="editor__fsbar" onSubmit={handleOpenFile}>
        <label className="editor__field">
          You
          <input
            className="editor__name"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commitName()
              }
            }}
            aria-label="Your name"
          />
        </label>

        <label className="editor__field">
          Filesystem
          <select
            value={owner}
            onChange={(e) => openRoom(e.target.value, file)}
            aria-label="Choose filesystem"
          >
            {ownerOptions.map((u) => (
              <option key={u.owner} value={u.owner}>
                {u.name}
                {u.owner === userId ? ' (you)' : ''}
              </option>
            ))}
          </select>
        </label>

        <label className="editor__field">
          File
          <input
            value={fileInput}
            onChange={(e) => setFileInput(e.target.value)}
            aria-label="Filename"
          />
        </label>
        <button type="submit">Open</button>

        <span className="editor__quota" aria-label="Storage usage">
          <span className="editor__badge">{ownerName}&apos;s files</span>
          <span className="editor__quota-bar">
            <span
              className={`editor__quota-fill ${usagePercent >= 100 ? 'is-full' : ''}`}
              style={{ width: `${usagePercent}%` }}
            />
          </span>
          {formatBytes(quota.usage)} / {formatBytes(quota.quota)}
        </span>
      </form>

      {files.length > 0 && (
        <div className="editor__files" aria-label="Files in this filesystem">
          {files.map((f) => (
            <button
              key={f.file}
              type="button"
              className={`editor__file ${f.file === file ? 'is-open' : ''}`}
              onClick={() => openRoom(owner, f.file)}
            >
              {f.file} <span className="editor__file-size">{formatBytes(f.bytes)}</span>
            </button>
          ))}
        </div>
      )}

      {quotaError && (
        <div className="editor__quota-error" role="alert">
          Storage limit reached ({formatBytes(quota.quota)} per filesystem). Delete or shorten
          a file to free space.
          <button type="button" onClick={clearQuotaError}>
            Dismiss
          </button>
        </div>
      )}

      <textarea
        className="editor__textarea"
        aria-label="Editor"
        value={content}
        onChange={handleChange}
        placeholder="Start typing…"
      />
    </div>
  )
}
