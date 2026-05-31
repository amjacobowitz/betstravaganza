import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const { mockSubmitSlatePicks } = vi.hoisted(() => ({
  mockSubmitSlatePicks: vi.fn(),
}))

vi.mock('@/lib/actions/player/slate-picks', () => ({
  submitSlatePicks: mockSubmitSlatePicks,
}))

// @dnd-kit requires pointer/keyboard events not available in jsdom.
// Mock the DnD context so tests focus on team selection, validation, and lock logic.
vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>()
  return {
    ...actual,
    DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useSensor: () => ({}),
    useSensors: () => [],
  }
})

vi.mock('@dnd-kit/sortable', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/sortable')>()
  return {
    ...actual,
    SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useSortable: (args: { id: string }) => ({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      transform: null,
      transition: undefined,
      isDragging: false,
    }),
  }
})

import { SlatePicksForm } from '@/components/player/SlatePicksForm'

const slateGames = [
  { id: 'g1', away_team: 'Yankees', home_team: 'Red Sox', sport_label: 'MLB', start_time_et: '2026-06-06T13:10:00Z', spread: null, notes: null },
  { id: 'g2', away_team: 'Cubs', home_team: 'Cardinals', sport_label: 'MLB', start_time_et: '2026-06-06T14:15:00Z', spread: -1.5, notes: null },
  { id: 'g3', away_team: 'Dodgers', home_team: 'Giants', sport_label: 'MLB', start_time_et: '2026-06-06T16:10:00Z', spread: null, notes: null },
]

const defaultProps = {
  betstravaganzaId: 'bz-1',
  slateGames,
  existingPicks: [] as any[],
  slateLockTime: null,
  confidenceMultiplier: 3,
}

