import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getCurrentUser, signIn } from '@/lib/auth'
import { useAuth } from '@/contexts/AuthContext'
import { APP_NAME, APP_TAGLINE } from '@/constants'
import { Loader2 } from 'lucide-react'

export function LoginPage() {
  const { setUser, user } = useAuth()
  const navigate = useNavigate()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)

  // If user is already logged in (cached), redirect via effect
  if (user) {
    navigate('/', { replace: true })
    return null
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { user: newUser } = await signIn(
        identifier,
        password,
        (attempt, maxAttempts) => {
          setNotice(`Waking Meridian — retrying… (attempt ${attempt} of ${maxAttempts})`)
        },
      )
      if (!newUser) {
        setError('Sign in failed')
        return
      }
      // Verify the session cookie was accepted before entering the app.
      // A 200 login response alone does not prove the browser will send
      // the cookie back (e.g. third-party-cookie blocking).
      const session = await getCurrentUser()
      if (!session.user) {
        setError('Sign-in could not be verified just now. Please check cookie settings, then try again.')
        return
      }
      setUser(session.user)
      try { sessionStorage.setItem('meridian_auth_user', JSON.stringify(session.user)) } catch { /* ignore */ }
      navigate('/')
    } catch (err: any) {
      setError(err.message || 'Sign in failed')
    } finally {
      setLoading(false)
      setNotice('')
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center bg-[var(--color-bg)] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-[var(--color-accent)]">{APP_NAME}</h1>
          <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[var(--color-faint)]">
            {APP_TAGLINE}
          </p>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Sign in to your tracker</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6">
          {notice && !error && (
            <div className="text-sm rounded-lg px-4 py-3 bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Loader2 className="size-3.5 animate-spin inline-block mr-2" />
              {notice}
            </div>
          )}

          {error && (
            <div className={`text-sm rounded-lg px-4 py-3 ${
              error.includes('waking up') || error.includes('try again')
                ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}>
              {error.includes('waking up') && (
                <Loader2 className="size-3.5 animate-spin inline-block mr-2" />
              )}
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Username or Email</label>
            <input
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoFocus
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-muted)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              placeholder="Enter username or email"
            />
            <p className="mt-1 text-xs text-[var(--color-muted)]">Username is <span className="text-[var(--color-accent)]">case-insensitive</span> — JohnDoe = johndoe.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-muted)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              placeholder="Enter password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--color-bg)] hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="size-3.5 animate-spin" />}
            {loading ? 'Signing in…' : 'Sign In'}
          </button>

          <div className="flex items-center justify-between text-sm">
            <Link to="/forgot-password" className="text-[var(--color-accent)] hover:underline">Forgot password?</Link>
            <Link to="/signup" className="text-[var(--color-muted)] hover:text-[var(--color-text)]">Create account</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
