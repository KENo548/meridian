import { Router } from 'express'
import bcrypt from 'bcrypt'
import crypto from 'node:crypto'
import {
  createUser,
  getUserById,
  getUserByUsername,
  getUserByEmail,
  updateUserPassword,
  createPasswordReset,
  getPasswordReset,
  usePasswordReset,
  cleanupExpiredResets,
} from './db.js'

const router = Router()
const BCRYPT_ROUNDS = 12
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000 // 1 hour
const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,30}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_MIN = 8
const PASSWORD_MAX = 128

function validatePassword(pw) {
  if (pw.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters`
  if (pw.length > PASSWORD_MAX) return `Password must be at most ${PASSWORD_MAX} characters`
  if (!/[A-Z]/.test(pw)) return 'Password must contain an uppercase letter'
  if (!/[a-z]/.test(pw)) return 'Password must contain a lowercase letter'
  if (!/[0-9]/.test(pw)) return 'Password must contain a number'
  return null
}

// ─── Sign Up ──────────────────────────────────────────────────

router.post('/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body || {}

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' })
    }

    if (!USERNAME_REGEX.test(username)) {
      return res.status(400).json({ error: 'Username must be 3-30 characters (letters, numbers, underscores, hyphens)' })
    }

    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' })
    }

    const pwError = validatePassword(password)
    if (pwError) return res.status(400).json({ error: pwError })

    // Check duplicates
    if (getUserByUsername(username)) {
      return res.status(409).json({ error: 'Username already taken' })
    }
    if (getUserByEmail(email)) {
      return res.status(409).json({ error: 'Email already registered' })
    }

    const id = `usr_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS)
    const user = createUser(id, username, email, hash)

    // Auto-login after signup
    req.session.userId = id
    req.session.save((err) => {
      if (err) {
        console.error('[Auth] Session save error:', err.message)
        return res.status(201).json({
          user: { id: user.id, username: user.username, email: user.email },
          message: 'Account created. Please sign in.',
        })
      }
      res.status(201).json({
        user: { id: user.id, username: user.username, email: user.email },
        message: 'Account created and signed in',
      })
    })
  } catch (err) {
    console.error('[Auth] Signup error:', err.message)
    res.status(500).json({ error: 'Signup failed' })
  }
})

// ─── Sign In ──────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body || {}

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Username/email and password are required' })
    }

    // Look up by username or email
    let user = getUserByUsername(identifier)
    if (!user) user = getUserByEmail(identifier)
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const match = await bcrypt.compare(password, user.password_hash)
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    req.session.userId = user.id
    req.session.save((err) => {
      if (err) {
        console.error('[Auth] Session save error:', err.message)
        return res.status(500).json({ error: 'Login failed' })
      }
      res.json({
        user: { id: user.id, username: user.username, email: user.email },
        message: 'Signed in',
      })
    })
  } catch (err) {
    console.error('[Auth] Login error:', err.message)
    res.status(500).json({ error: 'Login failed' })
  }
})

// ─── Sign Out ─────────────────────────────────────────────────

router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('[Auth] Logout error:', err.message)
      return res.status(500).json({ error: 'Logout failed' })
    }
    res.clearCookie('meridian.sid')
    res.json({ message: 'Signed out' })
  })
})

// ─── Current User ─────────────────────────────────────────────

router.get('/me', (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Not authenticated' })
  }
  const user = getUserById(req.session.userId)
  if (!user) {
    return res.status(401).json({ error: 'User not found' })
  }
  res.json({ user: { id: user.id, username: user.username, email: user.email } })
})

// ─── Forgot Password (request reset) ─────────────────────────

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body || {}
    if (!email) return res.status(400).json({ error: 'Email is required' })

    const user = getUserByEmail(email)
    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ message: 'If that email is registered, you will receive a reset link.' })
    }

    // Generate token (stored as SHA-256 hash)
    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS).toISOString()
    const resetId = `rst_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`

    // Cleanup old resets for this user
    cleanupExpiredResets()
    createPasswordReset(resetId, user.id, tokenHash, expiresAt)

    // In production, send email with rawToken link
    // For now, return the token (dev mode only)
    const isProduction = process.env.NODE_ENV === 'production'
    if (!isProduction) {
      console.log(`[Auth] Password reset token for ${user.email}: ${rawToken}`)
      console.log(`[Auth] Reset URL: http://localhost:5173/reset-password?token=${rawToken}`)
    }

    const response = {
      message: 'If that email is registered, you will receive a reset link.',
    }
    // Dev-only: include token in response
    if (!isProduction) {
      response._dev_token = rawToken
      response._dev_url = `http://localhost:5173/reset-password?token=${rawToken}`
    }

    res.json(response)
  } catch (err) {
    console.error('[Auth] Forgot password error:', err.message)
    res.status(500).json({ error: 'Password reset request failed' })
  }
})

// ─── Reset Password ──────────────────────────────────────────

router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body || {}
    if (!token || !password) {
      return res.status(400).json({ error: 'Token and new password are required' })
    }

    const pwError = validatePassword(password)
    if (pwError) return res.status(400).json({ error: pwError })

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const reset = getPasswordReset(tokenHash)

    if (!reset) {
      return res.status(400).json({ error: 'Invalid or expired reset token' })
    }

    // Check expiry
    if (new Date(reset.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Reset token has expired' })
    }

    // Update password
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS)
    updateUserPassword(reset.user_id, hash)
    usePasswordReset(tokenHash)

    res.json({ message: 'Password has been reset. You can now sign in.' })
  } catch (err) {
    console.error('[Auth] Reset password error:', err.message)
    res.status(500).json({ error: 'Password reset failed' })
  }
})

export default router
