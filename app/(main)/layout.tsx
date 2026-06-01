import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getActive } from '@/lib/db/betstravaganza'
import { NavBar } from '@/components/layout/NavBar'

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, bz] = await Promise.all([
    supabase.from('users').select('name, is_admin').eq('id', user.id).single(),
    getActive(),
  ])

  const isAdmin = !!profile?.is_admin
  const revealed = !!(bz as any)?.revealed

  return (
    <div className="flex min-h-dvh flex-col">
      <NavBar isAdmin={isAdmin} userName={profile?.name ?? ''} revealed={revealed} />
      <main className="flex-1 pb-20 sm:pb-6">
        <div className="mx-auto max-w-7xl px-4 py-6">
          {children}
        </div>
      </main>
    </div>
  )
}
