/**
 * Release-identity tests (Round 1, requirement C — frontend side).
 *
 * Deterministic: no network, no Sentry, no build. Run with:
 * `node --test --import ./src/test/register-alias.ts src/lib/release.test.ts`
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  MERIDIAN_VERSION,
  UNKNOWN_COMMIT,
  formatRelease,
  getFrontendCommit,
  getFrontendEnvironment,
  getFrontendRelease,
  normalizeCommit,
  shortCommit,
} from './release.ts'

const FULL_SHA = 'ebdd0bec5530b9bb35dfd159e004f561fb604f17'

describe('frontend release identity', () => {
  it('product version mirrors the root package.json authority', () => {
    const pkg = JSON.parse(
      readFileSync(new URL('../../package.json', import.meta.url), 'utf8'),
    ) as { version: string }
    assert.equal(MERIDIAN_VERSION, pkg.version)
    assert.equal(MERIDIAN_VERSION, '1.1.0')
  })

  it('formats version + SHA as meridian@<version>+<short-sha>', () => {
    assert.equal(formatRelease('1.1.0', FULL_SHA), 'meridian@1.1.0+ebdd0be')
  })

  it('missing SHA degrades to an explicit unknown value', () => {
    assert.equal(normalizeCommit(undefined), UNKNOWN_COMMIT)
    assert.equal(normalizeCommit(''), UNKNOWN_COMMIT)
    assert.equal(normalizeCommit('   '), UNKNOWN_COMMIT)
    assert.equal(shortCommit(''), UNKNOWN_COMMIT)
    assert.equal(formatRelease('1.1.0', ''), 'meridian@1.1.0+unknown')
    assert.equal(formatRelease('1.1.0', undefined), 'meridian@1.1.0+unknown')
  })

  it('derives release from injected build env, override wins', () => {
    assert.equal(
      getFrontendRelease({ VITE_MERIDIAN_COMMIT: FULL_SHA }),
      'meridian@1.1.0+ebdd0be',
    )
    assert.equal(getFrontendRelease({}), 'meridian@1.1.0+unknown')
    assert.equal(
      getFrontendRelease({
        VITE_MERIDIAN_COMMIT: FULL_SHA,
        VITE_MERIDIAN_RELEASE: 'meridian@1.1.0+pinned',
      }),
      'meridian@1.1.0+pinned',
    )
  })

  it('commit accessor never throws and never leaks secrets', () => {
    assert.equal(getFrontendCommit({ VITE_MERIDIAN_COMMIT: FULL_SHA }), FULL_SHA)
    assert.equal(getFrontendCommit({}), UNKNOWN_COMMIT)
  })

  it('native Vercel SHA binds exact release identity with no manual var', () => {
    assert.equal(getFrontendCommit({ VERCEL_GIT_COMMIT_SHA: FULL_SHA }), FULL_SHA)
    assert.equal(
      getFrontendRelease({ VERCEL_GIT_COMMIT_SHA: FULL_SHA }),
      'meridian@1.1.0+ebdd0be',
    )
  })

  it('manual VITE_MERIDIAN_COMMIT wins over the native Vercel SHA', () => {
    const manual = 'abc1234def5678abc1234def5678abc1234def56'
    assert.equal(
      getFrontendCommit({
        VITE_MERIDIAN_COMMIT: manual,
        VERCEL_GIT_COMMIT_SHA: FULL_SHA,
      }),
      manual,
    )
  })

  it('blank native SHA falls back to deterministic unknown', () => {
    assert.equal(getFrontendCommit({ VERCEL_GIT_COMMIT_SHA: '   ' }), UNKNOWN_COMMIT)
    assert.equal(
      getFrontendRelease({ VERCEL_GIT_COMMIT_SHA: '' }),
      'meridian@1.1.0+unknown',
    )
  })

  it('maps Vercel-native VERCEL_ENV deterministically', () => {
    assert.equal(getFrontendEnvironment({ VERCEL_ENV: 'preview' }), 'preview')
    assert.equal(getFrontendEnvironment({ VERCEL_ENV: 'production' }), 'production')
    assert.equal(
      getFrontendEnvironment({ VITE_SENTRY_ENVIRONMENT: 'preview', VERCEL_ENV: 'production' }),
      'preview',
    )
    assert.equal(
      getFrontendEnvironment({ VERCEL_ENV: 'production', VITE_VERCEL_ENV: 'preview' }),
      'production',
    )
  })

  it('maps environment deterministically', () => {
    assert.equal(getFrontendEnvironment({ VITE_VERCEL_ENV: 'preview' }), 'preview')
    assert.equal(getFrontendEnvironment({ VITE_VERCEL_ENV: 'production' }), 'production')
    assert.equal(getFrontendEnvironment({ PROD: true }), 'production')
    assert.equal(getFrontendEnvironment({}), 'development')
    assert.equal(
      getFrontendEnvironment({ VITE_SENTRY_ENVIRONMENT: 'preview', PROD: true }),
      'preview',
    )
  })
})
