'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data: p } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  if (!p?.is_admin) throw new Error('Not authorized')
  return supabase
}

export async function upsertEvent(formData: FormData) {
  try {
    const supabase = await requireAdmin()
    const id = formData.get('id') as string | null

    const payload = {
      betstravaganza_id: formData.get('betstravaganzaId') as string,
      name:              formData.get('name') as string,
      sport:             formData.get('sport') as string,
      category:          formData.get('category') as string,
      bet_type:          formData.get('betType') as string,
      start_time_et:     (formData.get('startTimeEt') as string) || null,
      streaming_info:    (formData.get('streamingInfo') as string) || null,
      notes:             (formData.get('notes') as string) || null,
    }

    const { data, error } = id
      ? await supabase.from('events').update(payload).eq('id', id).select().single()
      : await supabase.from('events').insert(payload).select().single()

    if (error) return { error: error.message }
    revalidatePath('/admin', 'layout')
    return { data }
  } catch (e: any) {
    return { error: e.message }
  }
}

export async function deleteEvent(eventId: string) {
  try {
    const supabase = await requireAdmin()
    const { error } = await supabase.from('events').delete().eq('id', eventId)
    if (error) return { error: error.message }
    revalidatePath('/admin', 'layout')
    return { ok: true }
  } catch (e: any) {
    return { error: e.message }
  }
}

export async function upsertBetOption(formData: FormData) {
  try {
    const supabase = await requireAdmin()
    const id = formData.get('id') as string | null

    const payload = {
      event_id:    formData.get('eventId') as string,
      label:       formData.get('label') as string,
      odds:        formData.get('odds') ? Number(formData.get('odds')) : null,
      odds_source: (formData.get('oddsSource') as string) || 'manual',
      max_drafts:  Number(formData.get('maxDrafts') ?? 1),
    }

    const { data, error } = id
      ? await supabase.from('bet_options').update(payload).eq('id', id).select().single()
      : await supabase.from('bet_options').insert(payload).select().single()

    if (error) return { error: error.message }
    revalidatePath('/admin', 'layout')
    return { data }
  } catch (e: any) {
    return { error: e.message }
  }
}

export async function deleteBetOption(optionId: string) {
  try {
    const supabase = await requireAdmin()
    const { error } = await supabase.from('bet_options').delete().eq('id', optionId)
    if (error) return { error: error.message }
    revalidatePath('/admin', 'layout')
    return { ok: true }
  } catch (e: any) {
    return { error: e.message }
  }
}

export async function updateBetOptionOdds(betOptionId: string, newOdds: number, bzId: string) {
  try {
    const supabase = await requireAdmin()
    const { error } = await supabase
      .from('bet_options')
      .update({ odds: newOdds, odds_source: 'auto_confirmed' })
      .eq('id', betOptionId)
    if (error) return { error: error.message }
    revalidatePath(`/admin/${bzId}/events`)
    return { ok: true }
  } catch (e: any) {
    return { error: e.message }
  }
}

export async function upsertSlateGame(formData: FormData) {
  try {
    const supabase = await requireAdmin()
    const id = formData.get('id') as string | null

    const payload = {
      betstravaganza_id: formData.get('betstravaganzaId') as string,
      sport_label:  formData.get('sportLabel') as string,
      home_team:    formData.get('homeTeam') as string,
      away_team:    formData.get('awayTeam') as string,
      start_time_et: formData.get('startTimeEt') as string,
      spread:       formData.get('spread') ? Number(formData.get('spread')) : null,
      notes:        (formData.get('notes') as string) || null,
    }

    const { data, error } = id
      ? await supabase.from('slate_games').update(payload).eq('id', id).select().single()
      : await supabase.from('slate_games').insert(payload).select().single()

    if (error) return { error: error.message }
    revalidatePath('/admin', 'layout')
    return { data }
  } catch (e: any) {
    return { error: e.message }
  }
}
