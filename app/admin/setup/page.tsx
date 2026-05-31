import { getActive } from '@/lib/db/betstravaganza'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { SetupForm } from '@/components/admin/SetupForm'
import { DraftOrderManager } from '@/components/admin/DraftOrderManager'

const statusColors: Record<string, string> = {
  setup:    'default',
  draft:    'required',
  active:   'win',
  complete: 'default',
}

export default async function SetupPage() {
  const bz = await getActive()

  const supabase = await createClient()
  const { data: allUsers } = await supabase
    .from('users')
    .select('id, name, team_name')
    .order('name')

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Setup</h1>
        {bz && (
          <Badge variant={statusColors[bz.status] as any}>
            {bz.status.toUpperCase()}
          </Badge>
        )}
      </div>

      {!bz ? (
        <Card title="Create Betstravaganza">
          <SetupForm />
        </Card>
      ) : (
        <>
          <Card>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
              <div className="text-muted">Name</div>
              <div className="text-white font-medium">{bz.name}</div>
              <div className="text-muted">Players</div>
              <div className="text-white">{bz.player_count}</div>
              <div className="text-muted">Rounds</div>
              <div className="text-white">{bz.round_count}</div>
              <div className="text-muted">Stake</div>
              <div className="text-white">${Number(bz.stake_amount)}</div>
              <div className="text-muted">Starting Bankroll</div>
              <div className="text-white">${Number(bz.starting_bankroll).toLocaleString()}</div>
              <div className="text-muted">Slate Multiplier</div>
              <div className="text-white">${Number(bz.confidence_multiplier)}/rank</div>
              <div className="text-muted">Current Pick</div>
              <div className="text-white">{bz.current_pick_index + 1} / {bz.player_count * bz.round_count}</div>
            </div>
          </Card>

          <Card title="Draft Order">
            <DraftOrderManager
              betstravaganzaId={bz.id}
              allUsers={allUsers ?? []}
              currentOrder={bz.draft_order ?? []}
              status={bz.status}
            />
          </Card>
        </>
      )}
    </div>
  )
}
