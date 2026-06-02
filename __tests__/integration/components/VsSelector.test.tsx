import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const { mockPush, mockUseSearchParams } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockUseSearchParams: vi.fn(() => new URLSearchParams()),
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: mockPush })),
  useSearchParams: mockUseSearchParams,
}))

import { VsSelector } from '@/components/player/VsSelector'

const users = [
  { id: 'u1', name: 'Alice', team_name: 'Team A' },
  { id: 'u2', name: 'Bob',   team_name: 'Team B' },
  { id: 'u3', name: 'Carol', team_name: 'Team C' },
  { id: 'u4', name: 'Dave',  team_name: 'Team D' },
]

describe('VsSelector', () => {
  beforeEach(() => {
    mockPush.mockReset()
    mockUseSearchParams.mockReturnValue(new URLSearchParams())
  })

  it('renders "Compare vs…" default option', () => {
    render(<VsSelector users={users} currentUserId="u1" viewUserId="u1" vsUserId={null} />)
    expect(screen.getByText('Compare vs…')).toBeInTheDocument()
  })

  it('excludes currentUserId and viewUserId from options', () => {
    render(<VsSelector users={users} currentUserId="u1" viewUserId="u2" vsUserId={null} />)
    expect(screen.queryByText(/Team A/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Team B/)).not.toBeInTheDocument()
    expect(screen.getByText('Team C (Carol)')).toBeInTheDocument()
    expect(screen.getByText('Team D (Dave)')).toBeInTheDocument()
  })

  it('navigates to /picks?vs=<id> when a user is selected', () => {
    render(<VsSelector users={users} currentUserId="u1" viewUserId="u1" vsUserId={null} />)
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'u3' } })
    expect(mockPush).toHaveBeenCalledWith('/picks?vs=u3')
  })

  it('clears vs param when blank option selected', () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('vs=u3'))
    render(<VsSelector users={users} currentUserId="u1" viewUserId="u1" vsUserId="u3" />)
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: '' } })
    expect(mockPush).toHaveBeenCalledWith('/picks?')
  })

  it('pre-selects vsUserId when provided', () => {
    render(<VsSelector users={users} currentUserId="u1" viewUserId="u1" vsUserId="u3" />)
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('u3')
  })

  it('preserves other search params when navigating', () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams('user=u2'))
    render(<VsSelector users={users} currentUserId="u1" viewUserId="u2" vsUserId={null} />)
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'u3' } })
    expect(mockPush).toHaveBeenCalledWith('/picks?user=u2&vs=u3')
  })
})
