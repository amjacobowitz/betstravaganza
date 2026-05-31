'use client'

import { Button } from '@/components/ui/Button'

interface BetOption {
  id: string
  label: string
  odds: number | null
  max_drafts?: number
}

interface Event {
  id: string
  name: string
  sport: string
  category: string
  bet_type: string
  start_time_et: string | null
  streaming_info: string | null
  bet_options: BetOption[]
}

interface SlateGame {
  id: string
  away_team: string
  home_team: string
  sport_label: string
  start_time_et: string
  spread: number | null
  notes: string | null
}

interface DraftPick {
  bet_option_id: string
  user_id: string
}

interface User {
  id: string
  name: string
  team_name: string
}

interface Props {
  bzName: string
  events: Event[]
  slateGames: SlateGame[]
  draftPicks?: DraftPick[]
  users?: User[]
}

function formatOdds(odds: number | null) {
  if (odds === null) return '—'
  return odds > 0 ? `+${odds}` : `${odds}`
}

function formatTime(iso: string | null) {
  if (!iso) return 'TBD'
  return new Date(iso).toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

function printDraftSheet(bzName: string, events: Event[], draftPicks: DraftPick[], users: User[]) {
  const required = events.filter(e => e.category === 'required')
  const optional = events.filter(e => e.category === 'optional')

  const pickedBy = (optionId: string): string => {
    const picks = draftPicks.filter(p => p.bet_option_id === optionId)
    if (picks.length === 0) return ''
    return picks.map(p => users.find(u => u.id === p.user_id)?.team_name ?? '?').join(', ')
  }

  const isDrafted = (optionId: string) => draftPicks.some(p => p.bet_option_id === optionId)

  const sortByOdds = (options: BetOption[]) =>
    [...options].sort((a, b) => {
      if (a.odds === null && b.odds === null) return 0
      if (a.odds === null) return 1
      if (b.odds === null) return -1
      return a.odds - b.odds
    })

  const eventRows = (e: Event) =>
    sortByOdds(e.bet_options).map(o => {
      const drafted = isDrafted(o.id)
      const by = pickedBy(o.id)
      const notesVal = e.sport === 'Horse Racing' && (o.max_drafts ?? 1) > 1 ? `max ${o.max_drafts}` : ''
      return `<tr style="${drafted ? 'background:#f0fdf4' : ''}">
  <td style="text-align:center;width:24px"><input type="checkbox" ${drafted ? 'checked' : ''}></td>
  <td>${o.label}</td>
  <td class="odds">${formatOdds(o.odds)}</td>
  <td style="color:#555;font-size:10px;padding-right:12px">${by}</td>
  <td style="color:#999;font-size:10px">${notesVal}</td>
</tr>`
    }).join('')

  const html = `<!DOCTYPE html>
<html>
<head>
<title>${bzName} - Draft Sheet</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; margin: 16px 20px; color: #000; }
  h1 { font-size: 17px; margin: 0 0 2px; }
  .sub { color: #666; font-size: 10px; margin-bottom: 14px; }
  h2 { font-size: 13px; margin: 14px 0 5px; border-bottom: 2px solid #333; padding-bottom: 2px; }
  h3 { font-size: 11px; margin: 9px 0 3px; font-weight: bold; color: #222; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 6px; table-layout: fixed; }
  col.col-check { width: 26px; }
  col.col-pick   { width: auto; }
  col.col-odds   { width: 48px; }
  col.col-by     { width: 160px; }
  col.col-notes  { width: 50px; }
  th { text-align: left; font-size: 9px; text-transform: uppercase; color: #888;
       border-bottom: 1px solid #ccc; padding: 2px 4px; }
  th.center { text-align: center; }
  td { padding: 3px 4px; border-bottom: 1px solid #eee; vertical-align: middle; }
  .odds { font-family: monospace; font-weight: bold; }
  .section { page-break-inside: avoid; }
  @media print { body { margin: 8px 12px; } input[type=checkbox] { accent-color: #16a34a; } }
</style>
</head>
<body>
<h1>${bzName}</h1>
<div class="sub">Draft Sheet — Snake Draft · ${new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>

<div class="section">
<h2>REQUIRED PICKS <span style="font-size:10px;font-weight:normal;color:#666">(must pick one per event)</span></h2>
${required.map(e => `
<h3>${e.name} <span style="font-weight:normal;color:#777">· ${e.sport}</span></h3>
<table>
<colgroup><col class="col-check"><col class="col-pick"><col class="col-odds"><col class="col-by"><col class="col-notes"></colgroup>
<thead><tr>
  <th class="center">✓</th>
  <th>Pick</th>
  <th>Odds</th>
  <th>Drafted By</th>
  <th>Notes</th>
</tr></thead>
<tbody>${eventRows(e)}</tbody>
</table>`).join('')}
</div>

<div class="section">
<h2>OPTIONAL PICKS <span style="font-size:10px;font-weight:normal;color:#666">(2 must be Clashes — pick opposing side)</span></h2>
${optional.map(e => `
<h3>${e.name} <span style="font-weight:normal;color:#777">· ${e.sport} · ${e.bet_type.replace('_',' ')}</span></h3>
<table>
<colgroup><col class="col-check"><col class="col-pick"><col class="col-odds"><col class="col-by"><col class="col-notes"></colgroup>
<thead><tr>
  <th class="center">✓</th>
  <th>Pick</th>
  <th>Odds</th>
  <th>Drafted By</th>
  <th>Notes</th>
</tr></thead>
<tbody>${eventRows(e)}</tbody>
</table>`).join('')}
</div>
</body></html>`

  const w = window.open('', '_blank')
  if (w) { w.document.write(html); w.document.close(); w.print() }
}

function printSchedule(bzName: string, events: Event[], slateGames: SlateGame[]) {
  const allItems = [
    ...events.map(e => ({
      time: e.start_time_et,
      name: e.name,
      sport: e.sport,
      streaming: e.streaming_info,
      tag: e.category === 'required' ? 'REQUIRED' : 'OPTIONAL',
    })),
    ...slateGames.map(g => ({
      time: g.start_time_et,
      name: `${g.away_team} @ ${g.home_team}`,
      sport: g.sport_label,
      streaming: g.notes,
      tag: 'SLATE',
    })),
  ].sort((a, b) => {
    if (!a.time) return 1
    if (!b.time) return -1
    return new Date(a.time).getTime() - new Date(b.time).getTime()
  })

  const html = `<!DOCTYPE html>
<html>
<head>
<title>${bzName} - Schedule</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; margin: 16px 20px; color: #000; }
  h1 { font-size: 17px; margin: 0 0 2px; }
  .sub { color: #666; font-size: 10px; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  col.col-time { width: 68px; }
  col.col-event { width: auto; }
  col.col-sport { width: 80px; }
  col.col-stream { width: 130px; }
  th { text-align: left; font-size: 9px; text-transform: uppercase; color: #888;
       border-bottom: 2px solid #333; padding: 3px 6px; }
  td { padding: 4px 6px; border-bottom: 1px solid #eee; vertical-align: top; }
  .time { font-family: monospace; font-weight: bold; white-space: nowrap; }
  .tag { font-size: 9px; font-weight: bold; padding: 1px 4px; border-radius: 2px; margin-left: 5px; white-space: nowrap; }
  .tag-required { background: #dbeafe; color: #1d4ed8; }
  .tag-optional { background: #f3e8ff; color: #7e22ce; }
  .tag-slate    { background: #dcfce7; color: #15803d; }
  @media print { body { margin: 8px 12px; } }
</style>
</head>
<body>
<h1>${bzName} — Event Schedule</h1>
<div class="sub">All times ET · Saturday June 6, 2026</div>
<table>
<colgroup><col class="col-time"><col class="col-event"><col class="col-sport"><col class="col-stream"></colgroup>
<thead><tr><th>Time ET</th><th>Event</th><th>Sport</th><th>Streaming / Notes</th></tr></thead>
<tbody>
${allItems.map(item => `<tr>
  <td class="time">${formatTime(item.time)}</td>
  <td><span>${item.name}</span><span class="tag tag-${item.tag.toLowerCase()}">${item.tag}</span></td>
  <td style="color:#666">${item.sport}</td>
  <td style="color:#555;font-size:10px">${item.streaming ?? ''}</td>
</tr>`).join('')}
</tbody>
</table>
</body></html>`

  const w = window.open('', '_blank')
  if (w) { w.document.write(html); w.document.close(); w.print() }
}

export function PrintPDFs({ bzName, events, slateGames, draftPicks = [], users = [] }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-6 space-y-3">
          <div>
            <h2 className="font-bold text-white">Draft Sheet</h2>
            <p className="text-sm text-muted mt-1">
              Required + optional picks sorted by odds. Includes odds, drafted-by column, and drafted checkboxes.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => printDraftSheet(bzName, events, draftPicks, users)}
            className="w-full"
          >
            🖨️ Print Draft Sheet
          </Button>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6 space-y-3">
          <div>
            <h2 className="font-bold text-white">Event Schedule</h2>
            <p className="text-sm text-muted mt-1">
              Chronological list of all events and slate games with streaming info and sport.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => printSchedule(bzName, events, slateGames)}
            className="w-full"
          >
            🖨️ Print Schedule
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4 text-sm text-muted">
        <p>Use your browser's print dialog to save as PDF. Chrome/Edge recommended for best formatting.</p>
      </div>
    </div>
  )
}
