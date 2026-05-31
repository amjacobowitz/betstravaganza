import { describe, it, expect } from 'vitest'
import { validateDraftTurn } from '@/lib/scoring/validation'
import type { DraftPick, BetOption, ScoringEvent } from '@/lib/scoring/types'

const t = (offsetMs: number) => new Date(1000000 + offsetMs)

// Required events: 6 categories
const REQUIRED_EVENT_IDS = ['req-1', 'req-2', 'req-3', 'req-4', 'req-5', 'req-6']
const TOTAL_ROUNDS = 11

const makeRequiredEvents = (): ScoringEvent[] =>
  REQUIRED_EVENT_IDS.map(id => ({
    id,
    name: `Required Event ${id}`,
    category: 'required' as const,
    betType: 'odds' as const,
  }))

const makeOptionalEvents = (count = 3): ScoringEvent[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `opt-event-${i}`,
    name: `Optional Event ${i}`,
    category: 'optional' as const,
    betType: 'spread' as const,
  }))

const makePick = (
  userId: string,
  eventId: string,
  betOptionId: string,
  roundNumber: number,
  createdAt: Date,
): DraftPick => ({
  id: `pick-${userId}-${roundNumber}`,
  userId,
  betOptionId,
  eventId,
  roundNumber,
  createdAt,
})

const makeOptions = (eventId: string, count = 2): BetOption[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `${eventId}-opt-${i}`,
    eventId,
    label: `Option ${i}`,
    odds: -110,
    maxDrafts: 1,
    draftCount: 0,
  }))

