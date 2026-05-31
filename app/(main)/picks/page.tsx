import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getActive } from '@/lib/db/betstravaganza'
import { createClient } from '@/lib/supabase/server'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { SlatePicksForm } from '@/components/player/SlatePicksForm'
import { TeamSelector } from '@/components/player/TeamSelector'
import { sportEmoji } from '@/lib/utils/sports'
import {
  computePlayerBankroll,
  computeConfidenceBonus,
  type DraftPick,
  type BetOption,
  type ScoringEvent,
  type EventResult,
  type SlatePick,
  type SlateResult,
} from '@/lib/scoring'

function getClashPartners(
  pick: DraftPick,
  allPicks: DraftPick[],
  betOptions: BetOption[],
  events: ScoringEvent[],
  usersById: Record<string, { team_name?: string | null; name: string }>,
): string[] {
  const event = events.find(e => e.id === pick.eventId)
  if (!event || event.category === 'required') return []
  const eventOptions = betOptions.filter(o => o.eventId === pick.eventId)
  if (eventOptions.length !== 2) return []
  const opposing = eventOptions.find(o => o.id !== pick.betOptionId)
  if (!opposing) return []
  return allPicks
    .filter(p => p.betOptionId === opposing.id && p.userId !== pick.userId)
    .map(p => usersById[p.userId]?.team_name ?? usersById[p.userId]?.name ?? '?')
    .filter((v, i, a) => a.indexOf(v) === i)
}

function formatOdds(odds: number | null) {
  if (odds === null) return '—'
  return odds > 0 ? `+${odds}` : `${odds}`
}

function formatMoney(n: number) {
  const sign = n >= 0 ? '+' : ''
  return `${sign}$${Math.abs(n).toFixed(0)}`
}

const outcomeStyles: Record<string, string> = {
  win:     'text-win',
  loss:    'text-loss',
  push:    'text-push',
  pending: 'text-muted',
}

const outcomeBadge: Record<string, string> = {
  win:     'WIN',
  loss:    'LOSS',
  push:    'PUSH',
  pending: 'PENDING',
}

