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

/** Returns true if picking `proposedOptionId` would create a clash for `userId` right now. */
export function wouldCreateClash(
  userId: string,
  proposedOptionId: string,
  allPicks: DraftPick[],
  betOptions: BetOption[],
  events: ScoringEvent[],
): boolean {
  const option = betOptions.find(bo => bo.id === proposedOptionId)
  if (!option) return false
  const event = events.find(e => e.id === option.eventId)
  if (!event || event.category !== 'optional') return false
  const eventOptions = betOptions.filter(bo => bo.eventId === option.eventId)
  if (eventOptions.length !== 2) return false
  const opposing = eventOptions.find(bo => bo.id !== proposedOptionId)
  if (!opposing) return false
  return allPicks.some(p => p.betOptionId === opposing.id && p.userId !== userId)
}

/**
 * Count how many optional events currently offer at least one clash opportunity
 * for the given player (an opposing pick from a different user already exists,
 * and the player hasn't picked from this event yet).
 */
export function countAvailableClashOpportunities(
  userId: string,
  playerPicks: DraftPick[],
  allPicks: DraftPick[],
  betOptions: BetOption[],
  events: ScoringEvent[],
): number {
  const alreadyPickedEventIds = new Set(playerPicks.map(p => p.eventId))
  let count = 0

  for (const event of events) {
    if (event.category !== 'optional') continue
    if (alreadyPickedEventIds.has(event.id)) continue
    const eventOptions = betOptions.filter(bo => bo.eventId === event.id)
    if (eventOptions.length !== 2) continue
    const hasOpposingPick = eventOptions.some(option => {
      const opposing = eventOptions.find(bo => bo.id !== option.id)
      return opposing && allPicks.some(p => p.betOptionId === opposing.id && p.userId !== userId)
    })
    if (hasOpposingPick) count++
  }

  return count
}
