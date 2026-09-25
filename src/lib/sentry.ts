/**
 * Privacy-safe frontend error monitoring (Sentry, Round 1).
 *
 * Contract:
 * - Initializes ONLY when VITE_SENTRY_DSN exists; always fails open.
 * - sendDefaultPii: false. No tracing, no Replay, no profiling, no logs.
 * - No user identity: we never call setUser, and the scrubber deletes
 *   any event.user payload before it leaves the browser.
 * - Every event passes through scrubSentryEvent(): workspace content
 *   (notes, documents, contacts, tasks, job descriptions), credentials,
 *   tokens, cookies, and request bodies are redacted. Technical context
 *   (route, error type, release, commit, environment) is preserved.
 *
 * The SDK is loaded with a dynamic import inside initSentry() so this
 * module is safe to import when the DSN is absent. All public helpers
 * are fail-open: Sentry must never break Meridian.
 */

import { getFrontendCommit, getFrontendEnvironment, getFrontendRelease } from './release.ts'

export const REDACTED = '[Redacted]'

// Key fragments whose VALUES must never leave the browser. Matched
// case-insensitively. Deliberately broad: Round 1 prefers over-redaction
// to a workspace-content leak.
const SENSITIVE_KEY_PARTS = [
  'authorization',
  'cookie',
  'password',
  'passwd',
  'secret',
  'token',
  'jwt',
  'session',
  'database_url',
  'databaseurl',
  'gmail',
  'app_password',
  'apppassword',
  'api_key',
  'apikey',
  'reset',
  'filedata',
  'file_data',
  'file',
  'document',
  'notes',
  'note',
  'description',
  'content',
  'body',
  'bio',
  'summary',
  'cover',
  'letter',
  'email',
  'e-mail',
  'linkedin',
  'phone',
  'contact',
  'address',
  'company',
  'requirement',
  'timing',
  'assessment',
  'visa',
  'eligibility',
  'process',
  'observation',
  'application',
  'job',
  'task',
  'firm',
  'opportunit',
  'workspace',
  'record',
  'payload',
  'records',
  'items',
  'data',
  'credential',
  'auth',
  'login',
  'owner',
  'user',
]

const SENSITIVE_PARAM_PARTS = [
  'token',
  'code',
  'email',
  'password',
  'secret',
  'key',
  'auth',
  'session',
  'user',
  'reset',
  'invite',
]

// Headers use a narrower list than body keys: only credential-carrying
// headers are redacted, so technical headers (Content-Type, User-Agent,
// Accept) survive for diagnostics.
const SENSITIVE_HEADER_PARTS = [
  'authorization',
  'cookie',
  'set-cookie',
  'token',
  'session',
  'secret',
  'api-key',
  'apikey',
  'jwt',
  'x-auth',
  'xsrf',
]

interface SentryLike {
  init: (options: Record<string, unknown>) => void
  captureException: (err: unknown, context?: Record<string, unknown>) => void
}

interface InitOptions {
  dsn?: string
  release?: string
  environment?: string
  loader?: () => Promise<SentryLike>
  sentryOptions?: Record<string, unknown>
}

function readDsn(): string {
  try {
    const env = (import.meta as unknown as { env?: { VITE_SENTRY_DSN?: string } })?.env
    const dsn = env?.VITE_SENTRY_DSN
    return typeof dsn === 'string' ? dsn : ''
  } catch {
    return ''
  }
}

function isSensitiveKey(key: unknown): boolean {
  if (typeof key !== 'string') return false
  const lower = key.toLowerCase()
  return SENSITIVE_KEY_PARTS.some((part) => lower.includes(part))
}

function isSensitiveParam(name: unknown): boolean {
  if (typeof name !== 'string') return false
  const lower = name.toLowerCase()
  return SENSITIVE_PARAM_PARTS.some((part) => lower.includes(part))
}

