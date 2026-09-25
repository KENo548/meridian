/**
 * Release-identity tests (Round 1, requirement C — backend side).
 *
 * Deterministic: no network, no Sentry, no DB. Run with:
 * `node --test server/__tests__/release.test.js`
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PRODUCT_VERSION,
  UNKNOWN_COMMIT,
  buildHealthBody,
  formatRelease,
  getCommitFromEnv,
  getDbDriver,
  getReleaseInfo,
  getSentryEnvironment,
  normalizeCommit,
  shortCommit,
} from '../release.js';

const FULL_SHA = 'ebdd0bec5530b9bb35dfd159e004f561fb604f17';

describe('backend release identity', () => {
  it('product version mirrors the root package.json authority (not server/package.json)', () => {
    const rootPkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
    const serverPkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    assert.equal(PRODUCT_VERSION, rootPkg.version);
    assert.equal(PRODUCT_VERSION, '1.1.0');
    assert.notEqual(serverPkg.version, undefined);
  });

  it('formats version + SHA as meridian@<version>+<short-sha>', () => {
    assert.equal(formatRelease('1.1.0', FULL_SHA), 'meridian@1.1.0+ebdd0be');
  });

  it('missing SHA degrades to an explicit unknown value', () => {
    assert.equal(normalizeCommit(undefined), UNKNOWN_COMMIT);
    assert.equal(normalizeCommit(''), UNKNOWN_COMMIT);
    assert.equal(normalizeCommit('   '), UNKNOWN_COMMIT);
    assert.equal(shortCommit(''), UNKNOWN_COMMIT);
    assert.equal(formatRelease('1.1.0', ''), 'meridian@1.1.0+unknown');
    assert.equal(formatRelease('1.1.0', undefined), 'meridian@1.1.0+unknown');
  });

  it('prefers MERIDIAN_COMMIT, then Render RENDER_GIT_COMMIT, then unknown', () => {
    assert.equal(getCommitFromEnv({ RENDER_GIT_COMMIT: FULL_SHA }), FULL_SHA);
    assert.equal(
      getCommitFromEnv({ MERIDIAN_COMMIT: 'abc1234', RENDER_GIT_COMMIT: FULL_SHA }),
      'abc1234',
    );
    assert.equal(getCommitFromEnv({}), UNKNOWN_COMMIT);
    assert.equal(getCommitFromEnv(undefined), UNKNOWN_COMMIT);
  });

  it('builds release info with explicit MERIDIAN_RELEASE override', () => {
    assert.deepEqual(getReleaseInfo({}), {
      version: '1.1.0',
      commit: UNKNOWN_COMMIT,
      release: 'meridian@1.1.0+unknown',
    });
    const info = getReleaseInfo({ RENDER_GIT_COMMIT: FULL_SHA });
    assert.equal(info.release, 'meridian@1.1.0+ebdd0be');
    assert.equal(info.commit, FULL_SHA);
    const pinned = getReleaseInfo({ MERIDIAN_RELEASE: 'meridian@1.1.0+pinned' });
    assert.equal(pinned.release, 'meridian@1.1.0+pinned');
  });

  it('maps Sentry environment from explicit override then NODE_ENV', () => {
    assert.equal(getSentryEnvironment({ NODE_ENV: 'production' }), 'production');
    assert.equal(getSentryEnvironment({ NODE_ENV: 'staging' }), 'staging');
    assert.equal(getSentryEnvironment({}), 'development');
    assert.equal(
      getSentryEnvironment({ SENTRY_ENVIRONMENT: 'staging', NODE_ENV: 'production' }),
      'staging',
    );
  });

  it('labels the technical db driver without connection strings', () => {
    assert.equal(getDbDriver({ DATABASE_URL: 'postgres://u:p@host/db' }), 'pg');
    assert.equal(getDbDriver({}), 'sqlite');
  });

  it('health body carries the release string only — no full commit, nothing secret-adjacent', () => {
    const body = buildHealthBody({ rss: { configured: true } }, { MERIDIAN_COMMIT: FULL_SHA });
    assert.deepEqual(Object.keys(body).sort(), ['release', 'sources', 'status', 'timestamp']);
    assert.equal(body.status, 'ok');
    assert.equal(body.release, 'meridian@1.1.0+ebdd0be');
    assert.ok(!('commit' in body), 'full commit must not be publicly exposed');
  });

  it('full commit stays available internally for Sentry release metadata', () => {
    const info = getReleaseInfo({ RENDER_GIT_COMMIT: FULL_SHA });
    assert.equal(info.commit, FULL_SHA);
    assert.equal(info.release, 'meridian@1.1.0+ebdd0be');
  });
});
