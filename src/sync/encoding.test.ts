import { describe, it, expect } from 'vitest'
import { toBase64, fromBase64 } from './encoding'

describe('base64 encoding', () => {
  it('round-trips arbitrary bytes including 0 and 255', () => {
    const bytes = new Uint8Array([0, 1, 2, 127, 128, 254, 255])
    expect(fromBase64(toBase64(bytes))).toEqual(bytes)
  })

  it('round-trips an empty array', () => {
    expect(fromBase64(toBase64(new Uint8Array([])))).toEqual(new Uint8Array([]))
  })
})
