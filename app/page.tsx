import { redirect } from 'next/navigation'
import { getActive } from '@/lib/db/betstravaganza'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const [bz, supabase] = await Promise.all([getActive(), createClient()])
  const { data: { user } } = await supabase.auth.getUser()

  if (bz && !(bz as any).revealed && user) {
    const { data: profile } = await supabase
      .from('users').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) redirect('/slate')
  }

  redirect('/leaderboard')
}
