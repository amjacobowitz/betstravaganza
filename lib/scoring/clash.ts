import type { DraftPick, BetOption, ScoringEvent } from './types'

export function isClashPick(
  pick: DraftPick,
  allPicks: DraftPick[],
  betOptions: BetOption[],
  events: ScoringEvent[],
): boolean {
  const event = events.find(e => e.id === pick.eventId)
  if (!event || event.category === 'required') return false

  const eventOptions = betOptions.filter(bo => bo.eventId === pick.eventId)
  if (eventOptions.length !== 2) return false

  const opposingOption = eventOptions.find(bo => bo.id !== pick.betOptionId)
  if (!opposingOption) return false

  return allPicks.some(
    p =>
      p.betOptionId === opposingOption.id &&
      p.userId !== pick.userId &&
      new Date(p.createdAt) < new Date(pick.createdAt),
  )
}
