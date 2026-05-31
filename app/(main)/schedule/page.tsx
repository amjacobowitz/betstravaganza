import { getActive } from '@/lib/db/betstravaganza'
import { getEventsWithOptions } from '@/lib/db/events'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { sportEmoji } from '@/lib/utils/sports'

function formatTime(iso: string | null) {
  if (!iso) return 'TBD'
  return new Date(iso).toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
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
  ] = await Promise.all([
    getEventsWithOptions(bz.id),
    supabase.from('slate_games').select('*').eq('betstravaganza_id', bz.id).order('start_time_et'),
    supabase.from('users').select('id, name, team_name').order('name'),
    supabase.from('draft_picks').select('*').eq('betstravaganza_id', bz.id),
    supabase.from('bet_options').select('*'),
    supabase.from('slate_picks').select('*').eq('betstravaganza_id', bz.id),
  ])

  // Index users by id
  const userById = Object.fromEntries((users ?? []).map((u: any) => [u.id, u]))

  // For each event, group draft picks by bet_option_id → user names
  // A "CLASH" event has picks on multiple different bet options by different players
  function getEventPickInfo(eventId: string) {
    const options = (betOptions ?? []).filter((o: any) => o.event_id === eventId)
    const picks = (allDraftPicks ?? []).filter((p: any) =>
      options.some((o: any) => o.id === p.bet_option_id)
    )

    const byOption: Record<string, { label: string; pickers: string[] }> = {}
    for (const opt of options) {
      byOption[opt.id] = { label: opt.label, pickers: [] }
    }
    for (const pick of picks) {
      if (byOption[pick.bet_option_id]) {
        const u = userById[pick.user_id]
        if (u) byOption[pick.bet_option_id].pickers.push(u.team_name ?? u.name)
      }
    }

    const filledOptions = Object.values(byOption).filter(o => o.pickers.length > 0)
    const isClash = filledOptions.length >= 2
    return { filledOptions, isClash, totalPicks: picks.length }
  }

  // For each slate game, get who picked home vs away
  function getSlatePickInfo(gameId: string) {
    const picks = (slatePicks ?? []).filter((p: any) => p.slate_game_id === gameId)
    const homeTeam: string[] = []
    const awayTeam: string[] = []
    for (const pick of picks) {
      const u = userById[pick.user_id]
      if (!u) continue
      const name = u.team_name ?? u.name
      if (pick.team_picked === 'home') homeTeam.push(name)
      else awayTeam.push(name)
    }
    const isClash = homeTeam.length > 0 && awayTeam.length > 0
    return { homeTeam, awayTeam, isClash, totalPicks: picks.length }
  }

  // Sort all items chronologically, TBD at end
  const allItems = [
    ...events.map((e: any) => ({
      id: e.id,
      name: e.name,
      sport: e.sport as string,
      startTime: e.start_time_et as string | null,
      streaming: e.streaming_info as string | null,
      category: e.category as string,
      betType: e.bet_type as string,
      isSlate: false,
    })),
    ...(slateGames ?? []).map((g: any) => ({
      id: g.id,
      name: `${g.away_team} @ ${g.home_team}`,
      sport: g.sport_label as string,
      startTime: g.start_time_et as string | null,
      streaming: g.notes as string | null,
      category: 'slate',
      betType: 'spread',
      isSlate: true,
      awayTeam: g.away_team as string,
      homeTeam: g.home_team as string,
      spread: g.spread as number | null,
    })),
  ].sort((a, b) => {
    if (!a.startTime) return 1
    if (!b.startTime) return -1
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  })

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold text-white">Event Schedule</h1>
      <p className="text-sm text-muted">All times ET</p>

      <Card className="divide-y divide-border p-0 overflow-hidden">
        {allItems.map(item => {
          const eventPicks = !item.isSlate ? getEventPickInfo(item.id) : null
          const slatePick = item.isSlate ? getSlatePickInfo(item.id) : null
          const isClash = eventPicks?.isClash || slatePick?.isClash

          return (
            <div key={item.id} className="px-4 py-3 hover:bg-surface-2/50 transition-colors">
              <div className="flex items-start gap-3">
                <div className="w-16 shrink-0 pt-0.5 text-right">
                  <span className="text-sm font-mono text-accent-2">{formatTime(item.startTime)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  {/* Title row */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white text-sm">
                      {sportEmoji(item.sport)} {item.name}
                    </span>
                    {item.category === 'required' && <Badge variant="required">REQUIRED</Badge>}
                    {item.isSlate && <Badge variant="default">SLATE</Badge>}
                    {isClash && <Badge variant="clash">CLASH</Badge>}
                  </div>

                  {/* Subtitle row */}
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted flex-wrap">
                    <span>{item.sport}</span>
                    {(item as any).spread !== null && (item as any).spread !== undefined && (
                      <>
                        <span>·</span>
                        <span>Spread: {(item as any).spread > 0 ? '+' : ''}{(item as any).spread}</span>
                      </>
                    )}
                    {item.streaming && (
                      <>
                        <span>·</span>
                        <span>{item.streaming}</span>
                      </>
                    )}
                    {!item.isSlate && (
                      <>
                        <span>·</span>
                        <span className="capitalize">{item.betType.replace('_', ' ')}</span>
                      </>
                    )}
                  </div>

                  {/* Picks display for draft events */}
                  {eventPicks && eventPicks.totalPicks > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {eventPicks.filledOptions.map(opt => (
                        <div key={opt.label} className="flex items-center gap-1.5 rounded-md bg-surface-2 border border-border/50 px-2 py-1">
                          <span className="text-xs text-white font-medium">{opt.label}</span>
                          <span className="text-xs text-muted">→</span>
                          <span className="text-xs text-accent">{opt.pickers.join(', ')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {eventPicks && eventPicks.totalPicks === 0 && (
                    <p className="mt-1 text-xs text-muted/50 italic">No picks yet</p>
                  )}

                  {/* Picks display for slate games */}
                  {slatePick && slatePick.totalPicks > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {slatePick.awayTeam.length > 0 && (
                        <div className="flex items-center gap-1.5 rounded-md bg-surface-2 border border-border/50 px-2 py-1">
                          <span className="text-xs text-white font-medium">{(item as any).awayTeam} (away)</span>
                          <span className="text-xs text-muted">→</span>
                          <span className="text-xs text-accent">{slatePick.awayTeam.join(', ')}</span>
                        </div>
                      )}
                      {slatePick.homeTeam.length > 0 && (
                        <div className="flex items-center gap-1.5 rounded-md bg-surface-2 border border-border/50 px-2 py-1">
                          <span className="text-xs text-white font-medium">{(item as any).homeTeam} (home)</span>
                          <span className="text-xs text-muted">→</span>
                          <span className="text-xs text-accent">{slatePick.homeTeam.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {slatePick && slatePick.totalPicks === 0 && (
                    <p className="mt-1 text-xs text-muted/50 italic">No picks yet</p>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        {allItems.length === 0 && (
          <div className="px-4 py-8 text-center text-muted">No events configured yet.</div>
        )}
      </Card>
    </div>
  )
}
