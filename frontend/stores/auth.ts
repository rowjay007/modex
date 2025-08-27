import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

export interface User {
  id: string
  email: string
  name: string
  role: 'admin' | 'instructor' | 'student'
  avatar?: string
}

interface AuthState {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  
  // Actions
  login: (token: string, user: User) => void
  logout: () => void
  setUser: (user: User) => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,

        login: (token: string, user: User) => {
          localStorage.setItem('auth_token', token)
          set({ 
            token, 
            user, 
            isAuthenticated: true,
            isLoading: false 
          }, false, 'auth/login')
        },

        logout: () => {
          localStorage.removeItem('auth_token')
          set({ 
            token: null, 
            user: null, 
            isAuthenticated: false,
            isLoading: false 
          }, false, 'auth/logout')
        },

        setUser: (user: User) => {
          set({ user }, false, 'auth/setUser')
        },

        setLoading: (loading: boolean) => {
          set({ isLoading: loading }, false, 'auth/setLoading')
        },
      }),
      {
        name: 'auth-store',
        partialize: (state) => ({ 
          user: state.user, 
          token: state.token,
          isAuthenticated: state.isAuthenticated 
        }),
      }
    ),
    { name: 'AuthStore' }
  )
)
