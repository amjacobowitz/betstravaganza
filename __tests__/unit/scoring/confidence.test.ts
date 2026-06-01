import { describe, it, expect } from 'vitest'
import { computeConfidenceBonus } from '@/lib/scoring/confidence'
import type { SlatePick, SlateResult } from '@/lib/scoring/types'

const makePick = (gameId: string, team: 'home' | 'away', rank: number): SlatePick => ({
  id: `pick-${gameId}`,
  userId: 'user-1',
  slateGameId: gameId,
  teamPicked: team,
  confidenceRank: rank,
  submittedAt: new Date(),
})

const makeResult = (gameId: string, winner: 'home' | 'away' | 'push', spread?: number): SlateResult => ({
  id: `result-${gameId}`,
  slateGameId: gameId,
  homeScore: winner === 'home' ? 5 : 3,
  awayScore: winner === 'away' ? 5 : 3,
  spread: spread ?? null,
  resultDisplay: `${winner} wins`,
})

const POINTS_PER_RANK = 3

describe('computeConfidenceBonus', () => {
  it('returns 0 when no results are in yet', () => {
    const picks = [makePick('g1', 'home', 15), makePick('g2', 'away', 14)]
    expect(computeConfidenceBonus(picks, [])).toBe(0)
  })

  it('awards rank × $3 for a correct pick', () => {
    const picks = [makePick('g1', 'home', 15)]
    const results = [makeResult('g1', 'home')]
    expect(computeConfidenceBonus(picks, results)).toBe(15 * POINTS_PER_RANK)
  })

  it('awards 0 for an incorrect pick (no penalty)', () => {
    const picks = [makePick('g1', 'home', 15)]
    const results = [makeResult('g1', 'away')]
    expect(computeConfidenceBonus(picks, results)).toBe(0)
  })

  it('awards 0 for a push (no win, no loss)', () => {
    const picks = [makePick('g1', 'home', 10)]
    const results = [makeResult('g1', 'push')]
    expect(computeConfidenceBonus(picks, results)).toBe(0)
  })

  it('accumulates bonus across multiple correct picks', () => {
    const picks = [
      makePick('g1', 'home', 15),
      makePick('g2', 'away', 10),
      makePick('g3', 'home', 5),
    ]
    const results = [
      makeResult('g1', 'home'), // correct: 15 × 3 = 45
      makeResult('g2', 'home'), // wrong: 0
      makeResult('g3', 'home'), // correct: 5 × 3 = 15
    ]
    expect(computeConfidenceBonus(picks, results)).toBe((15 + 5) * POINTS_PER_RANK)
  })

  it('handles partial results (some games not yet played)', () => {
    const picks = [
      makePick('g1', 'home', 15), // result in
      makePick('g2', 'away', 8),  // no result yet
    ]
    const results = [makeResult('g1', 'home')] // only g1 decided
    // g2 is pending → contributes 0
    expect(computeConfidenceBonus(picks, results)).toBe(15 * POINTS_PER_RANK)
  })

  it('computes max possible bonus correctly for 15 games all correct', () => {
    const picks = Array.from({ length: 15 }, (_, i) =>
      makePick(`g${i + 1}`, 'home', 15 - i) // ranks 15 down to 1
    )
    const results = Array.from({ length: 15 }, (_, i) =>
      makeResult(`g${i + 1}`, 'home') // all correct
    )
    // Max: (15+14+...+1) × 3 = 120 × 3 = 360
    expect(computeConfidenceBonus(picks, results)).toBe(360)
  })

  describe('spread-based winner determination', () => {
    it('home covers when winning by more than spread', () => {
      // home wins 28-24, spread -3.5 → adjusted home 24.5 > 24 → home covers
      const pick = makePick('g1', 'home', 5)
      const result: SlateResult = { id: 'r1', slateGameId: 'g1', homeScore: 28, awayScore: 24, spread: -3.5, resultDisplay: '' }
      expect(computeConfidenceBonus([pick], [result])).toBe(15)
    })

    it('away covers when home does not beat spread', () => {
      // home wins 27-24, spread -3.5 → adjusted home 23.5 < 24 → away covers
      const pick = makePick('g1', 'away', 5)
      const result: SlateResult = { id: 'r1', slateGameId: 'g1', homeScore: 27, awayScore: 24, spread: -3.5, resultDisplay: '' }
      expect(computeConfidenceBonus([pick], [result])).toBe(15)
    })

    it('push when adjusted scores are exactly equal', () => {
      // home wins 24-20, spread -4 → adjusted home 20 == 20 → push
      const pick = makePick('g1', 'home', 5)
      const result: SlateResult = { id: 'r1', slateGameId: 'g1', homeScore: 24, awayScore: 20, spread: -4, resultDisplay: '' }
      expect(computeConfidenceBonus([pick], [result])).toBe(0)
    })

    it('falls back to straight-up when spread is null', () => {
      const pick = makePick('g1', 'home', 5)
      const result: SlateResult = { id: 'r1', slateGameId: 'g1', homeScore: 5, awayScore: 3, spread: null, resultDisplay: '' }
      expect(computeConfidenceBonus([pick], [result])).toBe(15)
    })
  })
})
