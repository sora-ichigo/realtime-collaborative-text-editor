export interface DebouncedSaver {
  schedule(): void
  flush(): Promise<void>
}

/**
 * Coalesces frequent change notifications into at most one `save` per debounce
 * window. `flush()` runs any pending save immediately (for graceful shutdown).
 */
export function createDebouncedSaver(
  save: () => Promise<void> | void,
  debounceMs: number,
): DebouncedSaver {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending = false

  const flush = async () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    if (!pending) return
    pending = false
    await save()
  }

  const schedule = () => {
    pending = true
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void flush(), debounceMs)
  }

  return { schedule, flush }
}
