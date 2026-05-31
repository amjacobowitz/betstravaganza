import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const { mockSubmitSlatePicks } = vi.hoisted(() => ({
  mockSubmitSlatePicks: vi.fn(),
}))

vi.mock('@/lib/actions/player/slate-picks', () => ({
  submitSlatePicks: mockSubmitSlatePicks,
}))

import { SlatePicksForm } from '@/components/player/SlatePicksForm'

const slateGames = [
  { id: 'g1', away_team: 'Yankees', home_team: 'Red Sox', sport_label: 'MLB', start_time_et: '2026-06-06T13:10:00Z', spread: null, notes: null },
  { id: 'g2', away_team: 'Cubs', home_team: 'Cardinals', sport_label: 'MLB', start_time_et: '2026-06-06T14:15:00Z', spread: -1.5, notes: null },
  { id: 'g3', away_team: 'Dodgers', home_team: 'Giants', sport_label: 'MLB', start_time_et: '2026-06-06T16:10:00Z', spread: null, notes: 'ESPN+' },
]

describe('SlatePicksForm', () => {
  beforeEach(() => {
    mockSubmitSlatePicks.mockReset()
  })

  it('renders all slate games', () => {
    render(
      <SlatePicksForm betstravaganzaId="bz-1" slateGames={slateGames} existingPicks={[]} />
    )

    expect(screen.getByText(/Yankees @ Red Sox/)).toBeInTheDocument()
    expect(screen.getByText(/Cubs @ Cardinals/)).toBeInTheDocument()
    expect(screen.getByText(/Dodgers @ Giants/)).toBeInTheDocument()
  })

  it('shows home and away team buttons for each game', () => {
    render(
      <SlatePicksForm betstravaganzaId="bz-1" slateGames={slateGames} existingPicks={[]} />
    )

    expect(screen.getByRole('button', { name: /Yankees/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Red Sox/i })).toBeInTheDocument()
  })

  it('highlights selected team when clicked', () => {
    render(
      <SlatePicksForm betstravaganzaId="bz-1" slateGames={slateGames} existingPicks={[]} />
    )

    const yankeeBtn = screen.getByRole('button', { name: /Yankees/i })
    fireEvent.click(yankeeBtn)

    expect(yankeeBtn).toHaveClass('border-accent')
  })

  it('submit button is disabled when picks are incomplete', () => {
    render(
      <SlatePicksForm betstravaganzaId="bz-1" slateGames={slateGames} existingPicks={[]} />
    )

    expect(screen.getByRole('button', { name: /submit slate/i })).toBeDisabled()
  })

  it('submit button enables after all games are picked and ranked', async () => {
    render(
      <SlatePicksForm betstravaganzaId="bz-1" slateGames={slateGames} existingPicks={[]} />
    )

    // Pick teams and ranks for all 3 games
    const awayButtons = screen.getAllByText(/away/)
    const rankSelects = screen.getAllByRole('combobox')

    fireEvent.click(screen.getByRole('button', { name: /Yankees/i }))
    fireEvent.click(screen.getByRole('button', { name: /Cubs/i }))
    fireEvent.click(screen.getByRole('button', { name: /Dodgers/i }))

    fireEvent.change(rankSelects[0], { target: { value: '3' } })
    fireEvent.change(rankSelects[1], { target: { value: '2' } })
    fireEvent.change(rankSelects[2], { target: { value: '1' } })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /submit slate/i })).not.toBeDisabled()
    })
  })

  it('calls submitSlatePicks with correct payload on submit', async () => {
    mockSubmitSlatePicks.mockResolvedValue({ ok: true })
    render(
      <SlatePicksForm betstravaganzaId="bz-1" slateGames={slateGames} existingPicks={[]} />
    )

    fireEvent.click(screen.getByRole('button', { name: /Yankees/i }))
    fireEvent.click(screen.getByRole('button', { name: /Cubs/i }))
    fireEvent.click(screen.getByRole('button', { name: /Dodgers/i }))

    const rankSelects = screen.getAllByRole('combobox')
    fireEvent.change(rankSelects[0], { target: { value: '3' } })
    fireEvent.change(rankSelects[1], { target: { value: '2' } })
    fireEvent.change(rankSelects[2], { target: { value: '1' } })

    fireEvent.click(screen.getByRole('button', { name: /submit slate/i }))

    await waitFor(() => {
      expect(mockSubmitSlatePicks).toHaveBeenCalledWith('bz-1', [
        { slateGameId: 'g1', teamPicked: 'away', confidenceRank: 3 },
        { slateGameId: 'g2', teamPicked: 'away', confidenceRank: 2 },
        { slateGameId: 'g3', teamPicked: 'away', confidenceRank: 1 },
      ])
    })
  })

  it('swaps ranks when a duplicate rank is selected', () => {
    render(
      <SlatePicksForm betstravaganzaId="bz-1" slateGames={slateGames} existingPicks={[]} />
    )

    const rankSelects = screen.getAllByRole('combobox')
    fireEvent.change(rankSelects[0], { target: { value: '1' } })
    // Now assign rank 1 to game 2 — should swap game 1 to 0
    fireEvent.change(rankSelects[1], { target: { value: '1' } })

    // Game 1 should now have rank 0 (unset) and game 2 has rank 1
    expect(rankSelects[0]).toHaveValue('')
    expect(rankSelects[1]).toHaveValue('1')
  })

  it('shows error on submit failure', async () => {
    mockSubmitSlatePicks.mockResolvedValue({ error: 'Server error' })
    render(
      <SlatePicksForm betstravaganzaId="bz-1" slateGames={slateGames} existingPicks={[]} />
    )

    fireEvent.click(screen.getByRole('button', { name: /Yankees/i }))
    fireEvent.click(screen.getByRole('button', { name: /Cubs/i }))
    fireEvent.click(screen.getByRole('button', { name: /Dodgers/i }))

    const rankSelects = screen.getAllByRole('combobox')
    fireEvent.change(rankSelects[0], { target: { value: '1' } })
    fireEvent.change(rankSelects[1], { target: { value: '2' } })
    fireEvent.change(rankSelects[2], { target: { value: '3' } })

    fireEvent.click(screen.getByRole('button', { name: /submit slate/i }))

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument()
    })
  })

  it('pre-fills existing picks', () => {
    render(
      <SlatePicksForm
        betstravaganzaId="bz-1"
        slateGames={slateGames}
        existingPicks={[
          { slateGameId: 'g1', teamPicked: 'home', confidenceRank: 3 },
          { slateGameId: 'g2', teamPicked: 'away', confidenceRank: 1 },
          { slateGameId: 'g3', teamPicked: 'home', confidenceRank: 2 },
        ]}
      />
    )

    // Red Sox (home) should be highlighted for game 1
    expect(screen.getByRole('button', { name: /Red Sox/i })).toHaveClass('border-accent')

    // Rank selects should show pre-filled values
    const rankSelects = screen.getAllByRole('combobox')
    expect(rankSelects[0]).toHaveValue('3')
    expect(rankSelects[1]).toHaveValue('1')
  })

  it('shows update button text when picks already submitted', () => {
    render(
      <SlatePicksForm
        betstravaganzaId="bz-1"
        slateGames={slateGames}
        existingPicks={[
          { slateGameId: 'g1', teamPicked: 'home', confidenceRank: 3 },
          { slateGameId: 'g2', teamPicked: 'away', confidenceRank: 1 },
          { slateGameId: 'g3', teamPicked: 'home', confidenceRank: 2 },
        ]}
      />
    )

    expect(screen.getByRole('button', { name: /update/i })).toBeInTheDocument()
  })
})
