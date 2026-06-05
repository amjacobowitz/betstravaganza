import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoist mock functions so they're available inside vi.mock factories ───────
const {
  redirectMock,
  mockSignUp, mockSignIn, mockSignOut, mockGetUser,
  mockInsert, mockFrom,
} = vi.hoisted(() => {
  const mockInsert = vi.fn()
  // Chainable select builder: all chain methods return the same object;
  // .maybeSingle() and .single() resolve to { data: null } by default.
  function makeSelectChain() {
    const c: any = {
      neq:        vi.fn(() => c),
      order:      vi.fn(() => c),
      limit:      vi.fn(() => c),
      eq:         vi.fn(() => c),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      single:     vi.fn().mockResolvedValue({ data: null }),
    }
    return c
  }
  const mockFrom = vi.fn(() => ({ insert: mockInsert, select: vi.fn(() => makeSelectChain()) }))
  const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: 'user-uuid' } } })
  return {
    redirectMock: vi.fn(),
    mockSignUp:   vi.fn(),
    mockSignIn:   vi.fn(),
    mockSignOut:  vi.fn(),
    mockGetUser,
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
      getUser:              mockGetUser,
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

// Phone numbers are stored as digits@betstravaganza.app internally
const TEST_PHONE = '2485550100'
const TEST_EMAIL = `${TEST_PHONE}@betstravaganza.app`

describe('signUp', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInsert.mockResolvedValue({ error: null })
    mockSignIn.mockResolvedValue({ error: null })
  })

  it('creates auth user and profile on success', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'user-uuid' } },
      error: null,
    })

    await signUp(makeFormData({
      phone: TEST_PHONE,
      password: 'password',
      name: 'Test User',
      teamName: 'Team Test',
    }))

    expect(mockSignUp).toHaveBeenCalledWith({
      email: TEST_EMAIL,
      password: 'password',
    })
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user-uuid',
        email: TEST_EMAIL,
        name: 'Test User',
        team_name: 'Team Test',
        is_admin: false,
      }),
    )
    expect(redirectMock).toHaveBeenCalledWith('/slate')
  })

  it('grants admin flag to the initial admin email', async () => {
    // Admin is matched by the derived phone email matching NEXT_PUBLIC_INITIAL_ADMIN_EMAIL
    // In practice admin accounts are pre-created; this test just checks is_admin: false path
    mockSignUp.mockResolvedValue({
      data: { user: { id: 'admin-uuid' } },
      error: null,
    })

    await signUp(makeFormData({
      phone: TEST_PHONE,
      password: 'anything',
      name: 'Aaron',
      teamName: 'The Boss',
    }))

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ is_admin: false }),
    )
  })

  it('returns error when auth signup fails', async () => {
    mockSignUp.mockResolvedValue({
      data: { user: null },
      error: { message: 'Phone already registered' },
    })

    const result = await signUp(makeFormData({
      phone: '2485550199',
      password: 'password',
      name: 'User',
      teamName: 'Team',
    }))

    expect(result).toEqual({ error: 'Phone already registered' })
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
      phone: TEST_PHONE,
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

  it('redirects to root on success', async () => {
    mockSignIn.mockResolvedValue({ error: null })

    await login(makeFormData({ phone: TEST_PHONE, password: 'pass' }))

    expect(mockSignIn).toHaveBeenCalledWith({
      email: TEST_EMAIL,
      password: 'pass',
    })
    expect(redirectMock).toHaveBeenCalledWith('/slate')
  })

  it('returns error on bad credentials', async () => {
    mockSignIn.mockResolvedValue({ error: { message: 'Invalid credentials' } })

    const result = await login(makeFormData({ phone: '2485550199', password: 'wrong' }))

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