describe('validateDraftTurn', () => {
  describe('required pick enforcement', () => {
    it('blocks optional pick when required categories must fill all remaining rounds', () => {
      const events = [...makeRequiredEvents(), ...makeOptionalEvents(6)]
      const options = events.flatMap(e => makeOptions(e.id))

      // Player has 5 picks: 0 required, 5 optional. Rounds remaining = 6
      // Must complete 6 required in 6 remaining rounds → no optional picks allowed
      // Use 5 distinct events so no option is accidentally duplicated
      const playerPicks: DraftPick[] = Array.from({ length: 5 }, (_, i) =>
        makePick('user-1', `opt-event-${i}`, `opt-event-${i}-opt-0`, i + 1, t(i * 100))
      )

      const result = validateDraftTurn({
        userId: 'user-1',
        proposedBetOptionId: 'opt-event-5-opt-0', // fresh option, not yet drafted
        playerPicks,
        allPicks: playerPicks,
        betOptions: options,
        events,
        requiredEventIds: REQUIRED_EVENT_IDS,
        totalRounds: TOTAL_ROUNDS,
      })

      expect(result.valid).toBe(false)
      expect(result.reason).toMatch(/required/i)
    })

    it('allows optional pick when enough rounds remain for required picks', () => {
      const events = [...makeRequiredEvents(), ...makeOptionalEvents()]
      const options = events.flatMap(e => makeOptions(e.id))

      // Player has 2 picks: 2 required. 9 rounds remaining, 4 required left
      const playerPicks: DraftPick[] = [
        makePick('user-1', 'req-1', 'req-1-opt-0', 1, t(0)),
        makePick('user-1', 'req-2', 'req-2-opt-0', 2, t(100)),
      ]

      const result = validateDraftTurn({
        userId: 'user-1',
        proposedBetOptionId: 'opt-event-0-opt-0',
        playerPicks,
        allPicks: playerPicks,
        betOptions: options,
        events,
        requiredEventIds: REQUIRED_EVENT_IDS,
        totalRounds: TOTAL_ROUNDS,
      })

      expect(result.valid).toBe(true)
    })

    it('tracks which required categories are still needed', () => {
      const events = [...makeRequiredEvents(), ...makeOptionalEvents()]
      const options = events.flatMap(e => makeOptions(e.id))

      const playerPicks: DraftPick[] = [
        makePick('user-1', 'req-1', 'req-1-opt-0', 1, t(0)),
        makePick('user-1', 'req-2', 'req-2-opt-0', 2, t(100)),
      ]

      const result = validateDraftTurn({
        userId: 'user-1',
        proposedBetOptionId: 'req-3-opt-0',
        playerPicks,
        allPicks: playerPicks,
        betOptions: options,
        events,
        requiredEventIds: REQUIRED_EVENT_IDS,
        totalRounds: TOTAL_ROUNDS,
      })

      expect(result.requiredRemaining).toEqual(
        expect.arrayContaining(['req-3', 'req-4', 'req-5', 'req-6'])
      )
      expect(result.requiredRemaining).not.toContain('req-1')
      expect(result.requiredRemaining).not.toContain('req-2')
    })
  })

  describe('duplicate pick prevention', () => {
    it('blocks picking an option already taken by another player', () => {
      const events = [...makeRequiredEvents(), ...makeOptionalEvents()]
      const options = events.flatMap(e => makeOptions(e.id))

      const existingPick = makePick('user-2', 'req-1', 'req-1-opt-0', 1, t(0))
      const playerPicks: DraftPick[] = []

      const result = validateDraftTurn({
        userId: 'user-1',
        proposedBetOptionId: 'req-1-opt-0',
        playerPicks,
        allPicks: [existingPick],
        betOptions: options,
        events,
        requiredEventIds: REQUIRED_EVENT_IDS,
        totalRounds: TOTAL_ROUNDS,
      })

      expect(result.valid).toBe(false)
      expect(result.reason).toMatch(/already drafted by another player/i)
    })

    it('allows picking same event option up to maxDrafts (Belmont exception)', () => {
      const belmontEvent: ScoringEvent = {
        id: 'belmont',
        name: 'Belmont Stakes',
        category: 'required',
        betType: 'odds',
      }
      const belmontOptions: BetOption[] = [
        { id: 'belmont-horse-1', eventId: 'belmont', label: 'Secretariat', odds: 300, maxDrafts: 2, draftCount: 1 },
        { id: 'belmont-horse-2', eventId: 'belmont', label: 'Citation', odds: 500, maxDrafts: 2, draftCount: 0 },
      ]

      const existingPick = makePick('user-2', 'belmont', 'belmont-horse-1', 1, t(0))

      const result = validateDraftTurn({
        userId: 'user-1',
        proposedBetOptionId: 'belmont-horse-1',
        playerPicks: [],
        allPicks: [existingPick],
        betOptions: belmontOptions,
        events: [belmontEvent],
        requiredEventIds: ['belmont'],
        totalRounds: TOTAL_ROUNDS,
      })

      expect(result.valid).toBe(true)
    })

    it('blocks Belmont pick when maxDrafts reached', () => {
      const belmontEvent: ScoringEvent = {
        id: 'belmont',
        name: 'Belmont Stakes',
        category: 'required',
        betType: 'odds',
      }
      const belmontOptions: BetOption[] = [
        { id: 'belmont-horse-1', eventId: 'belmont', label: 'Secretariat', odds: 300, maxDrafts: 2, draftCount: 2 },
      ]

      const pick1 = makePick('user-2', 'belmont', 'belmont-horse-1', 1, t(0))
      const pick2 = makePick('user-3', 'belmont', 'belmont-horse-1', 2, t(100))

      const result = validateDraftTurn({
        userId: 'user-1',
        proposedBetOptionId: 'belmont-horse-1',
        playerPicks: [],
        allPicks: [pick1, pick2],
        betOptions: belmontOptions,
        events: [belmontEvent],
        requiredEventIds: ['belmont'],
        totalRounds: TOTAL_ROUNDS,
      })

      expect(result.valid).toBe(false)
      expect(result.reason).toMatch(/full.*max/i)
    })
  })

  describe('clash pick tracking', () => {
    it('reports clash picks needed', () => {
      const events = [...makeRequiredEvents(), ...makeOptionalEvents(5)]
      const options = events.flatMap(e => makeOptions(e.id))

      // Player has all 6 required + 3 optional (no clashes yet)
      const playerPicks: DraftPick[] = [
        ...REQUIRED_EVENT_IDS.map((id, i) =>
          makePick('user-1', id, `${id}-opt-0`, i + 1, t(i * 100))
        ),
        makePick('user-1', 'opt-event-0', 'opt-event-0-opt-0', 7, t(700)),
        makePick('user-1', 'opt-event-1', 'opt-event-1-opt-0', 8, t(800)),
        makePick('user-1', 'opt-event-2', 'opt-event-2-opt-0', 9, t(900)),
      ]

      const result = validateDraftTurn({
        userId: 'user-1',
        proposedBetOptionId: 'opt-event-3-opt-0',
        playerPicks,
        allPicks: playerPicks,
        betOptions: options,
        events,
        requiredEventIds: REQUIRED_EVENT_IDS,
        totalRounds: TOTAL_ROUNDS,
      })

      expect(result.clashPicksNeeded).toBe(2)
    })
  })
})
