import { describe, it, expect } from 'vitest'
import { computePlayerBankroll, computeOutcome } from '@/lib/scoring/bankroll'
import type { DraftPick, BetOption, EventResult, ScoringEvent } from '@/lib/scoring/types'

const makeEvent = (id: string, betType: ScoringEvent['betType'] = 'odds'): ScoringEvent => ({
  id,
  name: `Event ${id}`,
  category: 'optional',
  betType,
})

const makeOption = (id: string, eventId: string, odds: number | null = -110): BetOption => ({
  id,
  eventId,
  label: `Option ${id}`,
  odds,
  maxDrafts: 1,
  draftCount: 1,
})

const makePick = (betOptionId: string, eventId: string): DraftPick => ({
  id: `pick-${betOptionId}`,
  userId: 'user-1',
  betOptionId,
  eventId,
  roundNumber: 1,
  createdAt: new Date(),
})

describe('computeOutcome', () => {
  describe('winner-type events (race, boxing, golf, moneyline)', () => {
    it('returns win when player picked the winner', () => {
      const result: EventResult = {
        id: 'r1',
        eventId: 'event-1',
        winnerBetOptionId: 'opt-winner',
        homeScore: null,
        awayScore: null,
        resultDisplay: 'Horse A wins',
      }
      expect(computeOutcome('opt-winner', result, makeEvent('event-1'))).toBe('win')
    })

    it('returns loss when player did not pick the winner', () => {
      const result: EventResult = {
        id: 'r1',
        eventId: 'event-1',
        winnerBetOptionId: 'opt-winner',
        homeScore: null,
        awayScore: null,
        resultDisplay: 'Horse A wins',
      }
      expect(computeOutcome('opt-loser', result, makeEvent('event-1'))).toBe('loss')
    })
  })

  describe('spread events', () => {
    const spreadEvent = makeEvent('event-spread', 'spread')
    const homeOption: BetOption = makeOption('opt-home', 'event-spread', -110)
    const awayOption: BetOption = makeOption('opt-away', 'event-spread', -110)

    it('returns win when home team covers spread', () => {
      // Home -3.5: home wins by 4+ → home covers
      const result: EventResult = {
        id: 'r1',
        eventId: 'event-spread',
        winnerBetOptionId: 'opt-home',
        homeScore: null,
        awayScore: null,
        resultDisplay: 'Home covers',
      }
      expect(computeOutcome('opt-home', result, spreadEvent)).toBe('win')
      expect(computeOutcome('opt-away', result, spreadEvent)).toBe('loss')
    })

    it('returns push when result_display indicates push', () => {
      const result: EventResult = {
        id: 'r1',
        eventId: 'event-spread',
        winnerBetOptionId: null,
        homeScore: null,
        awayScore: null,
        resultDisplay: 'Push',
      }
      expect(computeOutcome('opt-home', result, spreadEvent)).toBe('push')
      expect(computeOutcome('opt-away', result, spreadEvent)).toBe('push')
    })
  })

  describe('pending events', () => {
    it('returns pending when no result exists', () => {
      expect(computeOutcome('opt-1', null, makeEvent('event-1'))).toBe('pending')
    })
  })
})

