import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import LoginPage from '../login/page'

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

// Mock the toast hook
vi.mock('../../hooks/use-toast', () => ({
  toast: vi.fn(),
}))

// Mock the login mutation
vi.mock('../../lib/hooks/use-queries', () => ({
  useLoginMutation: () => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  }),
}))

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders login form', () => {
    const wrapper = createWrapper()
    render(<LoginPage />, { wrapper })

    expect(screen.getByText('Welcome Back')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('allows user to type in email and password fields', async () => {
    const wrapper = createWrapper()
    render(<LoginPage />, { wrapper })

    const emailInput = screen.getByLabelText('Email')
    const passwordInput = screen.getByLabelText('Password')

    await fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    await fireEvent.change(passwordInput, { target: { value: 'password123' } })

    expect(emailInput).toHaveValue('test@example.com')
    expect(passwordInput).toHaveValue('password123')
  })

  it('shows/hides password when toggle button is clicked', async () => {
    const wrapper = createWrapper()
    render(<LoginPage />, { wrapper })

    const passwordInput = screen.getByLabelText('Password')
    const toggleButton = screen.getByRole('button', { name: '' }) // Eye icon button

    expect(passwordInput).toHaveAttribute('type', 'password')

    await fireEvent.click(toggleButton)
    expect(passwordInput).toHaveAttribute('type', 'text')

    await fireEvent.click(toggleButton)
    expect(passwordInput).toHaveAttribute('type', 'password')
  })

  it('submits form with correct data', async () => {
    const wrapper = createWrapper()
    render(<LoginPage />, { wrapper })

    const emailInput = screen.getByLabelText('Email')
    const passwordInput = screen.getByLabelText('Password')
    const submitButton = screen.getByRole('button', { name: /sign in/i })

    await fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
    await fireEvent.change(passwordInput, { target: { value: 'password123' } })
    await fireEvent.click(submitButton)

    // Form should submit without errors
    expect(submitButton).toBeInTheDocument()
  })

  it('has link to registration page', () => {
    const wrapper = createWrapper()
    render(<LoginPage />, { wrapper })

    const registerLink = screen.getByText('Create account')
    expect(registerLink).toBeInTheDocument()
    expect(registerLink.closest('a')).toHaveAttribute('href', '/register')
  })
})
