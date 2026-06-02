import { isClashPick, wouldCreateClash, countAvailableClashOpportunities } from './clash'
import type { ValidateDraftTurnInput, ValidationResult } from './types'

export function validateDraftTurn({
  userId,
  proposedBetOptionId,
  playerPicks,
  allPicks,
  betOptions,
  events,
  requiredEventIds,
  totalRounds,
  teamName,
}: ValidateDraftTurnInput): ValidationResult {
  const roundsRemaining = totalRounds - playerPicks.length
  const proposedOption = betOptions.find(bo => bo.id === proposedBetOptionId)

  // Duplicate / capacity check
  if (proposedOption) {
    const draftCount = allPicks.filter(p => p.betOptionId === proposedBetOptionId).length
    if (draftCount >= proposedOption.maxDrafts) {
      return {
        valid: false,
        reason:
          proposedOption.maxDrafts > 1
            ? `Pick is full (max ${proposedOption.maxDrafts} players allowed).`
            : 'Pick already drafted by another player.',
        requiredRemaining: computeRequiredRemaining(playerPicks, requiredEventIds, events),
        clashPicksNeeded: computeClashPicksNeeded(userId, playerPicks, allPicks, betOptions, events),
      }
    }
  }

  const requiredRemaining = computeRequiredRemaining(playerPicks, requiredEventIds, events)
  const clashPicksNeeded = computeClashPicksNeeded(userId, playerPicks, allPicks, betOptions, events)

  const who = teamName ?? 'This player'

  // Prevent picking a second option from an event the player already has a pick for
  if (proposedOption) {
    const alreadyPickedFromEvent = playerPicks.some(p => p.eventId === proposedOption.eventId)
    if (alreadyPickedFromEvent) {
      return {
        valid: false,
        reason: `${who} already has a pick from this event.`,
        requiredRemaining,
        clashPicksNeeded,
      }
    }
  }

  // No rounds remaining
  if (roundsRemaining <= 0) {
    return {
      valid: false,
      reason: `${who} has no draft rounds remaining.`,
      requiredRemaining,
      clashPicksNeeded,
    }
  }

  // Combined mandatory check: required + achievable clash picks must all fit in remaining rounds.
  // If a pick satisfies neither requirement, block it.
  const proposedEvent = proposedOption ? events.find(e => e.id === proposedOption.eventId) : null

  if (proposedOption && roundsRemaining > 0) {
    const availableClashOps = countAvailableClashOpportunities(userId, playerPicks, allPicks, betOptions, events)
    const effectiveClashNeeded = Math.min(clashPicksNeeded, availableClashOps)
    const mandatoryNeeded = requiredRemaining.length + effectiveClashNeeded

    if (mandatoryNeeded >= roundsRemaining) {
      const isRequiredPick = proposedEvent?.category === 'required'
      const isClashCreating = wouldCreateClash(userId, proposedBetOptionId, allPicks, betOptions, events)

      if (!isRequiredPick && !isClashCreating) {
        const parts: string[] = []
        if (requiredRemaining.length > 0)
          parts.push(`${requiredRemaining.length} required pick${requiredRemaining.length !== 1 ? 's' : ''}`)
        if (effectiveClashNeeded > 0)
          parts.push(`${effectiveClashNeeded} clash pick${effectiveClashNeeded !== 1 ? 's' : ''}`)
        const r = roundsRemaining
        return {
          valid: false,
          reason: `${who} must use remaining ${r} round${r !== 1 ? 's' : ''} for ${parts.join(' and ')}.`,
          requiredRemaining,
          clashPicksNeeded,
        }
      }
    }
  }

  return { valid: true, requiredRemaining, clashPicksNeeded }
}

function computeRequiredRemaining(
  playerPicks: { eventId: string }[],
  requiredEventIds: string[],
  events: { id: string; category: string }[],
): string[] {
  const satisfiedIds = new Set(
    playerPicks
      .filter(p => events.find(e => e.id === p.eventId)?.category === 'required')
      .map(p => p.eventId),
  )
  return requiredEventIds.filter(id => !satisfiedIds.has(id))
}

function computeClashPicksNeeded(
  userId: string,
  playerPicks: import('./types').DraftPick[],
  allPicks: import('./types').DraftPick[],
  betOptions: import('./types').BetOption[],
  events: import('./types').ScoringEvent[],
): number {
  const clashCount = playerPicks.filter(
    p => p.userId === userId && isClashPick(p, allPicks, betOptions, events),
  ).length
  return Math.max(0, 2 - clashCount)
}
