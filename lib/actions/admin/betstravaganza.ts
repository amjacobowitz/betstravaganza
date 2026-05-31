'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createBetstravaganza(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return { error: 'Not authorized' }

  const startRaw = formData.get('startDatetime') as string | null
  const endRaw   = formData.get('endDatetime')   as string | null

  const { data, error } = await supabase.from('betstravaganza').insert({
    name:                  formData.get('name') as string,
    player_count:          Number(formData.get('playerCount')),
    round_count:           Number(formData.get('roundCount')),
    stake_amount:          Number(formData.get('stakeAmount') ?? 100),
    starting_bankroll:     Number(formData.get('startingBankroll') ?? 1100),
    confidence_multiplier: Number(formData.get('confidenceMultiplier') ?? 3),
    start_datetime:        startRaw || null,
    end_datetime:          endRaw   || null,
  }).select().single()

  if (error) return { error: error.message }
  revalidatePath('/admin')
  return { data }
}

export async function updateDraftOrder(betstravaganzaId: string, userIds: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return { error: 'Not authorized' }

  const { error } = await supabase
    .from('betstravaganza')
    .update({ draft_order: userIds, status: 'draft' })
    .eq('id', betstravaganzaId)

  if (error) return { error: error.message }
  revalidatePath('/admin', 'layout')
  return { ok: true }
}

export async function updateBetstravaganzaDates(betstravaganzaId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { data: profile } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return { error: 'Not authorized' }

  const startRaw = formData.get('startDatetime') as string | null
  const endRaw   = formData.get('endDatetime')   as string | null

  const { error } = await supabase
    .from('betstravaganza')
    .update({
      start_datetime: startRaw || null,
      end_datetime:   endRaw   || null,
    })
    .eq('id', betstravaganzaId)

  if (error) return { error: error.message }
  revalidatePath('/admin', 'layout')
  revalidatePath('/my-picks')
  return { ok: true }
}

export async function updateStatus(betstravaganzaId: string, status: 'setup' | 'draft' | 'active' | 'complete') {
  const supabase = await createClient()
  const { error } = await supabase
    .from('betstravaganza')
    .update({ status })
    .eq('id', betstravaganzaId)
  if (error) return { error: error.message }
  revalidatePath('/admin')
  return { ok: true }
}
