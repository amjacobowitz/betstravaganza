import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const { mockUpdateOrder, mockUpdateStatus } = vi.hoisted(() => ({
  mockUpdateOrder: vi.fn(),
  mockUpdateStatus: vi.fn(),
}))

vi.mock('@/lib/actions/admin/betstravaganza', () => ({
  createBetstravaganza: vi.fn(),
  updateDraftOrder: mockUpdateOrder,
  updateStatus: mockUpdateStatus,
}))

import { DraftOrderManager } from '@/components/admin/DraftOrderManager'

const users = [
  { id: 'u1', name: 'Alice Smith', team_name: 'Team Alpha' },
  { id: 'u2', name: 'Bob Jones', team_name: 'Team Beta' },
  { id: 'u3', name: 'Carol White', team_name: 'Team Gamma' },
]

describe('DraftOrderManager', () => {
  beforeEach(() => {
    mockUpdateOrder.mockReset()
    mockUpdateStatus.mockReset()
  })

  it('renders users in the provided order', () => {
    render(
      <DraftOrderManager
        betstravaganzaId="bz-1"
        allUsers={users}
        currentOrder={['u1', 'u2', 'u3']}
        status="setup"
      />
    )

    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Team Alpha')
    expect(items[1]).toHaveTextContent('Team Beta')
    expect(items[2]).toHaveTextContent('Team Gamma')
  })

  it('moves a player down when down arrow is clicked', () => {
    render(
      <DraftOrderManager
        betstravaganzaId="bz-1"
        allUsers={users}
        currentOrder={['u1', 'u2', 'u3']}
        status="setup"
      />
    )

    // First item has a down button (▼); click it to move Team Alpha down
    const downButtons = screen.getAllByText('▼')
    fireEvent.click(downButtons[0])

    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Team Beta')
    expect(items[1]).toHaveTextContent('Team Alpha')
  })

  it('moves a player up when up arrow is clicked', () => {
    render(
      <DraftOrderManager
        betstravaganzaId="bz-1"
        allUsers={users}
        currentOrder={['u1', 'u2', 'u3']}
        status="setup"
      />
    )

    const upButtons = screen.getAllByText('▲')
    fireEvent.click(upButtons[1]) // Second item's up button

    const items = screen.getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Team Beta')
    expect(items[1]).toHaveTextContent('Team Alpha')
  })

  it('first item has disabled up button, last item has disabled down button', () => {
    render(
      <DraftOrderManager
        betstravaganzaId="bz-1"
        allUsers={users}
        currentOrder={['u1', 'u2', 'u3']}
        status="setup"
      />
    )

    const upButtons = screen.getAllByText('▲')
    const downButtons = screen.getAllByText('▼')

    expect(upButtons[0]).toBeDisabled()
    expect(downButtons[2]).toBeDisabled()
  })

  it('calls updateDraftOrder with correct user ids on save', async () => {
    mockUpdateOrder.mockResolvedValue({ ok: true })
    render(
      <DraftOrderManager
        betstravaganzaId="bz-1"
        allUsers={users}
        currentOrder={['u1', 'u2', 'u3']}
        status="setup"
      />
    )

    fireEvent.click(screen.getByText('Save Order'))

    await waitFor(() => {
      expect(mockUpdateOrder).toHaveBeenCalledWith('bz-1', ['u1', 'u2', 'u3'])
    })
  })

  it('shows saved confirmation after successful save', async () => {
    mockUpdateOrder.mockResolvedValue({ ok: true })
    render(
      <DraftOrderManager
        betstravaganzaId="bz-1"
        allUsers={users}
        currentOrder={['u1', 'u2', 'u3']}
        status="setup"
      />
    )

    fireEvent.click(screen.getByText('Save Order'))

    await waitFor(() => {
      expect(screen.getByText('✓ Saved')).toBeInTheDocument()
    })
  })

  it('shows error on save failure', async () => {
    mockUpdateOrder.mockResolvedValue({ error: 'Save failed' })
    render(
      <DraftOrderManager
        betstravaganzaId="bz-1"
        allUsers={users}
        currentOrder={[]}
        status="setup"
      />
    )

    fireEvent.click(screen.getByText('Save Order'))

    await waitFor(() => {
      expect(screen.getByText('Save failed')).toBeInTheDocument()
    })
  })

  it('calls updateStatus when a status button is clicked', async () => {
    mockUpdateStatus.mockResolvedValue({ ok: true })
    render(
      <DraftOrderManager
        betstravaganzaId="bz-1"
        allUsers={users}
        currentOrder={[]}
        status="setup"
      />
    )

    fireEvent.click(screen.getByText('Draft'))

    await waitFor(() => {
      expect(mockUpdateStatus).toHaveBeenCalledWith('bz-1', 'draft')
    })
  })

  it('highlights the current status button', () => {
    render(
      <DraftOrderManager
        betstravaganzaId="bz-1"
        allUsers={users}
        currentOrder={[]}
        status="draft"
      />
    )

    // The "Draft" button should be disabled (it is the current status)
    expect(screen.getByText('Draft')).toBeDisabled()
    expect(screen.getByText('Setup')).not.toBeDisabled()
  })
})
