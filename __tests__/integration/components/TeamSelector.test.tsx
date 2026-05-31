import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const { mockPush } = vi.hoisted(() => ({
  mockPush: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
}))

import { TeamSelector } from '@/components/player/TeamSelector'

const users = [
  { id: 'u1', name: 'Alice', team_name: 'Team A' },
  { id: 'u2', name: 'Bob',   team_name: 'Team B' },
  { id: 'u3', name: 'Carol', team_name: 'Team C' },
]

describe('TeamSelector', () => {
  beforeEach(() => {
    mockPush.mockReset()
  })

  it('renders options for users excluding currentUserId', () => {
    render(<TeamSelector users={users} currentUserId="u1" selectedUserId={null} />)

    // u1 (currentUser) should be excluded
    expect(screen.queryByText(/Team A/)).not.toBeInTheDocument()
    expect(screen.getByText('Team B (Bob)')).toBeInTheDocument()
    expect(screen.getByText('Team C (Carol)')).toBeInTheDocument()
  })

  it('shows player name alongside team name in option', () => {
    render(<TeamSelector users={users} currentUserId="u1" selectedUserId={null} />)
    expect(screen.getByText('Team B (Bob)')).toBeInTheDocument()
  })

  it('shows "— Select a team —" as default option', () => {
    render(<TeamSelector users={users} currentUserId="u1" selectedUserId={null} />)
    expect(screen.getByText('— Select a team —')).toBeInTheDocument()
  })

  it('calls router.push with /picks?user=<id> when a team is selected', () => {
    render(<TeamSelector users={users} currentUserId="u1" selectedUserId={null} />)

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'u2' } })

    expect(mockPush).toHaveBeenCalledWith('/picks?user=u2')
  })

  it('pre-selects the selectedUserId when provided', () => {
    render(<TeamSelector users={users} currentUserId="u1" selectedUserId="u2" />)

    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('u2')
  })
})
