'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data: p } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  if (!p?.is_admin) throw new Error('Not authorized')
  return { supabase, userId: user.id }
}

export async function upsertResult(formData: FormData) {
  try {
    const { supabase, userId } = await requireAdmin()
    const eventId            = formData.get('eventId') as string
    const bzId               = formData.get('bzId') as string
    const winnerBetOptionId  = (formData.get('winnerBetOptionId') as string) || null
    const homeScore          = formData.get('homeScore') ? Number(formData.get('homeScore')) : null
    const awayScore          = formData.get('awayScore') ? Number(formData.get('awayScore')) : null

    // Generate result_display from winner label (no manual entry needed)
    let resultDisplay = 'Push'
    if (winnerBetOptionId) {
      const { data: opt } = await supabase
        .from('bet_options').select('label').eq('id', winnerBetOptionId).single()
      if (opt?.label) resultDisplay = opt.label
    }

    const payload = {
      event_id:             eventId,
      winner_bet_option_id: winnerBetOptionId,
      home_score:           homeScore,
      away_score:           awayScore,
      result_display:       resultDisplay,
      entered_by:           userId,
    }

    const { error } = await supabase
      .from('results')
      .upsert(payload, { onConflict: 'event_id' })

    if (error) return { error: error.message }
    revalidatePath(`/admin/${bzId}/results`)
    revalidatePath('/leaderboard')
    return { ok: true }
  } catch (e: any) {
    return { error: e.message }
  }
}

export async function upsertSlateResult(formData: FormData) {
  try {
    const { supabase, userId } = await requireAdmin()
    const slateGameId = formData.get('slateGameId') as string
    const bzId        = formData.get('bzId') as string
    const homeScore   = Number(formData.get('homeScore'))
    const awayScore   = Number(formData.get('awayScore'))

    // Generate result_display from team names and scores (no manual entry needed)
    const { data: game } = await supabase
      .from('slate_games').select('away_team, home_team').eq('id', slateGameId).single()
    const resultDisplay = game
      ? `${game.away_team} ${awayScore}, ${game.home_team} ${homeScore}`
      : `${awayScore}-${homeScore}`

    const payload = {
      slate_game_id:  slateGameId,
      home_score:     homeScore,
      away_score:     awayScore,
      result_display: resultDisplay,
      entered_by:     userId,
    }

    const { error } = await supabase
      .from('slate_results')
      .upsert(payload, { onConflict: 'slate_game_id' })

    if (error) return { error: error.message }
    revalidatePath(`/admin/${bzId}/results`)
    revalidatePath('/leaderboard')
    return { ok: true }
  } catch (e: any) {
    return { error: e.message }
  }
}
