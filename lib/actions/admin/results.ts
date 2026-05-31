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
    const eventId = formData.get('eventId') as string

    const payload = {
      event_id:             eventId,
      winner_bet_option_id: (formData.get('winnerBetOptionId') as string) || null,
      home_score:           formData.get('homeScore') ? Number(formData.get('homeScore')) : null,
      away_score:           formData.get('awayScore') ? Number(formData.get('awayScore')) : null,
      result_display:       formData.get('resultDisplay') as string,
      entered_by:           userId,
    }

    const { error } = await supabase
      .from('results')
      .upsert(payload, { onConflict: 'event_id' })

    if (error) return { error: error.message }
    revalidatePath('/admin', 'layout')
    revalidatePath('/leaderboard')
    return { ok: true }
  } catch (e: any) {
    return { error: e.message }
  }
}

export async function upsertSlateResult(formData: FormData) {
  try {
    const { supabase, userId } = await requireAdmin()

    const payload = {
      slate_game_id:  formData.get('slateGameId') as string,
      home_score:     Number(formData.get('homeScore')),
      away_score:     Number(formData.get('awayScore')),
      result_display: formData.get('resultDisplay') as string,
      entered_by:     userId,
    }

    const { error } = await supabase
      .from('slate_results')
      .upsert(payload, { onConflict: 'slate_game_id' })

    if (error) return { error: error.message }
    revalidatePath('/admin', 'layout')
    revalidatePath('/leaderboard')
    return { ok: true }
  } catch (e: any) {
    return { error: e.message }
  }
}
