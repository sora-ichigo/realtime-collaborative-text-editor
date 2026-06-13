import type * as Y from 'yjs'

export type SyncMode = 'ws' | 'sse' | 'polling'

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'

export interface SyncTransport {
  connect(): void | Promise<void>
  disconnect(): void
}

export interface TransportDeps {
  doc: Y.Doc
  clientId: string
  owner: string
  file: string
  setStatus: (status: ConnectionStatus) => void
  onRejected?: (reason?: string) => void
}

export const SYNC_MODE_LABELS: Record<SyncMode, string> = {
  ws: 'WebSocket',
  sse: 'SSE',
  polling: 'Polling',
}
