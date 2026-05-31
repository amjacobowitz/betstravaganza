import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { PrintPDFs } from '@/components/admin/PrintPDFs'

const events = [
  {
    id: 'e1',
    name: 'Belmont Stakes',
    sport: 'Horse Racing',
    category: 'required',
    bet_type: 'odds',
    start_time_et: '2026-06-07T18:00:00Z',
    streaming_info: 'NBC',
    bet_options: [
      { id: 'o1', label: 'Justify', odds: -150 },
      { id: 'o2', label: 'American Pharoah', odds: 200 },
    ],
  },
  {
    id: 'e2',
    name: 'NASCAR Trucks',
    sport: 'NASCAR',
    category: 'required',
    bet_type: 'odds',
    start_time_et: '2026-06-07T14:00:00Z',
    streaming_info: 'Fox',
    bet_options: [
      { id: 'o3', label: 'Kyle Busch', odds: 300 },
    ],
  },
]

const slateGames = [
  {
    id: 'sg1',
    away_team: 'Yankees',
    home_team: 'Red Sox',
    sport_label: 'MLB',
    start_time_et: '2026-06-07T13:10:00Z',
    spread: -1.5,
    notes: 'ESPN',
  },
]

describe('PrintPDFs', () => {
  let mockOpen: ReturnType<typeof vi.fn>

  beforeEach(() => {
    const mockWindow = {
      document: { write: vi.fn(), close: vi.fn() },
      print: vi.fn(),
    }
    mockOpen = vi.fn().mockReturnValue(mockWindow)
    vi.stubGlobal('open', mockOpen)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders both print buttons', () => {
    render(<PrintPDFs bzName="Test BZ" events={events as any} slateGames={slateGames} />)

    expect(screen.getByText(/print draft sheet/i)).toBeInTheDocument()
    expect(screen.getByText(/print schedule/i)).toBeInTheDocument()
  })

  it('shows descriptive text for each print option', () => {
    render(<PrintPDFs bzName="Test BZ" events={events as any} slateGames={slateGames} />)

    expect(screen.getByText(/required picks sorted by odds/i)).toBeInTheDocument()
    expect(screen.getByText(/chronological list/i)).toBeInTheDocument()
  })

  it('opens a new window when Draft Sheet is clicked', () => {
    render(<PrintPDFs bzName="Test BZ" events={events as any} slateGames={slateGames} />)

    fireEvent.click(screen.getByRole('button', { name: /print draft sheet/i }))

    expect(mockOpen).toHaveBeenCalledWith('', '_blank')
  })

  it('opens a new window when Schedule is clicked', () => {
    render(<PrintPDFs bzName="Test BZ" events={events as any} slateGames={slateGames} />)

    fireEvent.click(screen.getByRole('button', { name: /print schedule/i }))

    expect(mockOpen).toHaveBeenCalledWith('', '_blank')
  })

  it('includes event name in draft sheet HTML', () => {
    const mockDoc = { write: vi.fn(), close: vi.fn() }
    mockOpen.mockReturnValue({ document: mockDoc, print: vi.fn() })
    render(<PrintPDFs bzName="Test BZ" events={events as any} slateGames={slateGames} />)

    fireEvent.click(screen.getByRole('button', { name: /print draft sheet/i }))

    const html = mockDoc.write.mock.calls[0][0]
    expect(html).toContain('Belmont Stakes')
    expect(html).toContain('Justify')
    expect(html).toContain('-150')
  })

  it('includes slate games in schedule HTML', () => {
    const mockDoc = { write: vi.fn(), close: vi.fn() }
    mockOpen.mockReturnValue({ document: mockDoc, print: vi.fn() })
    render(<PrintPDFs bzName="Test BZ" events={events as any} slateGames={slateGames} />)

    fireEvent.click(screen.getByRole('button', { name: /print schedule/i }))

    const html = mockDoc.write.mock.calls[0][0]
    expect(html).toContain('Yankees @ Red Sox')
  })
})
