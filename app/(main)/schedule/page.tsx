import { getActive } from '@/lib/db/betstravaganza'
import { getEventsWithOptions } from '@/lib/db/events'
import { createClient } from '@/lib/supabase/server'
import { Badge, ClashBadge } from '@/components/ui/Badge'
import { sportEmoji } from '@/lib/utils/sports'
import { bucketItem, type ScheduleBucket } from '@/lib/utils/schedule'

function formatTime(iso: string | null) {
  if (!iso) return 'TBD'
  return new Date(iso).toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function formatOdds(odds: number | null) {
  if (odds == null) return null
  return odds > 0 ? `+${odds}` : `${odds}`
}

const SECTION_CONFIG: Record<Exclude<ScheduleBucket, 'completed'>, { label: string; color: string; dot: string }> = {
  live:     { label: '🔴 Now / Live',   color: 'border-red-500/50 bg-red-950/20',    dot: 'bg-red-500' },
  upcoming: { label: '📅 Coming Up',    color: 'border-border bg-surface',           dot: 'bg-accent-2' },
  tbd:      { label: '⏳ All Day / TBD', color: 'border-border/50 bg-surface/50',    dot: 'bg-muted' },
}

export default async function SchedulePage() {
  const bz = await getActive()
  if (!bz) return <p className="text-muted text-center py-16">No active Betstravaganza.</p>

  const supabase = await createClient()

  const [
    events,
    { data: slateGames },
    { data: users },
    { data: allDraftPicks },
    { data: betOptions },
    { data: slatePicks },
    { data: eventResults },
    { data: slateResults },
  ] = await Promise.all([
    getEventsWithOptions(bz.id),
    supabase.from('slate_games').select('*').eq('betstravaganza_id', bz.id).order('start_time_et'),
    supabase.from('users').select('id, name, team_name').order('name'),
    supabase.from('draft_picks').select('*').eq('betstravaganza_id', bz.id),
    supabase.from('bet_options').select('*'),
    supabase.from('slate_picks').select('*').eq('betstravaganza_id', bz.id),
    supabase.from('event_results').select('event_id').eq('betstravaganza_id', bz.id),
    supabase.from('slate_results').select('slate_game_id').eq('betstravaganza_id', bz.id),
  ])

  const resolvedEventIds = new Set((eventResults ?? []).map((r: any) => r.event_id))
  const resolvedSlateIds = new Set((slateResults ?? []).map((r: any) => r.slate_game_id))
  const userById = Object.fromEntries((users ?? []).map((u: any) => [u.id, u]))

  function getEventPickInfo(eventId: string) {
    const options = (betOptions ?? []).filter((o: any) => o.event_id === eventId)
    const picks = (allDraftPicks ?? []).filter((p: any) =>
      options.some((o: any) => o.id === p.bet_option_id)
    )
    const byOption: Record<string, { label: string; odds: number | null; pickers: string[] }> = {}
    for (const opt of options) {
      byOption[opt.id] = { label: opt.label, odds: opt.odds ?? null, pickers: [] }
    }
    for (const pick of picks) {
      if (byOption[pick.bet_option_id]) {
        const u = userById[pick.user_id]
        if (u) byOption[pick.bet_option_id].pickers.push(u.team_name ?? u.name)
      }
    }
    const allOptions = Object.values(byOption)
    const filledOptions = allOptions.filter(o => o.pickers.length > 0)
    const isClash = filledOptions.length >= 2
    return { allOptions, filledOptions, isClash, totalPicks: picks.length }
  }

  // Total slate games picked per user — used to show rank in context (e.g. "#2 of 12")
  const totalSlatePicksByUser: Record<string, number> = {}
  for (const p of (slatePicks ?? [])) {
    totalSlatePicksByUser[p.user_id] = (totalSlatePicksByUser[p.user_id] ?? 0) + 1
  }

  function getSlatePickInfo(gameId: string) {
    const picks = (slatePicks ?? []).filter((p: any) => p.slate_game_id === gameId)
    const homeSide: { name: string; rank: number; total: number }[] = []
    const awaySide: { name: string; rank: number; total: number }[] = []
    for (const pick of picks) {
      const u = userById[pick.user_id]
      if (!u) continue
      const entry = {
        name:  u.team_name ?? u.name,
        rank:  pick.confidence_rank as number,
        total: totalSlatePicksByUser[pick.user_id] ?? 1,
      }
      if (pick.team_picked === 'home') homeSide.push(entry)
      else awaySide.push(entry)
    }
    // Sort each side by rank descending (highest confidence = highest rank number first)
    const byRankDesc = (a: typeof homeSide[0], b: typeof homeSide[0]) => b.rank - a.rank
    homeSide.sort(byRankDesc)
    awaySide.sort(byRankDesc)
    const isClash = homeSide.length > 0 && awaySide.length > 0
    return { homeSide, awaySide, isClash, totalPicks: picks.length }
  }

  type ScheduleItem = {
    id: string
    name: string
    sport: string
    startTime: string | null
    streaming: string | null
    category: string
    betType: string
    isSlate: false
  } | {
    id: string
    name: string
    sport: string
    startTime: string | null
    streaming: string | null
    category: 'slate'
    betType: 'spread'
    isSlate: true
    awayTeam: string
    homeTeam: string
    spread: number | null
  }

  const allItems: ScheduleItem[] = [
    ...events.map((e: any) => ({
      id: e.id,
      name: e.name,
      sport: e.sport as string,
      startTime: e.start_time_et as string | null,
      streaming: e.streaming_info as string | null,
      category: e.category as string,
      betType: e.bet_type as string,
      isSlate: false as const,
    })),
    ...(slateGames ?? []).map((g: any) => ({
      id: g.id,
      name: `${g.away_team} @ ${g.home_team}`,
      sport: g.sport_label as string,
      startTime: g.start_time_et as string | null,
      streaming: g.notes as string | null,
      category: 'slate' as const,
      betType: 'spread' as const,
      isSlate: true as const,
      awayTeam: g.away_team as string,
      homeTeam: g.home_team as string,
      spread: g.spread as number | null,
    })),
  ].sort((a, b) => {
    if (!a.startTime) return 1
    if (!b.startTime) return -1
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  })

  const buckets: Record<ScheduleBucket, ScheduleItem[]> = { live: [], upcoming: [], completed: [], tbd: [] }
  for (const item of allItems) {
    const hasResult = item.isSlate ? resolvedSlateIds.has(item.id) : resolvedEventIds.has(item.id)
    buckets[bucketItem(item.startTime, hasResult)].push(item)
  }

  const visibleBuckets: Exclude<ScheduleBucket, 'completed'>[] = ['live', 'upcoming', 'tbd']

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Watch Guide</h1>
        <p className="text-sm text-muted mt-1">All times ET · {allItems.length} events</p>
      </div>

      {allItems.length === 0 && (
        <p className="text-center text-muted py-16">No events configured yet.</p>
      )}

      {visibleBuckets.map(bucket => {
        const items = buckets[bucket]
        if (items.length === 0) return null
        const cfg = SECTION_CONFIG[bucket]

        return (
          <section key={bucket}>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-base font-bold text-white">{cfg.label}</h2>
              <span className="text-xs text-muted font-mono">{items.length}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {items.map(item => {
                const eventPicks = !item.isSlate ? getEventPickInfo(item.id) : null
                const slatePickInfo = item.isSlate ? getSlatePickInfo(item.id) : null
                const isClash = !item.isSlate && item.category === 'optional' && eventPicks?.isClash

                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border ${cfg.color} p-4 flex flex-col gap-3`}
                  >
                    {/* Card header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-muted font-mono mb-1">{formatTime(item.startTime)}</p>
                        <h3 className="font-semibold text-white text-sm leading-snug">
                          {sportEmoji(item.sport)} {item.name}
                        </h3>
                        {item.streaming && (
                          <p className="text-xs text-muted mt-0.5">{item.streaming}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {bucket === 'live' && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            LIVE
                          </span>
                        )}
                        {item.category === 'required' && <Badge variant="required">REQ</Badge>}
                        {item.isSlate && <Badge variant="default">SLATE</Badge>}
                        {isClash && <ClashBadge />}
                      </div>
                    </div>

                    {/* Slate game: two horizontal rows, one per side */}
                    {item.isSlate && slatePickInfo && (
                      <div className="flex flex-col gap-1.5">
                        <SlateSideRow
                          side="AWAY"
                          team={item.awayTeam}
                          spread={item.spread != null ? -item.spread : null}
                          pickers={slatePickInfo.awaySide}
                        />
                        <SlateSideRow
                          side="HOME"
                          team={item.homeTeam}
                          spread={item.spread}
                          pickers={slatePickInfo.homeSide}
                        />
                      </div>
                    )}

                    {/* Draft event: options grid */}
                    {!item.isSlate && eventPicks && (
                      <div className="flex flex-col gap-1.5">
                        {eventPicks.allOptions.length === 0 && (
                          <p className="text-xs text-muted/50 italic">No options</p>
                        )}
                        {eventPicks.allOptions.map(opt => (
                          <div
                            key={opt.label}
                            className="flex items-center justify-between gap-2 rounded-lg bg-surface-2/60 border border-border/40 px-3 py-2"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs font-medium text-white truncate">{opt.label}</span>
                              {opt.odds != null && (
                                <span className={`text-xs font-mono shrink-0 ${opt.odds > 0 ? 'text-win' : 'text-loss'}`}>
                                  {formatOdds(opt.odds)}
                                </span>
                              )}
                            </div>
                            {opt.pickers.length > 0 ? (
                              <div className="flex flex-wrap gap-1 justify-end">
                                {opt.pickers.map(p => (
                                  <span key={p} className="text-xs text-accent bg-accent/10 border border-accent/20 rounded-full px-2 py-0.5">
                                    {p}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-muted/40 italic">open</span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      {/* Completed section — collapsed summary */}
      {buckets.completed.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-base font-bold text-muted">✓ Completed</h2>
            <span className="text-xs text-muted font-mono">{buckets.completed.length}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {buckets.completed.map(item => (
              <div key={item.id} className="rounded-xl border border-border/30 bg-surface/30 px-4 py-3 flex items-center gap-3">
                <span className="text-lg">{sportEmoji(item.sport)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-muted/70 truncate">{item.name}</p>
                  <p className="text-xs text-muted/40">{formatTime(item.startTime)}</p>
                </div>
                <Badge variant="push">Final</Badge>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function SlateSideRow({
  side,
  team,
  spread,
  pickers,
}: {
  side: 'AWAY' | 'HOME'
  team: string
  spread: number | null
  pickers: { name: string; rank: number; total: number }[]
}) {
  const spreadLabel = spread == null ? null : spread > 0 ? `+${spread}` : `${spread}`
  const isFav = spread != null && spread < 0

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border/40 bg-surface-2/60 px-3 py-2">
      {/* Side label */}
      <span className="shrink-0 text-xs font-bold text-muted/50 w-9">{side}</span>

      {/* Team + spread */}
      <div className="w-36 shrink-0">
        <span className="text-xs font-bold text-white">{team}</span>
        {spreadLabel && (
          <span className={`ml-1.5 text-xs font-mono ${isFav ? 'text-win' : 'text-muted'}`}>
            {spreadLabel}
          </span>
        )}
      </div>

      {/* Divider */}
      <span className="shrink-0 text-border">·</span>

      {/* Pickers inline */}
      {pickers.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {pickers.map(p => (
            <span
              key={p.name}
              className="inline-flex items-center gap-1 text-xs rounded border border-accent/25 bg-accent/10 px-2 py-0.5"
              title={`Ranked #${p.rank} of ${p.total} picks`}
            >
              <span className="font-medium text-white">{p.name}</span>
              <span className="font-mono font-bold text-accent">#{p.rank}</span>
            </span>
          ))}
        </div>
      ) : (
        <span className="text-xs text-muted/40 italic">no picks</span>
      )}
    </div>
  )
}