/** Redact connection strings / bearer tokens / secret pairs in free text. */
export function scrubString(value: string): string {
  if (typeof value !== 'string') return value
  let out = value
  out = out.replace(/postgres(?:ql)?:\/\/[^\s"'`]+/gi, REDACTED)
  out = out.replace(/bearer\s+[A-Za-z0-9\-._~+/=]+/gi, `Bearer ${REDACTED}`)
  out = out.replace(
    /((?:password|passwd|secret|token|api[-_]?key|session|authorization)\s*[:=]\s*)([^\s&,;"']+)/gi,
    `$1${REDACTED}`,
  )
  return out
}

/**
 * Scrub a URL: drop the fragment, redact sensitive query values, and
 * normalize UUID / long-hex path segments. Never throws.
 */
export function scrubUrl(rawUrl: string): string {
  if (typeof rawUrl !== 'string' || !rawUrl) return rawUrl
  try {
    // Strip URL userinfo (credentials) first: userinfo never leaves the
    // browser. `https://user:pass@host/` becomes `https://host/`.
    const withoutUserinfo = rawUrl.replace(
      /^((?:[a-z][a-z0-9+.-]*:)?\/\/)[^/?#]*@/i,
      '$1',
    )
    const hashIndex = withoutUserinfo.indexOf('#')
    const withoutFragment =
      hashIndex === -1 ? withoutUserinfo : withoutUserinfo.slice(0, hashIndex)
    const queryIndex = withoutFragment.indexOf('?')
    let path = queryIndex === -1 ? withoutFragment : withoutFragment.slice(0, queryIndex)
    path = path.replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      ':id',
    )
    path = path.replace(/\b[0-9a-f]{32,64}\b/gi, ':hash')
    if (queryIndex === -1) return path
    const query = withoutFragment.slice(queryIndex + 1)
    const scrubbed = query
      .split('&')
      .map((pair) => {
        const eq = pair.indexOf('=')
        if (eq === -1) return isSensitiveParam(pair) ? REDACTED : pair
        const name = pair.slice(0, eq)
        return isSensitiveParam(name) ? `${name}=${REDACTED}` : pair
      })
      .join('&')
    return `${path}?${scrubbed}`
  } catch {
    return REDACTED
  }
}

function isSensitiveHeader(name: unknown): boolean {
  if (typeof name !== 'string') return false
  const lower = name.toLowerCase()
  return SENSITIVE_HEADER_PARTS.some((part) => lower.includes(part))
}

function scrubHeaders(headers: unknown): unknown {
  if (!headers || typeof headers !== 'object') return headers
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(headers as Record<string, unknown>)) {
    const value = (headers as Record<string, unknown>)[key]
    out[key] = isSensitiveHeader(key) ? REDACTED : scrubString(String(value))
  }
  return out
}

/** Recursively scrub a value; sensitive keys become [Redacted]. */
export function scrubValue(value: unknown, key?: unknown): unknown {
  if (typeof key === 'string' && isSensitiveKey(key)) return REDACTED
  if (typeof value === 'string') return scrubString(value)
  if (Array.isArray(value)) return value.map((item) => scrubValue(item))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const childKey of Object.keys(value as Record<string, unknown>)) {
      out[childKey] = scrubValue((value as Record<string, unknown>)[childKey], childKey)
    }
    return out
  }
  return value
}

function cloneEvent(event: unknown): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(event)) as Record<string, unknown>
  } catch {
    return {}
  }
}

interface StackFrameLike {
  pre_context?: unknown
  context_line?: unknown
  post_context?: unknown
  [key: string]: unknown
}

/**
 * Strip frame SOURCE CONTENT while keeping stack LOCATION.
 *
 * SDK context integrations embed neighboring source lines (pre_context /
 * context_line / post_context) into stack frames. Source text is not
 * trustworthy payload: it can contain sensitive literals. We keep
 * filename / function / lineno / colno / module / in_app and delete only
 * the content fields. Covers every exception value and, where present,
 * thread stack frames. Never throws.
 */
export function stripFrameSourceContent<T>(event: T): T {
  try {
    if (!event || typeof event !== 'object') return event
    const stripFrames = (frames: unknown): void => {
      if (!Array.isArray(frames)) return
      for (const frame of frames) {
        if (!frame || typeof frame !== 'object') continue
        const target = frame as StackFrameLike
        delete target.pre_context
        delete target.context_line
        delete target.post_context
      }
    }
    const record = event as Record<string, unknown>
    const exception = record.exception as
      | { values?: Array<{ stacktrace?: { frames?: unknown } }> }
      | undefined
    if (Array.isArray(exception?.values)) {
      for (const value of exception.values) {
        stripFrames(value?.stacktrace?.frames)
      }
    }
    const threads = record.threads as
      | { values?: Array<{ stacktrace?: { frames?: unknown } }> }
      | undefined
    if (Array.isArray(threads?.values)) {
      for (const thread of threads.values) {
        stripFrames(thread?.stacktrace?.frames)
      }
    }
    return event
  } catch {
    return event
  }
}

interface IntegrationLike {
  name?: unknown
  [key: string]: unknown
}

/**
 * Default-integrations filter: remove the integration named ContextLines,
 * which embeds surrounding source CONTENT into stack frames. All other
 * defaults are preserved. Never throws.
 */
export function withoutContextLines(
  defaultIntegrations: unknown,
): unknown {
  try {
    const list = Array.isArray(defaultIntegrations) ? defaultIntegrations : []
    return list.filter(
      (integration) =>
        !integration ||
        (integration as IntegrationLike).name !== 'ContextLines',
    )
  } catch {
    return defaultIntegrations
  }
}

/**
 * beforeSend-compatible scrubber. Removes user identity, request bodies,
 * cookies, auth headers, and workspace content; keeps route, error type,
 * stack (string-scrubbed), release, commit, and environment.
 * Never throws; never returns null.
 */
