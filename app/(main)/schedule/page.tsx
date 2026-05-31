import { getActive } from '@/lib/db/betstravaganza'
import { getEventsWithOptions } from '@/lib/db/events'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

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

  const events = await getEventsWithOptions(bz.id)

  // Also fetch slate games
  const supabase = await createClient()
  const { data: slateGames } = await supabase
    .from('slate_games')
    .select('*')
    .eq('betstravaganza_id', bz.id)
    .order('start_time_et')

  // Sort all events chronologically, with TBD at the end
  const allItems = [
    ...events.map(e => ({
      id: e.id,
      name: e.name,
      sport: e.sport,
      startTime: (e as any).start_time_et as string | null,
      streaming: (e as any).streaming_info as string | null,
      category: e.category as string,
      betType: (e as any).bet_type as string,
      isSlate: false,
    })),
    ...(slateGames ?? []).map(g => ({
      id: g.id,
      name: `${g.away_team} @ ${g.home_team}`,
      sport: g.sport_label,
      startTime: g.start_time_et as string | null,
      streaming: g.notes as string | null,
      category: 'slate',
      betType: 'spread',
      isSlate: true,
    })),
  ].sort((a, b) => {
    if (!a.startTime) return 1
    if (!b.startTime) return -1
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  })

  return (
    <div className="space-y-3">
      <h1 className="text-2xl font-bold text-white">Event Schedule</h1>
      <p className="text-sm text-muted">All times ET · Saturday June 6</p>

      <Card className="divide-y divide-border p-0 overflow-hidden">
        {allItems.map(item => (
          <div key={item.id} className="flex items-start gap-3 px-4 py-3 hover:bg-surface-2/50 transition-colors">
            <div className="w-16 shrink-0 pt-0.5 text-right">
              <span className="text-sm font-mono text-accent-2">{formatTime(item.startTime)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-white text-sm">{item.name}</span>
                {item.category === 'required' && <Badge variant="required">REQUIRED</Badge>}
                {item.isSlate && <Badge variant="default">SLATE</Badge>}
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted flex-wrap">
                <span>{item.sport}</span>
                {item.streaming && (
                  <>
                    <span>·</span>
                    <span>{item.streaming}</span>
                  </>
                )}
                <span>·</span>
                <span className="capitalize">{item.betType.replace('_', ' ')}</span>
              </div>
            </div>
          </div>
        ))}
        {allItems.length === 0 && (
          <div className="px-4 py-8 text-center text-muted">No events configured yet.</div>
        )}
      </Card>
    </div>
  )
}
