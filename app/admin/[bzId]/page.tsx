import { getById } from '@/lib/db/betstravaganza'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { BzDatetimeEditor } from '@/components/admin/BzDatetimeEditor'
import { DraftOrderManager } from '@/components/admin/DraftOrderManager'

const statusVariant: Record<string, string> = {
  setup: 'default', draft: 'required', active: 'win', complete: 'default',
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

export default async function BzOverviewPage({
  params,
}: {
  params: Promise<{ bzId: string }>
}) {
  const { bzId } = await params
  const [bz, supabase] = await Promise.all([getById(bzId), createClient()])
  if (!bz) notFound()

  const { data: allUsers } = await supabase
    .from('users')
    .select('id, name, team_name')
    .order('name')

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Config summary */}
      <Card>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
          <div className="text-muted">Status</div>
          <div><Badge variant={statusVariant[bz.status] as any}>{bz.status.toUpperCase()}</Badge></div>
          <div className="text-muted">Players</div>
          <div className="text-white">{bz.player_count}</div>
          <div className="text-muted">Rounds</div>
          <div className="text-white">{bz.round_count}</div>
          <div className="text-muted">Stake</div>
          <div className="text-white">${Number(bz.stake_amount)}/pick</div>
          <div className="text-muted">Starting Bankroll</div>
          <div className="text-white">${Number(bz.starting_bankroll).toLocaleString()}</div>
          <div className="text-muted">Slate $/Rank</div>
          <div className="text-white">${Number(bz.confidence_multiplier)}/rank</div>
          <div className="text-muted">Current Pick</div>
          <div className="text-white">
            {bz.current_pick_index + 1} / {bz.player_count * bz.round_count}
          </div>
          <div className="text-muted">Event Start (slate locks)</div>
          <div className="text-white">{fmtDate((bz as any).start_datetime)}</div>
          <div className="text-muted">Event End</div>
          <div className="text-white">{fmtDate((bz as any).end_datetime)}</div>
        </div>
      </Card>

      {/* Dates editor */}
      <Card title="Event Dates">
        <BzDatetimeEditor
          bzId={bz.id}
          startDatetime={(bz as any).start_datetime ?? null}
          endDatetime={(bz as any).end_datetime ?? null}
        />
      </Card>

      {/* Draft order */}
      <Card title="Draft Order">
        <DraftOrderManager
          betstravaganzaId={bz.id}
          allUsers={allUsers ?? []}
          currentOrder={bz.draft_order ?? []}
          status={bz.status}
        />
      </Card>
    </div>
  )
}
