/**
 * Privacy-safe backend error monitoring (Sentry, Round 1).
 *
 * Contract:
 * - Initializes ONLY when SENTRY_DSN exists; always fails open.
 * - sendDefaultPii: false. No tracing, no profiling, no log ingestion,
 *   no Session Replay, no attachments, no Sentry.setUser with real identity.
 * - Every event passes through scrubSentryEvent() before leaving the
 *   process: workspace content, credentials, tokens, and connection
 *   strings are redacted. Technical context (route, status, error type,
 *   release, commit, environment, db_driver) is preserved.
 *
 * The SDK is loaded with a dynamic import inside initSentry() so this
 * module is safe to import even when @sentry/node is absent. All public
 * helpers are wrapped in try/catch: Sentry must never break Meridian.
 */

import { getReleaseInfo, getSentryEnvironment, getDbDriver } from './release.js';

export const REDACTED = '[Redacted]';

// Key fragments whose VALUES must never leave the process. Matched
// case-insensitively against object keys. Deliberately broad: Round 1
// prefers over-redaction to a workspace-content leak.
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
  'connectionstring',
  'connection_string',
  'gmail',
  'app_password',
  'apppassword',
  'api_key',
  'apikey',
  'private_key',
  'privatekey',
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
  'sighting',
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
];

// Query-string / header names whose values are sensitive even when the
// surrounding URL is kept for technical context.
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
];

function isSensitiveKey(key) {
  if (typeof key !== 'string') return false;
  const lower = key.toLowerCase();
  return SENSITIVE_KEY_PARTS.some((part) => lower.includes(part));
}

function isSensitiveParam(name) {
  if (typeof name !== 'string') return false;
  const lower = name.toLowerCase();
  return SENSITIVE_PARAM_PARTS.some((part) => lower.includes(part));
}

