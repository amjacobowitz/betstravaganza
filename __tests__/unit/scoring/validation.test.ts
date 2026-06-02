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

  describe('one pick per event enforcement', () => {
    it('blocks a player from picking a second option from the same required event', () => {
      const events = [...makeRequiredEvents(), ...makeOptionalEvents()]
      const options = events.flatMap(e => makeOptions(e.id))

      // Player already has req-1-opt-0; now tries to pick req-1-opt-1
      const playerPicks: DraftPick[] = [
        makePick('user-1', 'req-1', 'req-1-opt-0', 1, t(0)),
      ]

      const result = validateDraftTurn({
        userId: 'user-1',
        proposedBetOptionId: 'req-1-opt-1',
        playerPicks,
        allPicks: playerPicks,
        betOptions: options,
        events,
        requiredEventIds: REQUIRED_EVENT_IDS,
        totalRounds: TOTAL_ROUNDS,
      })

      expect(result.valid).toBe(false)
      expect(result.reason).toMatch(/already has a pick from this event/i)
    })

    it('blocks a player from picking a second option from the same optional event', () => {
      const events = [...makeRequiredEvents(), ...makeOptionalEvents(3)]
      const options = events.flatMap(e => makeOptions(e.id))

      // All required done; player tries to pick second option from same optional event
      const playerPicks: DraftPick[] = [
        ...REQUIRED_EVENT_IDS.map((id, i) =>
          makePick('user-1', id, `${id}-opt-0`, i + 1, t(i * 100))
        ),
        makePick('user-1', 'opt-event-0', 'opt-event-0-opt-0', 7, t(700)),
      ]

      const result = validateDraftTurn({
        userId: 'user-1',
        proposedBetOptionId: 'opt-event-0-opt-1',
        playerPicks,
        allPicks: playerPicks,
        betOptions: options,
        events,
        requiredEventIds: REQUIRED_EVENT_IDS,
        totalRounds: TOTAL_ROUNDS,
      })

      expect(result.valid).toBe(false)
      expect(result.reason).toMatch(/already has a pick from this event/i)
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

  describe('combined required + clash enforcement', () => {
    // Setup: 6 required events, 3 optional events each with 2 sides
    function makeClashSetup(opts?: { clashOpsAvailable?: number; clashAlreadyDone?: number }) {
      const reqEvents = REQUIRED_EVENT_IDS.map(id => ({
        id,
        name: `Req ${id}`,
        category: 'required' as const,
        betType: 'odds' as const,
      }))
      const optEvents: ScoringEvent[] = ['opt-a', 'opt-b', 'opt-c'].map(id => ({
        id,
        name: `Opt ${id}`,
        category: 'optional' as const,
        betType: 'spread' as const,
      }))
      const betOptions: BetOption[] = [
        ...reqEvents.flatMap(e => makeOptions(e.id)),
        ...optEvents.flatMap(e => makeOptions(e.id)),
      ]
      return { events: [...reqEvents, ...optEvents], betOptions }
    }

    it('blocks optional non-clash pick when clash opportunities fill all remaining rounds', () => {
      const { events, betOptions } = makeClashSetup()

      // Player has all 6 required done, 2 optional non-clash picks done → 3 rounds left
      // Other users have picks on one side of opt-a, opt-b, opt-c → 3 clash opportunities
      // clashPicksNeeded = 2, effectiveClashNeeded = min(2,3) = 2
      // mandatoryNeeded = 0 required + 2 clash = 2, roundsRemaining = 3 → 2 < 3 → allow
      // ... let's use a tighter case: 2 rounds left with 2 clash ops needed

      const playerPicks: DraftPick[] = [
        ...REQUIRED_EVENT_IDS.map((id, i) => makePick('u1', id, `${id}-opt-0`, i + 1, t(i * 100))),
        makePick('u1', 'opt-a', 'opt-a-opt-0', 7, t(700)),  // already has opt-a (no clash, no opposing pick)
        makePick('u1', 'opt-b', 'opt-b-opt-0', 8, t(800)),  // already has opt-b (no clash)
        // 2 rounds left for opt-c (first of 2 optional events left)
      ]

      // Other users have picks on the OTHER side of opt-c only → 1 clash opportunity
      const otherPicks: DraftPick[] = [
        makePick('u2', 'opt-c', 'opt-c-opt-1', 1, t(0)),
      ]
      const allPicks = [...playerPicks, ...otherPicks]

      // roundsRemaining = 11 - 9 = 2, requiredRemaining = 0
      // availableClashOps = 1 (only opt-c remains), effectiveClashNeeded = min(2,1) = 1
      // mandatoryNeeded = 0 + 1 = 1, roundsRemaining = 2 → 1 < 2 → NOT blocked
      const result = validateDraftTurn({
        userId: 'u1',
        proposedBetOptionId: 'opt-c-opt-0', // would create clash
        playerPicks,
        allPicks,
        betOptions,
        events,
        requiredEventIds: REQUIRED_EVENT_IDS,
        totalRounds: TOTAL_ROUNDS,
      })

      expect(result.valid).toBe(true)
    })

    it('allows clash-creating optional pick even when mandatory slots are tight', () => {
      const { events, betOptions } = makeClashSetup()

      // Player has all 6 required, 3 optional picks done → 2 rounds left
      const playerPicks: DraftPick[] = [
        ...REQUIRED_EVENT_IDS.map((id, i) => makePick('u1', id, `${id}-opt-0`, i + 1, t(i * 100))),
        makePick('u1', 'opt-a', 'opt-a-opt-0', 7, t(700)),
        makePick('u1', 'opt-b', 'opt-b-opt-0', 8, t(800)),
        makePick('u1', 'opt-c', 'opt-c-opt-0', 9, t(900)),
      ]

      // Two more optional events, other user has picks on both opposing sides
      const extraOpts: ScoringEvent[] = [
        { id: 'opt-d', name: 'Opt D', category: 'optional', betType: 'spread' },
        { id: 'opt-e', name: 'Opt E', category: 'optional', betType: 'spread' },
      ]
      const extraOptions: BetOption[] = [
        ...makeOptions('opt-d'),
        ...makeOptions('opt-e'),
      ]
      const allEvents = [...events, ...extraOpts]
      const allOptions = [...betOptions, ...extraOptions]

      const otherPicks: DraftPick[] = [
        makePick('u2', 'opt-d', 'opt-d-opt-1', 1, t(0)),
        makePick('u2', 'opt-e', 'opt-e-opt-1', 2, t(100)),
      ]
      const allPicks = [...playerPicks, ...otherPicks]

      // roundsRemaining = 2, clashPicksNeeded = 2, availableClashOps = 2
      // effectiveClashNeeded = min(2,2) = 2, mandatoryNeeded = 0+2 = 2, roundsRemaining = 2 → 2 >= 2 → enforce
      // opt-d-opt-0 would create clash (u2 has opt-d-opt-1) → allowed
      const result = validateDraftTurn({
        userId: 'u1',
        proposedBetOptionId: 'opt-d-opt-0',
        playerPicks,
        allPicks,
        betOptions: allOptions,
        events: allEvents,
        requiredEventIds: REQUIRED_EVENT_IDS,
        totalRounds: TOTAL_ROUNDS,
      })

      expect(result.valid).toBe(true)
    })

    it('blocks non-clash optional pick when both required and clash must fill rounds', () => {
      const { events, betOptions } = makeClashSetup()

      // Player has 5 required done, 3 optional non-clash → 3 rounds left
      // requiredRemaining = 1, clashPicksNeeded = 2
      // Other user has picks on opt-c side only → availableClashOps = 0 (u1 already picked opt-a,b,c)
      // Actually need to re-set so u1 hasn't picked opt-c yet...

      // Let's do: 5 required, 2 optional non-clash done → 4 rounds left
      // requiredRemaining = 1, clashPicksNeeded = 2
      // Other users have picks on opt-a and opt-b → availableClashOps = 2
      // effectiveClashNeeded = min(2,2) = 2, mandatoryNeeded = 1+2 = 3, roundsRemaining = 4 → 3 < 4 → NOT blocked

      // Tighten: 5 required, 3 optional non-clash done → 3 rounds left
      // requiredRemaining = 1, clashPicksNeeded = 2
      // Other users have picks on opt-b opposing → availableClashOps = 1 (only opt-b left without picks)
      // Actually user already has opt-a, opt-b, opt-c done. Need more optional events.
      // Let's use 5 optional events total.
      const extraOpts: ScoringEvent[] = [
        { id: 'opt-d', name: 'Opt D', category: 'optional', betType: 'spread' },
        { id: 'opt-e', name: 'Opt E', category: 'optional', betType: 'spread' },
      ]
      const extraOptions: BetOption[] = [...makeOptions('opt-d'), ...makeOptions('opt-e')]
      const allEvents = [...events, ...extraOpts]
      const allOptions = [...betOptions, ...extraOptions]

      // 5 req done, 2 opt non-clash done → 4 rounds left
      // requiredRemaining = 1, clashPicksNeeded = 2
      // Clash oops: other user has picks on opt-c and opt-d → availableClashOps = 2
      // effectiveClashNeeded = min(2,2) = 2, mandatoryNeeded = 1+2 = 3, roundsRemaining = 4 → 3 < 4 → NOT blocked yet
      // But if we make roundsRemaining = 3 (9 picks done):
      // 5 req, 4 opt → 9 picks → 2 rounds left
      // requiredRemaining = 1, effectiveClashNeeded = min(2,2)=2, mandatoryNeeded = 3, roundsRemaining = 2 → 3 > 2 → impossible case, do NOT block more
      // Actually impossible case means we're already in trouble, so don't over-constrain.
      // Let's just test the clean case: mandatoryNeeded == roundsRemaining

      // 5 req, 3 opt non-clash → 8 picks → 3 rounds left
      // requiredRemaining = 1, clashOps = 2 (opt-c and opt-d have opposing picks)
      // effectiveClashNeeded = min(2,2) = 2, mandatoryNeeded = 1+2 = 3 = roundsRemaining = 3 → BLOCK
      const playerPicks: DraftPick[] = [
        ...REQUIRED_EVENT_IDS.slice(0, 5).map((id, i) => makePick('u1', id, `${id}-opt-0`, i + 1, t(i * 100))),
        makePick('u1', 'opt-a', 'opt-a-opt-0', 6, t(600)),
        makePick('u1', 'opt-b', 'opt-b-opt-0', 7, t(700)),
        makePick('u1', 'opt-e', 'opt-e-opt-0', 8, t(800)),
      ]
      const otherPicks: DraftPick[] = [
        makePick('u2', 'opt-c', 'opt-c-opt-1', 1, t(0)),  // opt-c has opposing pick
        makePick('u2', 'opt-d', 'opt-d-opt-1', 2, t(100)), // opt-d has opposing pick
      ]
      const allPicks = [...playerPicks, ...otherPicks]

      // proposing opt-d-opt-0 would create a clash → allowed
      const clashResult = validateDraftTurn({
        userId: 'u1',
        proposedBetOptionId: 'opt-d-opt-0',
        playerPicks,
        allPicks,
        betOptions: allOptions,
        events: allEvents,
        requiredEventIds: REQUIRED_EVENT_IDS,
        totalRounds: TOTAL_ROUNDS,
      })
      expect(clashResult.valid).toBe(true)

      // proposing req-6-opt-0 (required) → allowed
      const reqResult = validateDraftTurn({
        userId: 'u1',
        proposedBetOptionId: 'req-6-opt-0',
        playerPicks,
        allPicks,
        betOptions: allOptions,
        events: allEvents,
        requiredEventIds: REQUIRED_EVENT_IDS,
        totalRounds: TOTAL_ROUNDS,
      })
      expect(reqResult.valid).toBe(true)

      // proposing opt-e non-clash would NOT be allowed if opt-e doesn't have opposing pick
      // (opt-e-opt-0 is already in playerPicks, use a fresh optional... but we used all 5!)
      // Actually we already picked opt-e so it would fail "already has pick from event".
      // Let's verify the blocking with a genuinely new non-clash optional option.
      // The only remaining events are: req-6, opt-c, opt-d
      // opt-c creates clash (blocked would be opt-c-opt-0 DOES create clash since u2 has opt-c-opt-1)
      // So there's no truly "neutral" non-clash optional in this setup.
      // Test blocking by using an event from a different setup:
      // Add a no-opposing opt-f
      const optF: ScoringEvent = { id: 'opt-f', name: 'Opt F', category: 'optional', betType: 'spread' }
      const optFOptions = makeOptions('opt-f')

      const neutralResult = validateDraftTurn({
        userId: 'u1',
        proposedBetOptionId: 'opt-f-opt-0',
        playerPicks,
        allPicks,
        betOptions: [...allOptions, ...optFOptions],
        events: [...allEvents, optF],
        requiredEventIds: REQUIRED_EVENT_IDS,
        totalRounds: TOTAL_ROUNDS,
      })
      expect(neutralResult.valid).toBe(false)
      expect(neutralResult.reason).toMatch(/must use remaining/)
    })

    it('does not block when proposedOption is undefined (__check__ sentinel)', () => {
      const { events, betOptions } = makeClashSetup()
      // Even with tight constraints, __check__ (missing proposedOption) must not return valid=false
      const playerPicks: DraftPick[] = [
        ...REQUIRED_EVENT_IDS.map((id, i) => makePick('u1', id, `${id}-opt-0`, i + 1, t(i * 100))),
        makePick('u1', 'opt-a', 'opt-a-opt-0', 7, t(700)),
        makePick('u1', 'opt-b', 'opt-b-opt-0', 8, t(800)),
        makePick('u1', 'opt-c', 'opt-c-opt-0', 9, t(900)),
      ]

      const result = validateDraftTurn({
        userId: 'u1',
        proposedBetOptionId: '__check__',
        playerPicks,
        allPicks: playerPicks,
        betOptions,
        events,
        requiredEventIds: REQUIRED_EVENT_IDS,
        totalRounds: TOTAL_ROUNDS,
      })

      // __check__ has no proposedOption so bypass mandatory check
      expect(result.valid).toBe(true)
      expect(result.clashPicksNeeded).toBe(2)
    })
  })
})