export default async function PicksPage({
  searchParams,
}: {
  searchParams: Promise<{ user?: string }>
}) {
  const bz = await getActive()
  if (!bz) redirect('/leaderboard')

  const supabase = await createClient()
  const { data: { user: currentUser } } = await supabase.auth.getUser()
  if (!currentUser) redirect('/login')

  const params = await searchParams
  const viewUserId = params.user ?? currentUser.id
  const isOwnPicks = viewUserId === currentUser.id

  // Fetch all users for the team selector
  const { data: allUsersData } = await supabase
    .from('users')
    .select('id, name, team_name')
    .order('team_name')

  const allUsers = allUsersData ?? []

  // Fetch picks for the viewed user
  const [
    { data: picksData },
    { data: optionsData },
    { data: eventsData },
    { data: resultsData },
    { data: slateGamesData },
    { data: slatePicksData },
    { data: slateResultsData },
  ] = await Promise.all([
    supabase.from('draft_picks').select('*').eq('betstravaganza_id', bz.id).eq('user_id', viewUserId).order('pick_index'),
    supabase.from('bet_options').select('*'),
    supabase.from('events').select('*').eq('betstravaganza_id', bz.id),
    supabase.from('results').select('*'),
    supabase.from('slate_games').select('*').eq('betstravaganza_id', bz.id).order('start_time_et'),
    supabase.from('slate_picks').select('*').eq('betstravaganza_id', bz.id).eq('user_id', viewUserId),
    supabase.from('slate_results').select('*'),
  ])

  // Build scoring types
  const allOptions: BetOption[] = (optionsData ?? []).map((o: any) => ({
    id: o.id,
    eventId: o.event_id,
    label: o.label,
    odds: o.odds ? Number(o.odds) : null,
    maxDrafts: o.max_drafts,
    draftCount: 0,
  }))

  const allEvents: ScoringEvent[] = (eventsData ?? []).map((e: any) => ({
    id: e.id,
    name: e.name,
    category: e.category as 'required' | 'optional',
    betType: e.bet_type as 'odds' | 'spread' | 'no_odds',
  }))

  const eventSportMap: Record<string, string> = {}
  for (const e of eventsData ?? []) {
    eventSportMap[e.id] = e.sport ?? ''
  }

  const myPicks: DraftPick[] = (picksData ?? []).map((p: any) => ({
    id: p.id,
    userId: p.user_id,
    betOptionId: p.bet_option_id,
    eventId: allOptions.find(o => o.id === p.bet_option_id)?.eventId ?? '',
    roundNumber: p.round_number,
    createdAt: new Date(p.created_at),
  }))

  // We need allPicks for clash detection (not just the viewed user's)
  const { data: allPicksData } = await supabase
    .from('draft_picks')
    .select('*')
    .eq('betstravaganza_id', bz.id)

  const allPicks: DraftPick[] = (allPicksData ?? []).map((p: any) => ({
    id: p.id,
    userId: p.user_id,
    betOptionId: p.bet_option_id,
    eventId: allOptions.find(o => o.id === p.bet_option_id)?.eventId ?? '',
    roundNumber: p.round_number,
    createdAt: new Date(p.created_at),
  }))

  const scoringResults: EventResult[] = (resultsData ?? []).map((r: any) => ({
    id: r.id,
    eventId: r.event_id,
    winnerBetOptionId: r.winner_bet_option_id ?? null,
    winnerBetOptionIds: r.winner_bet_option_ids ?? [],
    homeScore: r.home_score ? Number(r.home_score) : null,
    awayScore: r.away_score ? Number(r.away_score) : null,
    resultDisplay: r.result_display ?? '',
  }))

  const mySlatePicks: SlatePick[] = (slatePicksData ?? []).map((p: any) => ({
    id: p.id,
    userId: p.user_id,
    slateGameId: p.slate_game_id,
    teamPicked: p.team_picked,
    confidenceRank: p.confidence_rank,
    submittedAt: new Date(p.submitted_at),
  }))

  const slateResults: SlateResult[] = (slateResultsData ?? []).map((r: any) => ({
    id: r.id,
    slateGameId: r.slate_game_id,
    homeScore: Number(r.home_score),
    awayScore: Number(r.away_score),
    resultDisplay: r.result_display ?? '',
  }))

  const usersById = Object.fromEntries(allUsers.map(u => [u.id, u]))

  const bankroll = computePlayerBankroll({
    picks: myPicks,
    betOptions: allOptions,
    events: allEvents,
    results: scoringResults,
    startingBankroll: Number(bz.starting_bankroll),
    stake: Number(bz.stake_amount),
  })

  const confidenceBonus = computeConfidenceBonus(mySlatePicks, slateResults)
  const grandTotal = bankroll.total + confidenceBonus
  const delta = grandTotal - Number(bz.starting_bankroll)

  const slateGames = slateGamesData ?? []

  const viewUser = allUsers.find(u => u.id === viewUserId)
  const viewTeamName = viewUser?.team_name ?? viewUser?.name ?? 'Unknown'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">Picks</h1>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Link
          href="/picks"
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            isOwnPicks ? 'bg-accent text-black' : 'bg-surface-2 text-muted hover:text-white'
          }`}
        >
          Mine
        </Link>
        <div className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
          !isOwnPicks ? 'bg-accent text-black' : 'bg-surface-2 text-muted hover:text-white'
        }`}>
          Others
        </div>
        {!isOwnPicks && (
          <TeamSelector
            users={allUsers}
            currentUserId={currentUser.id}
            selectedUserId={viewUserId}
          />
        )}
        {isOwnPicks && (
          <TeamSelector
            users={allUsers}
            currentUserId={currentUser.id}
            selectedUserId={null}
          />
        )}
      </div>

      {/* When Others tab and no user selected */}
      {!isOwnPicks && !viewUser && (
        <Card>
          <p className="text-muted text-sm text-center py-4">Select a team above to view their picks.</p>
        </Card>
      )}

      {/* Picks display */}
      {(isOwnPicks || viewUser) && (
        <>
          {/* Heading for others */}
          {!isOwnPicks && (
            <h2 className="text-xl font-bold text-white">{viewTeamName}&apos;s Picks</h2>
          )}

          {/* Bankroll summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="text-center p-3">
              <div className={`text-2xl font-bold font-mono ${delta >= 0 ? 'text-win' : 'text-loss'}`}>
                {formatMoney(delta)}
              </div>
              <div className="text-xs text-muted mt-1">Total P/L</div>
            </Card>
            <Card className="text-center p-3">
              <div className="text-2xl font-bold font-mono text-white">
                {bankroll.picks.filter(p => p.outcome === 'win').length}-{bankroll.picks.filter(p => p.outcome === 'loss').length}-{bankroll.picks.filter(p => p.outcome === 'push').length}
              </div>
              <div className="text-xs text-muted mt-1">W-L-P</div>
            </Card>
            <Card className="text-center p-3">
              <div className="text-2xl font-bold font-mono text-muted">{bankroll.pending}</div>
              <div className="text-xs text-muted mt-1">Pending</div>
            </Card>
            <Card className="text-center p-3">
              <div className="text-2xl font-bold font-mono text-accent-2">
                {confidenceBonus > 0 ? `+$${confidenceBonus}` : '—'}
              </div>
              <div className="text-xs text-muted mt-1">Slate Bonus</div>
            </Card>
          </div>

          {/* Draft picks */}
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3">Draft Picks</h2>
            {myPicks.length === 0 ? (
              <Card><p className="text-muted text-sm text-center py-4">No picks yet.</p></Card>
            ) : (
              <Card className="overflow-hidden p-0">
                <div className="divide-y divide-border/50">
                  {myPicks.map(pick => {
                    const option = allOptions.find(o => o.id === pick.betOptionId)
                    const event = allEvents.find(e => e.id === pick.eventId)
                    const pickDetail = bankroll.picks.find(p => p.pickId === pick.id)
                    const outcome = pickDetail?.outcome ?? 'pending'
                    const payout = pickDetail?.payout ?? 0
                    const clashPartners = getClashPartners(pick, allPicks, allOptions, allEvents, usersById)
                    const result = scoringResults.find(r => r.eventId === pick.eventId)

                    return (
                      <div key={pick.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-white text-sm">{option?.label}</span>
                            {event?.category === 'required' && <Badge variant="required">REQ</Badge>}
                            {clashPartners.length > 0 && (
                              <span className="text-xs font-semibold text-clash">
                                ⚔️ {clashPartners.join(', ')}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted mt-0.5">
                            {sportEmoji(eventSportMap[pick.eventId] ?? '')} {event?.name}
                            {result?.resultDisplay && ` · ${result.resultDisplay}`}
                          </div>
                        </div>
                        <div className="shrink-0 text-right space-y-0.5">
                          <div className={`text-xs font-bold ${outcomeStyles[outcome]}`}>
                            {outcomeBadge[outcome]}
                          </div>
                          <div className={`text-sm font-mono font-semibold ${payout > 0 ? 'text-win' : payout < 0 ? 'text-loss' : 'text-muted'}`}>
                            {outcome !== 'pending' ? formatMoney(payout) : formatOdds(option?.odds ?? null)}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )}
          </div>

          {/* Slate picks */}
          {slateGames.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted mb-3">
                Slate Confidence Picks
                {mySlatePicks.length === slateGames.length && (
                  <span className="ml-2 text-win">✓ Submitted</span>
                )}
              </h2>

              {/* Show existing slate results for others' picks only */}
              {!isOwnPicks && slateResults.length > 0 && mySlatePicks.length > 0 && (
                <Card className="mb-3 overflow-hidden p-0">
                  <div className="divide-y divide-border/50">
                    {[...mySlatePicks]
                      .sort((a, b) => b.confidenceRank - a.confidenceRank)
                      .map(sp => {
                        const game = slateGames.find((g: any) => g.id === sp.slateGameId) as any
                        const result = slateResults.find(r => r.slateGameId === sp.slateGameId)
                        if (!game) return null

                        const pickedTeam = sp.teamPicked === 'home' ? game.home_team : game.away_team
                        let correct: boolean | null = null
                        let bonus = 0
                        if (result) {
                          const homeWon = result.homeScore > result.awayScore
                          correct = (sp.teamPicked === 'home' && homeWon) || (sp.teamPicked === 'away' && !homeWon)
                          bonus = correct ? sp.confidenceRank * Number(bz.confidence_multiplier) : 0
                        }

                        return (
                          <div key={sp.id} className="flex items-center gap-3 px-4 py-2.5">
                            <span className="w-5 text-right font-mono text-xs font-bold text-accent-2">
                              #{slateGames.length - sp.confidenceRank + 1}
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

              {/* Show read-only slate picks for others (no form) */}
              {!isOwnPicks && mySlatePicks.length > 0 && slateResults.length === 0 && (
                <Card className="overflow-hidden p-0">
                  <div className="divide-y divide-border/50">
                    {[...mySlatePicks]
                      .sort((a, b) => b.confidenceRank - a.confidenceRank)
                      .map(sp => {
                        const game = slateGames.find((g: any) => g.id === sp.slateGameId) as any
                        if (!game) return null
                        const pickedTeam = sp.teamPicked === 'home' ? game.home_team : game.away_team
                        return (
                          <div key={sp.id} className="flex items-center gap-3 px-4 py-2.5">
                            <span className="w-5 text-right font-mono text-xs font-bold text-accent-2">
                              #{slateGames.length - sp.confidenceRank + 1}
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

              {/* Show slate form only for own picks */}
              {isOwnPicks && (
                <Card title="Submit / Update Picks">
                  <SlatePicksForm
                    betstravaganzaId={bz.id}
                    slateGames={slateGames as any}
                    existingPicks={mySlatePicks.map(sp => ({
                      slateGameId: sp.slateGameId,
                      teamPicked: sp.teamPicked,
                      confidenceRank: sp.confidenceRank,
                    }))}
                    slateLockTime={(bz as any).start_datetime ?? null}
                    confidenceMultiplier={Number(bz.confidence_multiplier)}
                  />
                </Card>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
