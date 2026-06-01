import { notFound } from 'next/navigation'
import { getById } from '@/lib/db/betstravaganza'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/Card'
import { BonusForm } from '@/components/admin/BonusForm'

export default async function BonusesPage({
  params,
}: {
  params: Promise<{ bzId: string }>
}) {
  const { bzId } = await params
  const bz = await getById(bzId)
  if (!bz) notFound()

  const supabase = await createClient()
  const [{ data: usersData }, { data: bonusesData }] = await Promise.all([
    supabase.from('users').select('id, name, team_name').order('name'),
    supabase
      .from('bonuses')
      .select('*, users(name, team_name)')
      .eq('betstravaganza_id', bzId)
      .order('created_at', { ascending: false }),
  ])

  const users = usersData ?? []
  const bonuses = bonusesData ?? []
  const total = bonuses.reduce((sum, b) => sum + Number(b.amount), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Bonuses</h1>
          <p className="text-sm text-muted mt-0.5">Award bonus winnings outside of draft picks.</p>
        </div>
        {bonuses.length > 0 && (
          <div className="text-xs text-muted">
            {bonuses.length} bonus{bonuses.length !== 1 ? 'es' : ''} · <span className="text-win font-mono">+${total.toFixed(0)} total awarded</span>
          </div>
        )}
      </div>

      {/* Add bonus form */}
      <Card title="Add Bonus">
        <BonusForm betstravaganzaId={bzId} users={users} />
      </Card>

      {/* Existing bonuses */}
      {bonuses.length > 0 && (
        <Card title="Awarded Bonuses" className="overflow-hidden p-0">
          <div className="divide-y divide-border/50">
            {bonuses.map((b: any) => {
              const u = b.users
              const teamName = u?.team_name ?? u?.name ?? '?'
              const playerName = u?.name
              return (
                <div key={b.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white">{b.title}</div>
                    <div className="text-xs text-muted mt-0.5">
                      {teamName}{playerName && teamName !== playerName ? ` (${playerName})` : ''}
                    </div>
                  </div>
                  <div className="text-base font-bold font-mono text-win shrink-0">
                    +${Number(b.amount).toFixed(0)}
                  </div>
                  <BonusDeleteButton bonusId={b.id} />
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {bonuses.length === 0 && (
        <Card>
          <p className="text-sm text-muted text-center py-4">No bonuses awarded yet.</p>
        </Card>
      )}
    </div>
  )
}

// Inline delete button — server action via form
import { deleteBonus } from '@/lib/actions/admin/bonuses'

function BonusDeleteButton({ bonusId }: { bonusId: string }) {
  return (
    <form action={async () => { 'use server'; await deleteBonus(bonusId) }}>
      <button
        type="submit"
        className="text-xs text-muted/40 hover:text-danger transition-colors px-1"
        aria-label="Delete bonus"
      >
        ✕
      </button>
    </form>
  )
}
