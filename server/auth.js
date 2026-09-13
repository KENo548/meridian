import { Router } from 'express'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
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
import { sendPasswordResetEmail } from './email.js'

const router = Router()
const BCRYPT_ROUNDS = 12
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000 // 1 hour
const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,30}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_MIN = 8
const PASSWORD_MAX = 128

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT signing secret is not configured - set JWT_SECRET (or legacy SESSION_SECRET) in the environment')
}
const JWT_EXPIRY = '7d'
const COOKIE_NAME = 'meridian_token'
const isProduction = process.env.NODE_ENV === 'production'

function signToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRY })
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: '/',
  })
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  })
}

/** Verify JWT from cookie — no DB call, sub-millisecond */
export function verifyAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME]
  if (!token) return res.status(401).json({ error: 'Authentication required' })
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.userId = payload.sub
    next()
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

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

    if (getUserByUsername(username)) {
      return res.status(409).json({ error: 'Username already taken' })
    }
    if (getUserByEmail(email)) {
      return res.status(409).json({ error: 'Email already registered' })
    }

    const id = `usr_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS)
    const user = createUser(id, username, email, hash)

    const token = signToken(user.id)
    setAuthCookie(res, token)

    res.status(201).json({
      user: { id: user.id, username: user.username, email: user.email },
      message: 'Account created and signed in',
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

    let user = getUserByUsername(identifier)
    if (!user) user = getUserByEmail(identifier)
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const match = await bcrypt.compare(password, user.password_hash)
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const token = signToken(user.id)
    setAuthCookie(res, token)

    res.json({
      user: { id: user.id, username: user.username, email: user.email },
      message: 'Signed in',
    })
  } catch (err) {
    console.error('[Auth] Login error:', err.message)
    res.status(500).json({ error: 'Login failed' })
  }
})

// ─── Sign Out ─────────────────────────────────────────────────

router.post('/logout', (_req, res) => {
  clearAuthCookie(res)
  res.json({ message: 'Signed out' })
})

// ─── Current User ─────────────────────────────────────────────

router.get('/me', verifyAuth, (req, res) => {
  const user = getUserById(req.userId)
  if (!user) {
    clearAuthCookie(res)
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
    if (!user) {
      return res.json({ message: 'If that email is registered, you will receive a reset link.' })
    }

    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS).toISOString()
    const resetId = `rst_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`

    cleanupExpiredResets()
    createPasswordReset(resetId, user.id, tokenHash, expiresAt)

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173'
    const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`

    if (isProduction) {
      const emailResult = await sendPasswordResetEmail(user.email, resetUrl)
      if (!emailResult.success) {
        console.error(`[Auth] Failed to send reset email to ${user.email}:`, emailResult.error)
      }
    } else {
      console.log(`[Auth] Password reset token for ${user.email}: ${rawToken}`)
      console.log(`[Auth] Reset URL: ${resetUrl}`)
    }

    const response = {
      message: 'If that email is registered, you will receive a reset link.',
    }
    if (!isProduction) {
      response._dev_token = rawToken
      response._dev_url = resetUrl
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

    if (new Date(reset.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Reset token has expired' })
    }

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
