const PACKAGED_SERVER = 'http://localhost:8787'
const PACKAGED_WS = 'ws://localhost:8787/ws'

export function resolveApiPath(path: string, protocol: string): string {
  return protocol === 'file:' ? `${PACKAGED_SERVER}${path}` : path
}

export function resolveWebsocketUrl(protocol: string, host: string): string {
  if (protocol === 'file:') return PACKAGED_WS
  return `${protocol === 'https:' ? 'wss' : 'ws'}://${host}/ws`
}

export function apiPath(path: string): string {
  return resolveApiPath(path, window.location.protocol)
}

export function websocketUrl(): string {
  return resolveWebsocketUrl(window.location.protocol, window.location.host)
}

/** Query string identifying a room (owner + file). */
export function roomParams(owner: string, file: string): string {
  return `owner=${encodeURIComponent(owner)}&file=${encodeURIComponent(file)}`
}
