import Link from 'next/link'
import { requireRevealed } from '@/lib/auth/requireRevealed'
import { getActive } from '@/lib/db/betstravaganza'
import { getDraftState } from '@/lib/db/draft'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { sportEmoji } from '@/lib/utils/sports'
import { BirdAvatar } from '@/components/ui/BirdAvatar'

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

export default async function PublicDraftPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  await requireRevealed()
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
  const params = await searchParams

  const roundCount = bz.round_count ?? 6
  const draftOrder: string[] = bz.draft_order ?? []
  const playerCount = draftOrder.length || bz.player_count || users.length
  const totalPicks = playerCount * roundCount
  const currentPickIndex = bz.current_pick_index ?? 0

  const status = getDraftStatus(currentPickIndex, totalPicks, rawPicks.length)
  const statusInfo = statusConfig[status]

  // Build ordered player list
  const orderedPlayers = draftOrder
    .map(uid => users.find(u => u.id === uid))
    .filter(Boolean) as typeof users

  const extraPlayers = users.filter(
    u => !draftOrder.includes(u.id) && rawPicks.some((p: any) => p.user_id === u.id)
  )
  const players = [...orderedPlayers, ...extraPlayers]

  const activeTab = status === 'complete' ? (params.tab ?? 'board') : null

  // Recap stats (only needed when complete)
  interface RecapStat {
    label: string
    value: string
    sub?: string
    emoji?: string
  }
  const recapStats: RecapStat[] = []
  if (status === 'complete' && activeTab === 'recap') {
    // Option pick counts
    const pickCountByOption: Record<string, { label: string; sport: string; eventName: string; odds: number | null; count: number }> = {}
    for (const pick of rawPicks as any[]) {
      const opt = pick.bet_options
      if (!opt) continue
      if (!pickCountByOption[opt.id]) {
        pickCountByOption[opt.id] = {
          label: opt.label,
          sport: opt.events?.sport ?? '',
          eventName: opt.events?.name ?? '',
          odds: opt.odds != null ? Number(opt.odds) : null,
          count: 0,
        }
      }
      pickCountByOption[opt.id].count++
    }
    const allOptCounts = Object.values(pickCountByOption)

    // Biggest longshot (highest positive odds)
    const withOdds = allOptCounts.filter(o => o.odds != null)
    const longshot = withOdds.length > 0
      ? withOdds.reduce((a, b) => (b.odds! > a.odds! ? b : a), withOdds[0])
      : null
    if (longshot && longshot.odds! > 0) recapStats.push({
      emoji: '💎',
      label: 'Biggest Longshot Taken',
      value: `${longshot.label} (+${longshot.odds})`,
      sub: `${sportEmoji(longshot.sport)} ${longshot.eventName}`,
    })

    // Biggest chalk (most negative odds)
    const chalk = withOdds.length > 0
      ? withOdds.reduce((a, b) => (b.odds! < a.odds! ? b : a), withOdds[0])
      : null
    if (chalk && chalk.odds! < 0) recapStats.push({
      emoji: '📉',
      label: 'Most Chalk Pick',
      value: `${chalk.label} (${chalk.odds})`,
      sub: `${sportEmoji(chalk.sport)} ${chalk.eventName}`,
    })

    // Rarest pick (drafted by only 1 player)
    const rarePicks = allOptCounts.filter(o => o.count === 1)
    recapStats.push({
      emoji: '🦄',
      label: 'Solo Darkhorse Picks',
      value: `${rarePicks.length} unique pick${rarePicks.length !== 1 ? 's' : ''}`,
      sub: rarePicks.length > 0 ? rarePicks.map(o => o.label).join(', ') : 'None — everyone agrees!',
    })

    // Clashes: optional events with picks on both sides
    const eventPickSides: Record<string, Set<string>> = {}
    for (const pick of rawPicks as any[]) {
      const opt = pick.bet_options
      const event = opt?.events
      if (!event || event.category !== 'optional') continue
      if (!eventPickSides[event.id]) eventPickSides[event.id] = new Set()
      eventPickSides[event.id].add(opt.id)
    }
    const clashCount = Object.values(eventPickSides).filter(s => s.size >= 2).length
    recapStats.push({
      emoji: '⚔️',
      label: 'Active Clashes',
      value: `${clashCount}`,
      sub: clashCount > 0 ? 'Players are on opposite sides' : 'No clashes this time',
    })

    // Most picks on a single event (most contested event)
    const picksByEvent: Record<string, { name: string; sport: string; count: number }> = {}
    for (const pick of rawPicks as any[]) {
      const event = pick.bet_options?.events
      if (!event) continue
      if (!picksByEvent[event.id]) picksByEvent[event.id] = { name: event.name, sport: event.sport ?? '', count: 0 }
      picksByEvent[event.id].count++
    }
    const hotEvent = Object.values(picksByEvent).reduce((a, b) => b.count > a.count ? b : a, { name: '', sport: '', count: 0 })
    if (hotEvent.count > 0) recapStats.push({
      emoji: '🎯',
      label: 'Most Contested Event',
      value: hotEvent.name,
      sub: `${hotEvent.count} total picks — ${sportEmoji(hotEvent.sport)}`,
    })
  }

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

      {/* Tabs — only when complete */}
      {status === 'complete' && (
        <div className="flex items-center gap-2">
          {(['board', 'rosters', 'recap'] as const).map(tab => (
            <Link
              key={tab}
              href={`/draft?tab=${tab}`}
              className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'bg-accent text-white'
                  : 'bg-surface-2 text-muted hover:text-white'
              }`}
            >
              {tab === 'board' ? 'Board' : tab === 'rosters' ? 'Rosters' : '🎉 Recap'}
            </Link>
          ))}
        </div>
      )}

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

      {/* Board tab — draft grid */}
      {status === 'complete' && activeTab === 'board' && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-surface-2">
                <th className="px-3 py-3 text-left text-xs text-muted font-semibold w-16">Round</th>
                {players.map(p => (
                  <th key={p.id} className="px-3 py-3 text-left text-xs font-semibold min-w-[160px] text-white">
                    <div className="flex items-center gap-2 mb-1">
                      <BirdAvatar teamName={p.team_name} size={28} />
                      <span>{p.team_name}</span>
                    </div>
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
      )}

      {/* Rosters tab — per-player pick cards */}
      {status === 'complete' && activeTab === 'rosters' && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {players.map(p => {
            const playerPicks = rawPicks.filter((dp: any) => dp.user_id === p.id) as any[]
            return (
              <Card key={p.id} className="p-3 space-y-2">
                <div className="flex items-center gap-2.5">
                  <BirdAvatar teamName={p.team_name} size={40} />
                  <div>
                    <div className="font-semibold text-white">{p.team_name}</div>
                    <div className="text-xs text-muted">{p.name}</div>
                  </div>
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
      )}

      {/* Recap tab */}
      {status === 'complete' && activeTab === 'recap' && (
        <div className="space-y-3">
          {recapStats.map((stat, i) => (
            <Card key={i} className="flex items-start gap-3 p-4">
              {stat.emoji && (
                <span className="text-2xl shrink-0 mt-0.5">{stat.emoji}</span>
              )}
              <div className="min-w-0">
                <div className="text-xs text-muted uppercase tracking-wider mb-1">{stat.label}</div>
                <div className="text-base font-bold text-white leading-snug">{stat.value}</div>
                {stat.sub && <div className="text-xs text-muted mt-1">{stat.sub}</div>}
              </div>
            </Card>
          ))}
          {recapStats.length === 0 && (
            <Card>
              <p className="text-muted text-sm text-center py-4">No data yet.</p>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
