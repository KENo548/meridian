/**
 * Health identity + 5xx leakage tests (Round 1: requirements G, H).
 *
 * Deterministic: exercises the real internalError() responder with a mock
 * response object, and scans the real server/index.js source to prove no
 * 500 path returns `details: err.message` anymore. No network, no Sentry.
 * Run with: `node --test server/__tests__/health-errors.test.js`
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PRODUCT_VERSION, buildHealthBody } from '../release.js';
import { internalError, resetSentryForTests } from '../sentry.js';

const FULL_SHA = 'ebdd0bec5530b9bb35dfd159e004f561fb604f17';

function mockResponse() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

describe('/api/health identity (G)', () => {
  it('exposes the release string only — no full commit, no secrets', () => {
    const body = buildHealthBody(
      { rss: { configured: true } },
      { MERIDIAN_COMMIT: FULL_SHA },
    );
    assert.equal(body.status, 'ok');
    assert.equal(typeof body.timestamp, 'string');
    assert.equal(body.release, `meridian@${PRODUCT_VERSION}+ebdd0be`);
    assert.ok(!('commit' in body), 'full commit must not be publicly exposed');
    assert.deepEqual(body.sources, { rss: { configured: true } });
    const serialized = JSON.stringify(body);
    for (const forbidden of [
      FULL_SHA,
      'DATABASE_URL',
      'SESSION_SECRET',
      'JWT_SECRET',
      'GMAIL_APP_PASSWORD',
      'meridian_token',
      'password',
      'Authorization',
      'details',
    ]) {
      assert.ok(!serialized.includes(forbidden), `health leaks: ${forbidden}`);
    }
  });

  it('server/index.js health route is wired to buildHealthBody', () => {
    const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
    assert.ok(source.includes('buildHealthBody('), 'health route does not use buildHealthBody');
  });
});

describe('internal 500 responses (H)', () => {
  it('generic client message; synthetic internal text absent from the body', () => {
    resetSentryForTests();
    const marker = 'MARKER-SYNTHETIC-DB-FAIL-88zz';
    const err = new Error(
      `synthetic adapter failure ${marker}: postgres://meridian:pw@host/db connect ECONNREFUSED`,
    );
    const res = mockResponse();
    internalError(res, err, 'Failed to fetch jobs', { path: '/api/jobs', method: 'GET' });
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { error: 'Failed to fetch jobs' });
    const serialized = JSON.stringify(res.body);
    assert.ok(!serialized.includes(marker), 'internal message leaked to client');
    assert.ok(!serialized.includes('postgres://'), 'connection string leaked to client');
    assert.ok(!serialized.includes('details'), 'details field present in client body');
  });

  it('no 500 path in server/index.js returns internal exception text', () => {
    const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
    assert.ok(!source.includes('details: err.message'), 'leaked details: err.message remains');
    assert.ok(!source.includes('details:err.message'), 'leaked details:err.message remains');
    // Approved call shape passes the Express request so Sentry events keep
    // the already-approved route/method technical context (F1).
    const withReq = (source.match(/internalError\(res, err, '[^']+', req\)/g) || []).length;
    assert.equal(withReq, 32, `expected 32 internalError(res, err, msg, req) sites, found ${withReq}`);
    const withoutReq = (source.match(/internalError\(res, err,[^)]*\)/g) || [])
      .filter((call) => !call.endsWith(', req)'));
    assert.deepEqual(withoutReq, [], 'internalError sites missing req');
  });

  it('deliberate 4xx validation responses are untouched', () => {
    const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8');
    assert.ok(
      source.includes("res.status(400).json({ error: '`enabled` (boolean) is required' })"),
      'validation 4xx response was altered',
    );
  });
});
