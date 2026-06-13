import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as Y from 'yjs'
import { replaceText } from '../lib/ytext'
import { loadDraft, saveDraft } from '../lib/storage'
import { createTransport } from '../sync/createTransport'
import type { ConnectionStatus, SyncMode } from '../sync/types'

export interface Collab {
  content: string
  setText: (next: string) => void
  mode: SyncMode
  setMode: (mode: SyncMode) => void
  status: ConnectionStatus
}

export function useCollab(): Collab {
  const docRef = useRef<Y.Doc | null>(null)
  if (!docRef.current) docRef.current = new Y.Doc()
  const doc = docRef.current
  const ytext = useMemo(() => doc.getText('content'), [doc])
  const clientIdRef = useRef<string>(crypto.randomUUID())

  const [content, setContent] = useState('')
  const [mode, setMode] = useState<SyncMode>('ws')
  const [status, setStatus] = useState<ConnectionStatus>('disconnected')

  // Mirror the Y.Text into React state and persist every change as a draft.
  useEffect(() => {
    const handler = () => {
      const value = ytext.toString()
      setContent(value)
      saveDraft(value)
    }
    ytext.observe(handler)
    return () => ytext.unobserve(handler)
  }, [ytext])

  // Seed the document from a previously saved draft once on mount.
  useEffect(() => {
    const draft = loadDraft()
    if (draft) replaceText(ytext, draft)
    else setContent(ytext.toString())
  }, [ytext])

  // (Re)connect whenever the transport mode changes.
  useEffect(() => {
    if (import.meta.env.MODE === 'test') return
    const transport = createTransport(mode, {
      doc,
      clientId: clientIdRef.current,
      setStatus,
    })
    Promise.resolve(transport.connect()).catch(() => setStatus('disconnected'))
    return () => transport.disconnect()
  }, [mode, doc])

  const setText = useCallback((next: string) => replaceText(ytext, next), [ytext])

  return { content, setText, mode, setMode, status }
}
