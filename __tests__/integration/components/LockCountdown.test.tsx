import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { LockCountdown } from '@/components/ui/LockCountdown'

describe('LockCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows "Locked" when lock time is in the past', () => {
    const past = new Date(Date.now() - 10_000).toISOString()
    render(<LockCountdown lockTime={past} />)
    expect(screen.getByText(/Locks in Locked/)).toBeInTheDocument()
  })

  it('shows hours and minutes for a distant future time', () => {
    const future = new Date(Date.now() + 2 * 3600_000 + 30 * 60_000).toISOString()
    render(<LockCountdown lockTime={future} />)
    expect(screen.getByText(/Locks in 2h 30m/)).toBeInTheDocument()
  })

  it('shows minutes and seconds for a near future time', () => {
    const future = new Date(Date.now() + 3 * 60_000 + 45_000).toISOString()
    render(<LockCountdown lockTime={future} />)
    expect(screen.getByText(/Locks in 3m 45s/)).toBeInTheDocument()
  })

  it('shows only seconds for very soon', () => {
    const future = new Date(Date.now() + 42_000).toISOString()
    render(<LockCountdown lockTime={future} />)
    expect(screen.getByText(/Locks in 42s/)).toBeInTheDocument()
  })

  it('applies urgent styling when under 5 minutes', () => {
    const future = new Date(Date.now() + 3 * 60_000).toISOString()
    const { container } = render(<LockCountdown lockTime={future} />)
    const span = container.querySelector('span')!
    expect(span.className).toContain('text-loss')
  })

  it('applies normal styling when more than 5 minutes remain', () => {
    const future = new Date(Date.now() + 10 * 60_000).toISOString()
    const { container } = render(<LockCountdown lockTime={future} />)
    const span = container.querySelector('span')!
    expect(span.className).toContain('text-accent-2')
  })

  it('ticks down every second', () => {
    const future = new Date(Date.now() + 65_000).toISOString()
    render(<LockCountdown lockTime={future} />)
    expect(screen.getByText(/Locks in 1m 5s/)).toBeInTheDocument()

    act(() => { vi.advanceTimersByTime(5_000) })
    expect(screen.getByText(/Locks in 1m 0s/)).toBeInTheDocument()
  })
})
