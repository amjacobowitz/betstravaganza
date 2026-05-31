'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { validateDraftTurn } from '@/lib/scoring'
import type { DraftPick, BetOption, ScoringEvent } from '@/lib/scoring/types'

export async function recordPick(input: {
  betstravaganzaId: string
  userId: string
  betOptionId: string
  roundNumber: number
  pickIndex: number
}) {
  const supabase = await createClient()

  // Auth guard
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { data: profile } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return { error: 'Not authorized' }

  // Fetch everything needed for validation
  const [
    { data: allPicksRaw },
    { data: optionsRaw },
    { data: eventsRaw },
    { data: bz },
  ] = await Promise.all([
    supabase.from('draft_picks').select('*').eq('betstravaganza_id', input.betstravaganzaId),
    supabase.from('bet_options').select('*'),
    supabase.from('events').select('*').eq('betstravaganza_id', input.betstravaganzaId),
    supabase.from('betstravaganza').select('round_count').eq('id', input.betstravaganzaId).single(),
  ])

  const allPicks: DraftPick[] = (allPicksRaw ?? []).map(p => ({
    id: p.id,
    userId: p.user_id,
    betOptionId: p.bet_option_id,
    eventId: (optionsRaw ?? []).find(o => o.id === p.bet_option_id)?.event_id ?? '',
    roundNumber: p.round_number,
    createdAt: new Date(p.created_at),
  }))

  const betOptions: BetOption[] = (optionsRaw ?? []).map(o => ({
    id: o.id,
    eventId: o.event_id,
    label: o.label,
    odds: o.odds ? Number(o.odds) : null,
    maxDrafts: o.max_drafts,
    draftCount: allPicks.filter(p => p.betOptionId === o.id).length,
  }))

  const events: ScoringEvent[] = (eventsRaw ?? []).map(e => ({
    id: e.id,
    name: e.name,
    category: e.category as 'required' | 'optional',
    betType: e.bet_type as 'odds' | 'spread' | 'no_odds',
  }))

  const requiredEventIds = events.filter(e => e.category === 'required').map(e => e.id)
  const playerPicks = allPicks.filter(p => p.userId === input.userId)

  const proposed: DraftPick = {
    id: 'proposed',
    userId: input.userId,
    betOptionId: input.betOptionId,
    eventId: betOptions.find(o => o.id === input.betOptionId)?.eventId ?? '',
    roundNumber: input.roundNumber,
    createdAt: new Date(),
  }

  const validation = validateDraftTurn({
    userId: input.userId,
    proposedBetOptionId: input.betOptionId,
    playerPicks,
    allPicks,
    betOptions,
    events,
    requiredEventIds,
    totalRounds: bz?.round_count ?? 11,
  })

  if (!validation.valid) return { error: validation.reason }

  const { error } = await supabase.from('draft_picks').insert({
    betstravaganza_id: input.betstravaganzaId,
    user_id:    input.userId,
    bet_option_id: input.betOptionId,
    round_number:  input.roundNumber,
    pick_index:    input.pickIndex,
  })

  if (error) return { error: error.message }

  // Advance draft position
  await supabase
    .from('betstravaganza')
    .update({ current_pick_index: input.pickIndex + 1 })
    .eq('id', input.betstravaganzaId)

  revalidatePath('/admin/draft')
  revalidatePath('/leaderboard')
  return { ok: true }
}

export async function undoLastPick(betstravaganzaId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }
  const { data: profile } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return { error: 'Not authorized' }

  const { data: lastPick } = await supabase
    .from('draft_picks')
    .select('id, pick_index')
    .eq('betstravaganza_id', betstravaganzaId)
    .order('pick_index', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!lastPick) return { error: 'No picks to undo' }

  await supabase.from('draft_picks').delete().eq('id', lastPick.id)
  await supabase.from('betstravaganza').update({ current_pick_index: lastPick.pick_index }).eq('id', betstravaganzaId)

  revalidatePath('/admin/draft')
  return { ok: true }
}
