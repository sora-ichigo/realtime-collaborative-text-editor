import * as Y from 'yjs'
import { createDocHub, type DocHub } from './docHub.ts'

export const PERSISTENCE_ORIGIN = 'persistence'
export const DEFAULT_QUOTA_BYTES = 1024 * 1024 // 1 MiB

export interface ApplyResult {
  accepted: boolean
  reason?: 'quota'
}

export interface FileInfo {
  file: string
  bytes: number
}

export interface DocRegistry {
  quotaBytes: number
  getOrCreate(owner: string, file: string): DocHub
  applyUpdate(owner: string, file: string, update: Uint8Array, origin: unknown): ApplyResult
  ownerUsage(owner: string): number
  listFiles(owner: string): FileInfo[]
  listOwners(): string[]
}

export interface DocRegistryOptions {
  quotaBytes?: number
  onRoomCreated?: (owner: string, file: string, hub: DocHub) => void
}

interface Room {
  owner: string
  file: string
  hub: DocHub
}

function contentBytes(hub: DocHub): number {
  return Buffer.byteLength(hub.doc.getText('content').toString(), 'utf8')
}

/**
 * Holds one document (DocHub) per (owner, file) and enforces a per-owner byte
 * quota across all of that owner's files.
 */
export function createDocRegistry(options: DocRegistryOptions = {}): DocRegistry {
  const quotaBytes = options.quotaBytes ?? DEFAULT_QUOTA_BYTES
  const rooms = new Map<string, Room>()
  const keyOf = (owner: string, file: string) => `${owner}/${file}`

  const getOrCreate = (owner: string, file: string): DocHub => {
    const key = keyOf(owner, file)
    let room = rooms.get(key)
    if (!room) {
      room = { owner, file, hub: createDocHub() }
      rooms.set(key, room)
      options.onRoomCreated?.(owner, file, room.hub)
    }
    return room.hub
  }

  const ownerUsage = (owner: string): number => {
    let total = 0
    for (const room of rooms.values()) {
      if (room.owner === owner) total += contentBytes(room.hub)
    }
    return total
  }

  const applyUpdate = (
    owner: string,
    file: string,
    update: Uint8Array,
    origin: unknown,
  ): ApplyResult => {
    const hub = getOrCreate(owner, file)

    // Compute the prospective size without mutating the live document.
    const probe = new Y.Doc()
    Y.applyUpdate(probe, hub.stateAsUpdate())
    Y.applyUpdate(probe, update)
    const nextBytes = Buffer.byteLength(probe.getText('content').toString(), 'utf8')
    const otherFilesBytes = ownerUsage(owner) - contentBytes(hub)

    // Restoring persisted state bypasses the quota so a full filesystem still loads.
    if (origin !== PERSISTENCE_ORIGIN && otherFilesBytes + nextBytes > quotaBytes) {
      return { accepted: false, reason: 'quota' }
    }

    hub.applyUpdate(update, origin)
    return { accepted: true }
  }

  const listFiles = (owner: string): FileInfo[] => {
    const files: FileInfo[] = []
    for (const room of rooms.values()) {
      if (room.owner !== owner) continue
      const bytes = contentBytes(room.hub)
      // Skip empty rooms so merely viewing a file does not pollute a filesystem.
      if (bytes > 0) files.push({ file: room.file, bytes })
    }
    return files
  }

  const listOwners = (): string[] => {
    const owners = new Set<string>()
    for (const room of rooms.values()) owners.add(room.owner)
    return [...owners]
  }

  return { quotaBytes, getOrCreate, applyUpdate, ownerUsage, listFiles, listOwners }
}
