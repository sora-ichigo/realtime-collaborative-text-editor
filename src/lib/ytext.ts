import type * as Y from 'yjs'

/**
 * Apply the minimal insert/delete needed to turn `ytext` into `next`,
 * preserving CRDT positions for the unchanged prefix and suffix.
 */
export function replaceText(ytext: Y.Text, next: string): void {
  const current = ytext.toString()
  if (current === next) return

  const minLen = Math.min(current.length, next.length)
  let start = 0
  while (start < minLen && current[start] === next[start]) start++

  let endCurrent = current.length
  let endNext = next.length
  while (
    endCurrent > start &&
    endNext > start &&
    current[endCurrent - 1] === next[endNext - 1]
  ) {
    endCurrent--
    endNext--
  }

  const deleteCount = endCurrent - start
  const insertText = next.slice(start, endNext)

  const apply = () => {
    if (deleteCount > 0) ytext.delete(start, deleteCount)
    if (insertText.length > 0) ytext.insert(start, insertText)
  }

  const doc = ytext.doc
  if (doc) doc.transact(apply)
  else apply()
}
