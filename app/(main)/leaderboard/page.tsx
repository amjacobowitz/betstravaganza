import Link from 'next/link'
import { getActive } from '@/lib/db/betstravaganza'
import { getLeaderboard } from '@/lib/db/leaderboard'
import { getMarketHistory } from '@/lib/db/market'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { BirdAvatar } from '@/components/ui/BirdAvatar'
import { AutoRefresh } from '@/components/ui/AutoRefresh'
import { MarketChart } from '@/components/MarketChart'
import { SlatePicksForm } from '@/components/player/SlatePicksForm'
import { LockCountdown } from '@/components/ui/LockCountdown'

export default async function LeaderboardPage() {
  const supabase = await createClient()
  const [bz, { data: { user } }] = await Promise.all([
    getActive(),
    supabase.auth.getUser(),
  ])

  if (!bz) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-2xl">🏈</p>
        <p className="mt-2 text-muted">No active Betstravaganza yet.</p>
        <p className="text-sm text-muted">Ask the admin to set one up.</p>
      </div>
    )
  }

  const revealed = !!(bz as any).revealed

  // Check if current user is admin
  let isAdmin = false
  if (user) {
    const { data: profile } = await supabase.from('users').select('is_admin').eq('id', user.id).single()
    isAdmin = !!profile?.is_admin
  }

  // ── Hidden state: show slate picks for non-admins ──────────────────────────
  if (!revealed && !isAdmin) {
    const [{ data: slateGamesData }, { data: slatePicksData }] = await Promise.all([
      supabase.from('slate_games').select('*').eq('betstravaganza_id', bz.id).order('start_time_et'),
      user
        ? supabase.from('slate_picks').select('*').eq('betstravaganza_id', bz.id).eq('user_id', user.id)
        : Promise.resolve({ data: [] }),
    ])

    const slateGames = slateGamesData ?? []
    const myPicks = slatePicksData ?? []
    const isLocked = !!(bz as any).start_datetime && new Date() > new Date((bz as any).start_datetime)
    const confidenceMultiplier = Number(bz.confidence_multiplier)
    const totalGames = slateGames.length

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-white">Slate</h1>
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

        {/* Before lock: editable form */}
        {!isLocked && user && slateGames.length > 0 && (() => {
          const allSaved = myPicks.length === totalGames
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
                confidenceMultiplier={confidenceMultiplier}
                revealed={false}
              />
            </Card>
          )
        })()}

        {/* After lock: compact own read-only view */}
        {isLocked && user && slateGames.length > 0 && (
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
                      return (
                        <div key={sp.id} className="flex items-center gap-3 px-4 py-2.5">
                          <span className="w-5 text-right font-mono text-xs font-bold text-accent-2">
                            #{totalGames - sp.confidence_rank + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-white">{pickedTeam}</div>
                            <div className="text-xs text-muted">{game.away_team} @ {game.home_team}</div>
                          </div>
                          <div className="text-xs text-muted">pending</div>
                        </div>
                      )
                    })}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Revealed state (or admin): show the leaderboard ───────────────────────
  const [entries, marketHistory] = await Promise.all([
    getLeaderboard(bz.id),
    getMarketHistory(bz.id),
  ])

  const hasRankChanges = entries.some(e => e.rankChange != null && e.rankChange !== 0)

  return (
    <div className="space-y-4">
      <AutoRefresh intervalMs={30_000} />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">{bz.name}</h1>
        <Badge variant={bz.status === 'active' ? 'win' : 'default'}>
          {bz.status.toUpperCase()}
        </Badge>
      </div>

      {hasRankChanges && (
        <div className="flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-sm text-accent">
          <span className="text-base">↑↓</span>
          <span className="font-semibold">Standings just updated</span>
          <span className="text-muted text-xs">— rankings shifted in the last few minutes</span>
        </div>
      )}

      <div className="space-y-2">
        {entries.length === 0 && (
          <Card><p className="text-muted text-sm text-center py-4">Draft hasn't started yet.</p></Card>
        )}
        {entries.map((e, i) => {
          const startingBankroll = Number(bz.starting_bankroll)
          const isProfit = e.total >= startingBankroll
          const draftDelta = e.bankroll - startingBankroll
          return (
            <Link key={e.userId} href={`/picks?user=${e.userId}`} className="block">
              <Card className="hover:border-accent/40 transition-colors p-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 shrink-0 text-center">
                    <div className="text-base leading-none">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="font-mono text-sm text-muted">{i + 1}</span>}
                    </div>
                    {e.rankChange != null && e.rankChange > 0 && (
                      <div className="text-win text-xs font-bold mt-0.5">↑{e.rankChange}</div>
                    )}
                    {e.rankChange != null && e.rankChange < 0 && (
                      <div className="text-loss text-xs font-bold mt-0.5">↓{Math.abs(e.rankChange)}</div>
                    )}
                  </div>

                  <BirdAvatar teamName={e.teamName} size={40} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white leading-tight truncate">{e.teamName}</div>
                    <div className="text-xs text-muted truncate">{e.name}</div>
                    {e.motto && <div className="text-xs text-accent/70 italic truncate">"{e.motto}"</div>}
                    <div className="flex items-center gap-3 mt-1 flex-wrap text-xs">
                      <span className="font-mono text-muted">
                        <span className="text-win">{e.wins}</span>
                        <span>-</span>
                        <span className="text-loss">{e.losses}</span>
                        <span>-</span>
                        <span className="text-push">{e.pushes}</span>
                        {e.pendingPicks > 0 && <span> · {e.pendingPicks} live</span>}
                      </span>
                      <span className="text-muted">
                        Picks: <span className={`font-mono ${draftDelta > 0 ? 'text-win' : draftDelta < 0 ? 'text-loss' : 'text-muted'}`}>
                          {draftDelta >= 0 ? '+' : ''}${draftDelta.toFixed(0)}
                        </span>
                      </span>
                      <span className="text-muted">
                        Slate: <span className={`font-mono ${e.confidenceBonus > 0 ? 'text-accent-2' : 'text-muted'}`}>
                          {e.confidenceBonus > 0 ? `+$${e.confidenceBonus}` : '—'}
                        </span>
                      </span>
                      <span className="text-muted">
                        Bonus: <span className={`font-mono ${e.bonuses > 0 ? 'text-win' : 'text-muted'}`}>
                          {e.bonuses > 0 ? `+$${e.bonuses}` : '—'}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className={`text-lg font-bold font-mono ${isProfit ? 'text-win' : 'text-loss'}`}>
                      ${e.total.toFixed(0)}
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          )
        })}
      </div>

      <p className="text-center text-xs text-muted">
        Starting bankroll: ${Number(bz.starting_bankroll).toLocaleString()} · ${Number(bz.stake_amount)} per pick
      </p>

      {marketHistory.steps.length >= 2 && (
        <Card className="space-y-2">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider">Bankroll Chart</h2>
          <MarketChart {...marketHistory} hideTeamFilter />
        </Card>
      )}
    </div>
  )
}
