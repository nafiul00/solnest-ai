import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const DASHBOARD_EMAIL    = import.meta.env.VITE_DASHBOARD_EMAIL    ?? 'admin@solneststays.com'
const DASHBOARD_PASSWORD = import.meta.env.VITE_DASHBOARD_PASSWORD ?? 'solnest2024'
const API_KEY            = import.meta.env.VITE_API_KEY            ?? ''

interface AuthState {
  isAuthenticated: boolean
  email: string | null
  token: string | null
  login: (email: string, password: string) => Promise<boolean>
  logout: () => void
}

function generateToken(email: string): string {
  const payload = btoa(JSON.stringify({ email, iat: Date.now(), exp: Date.now() + 8 * 3600_000 }))
  const sig = btoa(`${email}:${Date.now()}:solnest`).slice(0, 16)
  return `${payload}.${sig}`
}

function isTokenExpired(token: string): boolean {
  try {
    const [payload] = token.split('.')
    const { exp } = JSON.parse(atob(payload))
    return Date.now() > exp
  } catch {
    return true
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, _get) => ({
      isAuthenticated: false,
      email: null,
      token: null,

      login: async (email, password) => {
        // Simulate network latency
        await new Promise(r => setTimeout(r, 800))

        const emailMatch    = email.toLowerCase().trim() === DASHBOARD_EMAIL.toLowerCase()
        const passwordMatch = password === DASHBOARD_PASSWORD

        if (!emailMatch || !passwordMatch) return false

        const token = generateToken(email)
        set({ isAuthenticated: true, email, token })
        return true
      },

      logout: () => {
        set({ isAuthenticated: false, email: null, token: null })
      },
    }),
    {
      name: 'cortex-auth',
      // Validate stored session on rehydration
      onRehydrateStorage: () => (state) => {
        if (state?.token && isTokenExpired(state.token)) {
          state.isAuthenticated = false
          state.token = null
          state.email = null
        }
      },
    }
  )
)

/** Returns the Bearer token for API requests, or empty string if not authenticated */
export function getAuthHeader(): string {
  const { token } = useAuthStore.getState()
  if (token) return `Bearer ${token}`
  // Fall back to static API key if set
  if (API_KEY) return `Bearer ${API_KEY}`
  return ''
}
