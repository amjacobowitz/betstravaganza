import { describe, it, expect } from 'vitest'
import { computePayout } from '@/lib/scoring/payout'

describe('computePayout', () => {
  const STAKE = 100

  describe('win outcomes', () => {
    it('pays positive (underdog) odds correctly', () => {
      // +200 odds: $100 bet wins $200 profit
      expect(computePayout(200, STAKE, 'win')).toBeCloseTo(200)
    })

    it('pays negative (favorite) odds correctly', () => {
      // -150 odds: $100 bet wins $66.67 profit
      expect(computePayout(-150, STAKE, 'win')).toBeCloseTo(66.67, 1)
    })

    it('pays standard spread odds (-110) correctly', () => {
      // -110 odds: $100 bet wins $90.91 profit
      expect(computePayout(-110, STAKE, 'win')).toBeCloseTo(90.91, 1)
    })

    it('pays flat for no-odds events (null odds)', () => {
      // No odds: flat $100 win
      expect(computePayout(null, STAKE, 'win')).toBe(100)
    })

    it('pays +100 (even money) correctly', () => {
      expect(computePayout(100, STAKE, 'win')).toBe(100)
    })

    it('pays large underdog odds correctly', () => {
      // +500 odds: $100 bet wins $500 profit
      expect(computePayout(500, STAKE, 'win')).toBe(500)
    })

    it('pays heavy favorite odds correctly', () => {
      // -300 odds: $100 bet wins $33.33 profit
      expect(computePayout(-300, STAKE, 'win')).toBeCloseTo(33.33, 1)
    })
  })

  describe('loss outcomes', () => {
    it('returns -stake for a loss regardless of odds', () => {
      expect(computePayout(200, STAKE, 'loss')).toBe(-100)
      expect(computePayout(-150, STAKE, 'loss')).toBe(-100)
      expect(computePayout(null, STAKE, 'loss')).toBe(-100)
    })
  })

  describe('push outcomes', () => {
    it('returns 0 net change for a push', () => {
      expect(computePayout(-110, STAKE, 'push')).toBe(0)
      expect(computePayout(200, STAKE, 'push')).toBe(0)
      expect(computePayout(null, STAKE, 'push')).toBe(0)
    })
  })

  describe('pending outcomes', () => {
    it('returns 0 for pending picks', () => {
      expect(computePayout(-110, STAKE, 'pending')).toBe(0)
    })
  })

  describe('edge cases', () => {
    it('handles different stake amounts', () => {
      // $50 stake at +200 = $100 profit
      expect(computePayout(200, 50, 'win')).toBe(100)
    })

    it('rejects zero odds', () => {
      expect(() => computePayout(0, STAKE, 'win')).toThrow()
    })
  })
})
