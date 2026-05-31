import { notFound } from 'next/navigation'
import { getById } from '@/lib/db/betstravaganza'
import { getDraftState } from '@/lib/db/draft'
import { getEventsWithOptions } from '@/lib/db/events'
import { createClient } from '@/lib/supabase/server'
import { DraftBoard } from '@/components/admin/DraftBoard'
import { validateDraftTurn, isClashPick } from '@/lib/scoring'
import type { DraftPick, BetOption, ScoringEvent } from '@/lib/scoring/types'

export default async function DraftPage({
  params,
}: {
  params: Promise<{ bzId: string }>
}) {
  const { bzId } = await params
  const bz = await getById(bzId)
  if (!bz) notFound()

  const [{ picks: rawPicks, users }, events, supabase] = await Promise.all([
    getDraftState(bz.id),
    getEventsWithOptions(bz.id),
    createClient(),
  ])

  const { data: allUsers } = await supabase
    .from('users')
    .select('id, name, team_name')
    .order('name')

  const betOptions: BetOption[] = events.flatMap(e =>
    ((e as any).bet_options ?? []).map((o: any) => ({
      id: o.id,
      eventId: e.id,
      label: o.label,
      odds: o.odds ? Number(o.odds) : null,
      maxDrafts: o.max_drafts,
      draftCount: rawPicks.filter((p: any) => p.bet_option_id === o.id).length,
    }))
  )

  const scoringEvents: ScoringEvent[] = events.map(e => ({
    id: e.id,
    name: e.name,
    category: e.category as 'required' | 'optional',
    betType: (e as any).bet_type as 'odds' | 'spread' | 'no_odds',
  }))

  const allPicks: DraftPick[] = rawPicks.map((p: any) => ({
    id: p.id,
    userId: p.user_id,
    betOptionId: p.bet_option_id,
    eventId: betOptions.find(o => o.id === p.bet_option_id)?.eventId ?? '',
    roundNumber: p.round_number,
    createdAt: new Date(p.created_at),
  }))

  const requiredEventIds = scoringEvents.filter(e => e.category === 'required').map(e => e.id)

  const draftOrder: string[] = bz.draft_order ?? []
  const totalPicks = (bz.player_count ?? 11) * (bz.round_count ?? 11)
  const currentPickIndex = bz.current_pick_index ?? 0
  const currentUserId = computeCurrentPicker(draftOrder, currentPickIndex, bz.round_count ?? 11)

  const playerStatuses = (allUsers ?? []).map(u => {
    const playerPicks = allPicks.filter(p => p.userId === u.id)
    const validation = validateDraftTurn({
      userId: u.id,
      proposedBetOptionId: '__check__',
      playerPicks,
      allPicks,
      betOptions,
      events: scoringEvents,
      requiredEventIds,
      totalRounds: bz.round_count ?? 11,
    })
    const requiredSatisfied = requiredEventIds.filter(rid =>
      playerPicks.some(p => betOptions.find(o => o.id === p.betOptionId)?.eventId === rid)
    )
    const clashCount = playerPicks.filter(p =>
      isClashPick(p, allPicks, betOptions, scoringEvents)
    ).length

    return {
      userId: u.id,
      name: u.name,
      teamName: u.team_name,
      totalPicks: playerPicks.length,
      requiredSatisfied: requiredSatisfied.length,
      requiredTotal: requiredEventIds.length,
      clashCount,
      clashRequired: 2,
      requiredRemaining: validation.requiredRemaining,
      roundsRemaining: (bz.round_count ?? 11) - playerPicks.length,
    }
  })

  return (
    <DraftBoard
      betstravaganza={bz}
      events={events as any}
      betOptions={betOptions}
      scoringEvents={scoringEvents}
      allPicks={allPicks}
      playerStatuses={playerStatuses}
      currentUserId={currentUserId}
      currentPickIndex={currentPickIndex}
      totalPicks={totalPicks}
      draftOrder={draftOrder}
      allUsers={allUsers ?? []}
    />
  )
}

function computeCurrentPicker(draftOrder: string[], pickIndex: number, roundCount: number): string | null {
  if (!draftOrder.length) return null
  const n = draftOrder.length
  const round = Math.floor(pickIndex / n)
  const posInRound = pickIndex % n
  return round % 2 === 0 ? (draftOrder[posInRound] ?? null) : (draftOrder[n - 1 - posInRound] ?? null)
}
