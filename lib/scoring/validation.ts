import { isClashPick } from './clash'
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

  // Check if proposed pick is optional when we must take required
  const proposedEvent = proposedOption ? events.find(e => e.id === proposedOption.eventId) : null
  const isProposingOptional = proposedEvent?.category === 'optional'

  if (isProposingOptional && requiredRemaining.length >= roundsRemaining) {
    return {
      valid: false,
      reason: `You still need ${requiredRemaining.length} required pick${requiredRemaining.length !== 1 ? 's' : ''} and only have ${roundsRemaining} round${roundsRemaining !== 1 ? 's' : ''} left. You must draft a required event.`,
      requiredRemaining,
      clashPicksNeeded,
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
