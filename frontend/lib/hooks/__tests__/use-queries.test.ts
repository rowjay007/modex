import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useLoginMutation, useCoursesQuery } from '../use-queries'
import { authAPI, coursesAPI } from '../../api'

// Mock the API
vi.mock('../../api', () => ({
  authAPI: {
    login: vi.fn(),
    register: vi.fn(),
  },
  coursesAPI: {
    getAll: vi.fn(),
    getById: vi.fn(),
  },
  enrollmentAPI: {
    getUserEnrollments: vi.fn(),
    enroll: vi.fn(),
    updateProgress: vi.fn(),
  },
}))

// Mock Zustand stores
vi.mock('../../../stores/auth', () => ({
  useAuthStore: vi.fn(() => ({
    login: vi.fn(),
  })),
}))

vi.mock('../../../stores/course', () => ({
  useCourseStore: vi.fn(() => ({
    setCourses: vi.fn(),
    setCurrentCourse: vi.fn(),
    addToEnrolled: vi.fn(),
    updateProgress: vi.fn(),
  })),
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  })

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useLoginMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should login successfully', async () => {
    const mockResponse = {
      data: {
        token: 'mock-token',
        user: { id: '1', email: 'test@example.com', name: 'Test User', role: 'student' },
      },
    }

    vi.mocked(authAPI.login).mockResolvedValueOnce(mockResponse)

    const wrapper = createWrapper()
    const { result } = renderHook(() => useLoginMutation(), { wrapper })

    const credentials = { email: 'test@example.com', password: 'password' }
    result.current.mutate(credentials)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(authAPI.login).toHaveBeenCalledWith(credentials)
  })

  it('should handle login error', async () => {
    const mockError = new Error('Invalid credentials')
    vi.mocked(authAPI.login).mockRejectedValueOnce(mockError)

    const wrapper = createWrapper()
    const { result } = renderHook(() => useLoginMutation(), { wrapper })

    const credentials = { email: 'test@example.com', password: 'wrong-password' }
    result.current.mutate(credentials)

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBe(mockError)
  })
})

describe('useCoursesQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should fetch courses successfully', async () => {
    const mockCourses = [
      {
        id: '1',
        title: 'React Basics',
        description: 'Learn React fundamentals',
        instructor: 'John Doe',
        duration: '10 hours',
        students: 150,
        rating: 4.5,
        level: 'Beginner' as const,
        price: 99,
      },
    ]

    vi.mocked(coursesAPI.getAll).mockResolvedValueOnce({ data: mockCourses })

    const wrapper = createWrapper()
    const { result } = renderHook(() => useCoursesQuery(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toEqual(mockCourses)
    expect(coursesAPI.getAll).toHaveBeenCalledTimes(1)
  })

  it('should handle fetch error', async () => {
    const mockError = new Error('Failed to fetch courses')
    vi.mocked(coursesAPI.getAll).mockRejectedValueOnce(mockError)

    const wrapper = createWrapper()
    const { result } = renderHook(() => useCoursesQuery(), { wrapper })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(result.current.error).toBe(mockError)
  })
})
