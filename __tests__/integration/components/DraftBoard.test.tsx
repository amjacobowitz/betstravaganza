import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const { mockRecordPick, mockUndoPick, mockSetClock, mockResetDraft } = vi.hoisted(() => ({
  mockRecordPick: vi.fn(),
  mockUndoPick: vi.fn(),
  mockSetClock: vi.fn(),
  mockResetDraft: vi.fn(),
}))

vi.mock('@/lib/actions/admin/draft', () => ({
  recordPick: mockRecordPick,
  undoPick: mockUndoPick,
  setDraftPickIndex: mockSetClock,
  resetDraft: mockResetDraft,
}))

import { DraftBoard } from '@/components/admin/DraftBoard'
import type { DraftPick, BetOption, ScoringEvent } from '@/lib/scoring/types'

function makeBz() {
  return { id: 'bz-1', round_count: 11, player_count: 3 }
}

const scoringEvents: ScoringEvent[] = [
  { id: 'ev1', name: 'Belmont Stakes', category: 'required', betType: 'odds' },
  { id: 'ev2', name: 'US vs Germany', category: 'optional', betType: 'odds' },
]

const betOptions: BetOption[] = [
  { id: 'o1', eventId: 'ev1', label: 'Justify', odds: -150, maxDrafts: 1, draftCount: 0 },
  { id: 'o2', eventId: 'ev1', label: 'American Pharoah', odds: 200, maxDrafts: 1, draftCount: 0 },
  { id: 'o3', eventId: 'ev2', label: 'USA', odds: 110, maxDrafts: 1, draftCount: 0 },
  { id: 'o4', eventId: 'ev2', label: 'Germany', odds: -130, maxDrafts: 1, draftCount: 0 },
]

const events = scoringEvents.map(e => ({
  ...e,
  sport: 'test',
  bet_options: betOptions.filter(o => o.eventId === e.id),
}))

const allUsers = [
  { id: 'u1', name: 'Alice', team_name: 'Team A' },
  { id: 'u2', name: 'Bob', team_name: 'Team B' },
  { id: 'u3', name: 'Carol', team_name: 'Team C' },
]

const playerStatuses = allUsers.map(u => ({
  userId: u.id,
  name: u.name,
  teamName: u.team_name,
  totalPicks: 0,
  requiredSatisfied: 0,
  requiredTotal: 1,
  clashCount: 0,
  clashRequired: 2,
  requiredRemaining: ['ev1'],
  roundsRemaining: 11,
}))

const defaultProps = {
  betstravaganza: makeBz(),
  events,
  betOptions,
  scoringEvents,
  allPicks: [] as DraftPick[],
  playerStatuses,
  currentUserId: 'u1',
  currentPickIndex: 0,
  totalPicks: 33,
  draftOrder: ['u1', 'u2', 'u3'],
  allUsers,
}

