// Same-origin API: browser calls use relative /api/* paths, routed by the
// Vercel rewrite to the environment backend. No absolute base is needed
// (and none is read from the environment).
import {
  AuthRetryExhaustedError,
  LOGIN_MAX_ATTEMPTS,
  LOGIN_RETRY_DELAYS_MS,
  runWithAuthRetry,
} from './authRetry'

const AUTH_TIMEOUT_MS = 10000

export interface AuthUser {
  id: string
  username: string
  email: string
}

interface AuthResponse {
  user?: AuthUser
  message: string
  error?: string
  _dev_token?: string
  _dev_url?: string
}

async function apiCall<T>(path: string, options: RequestInit = {}, timeoutMs = 12000): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(path, {
      ...options,
      credentials: 'include',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
    return data as T
  } catch (err: any) {
    if (err?.name === 'AbortError') throw new Error('__COLD_START__')
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

export async function signUp(username: string, email: string, password: string): Promise<AuthResponse> {
  return authAttempt<AuthResponse>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  })
}

async function authAttempt<T>(path: string, options: RequestInit = {}): Promise<T> {
  try {
    return await apiCall<T>(path, options, AUTH_TIMEOUT_MS)
  } catch (err: any) {
    if (err?.message === '__COLD_START__') {
      throw new Error('The server is still starting up — please wait a few seconds, then try again.')
    }
    throw err
  }
}

export async function signIn(
  identifier: string,
  password: string,
  onRetry?: (attempt: number, maxAttempts: number) => void,
): Promise<AuthResponse> {
  try {
    const { value } = await runWithAuthRetry(
      () => apiCall<AuthResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password }),
      }, AUTH_TIMEOUT_MS),
      {
        maxAttempts: LOGIN_MAX_ATTEMPTS,
        delaysMs: LOGIN_RETRY_DELAYS_MS,
        onRetry: onRetry
          ? (info) => { onRetry(info.attempt, info.maxAttempts) }
          : undefined,
      },
    )
    return value
  } catch (err: any) {
    if (err instanceof AuthRetryExhaustedError) {
      throw new Error('Meridian is temporarily unavailable after several attempts. Please wait a minute, then try again.')
    }
    throw err
  }
}

export async function signOut(): Promise<AuthResponse> {
  return apiCall<AuthResponse>('/api/auth/logout', {
    method: 'POST',
  })
}

export async function getCurrentUser(): Promise<{ user: AuthUser | null }> {
  try {
    return await apiCall<{ user: AuthUser }>('/api/auth/me', {}, 10000)
  } catch {
    return { user: null }
  }
}

export async function forgotPassword(email: string): Promise<AuthResponse> {
  return apiCall<AuthResponse>('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function resetPassword(token: string, password: string): Promise<AuthResponse> {
  return apiCall<AuthResponse>('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  })
}