export function scrubSentryEvent(event: unknown): Record<string, unknown> {
  try {
    if (!event || typeof event !== 'object') return {}
    const scrubbed = cloneEvent(event)
    // Stack LOCATION without neighboring source CONTENT (see
    // stripFrameSourceContent). Runs before any string scrubbing so no
    // source literal can survive via frame context.
    stripFrameSourceContent(scrubbed)
    delete scrubbed.user
    const request = scrubbed.request
    if (request && typeof request === 'object') {
      const req = request as Record<string, unknown>
      delete req.cookies
      delete req.data
      delete req.body
      delete req.form
      if (req.headers) req.headers = scrubHeaders(req.headers)
      if (typeof req.url === 'string') req.url = scrubUrl(req.url)
    }
    const exception = scrubbed.exception
    if (exception && typeof exception === 'object') {
      try {
        scrubbed.exception = JSON.parse(scrubString(JSON.stringify(exception)))
      } catch {
        scrubbed.exception = {}
      }
    }
    if (typeof scrubbed.message === 'string') {
      scrubbed.message = scrubString(scrubbed.message)
    }
    if (Array.isArray(scrubbed.breadcrumbs)) {
      scrubbed.breadcrumbs = (scrubbed.breadcrumbs as unknown[]).map((crumb) => {
        if (!crumb || typeof crumb !== 'object') return crumb
        const copy = { ...(crumb as Record<string, unknown>) }
        if (typeof copy.message === 'string') copy.message = scrubString(copy.message)
        if (copy.data && typeof copy.data === 'object') copy.data = scrubValue(copy.data)
        if (typeof copy.url === 'string') copy.url = scrubUrl(copy.url)
        return copy
      })
    }
    if (scrubbed.extra && typeof scrubbed.extra === 'object') {
      scrubbed.extra = scrubValue(scrubbed.extra)
    }
    if (scrubbed.contexts && typeof scrubbed.contexts === 'object') {
      scrubbed.contexts = scrubValue(scrubbed.contexts)
    }
    if (scrubbed.tags && typeof scrubbed.tags === 'object') {
      const tags: Record<string, unknown> = {}
      for (const tagKey of Object.keys(scrubbed.tags as Record<string, unknown>)) {
        const tagValue = (scrubbed.tags as Record<string, unknown>)[tagKey]
        tags[tagKey] = isSensitiveKey(tagKey) ? REDACTED : scrubString(String(tagValue))
      }
      scrubbed.tags = tags
    }
    return scrubbed
  } catch {
    return {}
  }
}

/** Scrub technical context attached to a capture call. */
export function scrubCaptureContext(context: unknown): Record<string, unknown> {
  try {
    if (context && typeof context === 'object') {
      return scrubValue(context) as Record<string, unknown>
    }
    return {}
  } catch {
    return {}
  }
}

let sentryClient: SentryLike | null = null
let sentryEnabled = false

export function isSentryEnabled(): boolean {
  return sentryEnabled
}

/** Test hook: forget the client so tests stay isolated. */
export function resetSentryForTests(): void {
  sentryClient = null
  sentryEnabled = false
}

/**
 * Initialize Sentry. No-op (false) when VITE_SENTRY_DSN is absent. Any
 * failure resolves false; never throws. `loader` is injectable for
 * deterministic tests (defaults to the real React SDK).
 */
export async function initSentry(options: InitOptions = {}): Promise<boolean> {
  const rawDsn = options.dsn !== undefined ? options.dsn : readDsn()
  if (typeof rawDsn !== 'string' || !rawDsn.trim()) {
    return false
  }
  try {
    const loader =
      options.loader ??
      (() => import('@sentry/react') as unknown as Promise<SentryLike>)
    const Sentry = await loader()
    if (!Sentry || typeof Sentry.init !== 'function') return false
    Sentry.init({
      dsn: rawDsn.trim(),
      release: options.release ?? getFrontendRelease(),
      environment: options.environment ?? getFrontendEnvironment(),
      sendDefaultPii: false,
      // Round 1: Error Monitoring only. No tracing / Replay / profiling.
      tracesSampleRate: 0,
      enableTracing: false,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      profilesSampleRate: 0,
      enableLogs: false,
      attachStacktrace: true,
      // Primary source-context prevention: never collect neighboring
      // source CONTENT. An explicit integrations override in
      // sentryOptions still wins.
      integrations: withoutContextLines,
      beforeSend(event: unknown) {
        try {
          return scrubSentryEvent(event)
        } catch {
          return event
        }
      },
      ...(options.sentryOptions ?? {}),
    })
    sentryClient = Sentry
    sentryEnabled = true
    return true
  } catch {
    sentryClient = null
    sentryEnabled = false
    return false
  }
}

export interface TechnicalContext {
  route?: string
  component?: string
  action?: string
  status?: number
  errorType?: string
  [key: string]: unknown
}

/**
 * Narrow technical-error capture for genuinely diagnostic failures.
 * Round 1 callers: the top-level ErrorBoundary. Scrubbed, fail-open:
 * returns true when handed to Sentry, false otherwise — never throws.
 */
export function captureTechnicalError(err: unknown, context?: TechnicalContext): boolean {
  try {
    if (!sentryEnabled || !sentryClient || typeof sentryClient.captureException !== 'function') {
      return false
    }
    const safeContext = scrubCaptureContext({
      ...context,
      release: getFrontendRelease(),
      commit: getFrontendCommit(),
      environment: getFrontendEnvironment(),
    })
    sentryClient.captureException(err, { extra: safeContext })
    return true
  } catch {
    return false
  }
}
