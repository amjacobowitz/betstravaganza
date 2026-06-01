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

  return (
    <div className="space-y-4">
      <AutoRefresh intervalMs={30_000} />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">{bz.name}</h1>
        <Badge variant={bz.status === 'active' ? 'win' : 'default'}>
          {bz.status.toUpperCase()}
        </Badge>
      </div>

      {/* Leaderboard table */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left text-xs uppercase tracking-wider text-muted">
                <th className="px-4 py-3 w-10">#</th>
                <th className="px-4 py-3">Team</th>
                <th className="px-4 py-3 text-right">W-L-P</th>
                <th className="px-4 py-3 text-right">Draft</th>
                <th className="px-4 py-3 text-right">Slate</th>
                <th className="px-4 py-3 text-right">Bonus</th>
                <th className="px-4 py-3 text-right font-bold text-white">Total</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const startingBankroll = Number(bz.starting_bankroll)
                const isProfit = e.total >= startingBankroll
                return (
                  <tr key={e.userId} className="border-b border-border/50 hover:bg-surface-2/50 transition-colors">
                    <td className="px-4 py-3 font-mono">
                      <div className="flex items-center gap-1">
                        <span className="text-muted">
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                        </span>
                        {e.rankChange != null && e.rankChange > 0 && (
                          <span className="text-win text-xs font-bold">↑{e.rankChange}</span>
                        )}
                        {e.rankChange != null && e.rankChange < 0 && (
                          <span className="text-loss text-xs font-bold">↓{Math.abs(e.rankChange)}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/picks?user=${e.userId}`} className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
                        <BirdAvatar teamName={e.teamName} size={36} />
                        <div>
                          <div className="font-semibold text-white">{e.teamName}</div>
                          <div className="text-xs text-muted">{e.name}</div>
                          {e.motto && <div className="text-xs text-accent/70 italic">"{e.motto}"</div>}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      <span className="text-win">{e.wins}</span>
                      <span className="text-muted">-</span>
                      <span className="text-loss">{e.losses}</span>
                      <span className="text-muted">-</span>
                      <span className="text-push">{e.pushes}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(() => {
                        const draftDelta = e.bankroll - startingBankroll
                        return (
                          <span className={`font-mono text-sm ${draftDelta > 0 ? 'text-win' : draftDelta < 0 ? 'text-loss' : 'text-muted'}`}>
                            {draftDelta >= 0 ? '+' : ''}${draftDelta.toFixed(0)}
                          </span>
                        )
                      })()}
                      {e.pendingPicks > 0 && (
                        <div className="text-xs text-muted">{e.pendingPicks} pending</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-accent-2">
                      {e.confidenceBonus > 0 ? `+$${e.confidenceBonus}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-win">
                      {e.bonuses > 0 ? `+$${e.bonuses}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-bold font-mono text-base ${isProfit ? 'text-win' : 'text-loss'}`}>
                        ${e.total.toFixed(0)}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted">
                    Draft hasn't started yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

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
