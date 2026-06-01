'use client'

import { useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import type { MarketHistoryData } from '@/lib/db/market'

function SortedTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const sorted = [...payload]
    .filter(p => p.value != null)
    .sort((a, b) => b.value - a.value)
  return (
    <div style={{
      background: '#17213d', border: '1px solid #2a3d5f',
      borderRadius: 8, fontSize: 12, padding: '8px 12px',
    }}>
      <p style={{ color: '#8fa5c6', marginBottom: 6 }}>{label}</p>
      {sorted.map((p, i) => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, marginBottom: i < sorted.length - 1 ? 2 : 0 }}>
          <span style={{ color: p.color }}>{i + 1}. {p.name}</span>
          <span style={{ color: '#c8d8ee', fontVariantNumeric: 'tabular-nums' }}>${Number(p.value).toFixed(0)}</span>
        </div>
      ))}
    </div>
  )
}

export const MARKET_COLORS = [
  '#1493ff', '#2dcf6e', '#f5c518', '#f97316',
  '#c084fc', '#fb7185', '#34d399', '#60a5fa',
  '#fbbf24', '#a78bfa',
]

interface Props extends MarketHistoryData {
  singleUserId?: string
  hideTeamFilter?: boolean
}

export function MarketChart({ steps, users, startingBankroll, singleUserId, hideTeamFilter }: Props) {
  const [showSlate, setShowSlate] = useState(true)
  const [visibleUsers, setVisibleUsers] = useState<Set<string>>(
    () => new Set(users.map(u => u.userId))
  )

  const filteredSteps = showSlate ? steps : steps.filter(s => s.type !== 'slate')
  const displayUsers = singleUserId
    ? users.filter(u => u.userId === singleUserId)
    : users.filter(u => visibleUsers.has(u.userId))

  if (filteredSteps.length < 2) return null

  const data = filteredSteps.map(s => {
    const row: Record<string, any> = { label: s.label }
    for (const u of displayUsers) row[u.teamName] = s.totals[u.userId] ?? null
    return row
  })

  const allValues = filteredSteps.flatMap(s =>
    displayUsers.map(u => s.totals[u.userId] ?? startingBankroll)
  )
  const yMin = Math.min(startingBankroll, ...allValues)
  const yMax = Math.max(startingBankroll, ...allValues)
  const pad = Math.max((yMax - yMin) * 0.12, 50)

  // 80px per step, minimum 600
  const minWidth = Math.max(600, filteredSteps.length * 80)

  return (
    <div className="space-y-3">
      {!singleUserId && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowSlate(s => !s)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors border ${
              showSlate
                ? 'bg-accent/15 border-accent/40 text-accent'
                : 'bg-surface-2 border-border text-muted'
            }`}
          >
            🏟 Slate
          </button>
          {!hideTeamFilter && users.map((u, i) => (
            <button
              key={u.userId}
              onClick={() => {
                setVisibleUsers(prev => {
                  const next = new Set(prev)
                  if (next.has(u.userId)) next.delete(u.userId)
                  else next.add(u.userId)
                  return next
                })
              }}
              className="rounded-full px-3 py-1 text-xs font-semibold transition-colors border"
              style={visibleUsers.has(u.userId) ? {
                background: `${MARKET_COLORS[i % MARKET_COLORS.length]}22`,
                borderColor: `${MARKET_COLORS[i % MARKET_COLORS.length]}66`,
                color: MARKET_COLORS[i % MARKET_COLORS.length],
              } : {
                background: 'var(--surface-2)',
                borderColor: 'var(--border)',
                color: 'var(--text-muted)',
              }}
            >
              {u.teamName}
            </button>
          ))}
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth, height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 24, bottom: 48, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a3d5f" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#8fa5c6', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: '#2a3d5f' }}
                angle={-45}
                textAnchor="end"
                interval={0}
              />
              <YAxis
                tick={{ fill: '#8fa5c6', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={v => `$${v}`}
                domain={[Math.floor(yMin - pad), Math.ceil(yMax + pad)]}
                width={60}
              />
              <ReferenceLine
                y={startingBankroll}
                stroke="#8fa5c6"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
              />
              <Tooltip content={<SortedTooltip />} />
              {!singleUserId && (
                <Legend
                  verticalAlign="top"
                  wrapperStyle={{ paddingBottom: 8, fontSize: 12 }}
                  formatter={value => <span style={{ color: '#c8d8ee' }}>{value}</span>}
                />
              )}
              {displayUsers.map(u => {
                const colorIdx = users.findIndex(x => x.userId === u.userId)
                return (
                  <Line
                    key={u.userId}
                    type="monotone"
                    dataKey={u.teamName}
                    stroke={MARKET_COLORS[colorIdx % MARKET_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                  />
                )
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
