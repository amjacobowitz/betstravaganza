import Link from 'next/link'
import { getAll } from '@/lib/db/betstravaganza'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

const statusVariant: Record<string, string> = {
  setup:    'default',
  draft:    'required',
  active:   'win',
  complete: 'default',
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default async function AdminIndexPage() {
  const all = await getAll()

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Betstravaganzas</h1>
        <Link
          href="/admin/new"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
        >
          + New
        </Link>
      </div>

      {all.length === 0 && (
        <Card>
          <div className="py-8 text-center space-y-3">
            <p className="text-muted text-sm">No betstravaganzas yet.</p>
            <Link
              href="/admin/new"
              className="inline-block rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
            >
              Create your first one
            </Link>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {all.map(bz => (
          <Link key={bz.id} href={`/admin/${bz.id}`} className="block group">
            <Card className="hover:border-accent/40 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white group-hover:text-accent transition-colors">
                      {bz.name}
                    </span>
                    <Badge variant={statusVariant[bz.status] as any}>
                      {bz.status.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted space-x-3">
                    <span>{(bz.draft_order as string[] | null)?.length ?? bz.player_count} players · {bz.round_count} rounds</span>
                    <span>${Number(bz.stake_amount)}/pick</span>
                    {(bz as any).start_datetime && (
                      <span>Starts {formatDate((bz as any).start_datetime)}</span>
                    )}
                  </div>
                </div>
                <span className="text-muted text-sm group-hover:text-accent transition-colors">
                  Manage →
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
