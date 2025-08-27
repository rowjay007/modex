import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '../auth'

describe('Auth Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    const { logout } = useAuthStore.getState()
    logout()
  })

  it('should have initial state', () => {
    const state = useAuthStore.getState()
    
    expect(state.user).toBeNull()
    expect(state.token).toBeNull()
    expect(state.isAuthenticated).toBe(false)
    expect(state.isLoading).toBe(false)
  })

  it('should login user correctly', () => {
    const { login } = useAuthStore.getState()
    const mockUser = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'student' as const
    }
    const mockToken = 'mock-token'

    login(mockToken, mockUser)

    const state = useAuthStore.getState()
    expect(state.user).toEqual(mockUser)
    expect(state.token).toBe(mockToken)
    expect(state.isAuthenticated).toBe(true)
    expect(state.isLoading).toBe(false)
  })

  it('should logout user correctly', () => {
    const { login, logout } = useAuthStore.getState()
    const mockUser = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'student' as const
    }

    // First login
    login('mock-token', mockUser)
    expect(useAuthStore.getState().isAuthenticated).toBe(true)

    // Then logout
    logout()

    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.token).toBeNull()
    expect(state.isAuthenticated).toBe(false)
    expect(state.isLoading).toBe(false)
  })

  it('should set loading state', () => {
    const { setLoading } = useAuthStore.getState()

    setLoading(true)
    expect(useAuthStore.getState().isLoading).toBe(true)

    setLoading(false)
    expect(useAuthStore.getState().isLoading).toBe(false)
  })

  it('should update user', () => {
    const { login, setUser } = useAuthStore.getState()
    const mockUser = {
      id: '1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'student' as const
    }

    login('mock-token', mockUser)

    const updatedUser = {
      ...mockUser,
      name: 'Updated User'
    }

    setUser(updatedUser)

    const state = useAuthStore.getState()
    expect(state.user?.name).toBe('Updated User')
    expect(state.user?.id).toBe('1')
  })
})
