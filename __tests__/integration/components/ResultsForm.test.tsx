import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const { mockUpsertResult, mockUpsertSlateResult } = vi.hoisted(() => ({
  mockUpsertResult: vi.fn(),
  mockUpsertSlateResult: vi.fn(),
}))

vi.mock('@/lib/actions/admin/results', () => ({
  upsertResult: mockUpsertResult,
  upsertSlateResult: mockUpsertSlateResult,
}))

vi.mock('@/lib/actions/admin/fetch-results', () => ({
  fetchResultsFromAPI: vi.fn().mockResolvedValue({ proposed: [], notFound: [] }),
}))

import { ResultsForm } from '@/components/admin/ResultsForm'

const events = [
  {
    id: 'e1',
    name: 'Belmont Stakes',
    sport: 'Horse Racing',
    bet_type: 'odds',
    category: 'required',
    start_time_et: null,
    bet_options: [
      { id: 'o1', label: 'Justify', odds: -150 },
      { id: 'o2', label: 'American Pharoah', odds: 200 },
    ],
    result: null,
  },
  {
    id: 'e2',
    name: 'US Open',
    sport: 'Golf',
    bet_type: 'odds',
    category: 'required',
    start_time_et: '2026-06-01T14:00:00Z',
    bet_options: [
      { id: 'o3', label: 'Scottie Scheffler', odds: -120 },
    ],
    result: {
      winner_bet_option_id: 'o3',
      winner_bet_option_ids: ['o3'],
      home_score: null,
      away_score: null,
      result_display: 'Scheffler wins at -4',
    },
  },
]

const slateGames = [
  {
    id: 'sg1',
    away_team: 'Yankees',
    home_team: 'Red Sox',
    sport_label: 'MLB',
    start_time_et: null,
    result: null,
  },
]

const bzId = 'test-bz-id'

describe('ResultsForm', () => {
  beforeEach(() => {
    mockUpsertResult.mockReset()
    mockUpsertSlateResult.mockReset()
  })

  it('renders events tab by default', () => {
    render(<ResultsForm events={events} slateGames={slateGames} bzId={bzId} />)
    expect(screen.getByText(/belmont stakes/i)).toBeInTheDocument()
    expect(screen.getByText(/us open/i)).toBeInTheDocument()
  })

  it('shows tab with event and slate game counts', () => {
    render(<ResultsForm events={events} slateGames={slateGames} bzId={bzId} />)
    expect(screen.getByText(/events \(2\)/i)).toBeInTheDocument()
    expect(screen.getByText(/slate games \(1\)/i)).toBeInTheDocument()
  })

  it('switches to slate tab', () => {
    render(<ResultsForm events={events} slateGames={slateGames} bzId={bzId} />)

    fireEvent.click(screen.getByText(/slate games/i))

    expect(screen.getByText(/Yankees @ Red Sox/i)).toBeInTheDocument()
  })

  it('shows existing result_display as read-only text', () => {
    render(<ResultsForm events={events} slateGames={slateGames} bzId={bzId} />)
    expect(screen.getByText(/Scheffler wins at -4/)).toBeInTheDocument()
  })

  it('shows "Complete" status badge for events with existing results', () => {
    render(<ResultsForm events={events} slateGames={slateGames} bzId={bzId} />)
    expect(screen.getByText('Complete')).toBeInTheDocument()
  })

  it('calls upsertResult on form submission', async () => {
    mockUpsertResult.mockResolvedValue({ ok: true })
    render(<ResultsForm events={events} slateGames={slateGames} bzId={bzId} />)

    const saveButtons = screen.getAllByRole('button', { name: /save result/i })
    fireEvent.click(saveButtons[0])

    await waitFor(() => {
      expect(mockUpsertResult).toHaveBeenCalledOnce()
    })
  })

  it('shows ✓ Saved after successful submission', async () => {
    mockUpsertResult.mockResolvedValue({ ok: true })
    render(<ResultsForm events={events} slateGames={slateGames} bzId={bzId} />)

    const saveButtons = screen.getAllByRole('button', { name: /save result/i })
    fireEvent.click(saveButtons[0])

    await waitFor(() => {
      expect(screen.getAllByText('✓ Saved').length).toBeGreaterThan(0)
    })
  })

  it('shows error on submission failure', async () => {
    mockUpsertResult.mockResolvedValue({ error: 'DB error' })
    render(<ResultsForm events={events} slateGames={slateGames} bzId={bzId} />)

    const saveButtons = screen.getAllByRole('button', { name: /save result/i })
    fireEvent.click(saveButtons[0])

    await waitFor(() => {
      expect(screen.getByText('DB error')).toBeInTheDocument()
    })
  })

  it('calls upsertSlateResult for slate games', async () => {
    mockUpsertSlateResult.mockResolvedValue({ ok: true })
    render(<ResultsForm events={events} slateGames={slateGames} bzId={bzId} />)

    fireEvent.click(screen.getByText(/slate games/i))

    const scores = screen.getAllByRole('spinbutton')
    fireEvent.change(scores[0], { target: { value: '5' } })
    fireEvent.change(scores[1], { target: { value: '3' } })

    fireEvent.click(screen.getByRole('button', { name: /save result/i }))

    await waitFor(() => {
      expect(mockUpsertSlateResult).toHaveBeenCalledOnce()
    })
  })
})
