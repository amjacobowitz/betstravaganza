import { notFound } from 'next/navigation'
import { getById } from '@/lib/db/betstravaganza'
import { getEventsWithOptions } from '@/lib/db/events'
import { createClient } from '@/lib/supabase/server'
import { ResultsForm } from '@/components/admin/ResultsForm'

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ bzId: string }>
}) {
  const { bzId } = await params
  const bz = await getById(bzId)
  if (!bz) notFound()

  const supabase = await createClient()
  const rawEvents = await getEventsWithOptions(bz.id)
  const eventIds = rawEvents.map((e: any) => e.id)

  const [{ data: rawSlateGames }, { data: results }, { data: slateResults }] = await Promise.all([
    supabase.from('slate_games').select('*').eq('betstravaganza_id', bz.id).order('sort_order'),
    eventIds.length > 0
      ? supabase.from('results').select('*').in('event_id', eventIds)
      : Promise.resolve({ data: [] }),
    supabase.from('slate_results').select('*'),
  ])

  const events = rawEvents.map((e: any) => ({
    ...e,
    result: results?.find((r: any) => r.event_id === e.id) ?? null,
  }))
  const slateGames = (rawSlateGames ?? []).map((g: any) => ({
    ...g,
    result: slateResults?.find((r: any) => r.slate_game_id === g.id) ?? null,
  }))

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-white">Results</h2>
      <ResultsForm events={events} slateGames={slateGames} />
    </div>
  )
}
