import { describe, it, expect } from 'vitest'
import { bucketItem } from '@/lib/utils/schedule'

describe('bucketItem', () => {
  it('returns completed when hasResult is true regardless of startTime', () => {
    expect(bucketItem(null, true)).toBe('completed')
    expect(bucketItem('2020-01-01T00:00:00Z', true)).toBe('completed')
    expect(bucketItem('2099-01-01T00:00:00Z', true)).toBe('completed')
  })

  it('returns tbd when startTime is null and no result', () => {
    expect(bucketItem(null, false)).toBe('tbd')
  })

  it('returns upcoming for a future startTime with no result', () => {
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    expect(bucketItem(future, false)).toBe('upcoming')
  })

  it('returns live for a past startTime with no result', () => {
    const past = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    expect(bucketItem(past, false)).toBe('live')
  })
})
