'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const name     = (formData.get('name')     as string).trim()
  const teamName = (formData.get('teamName') as string).trim()

  if (!name)     return { error: 'Name is required' }
  if (!teamName) return { error: 'Team name is required' }

  const { error } = await supabase
    .from('users')
    .update({ name, team_name: teamName })
    .eq('id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/profile')
  revalidatePath('/leaderboard')
  return { ok: true }
}
