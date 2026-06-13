import { createWebSocketTransport } from './websocketTransport'
import { createSseTransport } from './sseTransport'
import { createPollingTransport } from './pollingTransport'
import type { SyncMode, SyncTransport, TransportDeps } from './types'

export function createTransport(mode: SyncMode, deps: TransportDeps): SyncTransport {
  switch (mode) {
    case 'ws':
      return createWebSocketTransport(deps)
    case 'sse':
      return createSseTransport(deps)
    case 'polling':
      return createPollingTransport(deps)
  }
}
