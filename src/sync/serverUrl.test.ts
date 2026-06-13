import { describe, it, expect } from 'vitest'
import { resolveApiPath, resolveWebsocketUrl } from './serverUrl'

describe('resolveApiPath', () => {
  it('keeps a relative path when served over http (dev/proxy)', () => {
    expect(resolveApiPath('/api/state', 'http:')).toBe('/api/state')
  })

  it('uses the absolute server URL when served from a packaged file:// app', () => {
    expect(resolveApiPath('/api/state', 'file:')).toBe('http://localhost:8787/api/state')
  })
})

describe('resolveWebsocketUrl', () => {
  it('builds a same-origin ws url over http', () => {
    expect(resolveWebsocketUrl('http:', 'localhost:5173')).toBe('ws://localhost:5173/ws')
  })

  it('uses wss over https', () => {
    expect(resolveWebsocketUrl('https:', 'example.com')).toBe('wss://example.com/ws')
  })

  it('targets the absolute server from a packaged file:// app', () => {
    expect(resolveWebsocketUrl('file:', '')).toBe('ws://localhost:8787/ws')
  })
})
