'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'

interface BetOption {
  id: string
  label: string
  odds: number | null
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

interface Props {
  bzName: string
  events: Event[]
  slateGames: SlateGame[]
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

function printDraftSheet(bzName: string, events: Event[]) {
  const required = events.filter(e => e.category === 'required')
  const optional = events.filter(e => e.category === 'optional')

  const sortedRequired = required.map(e => ({
    event: e,
    options: [...e.bet_options].sort((a, b) => {
      if (a.odds === null && b.odds === null) return 0
      if (a.odds === null) return 1
      if (b.odds === null) return -1
      return a.odds - b.odds
    }),
  }))

  const sortedOptional = optional.map(e => ({
    event: e,
    options: [...e.bet_options].sort((a, b) => {
      if (a.odds === null && b.odds === null) return 0
      if (a.odds === null) return 1
      if (b.odds === null) return -1
      return a.odds - b.odds
    }),
  }))

  const html = `<!DOCTYPE html>
<html>
<head>
<title>${bzName} - Draft Sheet</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; color: #000; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  h2 { font-size: 14px; margin: 16px 0 6px; border-bottom: 2px solid #333; padding-bottom: 2px; }
  h3 { font-size: 12px; margin: 10px 0 4px; font-weight: bold; color: #333; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; color: #666; border-bottom: 1px solid #ccc; padding: 2px 4px; }
  td { padding: 3px 4px; border-bottom: 1px solid #eee; }
  .odds { font-family: monospace; font-weight: bold; }
  .required-badge { background: #e3f2fd; color: #1565c0; padding: 1px 4px; border-radius: 2px; font-size: 9px; font-weight: bold; }
  .section { page-break-inside: avoid; }
  @media print { body { margin: 10px; } }
</style>
</head>
<body>
<h1>${bzName}</h1>
<p style="color:#666; margin-bottom:16px">Draft Sheet — Snake Draft Format</p>

<div class="section">
<h2>REQUIRED PICKS <span style="font-size:11px;font-weight:normal;color:#666">(must pick one per category)</span></h2>
${sortedRequired.map(({ event, options }) => `
<h3>${event.name} <span style="font-weight:normal;color:#666">· ${event.sport}</span></h3>
<table>
<thead><tr><th>Pick</th><th>Odds</th><th>Max</th></tr></thead>
<tbody>
${options.map(o => `<tr>
  <td>${o.label}</td>
  <td class="odds">${formatOdds(o.odds)}</td>
  <td style="color:#999">${(o as any).max_drafts > 1 ? `max ${(o as any).max_drafts}` : ''}</td>
</tr>`).join('')}
</tbody>
</table>
`).join('')}
</div>

<div class="section">
<h2>OPTIONAL PICKS <span style="font-size:11px;font-weight:normal;color:#666">(2 must be Clashes)</span></h2>
${sortedOptional.map(({ event, options }) => `
<h3>${event.name} <span style="font-weight:normal;color:#666">· ${event.sport} · ${event.bet_type.replace('_',' ')}</span></h3>
<table>
<thead><tr><th>Pick</th><th>Odds</th><th>Max</th></tr></thead>
<tbody>
${options.map(o => `<tr>
  <td>${o.label}</td>
  <td class="odds">${formatOdds(o.odds)}</td>
  <td style="color:#999">${(o as any).max_drafts > 1 ? `max ${(o as any).max_drafts}` : ''}</td>
</tr>`).join('')}
</tbody>
</table>
`).join('')}
</div>
</body></html>`

  const w = window.open('', '_blank')
  if (w) {
    w.document.write(html)
    w.document.close()
    w.print()
  }
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
  body { font-family: Arial, sans-serif; font-size: 11px; margin: 20px; color: #000; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; color: #666; border-bottom: 2px solid #333; padding: 4px 6px; }
  td { padding: 4px 6px; border-bottom: 1px solid #eee; vertical-align: top; }
  .time { font-family: monospace; font-weight: bold; white-space: nowrap; }
  .tag { font-size: 9px; font-weight: bold; padding: 1px 4px; border-radius: 2px; }
  .tag-required { background: #e3f2fd; color: #1565c0; }
  .tag-optional { background: #f3e5f5; color: #6a1b9a; }
  .tag-slate { background: #e8f5e9; color: #2e7d32; }
  @media print { body { margin: 10px; } }
</style>
</head>
<body>
<h1>${bzName} — Event Schedule</h1>
<p style="color:#666;margin-bottom:12px">All times ET · Saturday June 6, 2026</p>
<table>
<thead><tr><th>Time</th><th>Event</th><th>Sport</th><th>Streaming / Notes</th></tr></thead>
<tbody>
${allItems.map(item => `<tr>
  <td class="time">${formatTime(item.time)}</td>
  <td>
    <span>${item.name}</span>
    <span class="tag tag-${item.tag.toLowerCase()}" style="margin-left:6px">${item.tag}</span>
  </td>
  <td style="color:#666">${item.sport}</td>
  <td style="color:#555">${item.streaming ?? ''}</td>
</tr>`).join('')}
</tbody>
</table>
</body></html>`

  const w = window.open('', '_blank')
  if (w) {
    w.document.write(html)
    w.document.close()
    w.print()
  }
}

export function PrintPDFs({ bzName, events, slateGames }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-6 space-y-3">
          <div>
            <h2 className="font-bold text-white">Draft Sheet</h2>
            <p className="text-sm text-muted mt-1">
              Required picks sorted by odds, then optional picks sorted by odds.
              Event name, bet label, and odds only — no times.
            </p>
          </div>
          <Button
            variant="secondary"
            onClick={() => printDraftSheet(bzName, events)}
            className="w-full"
          >
            🖨️ Print Draft Sheet
          </Button>
        </div>

        <div className="rounded-xl border border-border bg-surface p-6 space-y-3">
          <div>
            <h2 className="font-bold text-white">Event Schedule</h2>
            <p className="text-sm text-muted mt-1">
              Chronological list of all events and slate games with
              streaming info and sport.
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
