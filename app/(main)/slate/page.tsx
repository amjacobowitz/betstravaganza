import { getActive } from '@/lib/db/betstravaganza'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { sportEmoji } from '@/lib/utils/sports'

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }) + ' ET'
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
  })
}

export default async function SlatePage() {
  const bz = await getActive()

  if (!bz) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Slate Overview</h1>
        <Card>
          <p className="text-muted text-sm text-center py-8">No active Betstravaganza.</p>
        </Card>
      </div>
    )
  }

  const supabase = await createClient()

  const [
    { data: slateGamesData },
    { data: slatePicksData },
    { data: slateResultsData },
    { data: usersData },
  ] = await Promise.all([
    supabase.from('slate_games').select('*').eq('betstravaganza_id', bz.id).order('start_time_et'),
    supabase.from('slate_picks').select('*').eq('betstravaganza_id', bz.id),
    supabase.from('slate_results').select('*'),
    supabase.from('users').select('id, name, team_name').order('team_name'),
  ])

  const slateGames = slateGamesData ?? []
  const slatePicks = slatePicksData ?? []
  const slateResults = slateResultsData ?? []
  const users = usersData ?? []

  const totalGames = slateGames.length
  const confidenceMultiplier = Number(bz.confidence_multiplier)

  // Build per-player totals
  const playerTotals: Record<string, number> = {}
  for (const user of users) {
    playerTotals[user.id] = 0
  }

  // Accumulate totals from results
  for (const result of slateResults) {
    const homeWon = Number(result.home_score) > Number(result.away_score)
    for (const pick of slatePicks.filter((p: any) => p.slate_game_id === result.slate_game_id)) {
      const correct = (pick.team_picked === 'home' && homeWon) || (pick.team_picked === 'away' && !homeWon)
      if (correct) {
        playerTotals[pick.user_id] = (playerTotals[pick.user_id] ?? 0) + pick.confidence_rank * confidenceMultiplier
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">Slate Overview</h1>
        <div className="text-sm text-muted">{bz.name}</div>
      </div>

      {slateGames.length === 0 && (
        <Card>
          <p className="text-muted text-sm text-center py-8">No slate games configured yet.</p>
        </Card>
      )}

      {/* Game cards */}
      <div className="space-y-4">
        {slateGames.map((game: any) => {
          const gamePicks = slatePicks.filter((p: any) => p.slate_game_id === game.id)
          const gameResult = slateResults.find((r: any) => r.slate_game_id === game.id)

          const homeWon = gameResult
            ? Number(gameResult.home_score) > Number(gameResult.away_score)
            : null

          return (
            <Card key={game.id} className="overflow-hidden p-0">
              {/* Game header */}
              <div className="px-4 py-3 bg-surface-2/50 border-b border-border/50">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-base">{sportEmoji(game.sport_label)}</span>
                    <span className="font-bold text-white text-sm">
                      {game.away_team} @ {game.home_team}
                    </span>
                    {gameResult && (
                      <span className="inline-flex items-center rounded-full bg-win/20 border border-win/40 px-2 py-0.5 text-xs font-semibold text-win">
                        Final: {game.away_team} {gameResult.away_score} – {game.home_team} {gameResult.home_score}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted">
                    {game.start_time_et ? `${formatDate(game.start_time_et)} · ${formatTime(game.start_time_et)}` : 'TBD'}
                  </div>
                </div>
              </div>

              {/* Per-player rows */}
              {gamePicks.length === 0 ? (
                <div className="px-4 py-3 text-xs text-muted italic">No picks yet.</div>
              ) : (
                <div className="divide-y divide-border/30">
                  {users
                    .filter(u => gamePicks.some((p: any) => p.user_id === u.id))
                    .map(user => {
                      const pick = gamePicks.find((p: any) => p.user_id === user.id)
                      if (!pick) return null
                      const pickedTeam = pick.team_picked === 'home' ? game.home_team : game.away_team
                      const storedRank: number = pick.confidence_rank
                      const displayRank = totalGames - storedRank + 1

                      let correct: boolean | null = null
                      let bonus = 0
                      if (gameResult && homeWon !== null) {
                        correct = (pick.team_picked === 'home' && homeWon) || (pick.team_picked === 'away' && !homeWon)
                        bonus = correct ? storedRank * confidenceMultiplier : 0
                      }

                      return (
                        <div key={user.id} className="flex items-center gap-3 px-4 py-2.5">
                          <div className="w-28 shrink-0">
                            <div className="text-xs font-semibold text-white">{user.team_name || user.name}</div>
                          </div>
                          <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                            <span className={`text-sm font-medium ${
                              gameResult
                                ? correct ? 'text-win' : 'text-loss'
                                : 'text-white'
                            }`}>
                              {pickedTeam}
                            </span>
                            <span className="text-xs text-muted font-mono">#{displayRank}</span>
                          </div>
                          {gameResult ? (
                            <div className="shrink-0 flex items-center gap-2">
                              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                                correct
                                  ? 'bg-win/20 text-win'
                                  : 'bg-loss/20 text-loss'
                              }`}>
                                {correct ? 'WIN' : 'LOSS'}
                              </span>
                              <span className={`text-sm font-mono font-semibold ${bonus > 0 ? 'text-win' : 'text-muted'}`}>
                                {bonus > 0 ? `+$${bonus}` : '$0'}
                              </span>
                            </div>
                          ) : (
                            <div className="shrink-0 text-xs text-muted">pending</div>
                          )}
                        </div>
                      )
                    })}
                </div>
              )}
            </Card>
          )
        })}
      </div>

      {/* Summary row — total slate bonus per player */}
      {users.length > 0 && slateGames.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3">Slate Bonus Totals</h2>
          <div className="divide-y divide-border/30">
            {users
              .filter(u => slatePicks.some((p: any) => p.user_id === u.id))
              .sort((a, b) => (playerTotals[b.id] ?? 0) - (playerTotals[a.id] ?? 0))
              .map(user => {
                const total = playerTotals[user.id] ?? 0
                const picksForUser = slatePicks.filter((p: any) => p.user_id === user.id)
                const submitted = picksForUser.length === totalGames
                return (
                  <div key={user.id} className="flex items-center justify-between py-2 gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{user.team_name || user.name}</div>
                      {!submitted && (
                        <div className="text-xs text-muted italic">Not submitted</div>
                      )}
                    </div>
                    <div className={`text-lg font-bold font-mono ${total > 0 ? 'text-win' : 'text-muted'}`}>
                      {total > 0 ? `+$${total}` : '$0'}
                    </div>
                  </div>
                )
              })}
          </div>
        </Card>
      )}
    </div>
  )
}
