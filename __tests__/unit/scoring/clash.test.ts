import { describe, it, expect } from 'vitest'
import { isClashPick } from '@/lib/scoring/clash'
import type { DraftPick, BetOption, ScoringEvent } from '@/lib/scoring/types'

const t = (offsetMs: number) => new Date(1000000 + offsetMs)

const makeEvent = (overrides: Partial<ScoringEvent> = {}): ScoringEvent => ({
  id: 'event-1',
  name: 'Yankees vs Red Sox',
  category: 'optional',
  betType: 'spread',
  ...overrides,
})

const makePick = (overrides: Partial<DraftPick> = {}): DraftPick => ({
  id: 'pick-1',
  userId: 'user-1',
  betOptionId: 'opt-home',
  eventId: 'event-1',
  roundNumber: 7,
  createdAt: t(0),
  ...overrides,
})

const makeTwoSidedOptions = (): BetOption[] => [
  { id: 'opt-home', eventId: 'event-1', label: 'Yankees', odds: -110, maxDrafts: 1, draftCount: 1 },
  { id: 'opt-away', eventId: 'event-1', label: 'Red Sox', odds: -110, maxDrafts: 1, draftCount: 1 },
]

describe('isClashPick', () => {
  it('is a clash when an earlier pick exists on the opposing side', () => {
    const events = [makeEvent()]
    const options = makeTwoSidedOptions()

    const earlierPick = makePick({ id: 'pick-0', userId: 'user-2', betOptionId: 'opt-home', createdAt: t(-100) })
    const laterPick   = makePick({ id: 'pick-1', userId: 'user-1', betOptionId: 'opt-away', createdAt: t(0) })

    expect(isClashPick(laterPick, [earlierPick, laterPick], options, events)).toBe(true)
  })

  it('is NOT a clash when no prior pick exists on the opposing side', () => {
    const events = [makeEvent()]
    const options = makeTwoSidedOptions()

    const pick = makePick({ betOptionId: 'opt-home' })
    expect(isClashPick(pick, [pick], options, events)).toBe(false)
  })

  it('is NOT a clash on a required event', () => {
    const events = [makeEvent({ category: 'required' })]
    const options = makeTwoSidedOptions()

    const earlierPick = makePick({ id: 'pick-0', userId: 'user-2', betOptionId: 'opt-home', createdAt: t(-100) })
    const laterPick   = makePick({ id: 'pick-1', userId: 'user-1', betOptionId: 'opt-away', createdAt: t(0) })

    expect(isClashPick(laterPick, [earlierPick, laterPick], options, events)).toBe(false)
  })

  it('is NOT a clash on a multi-option event (race/field)', () => {
    const events = [makeEvent()]
    const raceOptions: BetOption[] = [
      { id: 'opt-1', eventId: 'event-1', label: 'Horse A', odds: 300, maxDrafts: 1, draftCount: 1 },
      { id: 'opt-2', eventId: 'event-1', label: 'Horse B', odds: 500, maxDrafts: 2, draftCount: 1 },
      { id: 'opt-3', eventId: 'event-1', label: 'Horse C', odds: 200, maxDrafts: 1, draftCount: 1 },
    ]

    const earlierPick = makePick({ id: 'pick-0', userId: 'user-2', betOptionId: 'opt-1', createdAt: t(-100) })
    const laterPick   = makePick({ id: 'pick-1', userId: 'user-1', betOptionId: 'opt-2', createdAt: t(0) })

    expect(isClashPick(laterPick, [earlierPick, laterPick], raceOptions, events)).toBe(false)
  })

  it('is NOT a clash when the earlier pick is from the same user', () => {
    const events = [makeEvent()]
    const options = makeTwoSidedOptions()

    const firstPick  = makePick({ id: 'pick-0', userId: 'user-1', betOptionId: 'opt-home', createdAt: t(-100) })
    const secondPick = makePick({ id: 'pick-1', userId: 'user-1', betOptionId: 'opt-away', createdAt: t(0) })

    expect(isClashPick(secondPick, [firstPick, secondPick], options, events)).toBe(false)
  })

  it('is NOT a clash when the opposing pick came AFTER this pick', () => {
    const events = [makeEvent()]
    const options = makeTwoSidedOptions()

    const firstPick  = makePick({ id: 'pick-0', userId: 'user-1', betOptionId: 'opt-home', createdAt: t(0) })
    const laterPick  = makePick({ id: 'pick-1', userId: 'user-2', betOptionId: 'opt-away', createdAt: t(100) })

    // firstPick was made before anyone was on the other side → not a clash
    expect(isClashPick(firstPick, [firstPick, laterPick], options, events)).toBe(false)
  })

  it('counts clashes correctly across a full pick list', () => {
    const events = [makeEvent()]
    const options = makeTwoSidedOptions()

    const p1 = makePick({ id: 'p1', userId: 'user-1', betOptionId: 'opt-home', createdAt: t(0) })
    const p2 = makePick({ id: 'p2', userId: 'user-2', betOptionId: 'opt-away', createdAt: t(100) })

    const allPicks = [p1, p2]
    expect(isClashPick(p1, allPicks, options, events)).toBe(false) // p1 was first
    expect(isClashPick(p2, allPicks, options, events)).toBe(true)  // p2 clashes p1
  })
})