describe('computePlayerBankroll', () => {
  const STARTING_BANKROLL = 1100
  const STAKE = 100

  it('returns starting bankroll when all picks are pending', () => {
    const picks = [makePick('opt-1', 'e-1'), makePick('opt-2', 'e-2')]
    const options = [makeOption('opt-1', 'e-1', 200), makeOption('opt-2', 'e-2', -150)]
    const events = [makeEvent('e-1'), makeEvent('e-2')]
    const results: EventResult[] = []

    const bankroll = computePlayerBankroll({
      picks,
      betOptions: options,
      events,
      results,
      startingBankroll: STARTING_BANKROLL,
      stake: STAKE,
    })

    expect(bankroll.total).toBe(STARTING_BANKROLL)
    expect(bankroll.realized).toBe(0)
    expect(bankroll.pending).toBe(2)
  })

  it('adds profit on a winning bet', () => {
    const picks = [makePick('opt-winner', 'e-1')]
    const options = [makeOption('opt-winner', 'e-1', 200)]
    const events = [makeEvent('e-1')]
    const results: EventResult[] = [{
      id: 'r1',
      eventId: 'e-1',
      winnerBetOptionId: 'opt-winner',
      homeScore: null,
      awayScore: null,
      resultDisplay: 'Winner',
    }]

    const bankroll = computePlayerBankroll({
      picks,
      betOptions: options,
      events,
      results,
      startingBankroll: STARTING_BANKROLL,
      stake: STAKE,
    })

    // +$200 profit on +200 odds
    expect(bankroll.total).toBe(STARTING_BANKROLL + 200)
  })

  it('subtracts stake on a losing bet', () => {
    const picks = [makePick('opt-loser', 'e-1')]
    const options = [makeOption('opt-loser', 'e-1', -110)]
    const events = [makeEvent('e-1')]
    const results: EventResult[] = [{
      id: 'r1',
      eventId: 'e-1',
      winnerBetOptionId: 'opt-other',
      homeScore: null,
      awayScore: null,
      resultDisplay: 'Other wins',
    }]

    const bankroll = computePlayerBankroll({
      picks,
      betOptions: options,
      events,
      results,
      startingBankroll: STARTING_BANKROLL,
      stake: STAKE,
    })

    expect(bankroll.total).toBe(STARTING_BANKROLL - 100)
  })

  it('handles push correctly (no change)', () => {
    const picks = [makePick('opt-home', 'e-1')]
    const options = [makeOption('opt-home', 'e-1', -110)]
    const events = [makeEvent('e-1', 'spread')]
    const results: EventResult[] = [{
      id: 'r1',
      eventId: 'e-1',
      winnerBetOptionId: null,
      homeScore: null,
      awayScore: null,
      resultDisplay: 'Push',
    }]

    const bankroll = computePlayerBankroll({
      picks,
      betOptions: options,
      events,
      results,
      startingBankroll: STARTING_BANKROLL,
      stake: STAKE,
    })

    expect(bankroll.total).toBe(STARTING_BANKROLL)
  })

  it('computes correctly across mixed win/loss/push/pending picks', () => {
    const picks = [
      makePick('opt-win', 'e-1'),   // win +200
      makePick('opt-lose', 'e-2'),  // loss
      makePick('opt-push', 'e-3'),  // push
      makePick('opt-pending', 'e-4'), // pending
    ]
    const options = [
      makeOption('opt-win', 'e-1', 200),
      makeOption('opt-lose', 'e-2', -110),
      makeOption('opt-push', 'e-3', -110),
      makeOption('opt-pending', 'e-4', -150),
    ]
    const events = [
      makeEvent('e-1'), makeEvent('e-2'), makeEvent('e-3', 'spread'), makeEvent('e-4'),
    ]
    const results: EventResult[] = [
      { id: 'r1', eventId: 'e-1', winnerBetOptionId: 'opt-win',   homeScore: null, awayScore: null, resultDisplay: '' },
      { id: 'r2', eventId: 'e-2', winnerBetOptionId: 'opt-other', homeScore: null, awayScore: null, resultDisplay: '' },
      { id: 'r3', eventId: 'e-3', winnerBetOptionId: null,        homeScore: null, awayScore: null, resultDisplay: 'Push' },
    ]

    const bankroll = computePlayerBankroll({
      picks,
      betOptions: options,
      events,
      results,
      startingBankroll: STARTING_BANKROLL,
      stake: STAKE,
    })

    // +200 (win) - 100 (loss) + 0 (push) + 0 (pending) = +100
    expect(bankroll.total).toBe(STARTING_BANKROLL + 100)
    expect(bankroll.pending).toBe(1)
  })
})
