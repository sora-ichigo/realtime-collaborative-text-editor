import { describe, it, expect } from 'vitest'
import { createDebouncedSaver } from './persistence'

describe('createDebouncedSaver', () => {
  it('does nothing on flush when nothing was scheduled', async () => {
    let saves = 0
    const saver = createDebouncedSaver(() => { saves++ }, 5)
    await saver.flush()
    expect(saves).toBe(0)
  })

  it('flush() saves immediately when a save is pending', async () => {
    let saves = 0
    const saver = createDebouncedSaver(() => { saves++ }, 1000)
    saver.schedule()
    await saver.flush()
    expect(saves).toBe(1)
  })

  it('collapses multiple schedules into a single save', async () => {
    let saves = 0
    const saver = createDebouncedSaver(() => { saves++ }, 1000)
    saver.schedule()
    saver.schedule()
    saver.schedule()
    await saver.flush()
    expect(saves).toBe(1)
  })

  it('runs the timer-based save after the debounce window', async () => {
    let saves = 0
    const saver = createDebouncedSaver(() => { saves++ }, 5)
    saver.schedule()
    await new Promise((r) => setTimeout(r, 25))
    expect(saves).toBe(1)
  })
})
