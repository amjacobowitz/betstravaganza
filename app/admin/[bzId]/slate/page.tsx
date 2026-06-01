import { notFound } from 'next/navigation'
import { getById } from '@/lib/db/betstravaganza'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

export default async function SlatePage({
  params,
}: {
  params: Promise<{ bzId: string }>
}) {
  const { bzId } = await params
  const bz = await getById(bzId)
  if (!bz) notFound()

  const supabase = await createClient()
  const [{ data: users }, { data: slateGames }, { data: slatePicks }] = await Promise.all([
    supabase.from('users').select('id, name, team_name').order('name'),
    supabase.from('slate_games').select('id, away_team, home_team, sport_label, start_time_et').eq('betstravaganza_id', bz.id).order('start_time_et'),
    supabase.from('slate_picks').select('*').eq('betstravaganza_id', bz.id),
  ])

  const gameCount = slateGames?.length ?? 0

  const userPickCount = (uid: string) =>
    (slatePicks ?? []).filter((p: any) => p.user_id === uid).length

  const submittedUsers = (users ?? []).filter(u => gameCount > 0 && userPickCount(u.id) === gameCount)
  const partialUsers   = (users ?? []).filter(u => userPickCount(u.id) > 0 && userPickCount(u.id) < gameCount)
  const notStartedUsers = (users ?? []).filter(u => userPickCount(u.id) === 0)
  const submittedCount = submittedUsers.length
  const pendingUsers = [...partialUsers, ...notStartedUsers]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Slate Submissions</h2>
        <span className="text-sm text-muted">
          {submittedCount}/{(users ?? []).length} complete · {gameCount} games
        </span>
      </div>

      {gameCount > 0 && (
        <div className="rounded-lg border border-border bg-surface px-4 py-3 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Submission Status</p>
            <span className="text-xs text-muted font-mono">{submittedCount}/{(users ?? []).length} complete</span>
          </div>
          {submittedUsers.map(u => (
            <div key={u.id} className="flex items-center justify-between text-sm">
              <span className="text-white">{u.team_name || u.name}</span>
              <span className="text-win font-semibold text-xs">✓ All {gameCount}</span>
            </div>
          ))}
          {partialUsers.map(u => {
            const picked = userPickCount(u.id)
            return (
              <div key={u.id} className="flex items-center justify-between text-sm">
                <span className="text-white">{u.team_name || u.name}</span>
                <span className="text-accent-2 font-mono font-semibold text-xs">{picked}/{gameCount}</span>
              </div>
            )
          })}
          {notStartedUsers.map(u => (
            <div key={u.id} className="flex items-center justify-between text-sm">
              <span className="text-muted">{u.team_name || u.name}</span>
              <span className="text-muted text-xs">not started</span>
            </div>
          ))}
        </div>
      )}

      {gameCount === 0 && (
        <Card>
          <p className="text-muted text-sm text-center py-4">
            No slate games configured yet. Add them in Events.
          </p>
        </Card>
      )}

      {gameCount > 0 && (
        <div className="space-y-3">
          {(users ?? []).map(user => {
            const userPicks = (slatePicks ?? []).filter((p: any) => p.user_id === user.id)
            const submitted = userPicks.length === gameCount
            const partial = userPicks.length > 0 && !submitted
            const submittedAt = userPicks.length > 0
              ? new Date(Math.max(...userPicks.map((p: any) => new Date(p.submitted_at).getTime())))
              : null

            return (
              <Card key={user.id} className={partial ? 'border-accent-2/50' : ''}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white">{user.team_name}</div>
                    <div className="text-xs text-muted">{user.name}</div>
                    {submittedAt && (
                      <div className="text-xs text-muted mt-1">
                        {submittedAt.toLocaleString('en-US', { timeZone: 'America/New_York' })}
                      </div>
                    )}
                  </div>
                  <div>
                    {submitted ? (
                      <Badge variant="win">SUBMITTED</Badge>
                    ) : partial ? (
                      <Badge variant="required">PARTIAL ({userPicks.length}/{gameCount})</Badge>
                    ) : (
                      <Badge variant="default">NOT SUBMITTED</Badge>
                    )}
                  </div>
                </div>
                {userPicks.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {[...userPicks]
                      .sort((a: any, b: any) => b.confidence_rank - a.confidence_rank)
                      .map((pick: any) => {
                        const game = slateGames?.find(g => g.id === pick.slate_game_id)
                        if (!game) return null
                        const picked = pick.team_picked === 'home' ? game.home_team : game.away_team
                        return (
                          <div key={pick.id} className="flex items-center gap-2 text-xs">
                            <span className="w-5 text-right font-mono font-bold text-accent-2">
                              #{gameCount - pick.confidence_rank + 1}
                            </span>
                            <span className="text-white font-medium">{picked}</span>
                            <span className="text-muted">({game.away_team} @ {game.home_team})</span>
                          </div>
                        )
                      })}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
