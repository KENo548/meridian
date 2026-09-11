import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signUp } from '@/lib/auth'
import { useAuth } from '@/contexts/AuthContext'
import { APP_NAME } from '@/constants'

export function SignupPage() {
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const { user } = await signUp(username, email, password)
      if (user) setUser(user)
      navigate('/')
    } catch (err: any) {
      setError(err.message || 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-full flex items-center justify-center bg-[var(--color-bg)] px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-[var(--color-accent)]">{APP_NAME}</h1>
          <p className="mt-2 text-sm text-[var(--color-muted)]">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              minLength={3}
              maxLength={30}
              pattern="[a-zA-Z0-9_-]{3,30}"
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-muted)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              placeholder="Choose a username"
            />
            <p className="mt-1 text-xs text-[var(--color-muted)]">3-30 characters. Letters, numbers, underscores, hyphens. <span className="text-[var(--color-accent)]">Case-insensitive</span> — JohnDoe = johndoe.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-muted)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              placeholder="you@university.edu"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-muted)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              placeholder="Min 8 characters"
            />
            <p className="mt-1 text-xs text-[var(--color-muted)]">At least 8 characters with uppercase, lowercase, and a number.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-[var(--color-text)] mb-1.5">Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder-[var(--color-muted)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
              placeholder="Re-enter password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--color-bg)] hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </button>

          <p className="text-center text-sm text-[var(--color-muted)]">
            Already have an account?{' '}
            <Link to="/login" className="text-[var(--color-accent)] hover:underline">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