/** Redact connection strings / bearer tokens / secret pairs inside free text. */
export function scrubString(value) {
  if (typeof value !== 'string') return value;
  let out = value;
  // postgres://user:pass@host/db — never ship connection strings.
  out = out.replace(/postgres(?:ql)?:\/\/[^\s"'`]+/gi, REDACTED);
  // Bearer <token>
  out = out.replace(/bearer\s+[A-Za-z0-9\-._~+/=]+/gi, `Bearer ${REDACTED}`);
  // password=..., token=..., secret=... pairs in messages/stack text.
  out = out.replace(
    /((?:password|passwd|secret|token|api[-_]?key|session|authorization)\s*[:=]\s*)([^\s&,;"']+)/gi,
    `$1${REDACTED}`,
  );
  return out;
}

/**
 * Scrub a URL: drop the fragment, redact sensitive query values, and
 * normalize UUID / long-hex path segments to templates. Never throws.
 */
export function scrubUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl) return rawUrl;
  try {
    // Strip URL userinfo (credentials) first: userinfo never leaves the
    // process. `https://user:pass@host/` becomes `https://host/`.
    const withoutUserinfo = rawUrl.replace(
      /^((?:[a-z][a-z0-9+.-]*:)?\/\/)[^/?#]*@/i,
      '$1',
    );
    const hashIndex = withoutUserinfo.indexOf('#');
    const withoutFragment = hashIndex === -1 ? withoutUserinfo : withoutUserinfo.slice(0, hashIndex);
    const queryIndex = withoutFragment.indexOf('?');
    let path = queryIndex === -1 ? withoutFragment : withoutFragment.slice(0, queryIndex);
    // Normalize IDs in paths: UUIDs and long hex runs become templates.
    path = path.replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      ':id',
    );
    path = path.replace(/\b[0-9a-f]{32,64}\b/gi, ':hash');
    if (queryIndex === -1) return path;
    const query = withoutFragment.slice(queryIndex + 1);
    const scrubbed = query
      .split('&')
      .map((pair) => {
        const eq = pair.indexOf('=');
        if (eq === -1) return isSensitiveParam(pair) ? REDACTED : pair;
        const name = pair.slice(0, eq);
        return isSensitiveParam(name) ? `${name}=${REDACTED}` : pair;
      })
      .join('&');
    return `${path}?${scrubbed}`;
  } catch {
    return REDACTED;
  }
}

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
];

function isSensitiveHeader(name) {
  if (typeof name !== 'string') return false;
  const lower = name.toLowerCase();
  return SENSITIVE_HEADER_PARTS.some((part) => lower.includes(part));
}

function scrubHeaders(headers) {
  if (!headers || typeof headers !== 'object') return headers;
  const out = Array.isArray(headers) ? [] : {};
  for (const key of Object.keys(headers)) {
    out[key] = isSensitiveHeader(key) ? REDACTED : scrubString(String(headers[key]));
  }
  return out;
}

/** Recursively scrub a value; sensitive keys become [Redacted]. */
export function scrubValue(value, key) {
  if (typeof key === 'string' && isSensitiveKey(key)) return REDACTED;
  if (typeof value === 'string') return scrubString(value);
  if (Array.isArray(value)) return value.map((item) => scrubValue(item));
  if (value && typeof value === 'object') {
    const out = {};
    for (const childKey of Object.keys(value)) {
      out[childKey] = scrubValue(value[childKey], childKey);
    }
    return out;
  }
  return value;
}

function cloneEvent(event) {
  try {
    return JSON.parse(JSON.stringify(event));
  } catch {
    return {};
  }
}

/**
 * Strip frame SOURCE CONTENT while keeping stack LOCATION.
 *
 * The SDK's ContextLines integration embeds neighboring source lines
 * (pre_context / context_line / post_context) into stack frames. Source
 * text is not trustworthy payload: it can contain sensitive literals.
 * We keep filename / function / lineno / colno / module / in_app and
 * delete only the content fields. Covers every exception value and, where
 * present, thread stack frames. Never throws.
 */
export function stripFrameSourceContent(event) {
  try {
    if (!event || typeof event !== 'object') return event;
    const stripFrames = (frames) => {
      if (!Array.isArray(frames)) return;
      for (const frame of frames) {
        if (!frame || typeof frame !== 'object') continue;
        delete frame.pre_context;
        delete frame.context_line;
        delete frame.post_context;
      }
    };
    const values = event.exception && event.exception.values;
    if (Array.isArray(values)) {
      for (const value of values) {
        if (value && value.stacktrace) stripFrames(value.stacktrace.frames);
      }
    }
    const threads = event.threads && event.threads.values;
    if (Array.isArray(threads)) {
      for (const thread of threads) {
        if (thread && thread.stacktrace) stripFrames(thread.stacktrace.frames);
      }
    }
    return event;
  } catch {
    return event;
  }
}

/**
 * Default-integrations filter: remove the integration named ContextLines,
 * which reads local source files and embeds surrounding source CONTENT
 * into stack frames. All other defaults are preserved. Never throws.
 */
export function withoutContextLines(defaultIntegrations) {
  try {
    const list = Array.isArray(defaultIntegrations) ? defaultIntegrations : [];
    return list.filter(
      (integration) => !integration || integration.name !== 'ContextLines',
    );
  } catch {
    return defaultIntegrations;
  }
}

/**
 * beforeSend-compatible scrubber. Removes user identity, request bodies,
 * cookies, auth headers, and workspace content; keeps route template,
 * method, status, error type, stack (string-scrubbed), release, commit,
 * environment, and db_driver. Never throws; never returns null.
 */
export function scrubSentryEvent(event) {
  try {
    if (!event || typeof event !== 'object') return {};
    const scrubbed = cloneEvent(event);
    // Stack LOCATION without neighboring source CONTENT (see
    // stripFrameSourceContent). Runs before any string scrubbing so no
    // source literal can survive via frame context.
    stripFrameSourceContent(scrubbed);
    // No user identity, ever. (We never call setUser either.)
    delete scrubbed.user;
    // Request: keep method + scrubbed URL only.
    if (scrubbed.request && typeof scrubbed.request === 'object') {
      const request = scrubbed.request;
      delete request.cookies;
      delete request.data;
      delete request.body;
      delete request.form;
      if (request.headers) request.headers = scrubHeaders(request.headers);
      if (typeof request.url === 'string') request.url = scrubUrl(request.url);
      if (typeof request.query_string === 'string') {
        request.query_string = String(scrubUrl(`?${request.query_string}`).slice(1));
      }
    }
    // Exception messages / stack frames may embed secrets.
    if (scrubbed.exception && typeof scrubbed.exception === 'object') {
      try {
        scrubbed.exception = JSON.parse(scrubString(JSON.stringify(scrubbed.exception)));
      } catch {
        scrubbed.exception = {};
      }
    }
    if (typeof scrubbed.message === 'string') scrubbed.message = scrubString(scrubbed.message);
    // Breadcrumb messages + data can carry bodies/tokens.
    if (Array.isArray(scrubbed.breadcrumbs)) {
      scrubbed.breadcrumbs = scrubbed.breadcrumbs.map((crumb) => {
        if (!crumb || typeof crumb !== 'object') return crumb;
        const copy = { ...crumb };
        if (typeof copy.message === 'string') copy.message = scrubString(copy.message);
        if (copy.data && typeof copy.data === 'object') copy.data = scrubValue(copy.data);
        if (typeof copy.url === 'string') copy.url = scrubUrl(copy.url);
        return copy;
      });
    }
    // Extra + contexts: scrub recursively (technical keys survive by name).
    if (scrubbed.extra && typeof scrubbed.extra === 'object') {
      scrubbed.extra = scrubValue(scrubbed.extra);
    }
    if (scrubbed.contexts && typeof scrubbed.contexts === 'object') {
      scrubbed.contexts = scrubValue(scrubbed.contexts);
    }
    if (scrubbed.tags && typeof scrubbed.tags === 'object') {
      const tags = {};
      for (const tagKey of Object.keys(scrubbed.tags)) {
        tags[tagKey] = isSensitiveKey(tagKey) ? REDACTED : scrubString(String(scrubbed.tags[tagKey]));
      }
      scrubbed.tags = tags;
    }
    return scrubbed;
  } catch {
    return {};
  }
}

/** Scrub technical context attached to a capture call. Adds db_driver. */
export function scrubCaptureContext(context, env = process.env) {
  try {
    const base = context && typeof context === 'object' ? scrubValue(context) : {};
    if (base && typeof base === 'object' && !isSensitiveKey('db_driver')) {
      base.db_driver = getDbDriver(env);
    }
    return base;
  } catch {
    return { db_driver: getDbDriver(env) };
  }
}

let sentryClient = null;
let sentryEnabled = false;

export function isSentryEnabled() {
  return sentryEnabled;
}

/** Test hook: forget the client so tests stay isolated. */
export function resetSentryForTests() {
  sentryClient = null;
  sentryEnabled = false;
}

/**
 * Initialize Sentry. No-op (false) when SENTRY_DSN is absent. Any failure
 * — missing SDK, bad DSN, network — resolves false; never throws.
 * `loader` is injectable for deterministic tests (defaults to the real SDK).
 */
export async function initSentry(options = {}) {
  const dsn = options.dsn !== undefined ? options.dsn : process.env.SENTRY_DSN;
  if (typeof dsn !== 'string' || !dsn.trim()) {
    return false;
  }
  try {
    const loader = options.loader || (() => import('@sentry/node'));
    const Sentry = await loader();
    if (!Sentry || typeof Sentry.init !== 'function') return false;
    const { release } = getReleaseInfo();
    Sentry.init({
      dsn: dsn.trim(),
      release,
      environment: options.environment || getSentryEnvironment(),
      sendDefaultPii: false,
      // Round 1: Error Monitoring only. Tracing / profiling / logs off.
      tracesSampleRate: 0,
      enableTracing: false,
      profilesSampleRate: 0,
      enableLogs: false,
      attachStacktrace: true,
      // Primary source-context prevention: never collect neighboring
      // source CONTENT (ContextLines reads local files into frames).
      // An explicit integrations override in sentryOptions still wins.
      integrations: withoutContextLines,
      beforeSend(event) {
        try {
          return scrubSentryEvent(event);
        } catch {
          return event;
        }
      },
      ...(options.sentryOptions || {}),
    });
    sentryClient = Sentry;
    sentryEnabled = true;
    return true;
  } catch {
    sentryClient = null;
    sentryEnabled = false;
    return false;
  }
}

/**
 * Narrow technical-error capture. Scrubbed, fail-open: returns true when
 * handed to Sentry, false otherwise — never throws.
 */
export function captureTechnicalError(err, context, env = process.env) {
  try {
    if (!sentryEnabled || !sentryClient || typeof sentryClient.captureException !== 'function') {
      return false;
    }
    const safeContext = scrubCaptureContext(context, env);
    sentryClient.captureException(err, { extra: safeContext });
    return true;
  } catch {
    return false;
  }
}

/**
 * Standard internal-error responder: log the technical detail
 * server-side, forward a scrubbed copy to Sentry, and send the client a
 * generic message. err.message NEVER reaches the response body.
 */
export function internalError(res, err, publicMessage, req) {
  try {
    console.error(`[API] ${publicMessage}:`, err && err.message ? err.message : err);
  } catch {
    // Logging must never break the response path.
  }
  try {
    captureTechnicalError(err, req ? { route: req.path, method: req.method } : undefined);
  } catch {
    // Sentry must never break the response path.
  }
  try {
    return res.status(500).json({ error: publicMessage });
  } catch {
    return undefined;
  }
}

/**
 * Final Express error middleware (errors forwarded via next(err), e.g.
 * CORS rejections). Generic client message; technical detail stays
 * server-side / Sentry-side.
 */
// eslint-disable-next-line no-unused-vars
export function expressErrorMiddleware(err, req, res, next) {
  // Normalize status FIRST: expected client errors (4xx, e.g. malformed
  // JSON bodies rejected by express.json()) are never Sentry evidence.
  // Missing/invalid status defaults to 500 and IS captured.
  const status = err && typeof err.status === 'number' ? err.status : 500;
  if (status >= 500) {
    try {
      captureTechnicalError(err, {
        route: req && req.path,
        method: req && req.method,
        status,
      });
    } catch {
      // ignore
    }
  }
  try {
    if (res.headersSent) {
      if (typeof next === 'function') return next(err);
      return undefined;
    }
    if (status >= 500) {
      try {
        console.error('[API] Unhandled error:', err && err.message ? err.message : err);
      } catch {
        // ignore
      }
      return res.status(status).json({ error: 'Internal server error' });
    }
    // Generic message only: body-parser can embed submitted request
    // content in 4xx error messages, so err.message is never returned here.
    return res.status(status).json({ error: 'Request failed' });
  } catch {
    return undefined;
  }
}
