import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as Y from 'yjs'
import { replaceText } from '../lib/ytext'
import { encodeDocDraft, applyDocDraft } from '../lib/docState'
import { loadDraft, saveDraft, draftKey } from '../lib/storage'
import { getUserId } from '../lib/userId'
import { getUserName, setUserName } from '../lib/userName'
import { createTransport } from '../sync/createTransport'
import { apiPath } from '../sync/serverUrl'
import { DEFAULT_FILE } from '../lib/textFile'
import type { ConnectionStatus, SyncMode } from '../sync/types'

const QUOTA_REFRESH_MS = 2000
const DEFAULT_QUOTA_BYTES = 1024 * 1024

export interface FileInfo {
  file: string
  bytes: number
}

export interface UserInfo {
  owner: string
  name: string
  files: number
  usage: number
}

export interface QuotaInfo {
  usage: number
  quota: number
}

export interface Collab {
  userId: string
  userName: string
  updateName: (name: string) => void
  owner: string
  ownerName: string
  users: UserInfo[]
  file: string
  openRoom: (owner: string, file: string) => void
  content: string
  setText: (next: string) => void
  mode: SyncMode
  setMode: (mode: SyncMode) => void
  status: ConnectionStatus
  quota: QuotaInfo
  files: FileInfo[]
  quotaError: boolean
  clearQuotaError: () => void
}

const encoder = new TextEncoder()
export const byteLength = (text: string): number => encoder.encode(text).length

const isTest = import.meta.env.MODE === 'test'

export function useCollab(): Collab {
  const userId = useMemo(() => getUserId(), [])
  const clientIdRef = useRef<string>(crypto.randomUUID())

  const [owner, setOwner] = useState(userId)
  const [file, setFile] = useState(DEFAULT_FILE)
  const [userName, setUserNameState] = useState(() => getUserName(userId))
  const [users, setUsers] = useState<UserInfo[]>([])

  // A fresh document per room — different files never share a Y.Doc.
  const doc = useMemo(() => new Y.Doc(), [owner, file])
  const ytext = useMemo(() => doc.getText('content'), [doc])

  const [content, setContent] = useState('')
  const [mode, setMode] = useState<SyncMode>('ws')
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')
  const [quota, setQuota] = useState<QuotaInfo>({ usage: 0, quota: DEFAULT_QUOTA_BYTES })
  const [files, setFiles] = useState<FileInfo[]>([])
  const [quotaError, setQuotaError] = useState(false)

  // Mirror the Y.Text into React state and persist a per-room draft as binary
  // Yjs state. Restoring binary state is idempotent (re-merging the same history
  // does not duplicate), unlike re-inserting the text would be.
  useEffect(() => {
    const key = draftKey(owner, file)
    const handler = () => {
      setContent(ytext.toString())
      saveDraft(key, encodeDocDraft(doc))
    }
    ytext.observe(handler)
    applyDocDraft(doc, loadDraft(key))
    setContent(ytext.toString())
    return () => ytext.unobserve(handler)
  }, [doc, ytext, owner, file])

  // (Re)connect whenever the mode or room changes.
  useEffect(() => {
    if (isTest) return
    const transport = createTransport(mode, {
      doc,
      clientId: clientIdRef.current,
      owner,
      file,
      setStatus,
      onRejected: () => setQuotaError(true),
    })
    Promise.resolve(transport.connect()).catch(() => setStatus('disconnected'))
    return () => transport.disconnect()
  }, [mode, doc, owner, file])

  // Poll the current owner's filesystem listing + quota usage.
  const refreshFiles = useCallback(async () => {
    try {
      const res = await fetch(apiPath(`/api/files?owner=${encodeURIComponent(owner)}`))
      const data = (await res.json()) as { files: FileInfo[]; usage: number; quota: number }
      setFiles(data.files)
      setQuota({ usage: data.usage, quota: data.quota })
    } catch {
      /* offline — keep last known values */
    }
  }, [owner])

  const refreshUsers = useCallback(async () => {
    try {
      const res = await fetch(apiPath('/api/users'))
      const data = (await res.json()) as { users: UserInfo[] }
      setUsers(data.users)
    } catch {
      /* offline */
    }
  }, [])

  const registerProfile = useCallback(
    async (name: string) => {
      try {
        await fetch(apiPath(`/api/profile?owner=${encodeURIComponent(userId)}`), {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name }),
        })
      } catch {
        /* offline */
      }
    },
    [userId],
  )

  useEffect(() => {
    if (isTest) return
    // Clear the previous owner's listing immediately so it never appears under
    // the newly selected filesystem.
    setFiles([])
    const tick = () => {
      void refreshFiles()
      void refreshUsers()
    }
    tick()
    void registerProfile(userName)
    const id = setInterval(tick, QUOTA_REFRESH_MS)
    return () => clearInterval(id)
  }, [refreshFiles, refreshUsers, registerProfile, userName])

  const updateName = useCallback(
    (name: string) => {
      setUserName(name)
      const trimmed = name.trim()
      if (!trimmed) return
      setUserNameState(trimmed)
      if (!isTest) void registerProfile(trimmed).then(refreshUsers)
    },
    [registerProfile, refreshUsers],
  )

  const ownerName = users.find((u) => u.owner === owner)?.name ?? (owner === userId ? userName : owner)

  const openRoom = useCallback(
    (nextOwner: string, nextFile: string) => {
      setOwner(nextOwner.trim() || userId)
      setFile(nextFile.trim() || DEFAULT_FILE)
      setQuotaError(false)
    },
    [userId],
  )

  const setText = useCallback(
    (next: string) => {
      // Client-side quota guard (the server enforces it too).
      const otherFilesBytes = Math.max(0, quota.usage - byteLength(content))
      if (byteLength(next) + otherFilesBytes > quota.quota) {
        setQuotaError(true)
        return
      }
      replaceText(ytext, next)
    },
    [ytext, quota, content],
  )

  return {
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
    clearQuotaError: () => setQuotaError(false),
  }
}
