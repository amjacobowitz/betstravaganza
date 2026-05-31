import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const { mockCreateBz } = vi.hoisted(() => ({
  mockCreateBz: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() })),
  usePathname: vi.fn(() => '/'),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}))

vi.mock('@/lib/actions/admin/betstravaganza', () => ({
  createBetstravaganza: mockCreateBz,
  updateDraftOrder: vi.fn(),
  updateStatus: vi.fn(),
}))

import { SetupForm } from '@/components/admin/SetupForm'

describe('SetupForm', () => {
  beforeEach(() => {
    mockCreateBz.mockReset()
  })

  it('renders all form fields with correct defaults', () => {
    render(<SetupForm />)

    expect(screen.getByLabelText(/event name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/players/i)).toHaveValue(11)
    expect(screen.getByLabelText(/rounds/i)).toHaveValue(11)
    expect(screen.getByLabelText(/stake/i)).toHaveValue(100)
    expect(screen.getByLabelText(/starting bankroll/i)).toHaveValue(1100)
  })

  it('calls createBetstravaganza on submit', async () => {
    mockCreateBz.mockResolvedValue({ data: { id: 'bz-1' } })
    render(<SetupForm />)

    fireEvent.change(screen.getByLabelText(/event name/i), { target: { value: 'Test BZ' } })
    fireEvent.submit(screen.getByRole('button', { name: /create/i }).closest('form')!)

    await waitFor(() => {
      expect(mockCreateBz).toHaveBeenCalledOnce()
    })
  })

  it('shows error message on failure', async () => {
    mockCreateBz.mockResolvedValue({ error: 'Database error' })
    render(<SetupForm />)

    fireEvent.change(screen.getByLabelText(/event name/i), { target: { value: 'Test' } })
    fireEvent.submit(screen.getByRole('button', { name: /create/i }).closest('form')!)

    await waitFor(() => {
      expect(screen.getByText('Database error')).toBeInTheDocument()
    })
  })

  it('disables submit button while loading', async () => {
    let resolve: (v: any) => void
    mockCreateBz.mockReturnValue(new Promise(r => { resolve = r }))
    render(<SetupForm />)

    fireEvent.change(screen.getByLabelText(/event name/i), { target: { value: 'Test' } })
    fireEvent.submit(screen.getByRole('button', { name: /create/i }).closest('form')!)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /create/i })).toBeDisabled()
    })

    resolve!({ data: {} })
  })
})
