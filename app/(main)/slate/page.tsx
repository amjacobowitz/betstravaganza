import Link from 'next/link'
import { getActive } from '@/lib/db/betstravaganza'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/Card'
import { SlatePicksForm } from '@/components/player/SlatePicksForm'
import { LockCountdown } from '@/components/ui/LockCountdown'
import { sportEmoji } from '@/lib/utils/sports'

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', {
    timeZone: 'America/Chicago',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }) + ' CT'
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'America/Chicago',
    month: 'short',
    day: 'numeric',
  })
}

type PickerEntry = { name: string; rank: number; totalGames: number }

function SlateSideRow({
  side,
  team,
  spread,
  pickers,
  correct,
  resultExists,
}: {
  side: 'AWAY' | 'HOME'
  team: string
  spread: number | null
  pickers: PickerEntry[]
  correct: boolean | null
  resultExists: boolean
}) {
  const spreadLabel = spread == null ? null : spread > 0 ? `+${spread}` : `${spread}`
  const isFav = spread != null && spread < 0

  const rowColor = resultExists
    ? correct === true
      ? 'border-win/40 bg-win/5'
      : 'border-loss/30 bg-surface-2/40'
    : 'border-border/40 bg-surface-2/60'

  return (
    <div className={`flex items-center gap-2 rounded-lg border ${rowColor} px-3 py-2`}>
      <span className="shrink-0 text-xs font-bold text-muted/50 w-9">{side}</span>

      <div className="w-36 shrink-0">
        <span className={`text-xs font-bold ${resultExists && correct === true ? 'text-win' : resultExists ? 'text-loss/70' : 'text-white'}`}>
          {team}
        </span>
        {spreadLabel && (
          <span className={`ml-1.5 text-xs font-mono ${isFav ? 'text-win' : 'text-muted'}`}>
            {spreadLabel}
          </span>
        )}
      </div>

      <span className="shrink-0 text-border">·</span>

      {pickers.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {pickers.map(p => (
            <span
              key={p.name}
              className={`inline-flex items-center gap-1 text-xs rounded border px-2 py-0.5 ${
                resultExists && correct === true
                  ? 'border-win/30 bg-win/10'
                  : resultExists
                    ? 'border-loss/20 bg-loss/5'
                    : 'border-accent/25 bg-accent/10'
              }`}
              title={`Confidence rank #${p.rank} of ${p.totalGames} picks`}
            >
              <span className={`font-medium ${resultExists && correct === true ? 'text-win' : resultExists ? 'text-muted/70' : 'text-white'}`}>
                {p.name}
              </span>
              <span className={`font-mono font-bold ${resultExists && correct === true ? 'text-win' : 'text-accent'}`}>
                #{p.rank}
              </span>
            </span>
          ))}
        </div>
      ) : (
        <span className="text-xs text-muted/40 italic">no picks</span>
      )}
    </div>
  )
}

