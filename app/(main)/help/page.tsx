import { requireRevealed } from '@/lib/auth/requireRevealed'
import { getActive } from '@/lib/db/betstravaganza'
import { Card } from '@/components/ui/Card'

export default async function HelpPage() {
  await requireRevealed()
  const bz = await getActive()

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">How to Play</h1>
        <p className="text-sm text-muted mt-1">Everything you need to know about Betstravaganza</p>
      </div>

      <Card className="space-y-4">
        <h2 className="text-base font-bold text-accent uppercase tracking-wider">The Big Picture</h2>
        <p className="text-sm text-muted/90 leading-relaxed">
          Betstravaganza is a fantasy-sports-style game where everyone starts with the same bankroll and picks sides on real sporting events. Pick correctly and win money; pick wrong and lose it. The player with the most money at the end wins.
        </p>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-base font-bold text-accent uppercase tracking-wider">The Draft</h2>
        <div className="space-y-3 text-sm text-muted/90 leading-relaxed">
          <p>
            Everyone drafts a set of picks via a <strong className="text-white">snake draft</strong> — players take turns in order, then the order reverses each round. You get {bz?.round_count ?? 11} total picks.
          </p>
          <ul className="space-y-2 list-none">
            <li className="flex gap-2">
              <span className="text-accent font-bold shrink-0">REQ</span>
              <span><strong className="text-white">Required picks</strong> must be taken at some point. If you&apos;re running out of rounds and still have required picks left, the draft will force you to take them first.</span>
            </li>
            <li className="flex gap-2">
              <span className="text-clash font-bold shrink-0">⚔️</span>
              <span><strong className="text-white">Clash picks</strong> happen when you pick the opposing side of an event someone else already has. Clashes are encouraged — you need at least 2. If you haven&apos;t gotten enough clashes and rounds are running out, the draft will steer you toward clash opportunities.</span>
            </li>
          </ul>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-base font-bold text-accent uppercase tracking-wider">Scoring</h2>
        <div className="space-y-3 text-sm text-muted/90 leading-relaxed">
          <p>
            Each pick stakes a fixed dollar amount. Win and your bankroll goes up; lose and it goes down. Some events use <strong className="text-white">straight odds</strong> (just pick the winner), others use a <strong className="text-white">spread</strong> (you need to win by a margin).
          </p>
          <p>
            <strong className="text-white">Slate picks</strong> are a separate bonus game on top of the draft. You rank every game in a daily slate by confidence — the game you&apos;re most confident about goes #1, least confident goes last. A correct pick earns you <strong className="text-white">rank × multiplier</strong> dollars as a bonus. You can change your order right up until the slate locks.
          </p>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-base font-bold text-accent uppercase tracking-wider">Leaderboard</h2>
        <p className="text-sm text-muted/90 leading-relaxed">
          Standings update automatically as results come in. The <strong className="text-white">Draft</strong> column shows your pick P&amp;L from the draft. <strong className="text-white">Slate</strong> shows your confidence-pick bonus. <strong className="text-white">Total</strong> is your overall bankroll.
          The ↑↓ arrows on the leaderboard show how ranks shifted when results just posted.
        </p>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-base font-bold text-accent uppercase tracking-wider">The Picks Page</h2>
        <p className="text-sm text-muted/90 leading-relaxed">
          Your <strong className="text-white">Picks</strong> page shows your full portfolio — every draft pick, the slate confidence ranking, and a clash tracker for any events where you and another player are on opposite sides. You can browse anyone else&apos;s picks using the Others tab.
        </p>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-base font-bold text-accent uppercase tracking-wider">Tips</h2>
        <ul className="space-y-2 text-sm text-muted/90">
          <li>• Get your 2 clashes early — late-draft clash opportunities can dry up.</li>
          <li>• Required picks are guaranteed to be available (no cap on picks), so you can leave them for later.</li>
          <li>• Slate picks are low-stakes but meaningful — even a partial submission scores bonus money.</li>
          <li>• Use the Schedule page to see who has what and spot clash targets.</li>
        </ul>
      </Card>
    </div>
  )
}
