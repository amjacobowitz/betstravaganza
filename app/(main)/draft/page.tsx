import { getActive } from '@/lib/db/betstravaganza'
import { getDraftState } from '@/lib/db/draft'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { sportEmoji } from '@/lib/utils/sports'

type DraftStatus = 'not_started' | 'in_progress' | 'complete'

function getDraftStatus(currentPickIndex: number, totalPicks: number, picksCount: number): DraftStatus {
  if (picksCount === 0) return 'not_started'
  if (currentPickIndex >= totalPicks) return 'complete'
  return 'in_progress'
}

const statusConfig: Record<DraftStatus, { label: string; color: string; description: string }> = {
  not_started: {
    label: 'Not Started',
    color: 'bg-zinc-700/50 text-zinc-300 border-zinc-600',
    description: 'The draft has not begun yet.',
  },
  in_progress: {
    label: 'In Progress',
    color: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    description: 'The draft is currently underway. Picks will be revealed once the draft is complete.',
  },
  complete: {
    label: 'Complete',
    color: 'bg-win/10 text-win border-win/30',
    description: 'The draft is complete.',
  },
}

export default async function PublicDraftPage() {
  const bz = await getActive()
  if (!bz) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-2xl">🎲</p>
        <p className="mt-2 text-muted">No active Betstravaganza yet.</p>
      </div>
    )
  }

  const { picks: rawPicks, users } = await getDraftState(bz.id)

  const roundCount = bz.round_count ?? 6
  const playerCount = bz.player_count ?? users.length
  const totalPicks = playerCount * roundCount
  const currentPickIndex = bz.current_pick_index ?? 0
  const draftOrder: string[] = bz.draft_order ?? []

  const status = getDraftStatus(currentPickIndex, totalPicks, rawPicks.length)
  const statusInfo = statusConfig[status]

  // Build ordered player list
  const orderedPlayers = draftOrder
    .map(uid => users.find(u => u.id === uid))
    .filter(Boolean) as typeof users

  // If any users have picks but aren't in draft_order, append them
  const extraPlayers = users.filter(
    u => !draftOrder.includes(u.id) && rawPicks.some((p: any) => p.user_id === u.id)
  )
  const players = [...orderedPlayers, ...extraPlayers]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Draft Board</h1>
          <p className="text-sm text-muted mt-0.5">{bz.name}</p>
        </div>
        <div className={`rounded-full border px-4 py-1.5 text-sm font-semibold ${statusInfo.color}`}>
          {statusInfo.label}
        </div>
      </div>

      {/* Status message */}
      {status !== 'complete' && (
        <Card className={`border ${statusInfo.color}`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">
              {status === 'not_started' ? '🔒' : '⏱'}
            </span>
            <div>
              <p className="font-semibold text-white">{statusInfo.label}</p>
              <p className="text-sm text-muted mt-0.5">{statusInfo.description}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Draft progress (in progress only) */}
      {status === 'in_progress' && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="text-center p-3">
            <div className="text-2xl font-bold font-mono text-white">{rawPicks.length}</div>
            <div className="text-xs text-muted mt-1">Picks Made</div>
          </Card>
          <Card className="text-center p-3">
            <div className="text-2xl font-bold font-mono text-white">{totalPicks - rawPicks.length}</div>
            <div className="text-xs text-muted mt-1">Picks Remaining</div>
          </Card>
          <Card className="text-center p-3">
            <div className="text-2xl font-bold font-mono text-white">
              {Math.min(Math.floor(currentPickIndex / (draftOrder.length || 1)) + 1, roundCount)}
              <span className="text-muted text-lg">/{roundCount}</span>
            </div>
            <div className="text-xs text-muted mt-1">Round</div>
          </Card>
        </div>
      )}

      {/* Full grid — only shown when complete */}
      {status === 'complete' && (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-surface-2">
                  <th className="px-3 py-3 text-left text-xs text-muted font-semibold w-16">Round</th>
                  {players.map(p => (
                    <th key={p.id} className="px-3 py-3 text-left text-xs font-semibold min-w-[160px] text-white">
                      {p.team_name}
                      <div className="font-normal text-muted">{p.name}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: roundCount }, (_, i) => {
                  const round = i + 1
                  const isSnakeReverse = round % 2 === 0
                  return (
                    <tr key={round} className="border-b border-border/40 last:border-b-0">
                      <td className="px-3 py-3 text-xs font-mono font-semibold">
                        <div className="text-white">{round}</div>
                        <div className="text-muted/50 text-[10px]">{isSnakeReverse ? '←' : '→'}</div>
                      </td>
                      {players.map(p => {
                        const pick = rawPicks.find(
                          (dp: any) => dp.user_id === p.id && dp.round_number === round
                        ) as any | undefined

                        const option = pick?.bet_options
                        const event = option?.events

                        if (!pick || !option) {
                          return (
                            <td key={p.id} className="px-3 py-3 text-xs text-muted/30">—</td>
                          )
                        }

                        return (
                          <td key={p.id} className="px-3 py-3 align-top">
                            <div className="rounded-lg bg-surface-2/40 border border-border/40 px-2.5 py-2">
                              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                <span className="text-xs font-semibold text-white leading-tight">
                                  {option.label}
                                </span>
                                {event?.category === 'required' && (
                                  <Badge variant="required" className="text-[10px]">REQ</Badge>
                                )}
                              </div>
                              <div className="text-[11px] text-muted leading-tight">
                                {sportEmoji(event?.sport ?? '')} {event?.name}
                              </div>
                              {option.odds != null && (
                                <div className={`text-[11px] font-mono mt-0.5 ${Number(option.odds) > 0 ? 'text-win' : 'text-muted'}`}>
                                  {Number(option.odds) > 0 ? `+${option.odds}` : option.odds}
                                </div>
                              )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Per-player summary */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {players.map(p => {
              const playerPicks = rawPicks.filter((dp: any) => dp.user_id === p.id) as any[]
              return (
                <Card key={p.id} className="p-3 space-y-2">
                  <div>
                    <div className="font-semibold text-white">{p.team_name}</div>
                    <div className="text-xs text-muted">{p.name}</div>
                  </div>
                  <div className="space-y-1">
                    {playerPicks
                      .sort((a, b) => a.round_number - b.round_number)
                      .map((pick: any) => {
                        const option = pick.bet_options
                        const event = option?.events
                        return (
                          <div key={pick.id} className="flex items-center gap-2 text-xs">
                            <span className="w-5 text-right font-mono text-muted shrink-0">R{pick.round_number}</span>
                            <span className="text-white font-medium truncate">{option?.label}</span>
                            {event?.category === 'required' && (
                              <Badge variant="required" className="text-[10px] shrink-0">REQ</Badge>
                            )}
                          </div>
                        )
                      })}
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
