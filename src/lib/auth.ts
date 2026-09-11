const API_BASE = import.meta.env.VITE_API_BASE
  || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001'
    : `http://${window.location.hostname}:3001`)

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

async function apiCall<T>(path: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(`${API_BASE}${path}`, {
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
    if (err?.name === 'AbortError') throw new Error('Server is starting up, please try again')
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

export async function signUp(username: string, email: string, password: string): Promise<AuthResponse> {
  return apiCall<AuthResponse>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ username, email, password }),
  })
}

export async function signIn(identifier: string, password: string): Promise<AuthResponse> {
  return apiCall<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  })
}

export async function signOut(): Promise<AuthResponse> {
  return apiCall<AuthResponse>('/api/auth/logout', {
    method: 'POST',
  })
}

export async function getCurrentUser(): Promise<{ user: AuthUser }> {
  return apiCall<{ user: AuthUser }>('/api/auth/me')
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