describe('DraftBoard', () => {
  beforeEach(() => {
    mockRecordPick.mockReset()
    mockUndoPick.mockReset()
    mockSetClock.mockReset()
    mockResetDraft.mockReset()
  })

  it('renders player sidebar with all players', () => {
    render(<DraftBoard {...defaultProps} />)

    expect(screen.getByText('Team A')).toBeInTheDocument()
    expect(screen.getByText('Team B')).toBeInTheDocument()
    expect(screen.getByText('Team C')).toBeInTheDocument()
  })

  it('shows ON CLOCK indicator for current player', () => {
    render(<DraftBoard {...defaultProps} />)
    expect(screen.getByText('ON CLOCK')).toBeInTheDocument()
  })

  it('shows pick counter', () => {
    render(<DraftBoard {...defaultProps} />)
    expect(screen.getByText(/pick 1 \/ 33/i)).toBeInTheDocument()
  })

  it('renders bet options in the pick pool', () => {
    render(<DraftBoard {...defaultProps} />)
    expect(screen.getByText('Justify')).toBeInTheDocument()
    expect(screen.getByText('American Pharoah')).toBeInTheDocument()
    expect(screen.getByText('USA')).toBeInTheDocument()
    expect(screen.getByText('Germany')).toBeInTheDocument()
  })

  it('record button is disabled when no option selected', () => {
    render(<DraftBoard {...defaultProps} />)
    expect(screen.getByRole('button', { name: /select a pick/i })).toBeDisabled()
  })

  it('selects an option when clicked and shows validation', async () => {
    render(<DraftBoard {...defaultProps} />)

    fireEvent.click(screen.getByText('Justify'))

    await waitFor(() => {
      expect(screen.getByText(/valid pick/i)).toBeInTheDocument()
    })
  })

  it('deselects option when clicked again', async () => {
    render(<DraftBoard {...defaultProps} />)

    fireEvent.click(screen.getByText('Justify'))
    await waitFor(() => expect(screen.getByText(/valid pick/i)).toBeInTheDocument())

    fireEvent.click(screen.getByText('Justify'))
    await waitFor(() => {
      expect(screen.queryByText(/valid pick/i)).not.toBeInTheDocument()
    })
  })

  it('shows invalid validation for optional when required must be filled', async () => {
    // round_count=1 → roundsRemaining=1 with 0 picks; requiredRemaining=['ev1'] → 1>=1 → block optional
    render(<DraftBoard {...defaultProps} betstravaganza={{ ...makeBz(), round_count: 1 }} />)

    // Click an optional bet option
    fireEvent.click(screen.getByText('USA'))

    await waitFor(() => {
      expect(screen.getByText(/✗/)).toBeInTheDocument()
    })
  })

  it('record button shows selected option label when valid', async () => {
    render(<DraftBoard {...defaultProps} />)

    fireEvent.click(screen.getByText('Justify'))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /record pick: justify/i })).toBeInTheDocument()
    })
  })

  it('calls recordPick on Record button click', async () => {
    mockRecordPick.mockResolvedValue({ ok: true })
    render(<DraftBoard {...defaultProps} />)

    fireEvent.click(screen.getByText('Justify'))
    await waitFor(() => screen.getByRole('button', { name: /record pick: justify/i }))

    fireEvent.click(screen.getByRole('button', { name: /record pick: justify/i }))

    await waitFor(() => {
      expect(mockRecordPick).toHaveBeenCalledWith(expect.objectContaining({
        betstravaganzaId: 'bz-1',
        userId: 'u1',
        betOptionId: 'o1',
      }))
    })
  })

  it('shows error when recordPick fails', async () => {
    mockRecordPick.mockResolvedValue({ error: 'Pick failed' })
    render(<DraftBoard {...defaultProps} />)

    fireEvent.click(screen.getByText('Justify'))
    await waitFor(() => screen.getByRole('button', { name: /record pick/i }))
    fireEvent.click(screen.getByRole('button', { name: /record pick/i }))

    await waitFor(() => {
      expect(screen.getByText('Pick failed')).toBeInTheDocument()
    })
  })

  it('filters options by category', () => {
    render(<DraftBoard {...defaultProps} />)

    fireEvent.click(screen.getByText('required'))

    // Should only show Belmont (required), not US vs Germany (optional)
    expect(screen.getByText('Justify')).toBeInTheDocument()
    expect(screen.queryByText('USA')).not.toBeInTheDocument()
  })

  it('filters options by optional', () => {
    render(<DraftBoard {...defaultProps} />)

    fireEvent.click(screen.getByText('optional'))

    expect(screen.getByText('USA')).toBeInTheDocument()
    expect(screen.queryByText('Justify')).not.toBeInTheDocument()
  })

  it('searches options by label', () => {
    render(<DraftBoard {...defaultProps} />)

    const searchInput = screen.getByPlaceholderText('Search...')
    fireEvent.change(searchInput, { target: { value: 'Justify' } })

    expect(screen.getByText('Justify')).toBeInTheDocument()
    expect(screen.queryByText('USA')).not.toBeInTheDocument()
  })

  it('switching players updates the "Picking for" header', () => {
    render(<DraftBoard {...defaultProps} />)

    fireEvent.click(screen.getByText('Team B'))

    expect(screen.getByText(/team b — roster/i)).toBeInTheDocument()
  })

  it('calls resetDraft when Reset Draft button clicked and confirmed', async () => {
    mockResetDraft.mockResolvedValue({ ok: true })
    render(<DraftBoard {...defaultProps} />)

    fireEvent.click(screen.getByRole('button', { name: /reset draft/i }))

    await waitFor(() => {
      expect(screen.getByText('Reset entire draft?')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /yes, reset/i }))

    await waitFor(() => {
      expect(mockResetDraft).toHaveBeenCalledWith('bz-1')
    })
  })

  it('marks already-drafted option as FULL when draftCount equals maxDrafts', () => {
    const fullOptions = betOptions.map(o =>
      o.id === 'o1' ? { ...o, draftCount: 1 } : o
    )
    const fullPicks: DraftPick[] = [{
      id: 'dp1', userId: 'u2', betOptionId: 'o1', eventId: 'ev1',
      roundNumber: 1, createdAt: new Date(),
    }]

    render(
      <DraftBoard
        {...defaultProps}
        betOptions={fullOptions}
        allPicks={fullPicks}
      />
    )

    expect(screen.getByText('FULL')).toBeInTheDocument()
  })

  it('shows YOURS badge for options already picked by selected user', () => {
    const myPick: DraftPick[] = [{
      id: 'dp1', userId: 'u1', betOptionId: 'o3', eventId: 'ev2',
      roundNumber: 1, createdAt: new Date(),
    }]

    render(<DraftBoard {...defaultProps} allPicks={myPick} />)

    expect(screen.getByText('Picked')).toBeInTheDocument()
  })
})
