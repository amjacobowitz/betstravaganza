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

export async function setUserAdmin(userId: string, isAdmin: boolean) {
  try {
    const supabase = await requireAdmin()
    const { error } = await supabase
      .from('users')
      .update({ is_admin: isAdmin })
      .eq('id', userId)
    if (error) return { error: error.message }
    revalidatePath('/admin/users')
    return { ok: true }
  } catch (e: any) {
    return { error: e.message }
  }
}
