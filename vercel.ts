/**
 * Programmatic Vercel routing: same-origin API proxy (Phase 1).
 *
 * Browser traffic stays same-origin:
 *
 *   Browser → /api/* → Vercel external rewrite → Render backend
 *
 * The upstream backend is chosen at BUILD time from ONE server-side-only
 * variable, MERIDIAN_API_UPSTREAM (never browser-exposed):
 *
 *   Preview    → https://meridian-staging-oyfk.onrender.com
 *   Production → https://meridian-rcfu.onrender.com
 *
 * Fail-closed: a missing/invalid/mis-scoped upstream throws here, which
 * fails the build instead of deploying wrong routing. There is deliberately
 * no default or fallback backend, and the destination can never come from
 * request/query/header/client input.
 *
 * Auth/API responses must never be CDN-cached, so rewrite caching is
 * explicitly disabled for /api/* (see headers below).
 */

export interface UpstreamEnv {
  MERIDIAN_API_UPSTREAM?: string | undefined;
  VERCEL_ENV?: string | undefined;
}

// Exact allowed origins per deployment environment. Compared by full
// normalized origin (never substring, never hostname): lookalikes,
// subdomains, and staging-test fixtures are all rejected.
export const STAGING_UPSTREAM = 'https://meridian-staging-oyfk.onrender.com';
export const PRODUCTION_UPSTREAM = 'https://meridian-rcfu.onrender.com';

export interface ProxyRewrite {
  source: string;
  destination: string;
}

export interface ProxyHeaderRule {
  source: string;
  headers: Array<{ key: string; value: string }>;
}

/**
 * Pure fail-closed upstream resolution. Returns the normalized origin
 * (scheme + host, no trailing slash, no path). Throws on anything else.
 * Dependency-free so node:test can cover the full matrix deterministically.
 */
export function resolveApiUpstream(env: UpstreamEnv): string {
  const raw = (env.MERIDIAN_API_UPSTREAM ?? '').trim();
  if (!raw) {
    throw new Error('MERIDIAN_API_UPSTREAM is not configured (fail-closed: no default backend)');
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('MERIDIAN_API_UPSTREAM is not a valid absolute URL');
  }
  if (url.protocol !== 'https:') {
    throw new Error('MERIDIAN_API_UPSTREAM must use https');
  }
  if (url.username || url.password) {
    throw new Error('MERIDIAN_API_UPSTREAM must not contain credentials');
  }
  if (url.pathname !== '/' && url.pathname !== '') {
    throw new Error('MERIDIAN_API_UPSTREAM must be an origin (no path)');
  }
  if (url.search || url.hash) {
    throw new Error('MERIDIAN_API_UPSTREAM must be an origin (no query or fragment)');
  }
  const normalized = `${url.protocol}//${url.host}`;
  const vercelEnv = env.VERCEL_ENV ?? '';
  // Exact per-environment allowlist. The dashboard value must equal the
  // expected origin byte-for-byte after normalization; anything else —
  // production host in Preview, staging host in Production, lookalikes,
  // subdomains, fixtures — fails the deployment instead of misrouting it.
  const expected = vercelEnv === 'production' ? PRODUCTION_UPSTREAM : STAGING_UPSTREAM;
  if (normalized !== expected) {
    throw new Error(
      `MERIDIAN_API_UPSTREAM must be ${expected} for this deployment environment`,
    );
  }
  return normalized;
}

/** Build the routing tables for a validated upstream origin. */
export function buildProxyConfig(upstream: string): {
  rewrites: ProxyRewrite[];
  headers: ProxyHeaderRule[];
} {
  return {
    rewrites: [
      // API traffic first: proxy to the environment backend. Because this
      // rule matches first, /api/* can never fall through to index.html.
      { source: '/api/:path*', destination: `${upstream}/api/:path*` },
      // Existing SPA behavior, unchanged: everything except /api/* serves
      // the frontend shell.
      { source: '/((?!api/).*)', destination: '/index.html' },
    ],
    headers: [
      // Auth/workspace/API responses must never be served from the CDN.
      {
        source: '/api/:path*',
        headers: [{ key: 'x-vercel-enable-rewrite-caching', value: '0' }],
      },
    ],
  };
}

const apiUpstream = resolveApiUpstream(process.env);

export const config = buildProxyConfig(apiUpstream);
