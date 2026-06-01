'use client'

import { useState, useEffect } from 'react'

function timeUntil(lockTime: string): string {
  const diff = new Date(lockTime).getTime() - Date.now()
  if (diff <= 0) return 'Locked'
  const totalSec = Math.floor(diff / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

export function LockCountdown({ lockTime }: { lockTime: string }) {
  const [label, setLabel] = useState(() => timeUntil(lockTime))

  useEffect(() => {
    const tick = () => setLabel(timeUntil(lockTime))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [lockTime])

  const isUrgent = new Date(lockTime).getTime() - Date.now() < 5 * 60 * 1000

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold font-mono ${
      isUrgent
        ? 'border-loss/40 bg-loss/10 text-loss'
        : 'border-accent-2/30 bg-accent-2/5 text-accent-2'
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${isUrgent ? 'bg-loss animate-pulse' : 'bg-accent-2'}`} />
      Locks in {label}
    </span>
  )
}
