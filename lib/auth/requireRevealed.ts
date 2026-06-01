import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActive } from '@/lib/db/betstravaganza'

export async function requireRevealed() {
  const [bz, supabase] = await Promise.all([getActive(), createClient()])
  if (!bz) return

  if (!(bz as any).revealed) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) redirect('/slate')
  }
}
