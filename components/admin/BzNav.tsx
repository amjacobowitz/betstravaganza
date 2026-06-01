'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'

const statusVariant: Record<string, string> = {
  setup:    'default',
  draft:    'required',
  active:   'win',
  complete: 'default',
}

const tabs = [
  { segment: '',        label: 'Overview' },
  { segment: 'events',  label: 'Events'   },
  { segment: 'draft',   label: 'Draft'    },
  { segment: 'results', label: 'Results'  },
  { segment: 'slate',   label: 'Slate'    },
  { segment: 'bonuses', label: 'Bonuses'  },
  { segment: 'print',   label: 'Print'    },
]

export function BzNav({ bzId, bzName, bzStatus }: {
  bzId: string
  bzName: string
  bzStatus: string
}) {
  const path = usePathname()

  function href(segment: string) {
    return segment ? `/admin/${bzId}/${segment}` : `/admin/${bzId}`
  }

  function isActive(segment: string) {
    const target = href(segment)
    if (segment === '') return path === target
    return path.startsWith(target)
  }

  return (
    <div className="border-b border-border pb-0 -mx-4 px-4">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/admin" className="text-xs text-muted hover:text-white transition-colors">
          ← All
        </Link>
        <span className="text-white font-semibold">{bzName}</span>
        <Badge variant={statusVariant[bzStatus] as any}>{bzStatus.toUpperCase()}</Badge>
      </div>
      <nav className="flex gap-0.5 overflow-x-auto">
        {tabs.map(tab => (
          <Link
            key={tab.segment}
            href={href(tab.segment)}
            className={`rounded-t-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              isActive(tab.segment)
                ? 'bg-accent/10 text-accent border-b-2 border-accent'
                : 'text-muted hover:text-white'
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
