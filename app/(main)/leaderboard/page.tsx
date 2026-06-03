import Link from 'next/link'
import { requireRevealed } from '@/lib/auth/requireRevealed'
import { getActive } from '@/lib/db/betstravaganza'
import { getLeaderboard } from '@/lib/db/leaderboard'
import { getMarketHistory } from '@/lib/db/market'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { BirdAvatar } from '@/components/ui/BirdAvatar'
import { AutoRefresh } from '@/components/ui/AutoRefresh'
import { MarketChart } from '@/components/MarketChart'


export default async function LeaderboardPage() {
  await requireRevealed()
  const bz = await getActive()
  if (!bz) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <p className="text-2xl">🏈</p>
        <p className="mt-2 text-muted">No active Betstravaganza yet.</p>
        <p className="text-sm text-muted">Ask the admin to set one up.</p>
      </div>
    )
  }

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

      {/* Leaderboard cards */}
      <div className="space-y-2">
        {entries.length === 0 && (
          <Card><p className="text-muted text-sm text-center py-4">Draft hasn't started yet.</p></Card>
        )}
        {entries.map((e, i) => {
          const startingBankroll = Number(bz.starting_bankroll)
          const isProfit = e.total >= startingBankroll
          return (
            <Link key={e.userId} href={`/picks?user=${e.userId}`} className="block">
              <Card className="hover:border-accent/40 transition-colors p-3">
                <div className="flex items-center gap-3">
                  {/* Rank */}
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

                  {/* Avatar + name */}
                  <BirdAvatar teamName={e.teamName} size={40} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white leading-tight truncate">{e.teamName}</div>
                    <div className="text-xs text-muted truncate">{e.name}</div>
                    {e.motto && <div className="text-xs text-accent/70 italic truncate">"{e.motto}"</div>}
                    {/* Breakdown row */}
                    <div className="flex items-center gap-2.5 mt-1 flex-wrap">
                      <span className="text-xs font-mono">
                        <span className="text-win">{e.wins}</span>
                        <span className="text-muted">-</span>
                        <span className="text-loss">{e.losses}</span>
                        <span className="text-muted">-</span>
                        <span className="text-push">{e.pushes}</span>
                        {e.pendingPicks > 0 && <span className="text-muted"> · {e.pendingPicks} live</span>}
                      </span>
                      {e.confidenceBonus > 0 && (
                        <span className="text-xs font-mono text-accent-2">+${e.confidenceBonus} slate</span>
                      )}
                      {e.bonuses > 0 && (
                        <span className="text-xs font-mono text-win">+${e.bonuses} bonus</span>
                      )}
                    </div>
                  </div>

                  {/* Total */}
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
