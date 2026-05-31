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

import { ResultsForm } from '@/components/admin/ResultsForm'

const events = [
  {
    id: 'e1',
    name: 'Belmont Stakes',
    sport: 'Horse Racing',
    bet_type: 'odds',
    category: 'required',
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
    bet_options: [
      { id: 'o3', label: 'Scottie Scheffler', odds: -120 },
    ],
    result: {
      winner_bet_option_id: 'o3',
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
    result: null,
  },
]

describe('ResultsForm', () => {
  beforeEach(() => {
    mockUpsertResult.mockReset()
    mockUpsertSlateResult.mockReset()
  })

  it('renders events tab by default', () => {
    render(<ResultsForm events={events} slateGames={slateGames} />)
    expect(screen.getByText(/belmont stakes/i)).toBeInTheDocument()
    expect(screen.getByText(/us open/i)).toBeInTheDocument()
  })

  it('shows tab with event and slate game counts', () => {
    render(<ResultsForm events={events} slateGames={slateGames} />)
    expect(screen.getByText(/events \(2\)/i)).toBeInTheDocument()
    expect(screen.getByText(/slate games \(1\)/i)).toBeInTheDocument()
  })

  it('switches to slate tab', () => {
    render(<ResultsForm events={events} slateGames={slateGames} />)

    fireEvent.click(screen.getByText(/slate games/i))

    expect(screen.getByText(/Yankees @ Red Sox/i)).toBeInTheDocument()
  })

  it('pre-fills existing result values', () => {
    render(<ResultsForm events={events} slateGames={slateGames} />)

    // The second event has an existing result_display — find it by its value
    // (multiple forms reuse the same label, so search by display value instead)
    expect(screen.getByDisplayValue('Scheffler wins at -4')).toBeInTheDocument()
  })

  it('shows "Has result" for events with existing results', () => {
    render(<ResultsForm events={events} slateGames={slateGames} />)
    expect(screen.getByText('Has result')).toBeInTheDocument()
  })

  it('calls upsertResult on form submission', async () => {
    mockUpsertResult.mockResolvedValue({ ok: true })
    render(<ResultsForm events={events} slateGames={slateGames} />)

    const resultDisplay = screen.getAllByLabelText(/result display/i)[0]
    fireEvent.change(resultDisplay, { target: { value: 'Justify wins' } })

    const saveButtons = screen.getAllByRole('button', { name: /save result/i })
    fireEvent.click(saveButtons[0])

    await waitFor(() => {
      expect(mockUpsertResult).toHaveBeenCalledOnce()
    })
  })

  it('shows ✓ Saved after successful submission', async () => {
    mockUpsertResult.mockResolvedValue({ ok: true })
    render(<ResultsForm events={events} slateGames={slateGames} />)

    const resultDisplay = screen.getAllByLabelText(/result display/i)[0]
    fireEvent.change(resultDisplay, { target: { value: 'Justify wins' } })

    const saveButtons = screen.getAllByRole('button', { name: /save result/i })
    fireEvent.click(saveButtons[0])

    await waitFor(() => {
      expect(screen.getAllByText('✓ Saved').length).toBeGreaterThan(0)
    })
  })

  it('shows error on submission failure', async () => {
    mockUpsertResult.mockResolvedValue({ error: 'DB error' })
    render(<ResultsForm events={events} slateGames={slateGames} />)

    const resultDisplay = screen.getAllByLabelText(/result display/i)[0]
    fireEvent.change(resultDisplay, { target: { value: 'Justify wins' } })

    const saveButtons = screen.getAllByRole('button', { name: /save result/i })
    fireEvent.click(saveButtons[0])

    await waitFor(() => {
      expect(screen.getByText('DB error')).toBeInTheDocument()
    })
  })

  it('calls upsertSlateResult for slate games', async () => {
    mockUpsertSlateResult.mockResolvedValue({ ok: true })
    render(<ResultsForm events={events} slateGames={slateGames} />)

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
