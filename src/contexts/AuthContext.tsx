import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { type AuthUser, getCurrentUser, signOut as apiSignOut } from '@/lib/auth'
import { clearUserSession } from '@/lib/db'

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  logout: () => Promise<void>
  setUser: (user: AuthUser | null) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    // Try sessionStorage first for instant restore
    try {
      const cached = sessionStorage.getItem('meridian_auth_user')
      if (cached) {
        const parsed = JSON.parse(cached) as AuthUser
        setUser(parsed)
        setLoading(false)
        // Still verify in background, but don't block UI
        getCurrentUser()
          .then(({ user: fresh }) => {
            if (mountedRef.current && fresh) {
              setUser(fresh)
              sessionStorage.setItem('meridian_auth_user', JSON.stringify(fresh))
            }
          })
          .catch(() => {
            // Session expired — clear cached user
            if (mountedRef.current) {
              setUser(null)
              sessionStorage.removeItem('meridian_auth_user')
            }
          })
        return () => { mountedRef.current = false }
      }
    } catch { /* sessionStorage unavailable */ }

    // No cached user — must check server (but don't block UI forever)
    getCurrentUser()
      .then(({ user: fresh }) => {
        if (mountedRef.current) {
          setUser(fresh)
          if (fresh) sessionStorage.setItem('meridian_auth_user', JSON.stringify(fresh))
        }
      })
      .catch(() => {
        if (mountedRef.current) setUser(null)
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false)
      })

    return () => { mountedRef.current = false }
  }, [])

  const setUserAndCache = useCallback((u: AuthUser | null) => {
    setUser(u)
    if (u) {
      try { sessionStorage.setItem('meridian_auth_user', JSON.stringify(u)) } catch { /* ignore */ }
    } else {
      try { sessionStorage.removeItem('meridian_auth_user') } catch { /* ignore */ }
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiSignOut()
    } catch {
      // Even if server call fails, clear local state
    }
    clearUserSession()
    setUserAndCache(null)
  }, [setUserAndCache])

  return (
    <AuthContext.Provider value={{ user, loading, logout, setUser: setUserAndCache }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
