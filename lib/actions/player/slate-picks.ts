'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function submitSlatePicks(betstravaganzaId: string, picks: Array<{
  slateGameId: string
  teamPicked: 'home' | 'away'
  confidenceRank: number
}>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Validate: ranks must be 1..N with no duplicates
  const ranks = picks.map(p => p.confidenceRank).sort((a, b) => a - b)
  const expected = Array.from({ length: picks.length }, (_, i) => i + 1)
  if (JSON.stringify(ranks) !== JSON.stringify(expected)) {
    return { error: 'Confidence ranks must be consecutive integers starting at 1' }
  }

  // Upsert all picks
  const rows = picks.map(p => ({
    betstravaganza_id: betstravaganzaId,
    user_id:           user.id,
    slate_game_id:     p.slateGameId,
    team_picked:       p.teamPicked,
    confidence_rank:   p.confidenceRank,
    submitted_at:      new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('slate_picks')
    .upsert(rows, { onConflict: 'user_id,slate_game_id' })

  if (error) return { error: error.message }
  revalidatePath('/my-picks')
  revalidatePath('/admin/slate')
  return { ok: true }
}
