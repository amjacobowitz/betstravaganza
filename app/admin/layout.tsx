import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

const adminLinks = [
  { href: '/admin/setup',   label: '⚙️ Setup'    },
  { href: '/admin/events',  label: '📋 Events'   },
  { href: '/admin/draft',   label: '🎯 Draft'    },
  { href: '/admin/results', label: '🏁 Results'  },
  { href: '/admin/slate',   label: '⚾ Slate'    },
  { href: '/admin/print',   label: '🖨️ Print'    },
  { href: '/admin/users',   label: '👤 Users'    },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) redirect('/leaderboard')

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Admin top bar */}
      <header className="sticky top-0 z-50 border-b border-border bg-surface/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-2">
          <Link href="/leaderboard" className="text-lg font-black tracking-tight text-white">
            S<span className="text-accent">.</span>P<span className="text-accent">.</span>O<span className="text-accent">.</span>R<span className="text-accent">.</span>T<span className="text-accent">.</span>S<span className="text-accent">.</span>
          </Link>
          <span className="text-accent-2 text-xs font-bold uppercase tracking-wider">Admin</span>
        </div>
        <nav className="overflow-x-auto">
          <div className="flex min-w-max gap-0.5 px-4 pb-2">
            {adminLinks.map(l => (
              <Link
                key={l.href}
                href={l.href}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted hover:text-white hover:bg-surface-2 transition-colors whitespace-nowrap"
              >
                {l.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-6">
          {children}
        </div>
      </main>
    </div>
  )
}
