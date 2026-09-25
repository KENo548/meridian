/**
 * Same-origin API proxy routing tests (Phase 1).
 *
 * Covers the fail-closed upstream matrix (A-F, M), the generated Vercel
 * routing shape (G-I), the browser-runtime migration (J-K), and the local
 * dev proxy contract (L) — all deterministic under node:test, no browser,
 * no network, no Vercel SDK.
 *
 * Run with:
 * `node --test vercel.routing.test.ts`
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const SRC_ROOT = path.join(ROOT, 'src')

const STAGING = 'https://meridian-staging-oyfk.onrender.com'
const PROD = 'https://meridian-rcfu.onrender.com'

// The module top level resolves process.env and throws when unconfigured,
// so preset a safe staging environment before importing.
process.env.MERIDIAN_API_UPSTREAM = STAGING
process.env.VERCEL_ENV = 'preview'
const proxy = await import('./vercel.ts')
const { resolveApiUpstream, buildProxyConfig, config } = proxy

describe('upstream fail-closed matrix', () => {
  it('A. preview + staging upstream accepted', () => {
    assert.equal(
      resolveApiUpstream({ MERIDIAN_API_UPSTREAM: STAGING, VERCEL_ENV: 'preview' }),
      STAGING,
    )
  })

  it('B. preview + production upstream rejected', () => {
    assert.throws(() =>
      resolveApiUpstream({ MERIDIAN_API_UPSTREAM: PROD, VERCEL_ENV: 'preview' }),
    )
  })

  it('C. production + production upstream accepted', () => {
    assert.equal(
      resolveApiUpstream({ MERIDIAN_API_UPSTREAM: PROD, VERCEL_ENV: 'production' }),
      PROD,
    )
  })

  it('C2. production + staging upstream rejected', () => {
    assert.throws(() =>
      resolveApiUpstream({ MERIDIAN_API_UPSTREAM: STAGING, VERCEL_ENV: 'production' }),
    )
  })

  it('D. missing upstream rejected (undefined, empty, whitespace)', () => {
    assert.throws(() => resolveApiUpstream({ VERCEL_ENV: 'preview' }))
    assert.throws(() => resolveApiUpstream({ MERIDIAN_API_UPSTREAM: '', VERCEL_ENV: 'preview' }))
    assert.throws(() => resolveApiUpstream({ MERIDIAN_API_UPSTREAM: '   ', VERCEL_ENV: 'preview' }))
  })

  it('E. malformed/non-HTTPS/credentialed/pathed upstream rejected', () => {
    assert.throws(() => resolveApiUpstream({ MERIDIAN_API_UPSTREAM: 'not a url', VERCEL_ENV: 'preview' }))
    assert.throws(() => resolveApiUpstream({ MERIDIAN_API_UPSTREAM: 'ftp://staging-x.invalid', VERCEL_ENV: 'preview' }))
    assert.throws(() => resolveApiUpstream({ MERIDIAN_API_UPSTREAM: 'http://staging-x.invalid', VERCEL_ENV: 'preview' }))
    assert.throws(() =>
      resolveApiUpstream({ MERIDIAN_API_UPSTREAM: 'https://user:pass@staging-x.invalid', VERCEL_ENV: 'preview' }),
    )
    assert.throws(() =>
      resolveApiUpstream({ MERIDIAN_API_UPSTREAM: 'https://staging-x.invalid/api', VERCEL_ENV: 'preview' }),
    )
  })

  it('F. no implicit fallback exists: every invalid input throws', () => {
    const bad = [
      {},
      { MERIDIAN_API_UPSTREAM: undefined, VERCEL_ENV: undefined },
      { MERIDIAN_API_UPSTREAM: PROD },
      { MERIDIAN_API_UPSTREAM: PROD, VERCEL_ENV: 'development' },
    ]
    for (const env of bad) {
      assert.throws(() => resolveApiUpstream(env), undefined, `expected throw for ${JSON.stringify(env)}`)
    }
  })

  it('trailing slash is normalized (kills //api at the edge)', () => {
    assert.equal(
      resolveApiUpstream({ MERIDIAN_API_UPSTREAM: `${STAGING}/`, VERCEL_ENV: 'preview' }),
      STAGING,
    )
  })
})

describe('generated routing shape', () => {
  it('G. /api rewrite precedes the SPA fallback', () => {
    assert.equal(config.rewrites[0].source, '/api/:path*')
    assert.ok(config.rewrites[0].destination.startsWith(`${STAGING}/api/`))
    assert.equal(config.rewrites[1].destination, '/index.html')
  })

  it('H. /api cannot fall through to index.html', () => {
    assert.equal(config.rewrites[1].source, '/((?!api/).*)')
    for (const rule of config.rewrites) {
      if (rule.destination === '/index.html') {
        assert.ok(!rule.source.startsWith('/api'), 'index.html rule must not match /api')
      }
    }
  })

  it('I. rewrite caching explicitly disabled for /api', () => {
    const rule = config.headers.find((h) => h.source === '/api/:path*')
    assert.ok(rule, 'missing /api header rule')
    assert.deepEqual(rule.headers, [{ key: 'x-vercel-enable-rewrite-caching', value: '0' }])
  })

  it('buildProxyConfig interpolates only the validated upstream', () => {
    const built = buildProxyConfig('https://staging-test.invalid')
    assert.equal(built.rewrites[0].destination, 'https://staging-test.invalid/api/:path*')
  })
})

function collectSourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...collectSourceFiles(full))
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full)
  }
  return out
}

describe('browser-runtime migration', () => {
  it('J. src runtime contains zero VITE_API_BASE consumers', () => {
    const hits = collectSourceFiles(SRC_ROOT).filter((f) =>
      readFileSync(f, 'utf8').includes('VITE_API_BASE'),
    )
    assert.deepEqual(hits, [])
  })

  it('K. all four migrated surfaces construct /api paths with no base join', () => {
    const files = [
      'src/lib/auth.ts',
      'src/lib/workspaceApi.ts',
      'src/lib/jobSources.ts',
      'src/components/CoverageDashboard.tsx',
    ]
    for (const rel of files) {
      const src = readFileSync(path.join(ROOT, rel), 'utf8')
      assert.ok(!src.includes('API_BASE'), `${rel} still references API_BASE`)
      assert.ok(src.includes('/api/'), `${rel} builds no /api/ path`)
    }
  })

  it('L. local dev proxy targets the local backend only', () => {
    const vite = readFileSync(path.join(ROOT, 'vite.config.ts'), 'utf8')
    assert.ok(vite.includes("'/api'"), 'missing /api dev proxy')
    assert.ok(vite.includes('localhost:3001'), 'dev proxy must target local backend')
    assert.ok(!vite.includes('onrender.com'), 'dev proxy must never target Render')
  })

  it('M. destination cannot be request-controlled', () => {
    const src = readFileSync(path.join(ROOT, 'vercel.ts'), 'utf8')
    assert.ok(src.includes('${upstream}/api/:path*'), 'destination must use the validated upstream const')
    for (const token of ['req.', 'request.headers', 'query[', 'searchParams']) {
      assert.ok(!src.includes(token), `request-controlled token present: ${token}`)
    }
  })
})
