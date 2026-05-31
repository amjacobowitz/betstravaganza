'use server'

import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { phoneToEmail } from '@/lib/utils/phone'

export async function signUp(formData: FormData) {
  const phone = (formData.get('phone') as string).trim()
  const password = formData.get('password') as string
  const name = formData.get('name') as string
  const teamName = formData.get('teamName') as string

  const email = phoneToEmail(phone)
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error || !data.user) {
    return { error: error?.message ?? 'Signup failed' }
  }

  const isAdmin =
    email.toLowerCase() ===
    process.env.NEXT_PUBLIC_INITIAL_ADMIN_EMAIL?.toLowerCase()

  const adminClient = await createAdminClient()
  const { error: profileError } = await adminClient.from('users').insert({
    id: data.user.id,
    email,
    name,
    team_name: teamName,
    phone,
    is_admin: isAdmin,
  })

  if (profileError) {
    return { error: profileError.message }
  }

  if (!data.session) {
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) return { error: signInError.message }
  }

  redirect('/leaderboard')
}

export async function login(formData: FormData) {
  const phone = (formData.get('phone') as string).trim()
  const password = formData.get('password') as string

  const email = phoneToEmail(phone)
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    return { error: error.message }
  }

  redirect('/leaderboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
