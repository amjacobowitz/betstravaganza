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

export async function createBonus(formData: FormData) {
  try {
    const supabase = await requireAdmin()
    const { error } = await supabase.from('bonuses').insert({
      betstravaganza_id: formData.get('betstravaganzaId') as string,
      user_id:           formData.get('userId') as string,
      title:             formData.get('title') as string,
      amount:            Number(formData.get('amount')),
    })
    if (error) return { error: error.message }
    revalidatePath('/admin', 'layout')
    revalidatePath('/leaderboard')
    revalidatePath('/picks')
    return { ok: true }
  } catch (e: any) {
    return { error: e.message }
  }
}

export async function deleteBonus(bonusId: string) {
  try {
    const supabase = await requireAdmin()
    const { error } = await supabase.from('bonuses').delete().eq('id', bonusId)
    if (error) return { error: error.message }
    revalidatePath('/admin', 'layout')
    revalidatePath('/leaderboard')
    revalidatePath('/picks')
    return { ok: true }
  } catch (e: any) {
    return { error: e.message }
  }
}
