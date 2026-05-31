'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const nickname = ((formData.get('nickname') as string) ?? '').trim()

  const { error } = await supabase
    .from('users')
    .update({ nickname })
    .eq('id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/profile')
  return { ok: true }
}
