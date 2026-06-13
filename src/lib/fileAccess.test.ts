import { describe, it, expect, vi, afterEach } from 'vitest'
import { isFileSystemAccessSupported, writeFile } from './fileAccess'

afterEach(() => {
  delete (window as unknown as { showOpenFilePicker?: unknown }).showOpenFilePicker
})

describe('isFileSystemAccessSupported', () => {
  it('is false when showOpenFilePicker is missing', () => {
    expect(isFileSystemAccessSupported()).toBe(false)
  })

  it('is true when showOpenFilePicker is available', () => {
    ;(window as unknown as { showOpenFilePicker: unknown }).showOpenFilePicker = () => {}
    expect(isFileSystemAccessSupported()).toBe(true)
  })
})

describe('writeFile', () => {
  it('writes the content to the handle and closes the stream', async () => {
    const write = vi.fn()
    const close = vi.fn()
    const createWritable = vi.fn().mockResolvedValue({ write, close })
    const handle = { createWritable } as unknown as FileSystemFileHandle

    await writeFile(handle, 'hello')

    expect(createWritable).toHaveBeenCalled()
    expect(write).toHaveBeenCalledWith('hello')
    expect(close).toHaveBeenCalled()
  })
})