describe('SlatePicksForm', () => {
  beforeEach(() => {
    mockSubmitSlatePicks.mockReset()
  })

  it('renders all slate games', () => {
    render(<SlatePicksForm {...defaultProps} />)

    expect(screen.getByText(/Yankees @ Red Sox/)).toBeInTheDocument()
    expect(screen.getByText(/Cubs @ Cardinals/)).toBeInTheDocument()
    expect(screen.getByText(/Dodgers @ Giants/)).toBeInTheDocument()
  })

  it('shows home and away team buttons for each game', () => {
    render(<SlatePicksForm {...defaultProps} />)

    expect(screen.getByRole('button', { name: /Yankees away/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Red Sox home/i })).toBeInTheDocument()
  })

  it('highlights selected team when clicked', () => {
    render(<SlatePicksForm {...defaultProps} />)

    const yankeeBtn = screen.getByRole('button', { name: /Yankees away/i })
    fireEvent.click(yankeeBtn)

    expect(yankeeBtn).toHaveClass('border-accent')
  })

  it('submit button is disabled when no teams are picked', () => {
    render(<SlatePicksForm {...defaultProps} />)

    expect(screen.getByRole('button', { name: /submit slate/i })).toBeDisabled()
  })

  it('submit button enables after all games have a team picked', async () => {
    render(<SlatePicksForm {...defaultProps} />)

    fireEvent.click(screen.getByRole('button', { name: /Yankees away/i }))
    fireEvent.click(screen.getByRole('button', { name: /Cubs away/i }))
    fireEvent.click(screen.getByRole('button', { name: /Dodgers away/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /submit slate/i })).not.toBeDisabled()
    })
  })

  it('calls submitSlatePicks with ranks derived from game order', async () => {
    mockSubmitSlatePicks.mockResolvedValue({ ok: true })
    render(<SlatePicksForm {...defaultProps} />)

    // g1 at position 0 → rank 3, g2 → rank 2, g3 → rank 1 (default order)
    fireEvent.click(screen.getByRole('button', { name: /Yankees away/i }))
    fireEvent.click(screen.getByRole('button', { name: /Cubs away/i }))
    fireEvent.click(screen.getByRole('button', { name: /Dodgers away/i }))

    fireEvent.click(screen.getByRole('button', { name: /submit slate/i }))

    await waitFor(() => {
      expect(mockSubmitSlatePicks).toHaveBeenCalledWith('bz-1', [
        { slateGameId: 'g1', teamPicked: 'away', confidenceRank: 3 },
        { slateGameId: 'g2', teamPicked: 'away', confidenceRank: 2 },
        { slateGameId: 'g3', teamPicked: 'away', confidenceRank: 1 },
      ])
    })
  })

  it('shows error on submit failure', async () => {
    mockSubmitSlatePicks.mockResolvedValue({ error: 'Server error' })
    render(<SlatePicksForm {...defaultProps} />)

    fireEvent.click(screen.getByRole('button', { name: /Yankees away/i }))
    fireEvent.click(screen.getByRole('button', { name: /Cubs away/i }))
    fireEvent.click(screen.getByRole('button', { name: /Dodgers away/i }))

    fireEvent.click(screen.getByRole('button', { name: /submit slate/i }))

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument()
    })
  })

  it('pre-fills existing picks and orders by rank descending', () => {
    render(
      <SlatePicksForm
        {...defaultProps}
        existingPicks={[
          { slateGameId: 'g1', teamPicked: 'home', confidenceRank: 3 },
          { slateGameId: 'g3', teamPicked: 'home', confidenceRank: 2 },
          { slateGameId: 'g2', teamPicked: 'away', confidenceRank: 1 },
        ]}
      />
    )

    // Red Sox (home) for g1 should be highlighted
    expect(screen.getByRole('button', { name: /Red Sox home/i })).toHaveClass('border-accent')
    // Cubs (away) for g2 should be highlighted
    expect(screen.getByRole('button', { name: /Cubs away/i })).toHaveClass('border-accent')
  })

  it('shows update button text when all picks already submitted', () => {
    render(
      <SlatePicksForm
        {...defaultProps}
        existingPicks={[
          { slateGameId: 'g1', teamPicked: 'home', confidenceRank: 3 },
          { slateGameId: 'g2', teamPicked: 'away', confidenceRank: 1 },
          { slateGameId: 'g3', teamPicked: 'home', confidenceRank: 2 },
        ]}
      />
    )

    expect(screen.getByRole('button', { name: /update/i })).toBeInTheDocument()
  })

  it('shows dollar potential for each game', () => {
    render(<SlatePicksForm {...defaultProps} confidenceMultiplier={3} />)

    // Rank 3 = $9, rank 2 = $6, rank 1 = $3 with multiplier 3
    expect(screen.getByText('+$9')).toBeInTheDocument()
    expect(screen.getByText('+$6')).toBeInTheDocument()
    expect(screen.getByText('+$3')).toBeInTheDocument()
  })

  it('shows max potential in header', () => {
    render(<SlatePicksForm {...defaultProps} confidenceMultiplier={3} />)
    // 3+2+1 = 6 ranks × $3 = $18 total
    expect(screen.getByText(/\+\$18/)).toBeInTheDocument()
  })

  it('shows locked banner when slateLockTime is in the past', () => {
    const pastTime = new Date(Date.now() - 60_000).toISOString()
    render(<SlatePicksForm {...defaultProps} slateLockTime={pastTime} />)

    expect(screen.getByText(/slate locked/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /submit slate/i })).not.toBeInTheDocument()
  })

  it('does not lock when slateLockTime is in the future', () => {
    const futureTime = new Date(Date.now() + 60_000 * 60).toISOString()
    render(<SlatePicksForm {...defaultProps} slateLockTime={futureTime} />)

    expect(screen.queryByText(/slate locked/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /submit slate/i })).toBeInTheDocument()
  })

  it('disables team buttons when locked', () => {
    const pastTime = new Date(Date.now() - 60_000).toISOString()
    render(<SlatePicksForm {...defaultProps} slateLockTime={pastTime} />)

    const awayBtn = screen.getByRole('button', { name: /Yankees away/i })
    expect(awayBtn).toBeDisabled()
  })
})
