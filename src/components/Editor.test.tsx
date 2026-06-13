import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import * as Y from 'yjs'
import { Editor } from './Editor'
import { loadDraft, draftKey } from '../lib/storage'
import { encodeDocDraft, applyDocDraft } from '../lib/docState'
import { USER_ID_KEY } from '../lib/userId'

type PickerWindow = {
  showOpenFilePicker?: unknown
  showSaveFilePicker?: unknown
}

const TEST_USER = 'test-user'
const TEST_DRAFT_KEY = draftKey(TEST_USER, 'untitled.txt')

function draftFor(text: string): string {
  const doc = new Y.Doc()
  doc.getText('content').insert(0, text)
  return encodeDocDraft(doc)
}

function textOfDraft(draft: string): string {
  const doc = new Y.Doc()
  applyDocDraft(doc, draft)
  return doc.getText('content').toString()
}

describe('Editor', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    sessionStorage.setItem(USER_ID_KEY, TEST_USER)
  })

  afterEach(() => {
    delete (window as unknown as PickerWindow).showOpenFilePicker
    delete (window as unknown as PickerWindow).showSaveFilePicker
  })

  it('renders an empty text area by default', () => {
    render(<Editor />)
    const textarea = screen.getByRole('textbox', { name: /editor/i })
    expect(textarea).toHaveValue('')
  })

  it('lets the user type text', async () => {
    const user = userEvent.setup()
    render(<Editor />)
    const textarea = screen.getByRole('textbox', { name: /editor/i })
    await user.type(textarea, 'hello')
    expect(textarea).toHaveValue('hello')
  })

  it('restores a previously saved draft on mount', () => {
    localStorage.setItem(TEST_DRAFT_KEY, draftFor('saved text'))
    render(<Editor />)
    expect(screen.getByRole('textbox', { name: /editor/i })).toHaveValue('saved text')
  })

  it('auto-saves typed text to the per-room draft storage', async () => {
    const user = userEvent.setup()
    render(<Editor />)
    const textarea = screen.getByRole('textbox', { name: /editor/i })
    await user.type(textarea, 'auto')
    expect(textOfDraft(loadDraft(TEST_DRAFT_KEY))).toBe('auto')
  })

  it('overwrites the opened local file on export instead of creating a new one', async () => {
    const user = userEvent.setup()
    const write = vi.fn()
    const close = vi.fn()
    const file = new File(['original'], 'notes.txt', { type: 'text/plain' })
    const handle = {
      getFile: vi.fn().mockResolvedValue(file),
      createWritable: vi.fn().mockResolvedValue({ write, close }),
    }
    const showOpenFilePicker = vi.fn().mockResolvedValue([handle])
    const showSaveFilePicker = vi.fn()
    Object.assign(window as unknown as PickerWindow, {
      showOpenFilePicker,
      showSaveFilePicker,
    })

    render(<Editor />)
    await user.click(screen.getByRole('button', { name: /import/i }))
    expect(await screen.findByDisplayValue('original')).toBeInTheDocument()

    const textarea = screen.getByRole('textbox', { name: /editor/i })
    await user.clear(textarea)
    await user.type(textarea, 'edited')
    await user.click(screen.getByRole('button', { name: /export/i }))

    expect(handle.createWritable).toHaveBeenCalled()
    expect(write).toHaveBeenCalledWith('edited')
    expect(showSaveFilePicker).not.toHaveBeenCalled()
  })

  it('shows no unsaved indicator for a clean blank document', () => {
    render(<Editor />)
    expect(screen.queryByText(/unsaved/i)).not.toBeInTheDocument()
  })

  it('marks the document as unsaved after editing', async () => {
    const user = userEvent.setup()
    render(<Editor />)
    await user.type(screen.getByRole('textbox', { name: /editor/i }), 'hi')
    expect(screen.getByText(/unsaved/i)).toBeInTheDocument()
  })

  it('marks a restored draft as unsaved on mount', () => {
    localStorage.setItem(TEST_DRAFT_KEY, draftFor('restored work'))
    render(<Editor />)
    expect(screen.getByText(/unsaved/i)).toBeInTheDocument()
  })

  it('clears the unsaved indicator after exporting', async () => {
    const user = userEvent.setup()
    const write = vi.fn()
    const close = vi.fn()
    const handle = { createWritable: vi.fn().mockResolvedValue({ write, close }) }
    const showSaveFilePicker = vi.fn().mockResolvedValue(handle)
    Object.assign(window as unknown as PickerWindow, { showSaveFilePicker })

    render(<Editor />)
    await user.type(screen.getByRole('textbox', { name: /editor/i }), 'note')
    expect(screen.getByText(/unsaved/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /export/i }))
    expect(screen.queryByText(/unsaved/i)).not.toBeInTheDocument()
  })

  it('prompts for a location with save-as when no local file is open', async () => {
    const user = userEvent.setup()
    const write = vi.fn()
    const close = vi.fn()
    const handle = { createWritable: vi.fn().mockResolvedValue({ write, close }) }
    const showSaveFilePicker = vi.fn().mockResolvedValue(handle)
    Object.assign(window as unknown as PickerWindow, { showSaveFilePicker })

    render(<Editor />)
    const textarea = screen.getByRole('textbox', { name: /editor/i })
    await user.type(textarea, 'fresh note')
    await user.click(screen.getByRole('button', { name: /export/i }))

    expect(showSaveFilePicker).toHaveBeenCalled()
    expect(write).toHaveBeenCalledWith('fresh note')
  })
})