export default async function SlatePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
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
  const { data: { user: currentUser } } = await supabase.auth.getUser()

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

  const params = await searchParams

  const slateGames = slateGamesData ?? []
  const slatePicks = slatePicksData ?? []
  const slateResults = slateResultsData ?? []
  const users = usersData ?? []
  const revealed = !!(bz as any).revealed

  const isLocked = !!(bz as any).start_datetime && new Date() > new Date((bz as any).start_datetime)
  // "All Slates" tab only visible once picks are revealed
  const canSeeAll = isLocked && revealed
  const activeTab = isLocked ? (canSeeAll ? (params.tab ?? 'my') : 'my') : null

  const totalGames = slateGames.length
  const confidenceMultiplier = Number(bz.confidence_multiplier)

  const userById = Object.fromEntries(users.map((u: any) => [u.id, u]))

  const totalPicksByUser: Record<string, number> = {}
  for (const p of slatePicks) {
    totalPicksByUser[(p as any).user_id] = (totalPicksByUser[(p as any).user_id] ?? 0) + 1
  }

  const playerTotals: Record<string, number> = {}
  for (const user of users) {
    playerTotals[(user as any).id] = 0
  }
  for (const result of slateResults) {
    const homeWon = Number((result as any).home_score) > Number((result as any).away_score)
    for (const pick of slatePicks.filter((p: any) => p.slate_game_id === (result as any).slate_game_id)) {
      const correct = ((pick as any).team_picked === 'home' && homeWon) || ((pick as any).team_picked === 'away' && !homeWon)
      if (correct) {
        const uid = (pick as any).user_id
        playerTotals[uid] = (playerTotals[uid] ?? 0) + (pick as any).confidence_rank * confidenceMultiplier
      }
    }
  }

  const myPicks = currentUser
    ? slatePicks.filter((p: any) => p.user_id === currentUser.id)
    : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">Slate Overview</h1>
        <div className="flex items-center gap-3">
          {!isLocked && (bz as any).start_datetime && (
            <LockCountdown lockTime={(bz as any).start_datetime} />
          )}
          <div className="text-sm text-muted">{bz.name}</div>
        </div>
      </div>

      {slateGames.length === 0 && (
        <Card>
          <p className="text-muted text-sm text-center py-8">No slate games configured yet.</p>
        </Card>
      )}

      {/* Tabs — only after lock and once revealed */}
      {canSeeAll && slateGames.length > 0 && (
        <div className="flex items-center gap-2">
          {(['my', 'all'] as const).map(tab => (
            <Link
              key={tab}
              href={`/slate?tab=${tab}`}
              className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'bg-accent text-white'
                  : 'bg-surface-2 text-muted hover:text-white'
              }`}
            >
              {tab === 'my' ? 'My Slate' : 'All Slates'}
            </Link>
          ))}
        </div>
      )}

      {/* Before lock: editable form for current user */}
      {!isLocked && currentUser && slateGames.length > 0 && (() => {
        const allSaved = myPicks.length === slateGames.length
        return (
          <Card title={allSaved ? 'Your Confidence Picks ✓' : 'Your Confidence Picks'}>
            <SlatePicksForm
              betstravaganzaId={bz.id}
              slateGames={slateGames as any}
              existingPicks={myPicks.map((p: any) => ({
                slateGameId: p.slate_game_id,
                teamPicked: p.team_picked,
                confidenceRank: p.confidence_rank,
              }))}
              slateLockTime={(bz as any).start_datetime ?? null}
              confidenceMultiplier={Number(bz.confidence_multiplier)}
              revealed={revealed}
            />
          </Card>
        )
      })()}

      {/* After lock — My Slate tab: compact own read-only view */}
      {isLocked && activeTab === 'my' && currentUser && slateGames.length > 0 && (
        <div>
          {myPicks.length === 0 ? (
            <Card>
              <p className="text-muted text-sm text-center py-4">You didn't submit slate picks.</p>
            </Card>
          ) : (
            <Card className="overflow-hidden p-0">
              <div className="divide-y divide-border/50">
                {[...myPicks]
                  .sort((a: any, b: any) => b.confidence_rank - a.confidence_rank)
                  .map((sp: any) => {
                    const game = slateGames.find((g: any) => g.id === sp.slate_game_id) as any
                    if (!game) return null
                    const pickedTeam = sp.team_picked === 'home' ? game.home_team : game.away_team
                    const result = slateResults.find((r: any) => r.slate_game_id === sp.slate_game_id) as any
                    let correct: boolean | null = null
                    let bonus = 0
                    if (result) {
                      const homeWon = Number(result.home_score) > Number(result.away_score)
                      correct = (sp.team_picked === 'home' && homeWon) || (sp.team_picked === 'away' && !homeWon)
                      bonus = correct ? sp.confidence_rank * confidenceMultiplier : 0
                    }
                    return (
                      <div key={sp.id} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="w-5 text-right font-mono text-xs font-bold text-accent-2">
                          #{totalGames - sp.confidence_rank + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-white">{pickedTeam}</div>
                          <div className="text-xs text-muted">{game.away_team} @ {game.home_team}</div>
                        </div>
                        {result ? (
                          <div className="text-right">
                            <div className={`text-xs font-bold ${correct ? 'text-win' : 'text-loss'}`}>
                              {correct ? 'WIN' : 'LOSS'}
                            </div>
                            <div className={`text-sm font-mono ${bonus > 0 ? 'text-win' : 'text-muted'}`}>
                              {bonus > 0 ? `+$${bonus}` : '$0'}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-muted">pending</div>
                        )}
                      </div>
                    )
                  })}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Game cards: only on All Slates tab after lock + reveal */}
      {canSeeAll && activeTab === 'all' && (
        <div className="space-y-4">
          {slateGames.map((game: any) => {
            const gamePicks = slatePicks.filter((p: any) => p.slate_game_id === game.id)
            const gameResult = slateResults.find((r: any) => r.slate_game_id === game.id)
            const homeWon = gameResult
              ? Number((gameResult as any).home_score) > Number((gameResult as any).away_score)
              : null

            const awayPickers: PickerEntry[] = []
            const homePickers: PickerEntry[] = []
            for (const p of gamePicks) {
              if (!isLocked && currentUser && (p as any).user_id === currentUser.id) continue
              const user = userById[(p as any).user_id] as any
              if (!user) continue
              const entry: PickerEntry = {
                name:       user.team_name ?? user.name,
                rank:       (p as any).confidence_rank as number,
                totalGames: totalPicksByUser[(p as any).user_id] ?? totalGames,
              }
              if ((p as any).team_picked === 'away') awayPickers.push(entry)
              else homePickers.push(entry)
            }
            awayPickers.sort((a, b) => b.rank - a.rank)
            homePickers.sort((a, b) => b.rank - a.rank)

            return (
              <Card key={game.id} className="overflow-hidden p-0">
                <div className="px-4 py-3 bg-surface-2/50 border-b border-border/50">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base">{sportEmoji(game.sport_label)}</span>
                      <span className="font-bold text-white text-sm">
                        {game.away_team} @ {game.home_team}
                      </span>
                      {gameResult && (
                        <span className="inline-flex items-center rounded-full bg-win/20 border border-win/40 px-2 py-0.5 text-xs font-semibold text-win">
                          Final: {game.away_team} {(gameResult as any).away_score} – {game.home_team} {(gameResult as any).home_score}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted">
                      {game.start_time_et ? `${formatDate(game.start_time_et)} · ${formatTime(game.start_time_et)}` : 'TBD'}
                    </div>
                  </div>
                </div>

                {revealed && (
                  <div className="px-4 py-3 flex flex-col gap-1.5">
                    {gamePicks.length === 0 ? (
                      <p className="text-xs text-muted italic">No picks yet.</p>
                    ) : (
                      <>
                        <SlateSideRow
                          side="AWAY"
                          team={game.away_team}
                          spread={game.spread != null ? -game.spread : null}
                          pickers={awayPickers}
                          correct={homeWon === false}
                          resultExists={!!gameResult}
                        />
                        <SlateSideRow
                          side="HOME"
                          team={game.home_team}
                          spread={game.spread}
                          pickers={homePickers}
                          correct={homeWon === true}
                          resultExists={!!gameResult}
                        />
                      </>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Bonus totals: only on All Slates tab after lock + reveal */}
      {canSeeAll && activeTab === 'all' && revealed && users.length > 0 && slateGames.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3">Slate Bonus Totals</h2>
          <div className="divide-y divide-border/30">
            {users
              .filter((u: any) => slatePicks.some((p: any) => p.user_id === u.id))
              .sort((a: any, b: any) => (playerTotals[b.id] ?? 0) - (playerTotals[a.id] ?? 0))
              .map((user: any) => {
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
