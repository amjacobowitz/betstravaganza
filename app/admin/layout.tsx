import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) redirect('/leaderboard')

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-50 border-b border-border bg-surface/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/leaderboard" className="text-lg font-black tracking-tight text-white">
              S<span className="text-accent">.</span>P<span className="text-accent">.</span>O<span className="text-accent">.</span>R<span className="text-accent">.</span>T<span className="text-accent">.</span>S<span className="text-accent">.</span>
            </Link>
            <span className="rounded-md bg-accent-2/10 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-accent-2">
              Admin
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin/users"
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted hover:text-white hover:bg-surface-2 transition-colors"
            >
              Users
            </Link>
            <Link
              href="/leaderboard"
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted hover:text-white hover:bg-surface-2 transition-colors"
            >
              ← App
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6">
          {children}
        </div>
      </main>
    </div>
  )
}
