import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoist mock functions so they're available inside vi.mock factories ───────
const {
  redirectMock,
  mockSignUp, mockSignIn, mockSignOut,
  mockInsert, mockFrom,
} = vi.hoisted(() => {
  const mockInsert = vi.fn()
  const mockFrom   = vi.fn(() => ({ insert: mockInsert }))
  return {
    redirectMock: vi.fn(),
    mockSignUp:   vi.fn(),
    mockSignIn:   vi.fn(),
    mockSignOut:  vi.fn(),
    mockInsert,
    mockFrom,
  }
})

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: vi.fn(),
  }),
}))

vi.mock('next/navigation', () => ({ redirect: redirectMock }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      signUp:               mockSignUp,
      signInWithPassword:   mockSignIn,
      signOut:              mockSignOut,
    },
    from: mockFrom,
  }),
  createAdminClient: vi.fn().mockResolvedValue({
    auth: { signUp: mockSignUp },
    from: mockFrom,
  }),
}))

import { signUp, login, logout } from '@/lib/actions/auth'

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData()
  Object.entries(data).forEach(([k, v]) => fd.append(k, v))
  return fd
}

describe('signUp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInsert.mockResolvedValue({ error: null })
  })

  it('creates auth user and profile on success', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'user-uuid' } },
      error: null,
    })

    await signUp(makeFormData({
      email: 'test@example.com',
      password: 'password',
      name: 'Test User',
      teamName: 'Team Test',
    }))

    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password',
    })
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user-uuid',
        email: 'test@example.com',
        name: 'Test User',
        team_name: 'Team Test',
        is_admin: false,
      }),
    )
    expect(redirectMock).toHaveBeenCalledWith('/leaderboard')
  })

  it('grants admin flag to the initial admin email', async () => {
    process.env.NEXT_PUBLIC_INITIAL_ADMIN_EMAIL = 'amjacobowitz@gmail.com'
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'admin-uuid' } },
      error: null,
    })

    await signUp(makeFormData({
      email: 'amjacobowitz@gmail.com',
      password: 'anything',
      name: 'Aaron',
      teamName: 'The Boss',
    }))

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ is_admin: true }),
    )
  })

  it('returns error when auth signup fails', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null },
      error: { message: 'Email already registered' },
    })

    const result = await signUp(makeFormData({
      email: 'taken@example.com',
      password: 'password',
      name: 'User',
      teamName: 'Team',
    }))

    expect(result).toEqual({ error: 'Email already registered' })
    expect(mockInsert).not.toHaveBeenCalled()
    expect(redirectMock).not.toHaveBeenCalled()
  })

  it('returns error when profile insert fails', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'user-uuid' } },
      error: null,
    })
    mockInsert.mockResolvedValue({ error: { message: 'DB constraint violation' } })

    const result = await signUp(makeFormData({
      email: 'test@example.com',
      password: 'password',
      name: 'User',
      teamName: 'Team',
    }))

    expect(result).toEqual({ error: 'DB constraint violation' })
    expect(redirectMock).not.toHaveBeenCalled()
  })
})

describe('login', () => {
  beforeEach(() => vi.clearAllMocks())

  it('redirects to leaderboard on success', async () => {
    mockSignIn.mockResolvedValue({ error: null })

    await login(makeFormData({ email: 'user@test.com', password: 'pass' }))

    expect(mockSignIn).toHaveBeenCalledWith({
      email: 'user@test.com',
      password: 'pass',
    })
    expect(redirectMock).toHaveBeenCalledWith('/leaderboard')
  })

  it('returns error on bad credentials', async () => {
    mockSignIn.mockResolvedValue({ error: { message: 'Invalid credentials' } })

    const result = await login(makeFormData({ email: 'x@x.com', password: 'wrong' }))

    expect(result).toEqual({ error: 'Invalid credentials' })
    expect(redirectMock).not.toHaveBeenCalled()
  })
})

describe('logout', () => {
  it('signs out and redirects to login', async () => {
    mockSignOut.mockResolvedValue({})

    await logout()

    expect(mockSignOut).toHaveBeenCalled()
    expect(redirectMock).toHaveBeenCalledWith('/login')
  })
})
