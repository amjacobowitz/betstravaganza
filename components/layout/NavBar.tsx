'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logout } from '@/lib/actions/auth'

interface NavBarProps {
  isAdmin: boolean
  userName: string
  revealed?: boolean
}

const mainLinks = [
  { href: '/leaderboard', label: '🏆 Leaderboard' },
  { href: '/picks',       label: '🎯 Picks'        },
  { href: '/draft',       label: '📋 Draft'        },
  { href: '/slate',       label: '🏟 Slate'         },
  { href: '/schedule',    label: '📅 Schedule'     },
]

export function NavBar({ isAdmin, userName, revealed = true }: NavBarProps) {
  const path = usePathname()
  const visibleLinks = revealed ? mainLinks : mainLinks.filter(l => l.href === '/slate')

  return (
    <>
      {/* Desktop top bar */}
      <header className="sticky top-0 z-50 hidden border-b border-border bg-surface/90 backdrop-blur-sm sm:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link href="/leaderboard" className="flex items-center gap-2">
            <span className="text-xl font-black tracking-tight text-white">
              S<span className="text-accent">.</span>P<span className="text-accent">.</span>O<span className="text-accent">.</span>R<span className="text-accent">.</span>T<span className="text-accent">.</span>S<span className="text-accent">.</span>
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            {visibleLinks.map(l => (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors
                  ${path.startsWith(l.href) ? 'bg-accent/10 text-accent' : 'text-muted hover:text-white'}`}
              >
                {l.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors
                  ${path.startsWith('/admin') ? 'bg-accent-2/10 text-accent-2' : 'text-muted hover:text-white'}`}
              >
                ⚙️ Admin
              </Link>
            )}
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/profile" className="text-sm text-muted hover:text-white transition-colors">{userName}</Link>
            <form action={logout}>
              <button type="submit" className="text-sm text-muted hover:text-white transition-colors">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border bg-surface/90 px-4 py-3 backdrop-blur-sm sm:hidden">
        <Link href="/leaderboard" className="text-lg font-black tracking-tight text-white">
          S<span className="text-accent">.</span>P<span className="text-accent">.</span>O<span className="text-accent">.</span>R<span className="text-accent">.</span>T<span className="text-accent">.</span>S<span className="text-accent">.</span>
        </Link>
        <Link href="/profile" className="text-sm text-muted hover:text-white transition-colors">{userName}</Link>
      </header>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-border bg-surface sm:hidden">
        {visibleLinks.map(l => (
          <Link
            key={l.href}
            href={l.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors
              ${path.startsWith(l.href) ? 'text-accent' : 'text-muted'}`}
          >
            <span className="text-lg leading-none">{l.label.split(' ')[0]}</span>
            <span>{l.label.split(' ').slice(1).join(' ')}</span>
          </Link>
        ))}
        {isAdmin && (
          <Link
            href="/admin"
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors
              ${path.startsWith('/admin') ? 'text-accent-2' : 'text-muted'}`}
          >
            <span className="text-lg leading-none">⚙️</span>
            <span>Admin</span>
          </Link>
        )}
      </nav>
    </>
  )
}
