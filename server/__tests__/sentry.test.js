/**
 * Backend Sentry tests (Round 1: requirements A, B, E, F).
 *
 * Deterministic: the real SDK is never loaded (injectable loader), and
 * sentry.io is never contacted. Run with:
 * `node --test server/__tests__/sentry.test.js`
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  REDACTED,
  captureTechnicalError,
  initSentry,
  isSentryEnabled,
  resetSentryForTests,
  scrubCaptureContext,
  scrubSentryEvent,
  scrubString,
  scrubUrl,
  scrubValue,
} from '../sentry.js';

describe('backend Sentry init (A: DSN absent, B: failure fail-open)', () => {
  it('no DSN → no-op, loader never invoked, server continues', async () => {
    resetSentryForTests();
    delete process.env.SENTRY_DSN;
    let loaderCalls = 0;
    const enabled = await initSentry({
      dsn: '',
      loader: async () => {
        loaderCalls += 1;
        throw new Error('must not be called');
      },
    });
    assert.equal(enabled, false);
    assert.equal(loaderCalls, 0);
    assert.equal(isSentryEnabled(), false);
    assert.equal(captureTechnicalError(new Error('boom')), false);
  });

  it('missing SENTRY_DSN env → initSentry() resolves false without importing the SDK', async () => {
    resetSentryForTests();
    delete process.env.SENTRY_DSN;
    const enabled = await initSentry();
    assert.equal(enabled, false);
    assert.equal(isSentryEnabled(), false);
  });

  it('SDK init throwing → fail-open false, server continues', async () => {
    resetSentryForTests();
    const enabled = await initSentry({
      dsn: 'https://public@example.com/1',
      loader: async () => {
        throw new Error('synthetic SDK failure');
      },
    });
    assert.equal(enabled, false);
    assert.equal(isSentryEnabled(), false);
    assert.equal(captureTechnicalError(new Error('boom')), false);
  });

  it('capture throwing inside the client → fail-open false, never throws', async () => {
    resetSentryForTests();
    const enabled = await initSentry({
      dsn: 'https://public@example.com/1',
      loader: async () => ({
        init() {},
        captureException() {
          throw new Error('synthetic transport failure');
        },
      }),
    });
    assert.equal(enabled, true);
    assert.equal(isSentryEnabled(), true);
    assert.equal(captureTechnicalError(new Error('boom'), { route: '/api/jobs' }), false);
    resetSentryForTests();
  });

  it('healthy fake client receives the scrubbed technical context', async () => {
    resetSentryForTests();
    const savedDatabaseUrl = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    let seen = null;
    await initSentry({
      dsn: 'https://public@example.com/1',
      loader: async () => ({
        init() {},
        captureException(err, context) {
          seen = { err, context };
        },
      }),
    });
    assert.equal(captureTechnicalError(new Error('boom'), { route: '/api/jobs', notes: 'x' }), true);
    assert.equal(seen.context.extra.route, '/api/jobs');
    assert.equal(seen.context.extra.notes, REDACTED);
    assert.equal(seen.context.extra.db_driver, 'sqlite');
    if (savedDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = savedDatabaseUrl;
    resetSentryForTests();
  });
});

describe('backend scrubber (E: secrets + workspace content removed)', () => {
  it('strips auth headers, cookies, bodies, and user identity', () => {
    const scrubbed = scrubSentryEvent({
      user: { email: 'candidate@example.com', id: 'user-1' },
      request: {
        method: 'GET',
        url: 'https://api/api/workspace',
        headers: {
          Authorization: 'Bearer secret-jwt',
          Cookie: 'meridian_token=secret-token',
          'Content-Type': 'application/json',
        },
        data: { records: [{ notes: 'private' }] },
        cookies: { meridian_token: 'secret-token' },
      },
      tags: { environment: 'production' },
    });
    assert.equal(scrubbed.user, undefined);
    assert.equal(scrubbed.request.cookies, undefined);
    assert.equal(scrubbed.request.data, undefined);
    assert.equal(scrubbed.request.headers.Authorization, REDACTED);
    assert.equal(scrubbed.request.headers.Cookie, REDACTED);
    assert.equal(scrubbed.request.headers['Content-Type'], 'application/json');
    assert.equal(scrubbed.tags.environment, 'production');
  });

  it('redacts secret-like and workspace free-text keys', () => {
    for (const key of [
      'password',
      'DATABASE_URL',
      'database_url',
      'SESSION_SECRET',
      'JWT_SECRET',
      'GMAIL_APP_PASSWORD',
      'meridian_token',
      'Authorization',
      'resetToken',
      'fileData',
      'notes',
      'companyNotes',
      'visaNotes',
      'jobDescription',
      'contacts',
    ]) {
      assert.equal(scrubValue('s3cr3t', key), REDACTED, `key not redacted: ${key}`);
    }
    // Technical keys survive by name.
    assert.equal(scrubValue('GET', 'method'), 'GET');
    assert.equal(scrubValue(500, 'status'), 500);
    assert.equal(scrubValue('/api/jobs', 'route'), '/api/jobs');
    assert.equal(scrubValue('pg', 'db_driver'), 'pg');
    assert.equal(scrubValue('Error', 'errorType'), 'Error');
  });

  it('scrubs secrets embedded in strings and URLs', () => {
    assert.ok(!scrubString('failed postgres://user:pass@host/db x').includes('pass@host'));
    assert.ok(!scrubString('Authorization: Bearer abc.def').includes('abc.def'));
    const url = scrubUrl('https://api/api/jobs?reset=abc123&limit=10#frag');
    assert.ok(!url.includes('abc123'));
    assert.ok(url.includes('limit=10'));
    assert.ok(!url.includes('frag'));
  });

  it('capture context always carries db_driver and never secrets', () => {
    const withDb = scrubCaptureContext({ route: '/api/jobs' }, { DATABASE_URL: 'postgres://u:p@h/d' });
    assert.equal(withDb.db_driver, 'pg');
    assert.equal(withDb.route, '/api/jobs');
    const serialized = JSON.stringify(
      scrubCaptureContext({ DATABASE_URL: 'postgres://u:p@h/d', notes: 'x' }, {}),
    );
    assert.ok(!serialized.includes('postgres://'));
  });
});

describe('backend seeded-secret proof (F)', () => {
  it('serialized scrubbed output contains none of the seeded markers', () => {
    const markers = [
      'MARKER-AUTH-aa11',
      'MARKER-COOKIE-bb22',
      'MARKER-FILEDATA-cc33',
      'MARKER-NOTES-dd44',
      'MARKER-BODY-ee55',
      'MARKER-EMAIL-ff66',
      'MARKER-DBURL-0011',
      'MARKER-JWT-2233',
      'MARKER-RESET-4455',
      'MARKER-DBCONN-6677',
    ];
    const event = {
      user: { email: `candidate+${markers[5]}@example.com` },
      request: {
        method: 'PUT',
        url: `https://api/api/workspace/import?reset=${markers[8]}&limit=10`,
        headers: {
          Authorization: `Bearer ${markers[0]}`,
          Cookie: `session=${markers[1]}`,
        },
        data: { records: { applications: [{ notes: `private ${markers[3]}`, body: markers[4] }] } },
        cookies: { session: markers[1] },
      },
      exception: {
        values: [
          {
            type: 'Error',
            value: `connect postgres://meridian:${markers[6]}@db/host failed; token=${markers[7]}`,
            stacktrace: {
              frames: [{ filename: 'db-pg.js', function: 'query', lineno: 10 }],
            },
          },
        ],
      },
      extra: {
        fileData: markers[2],
        DATABASE_URL: `postgres://meridian:${markers[9]}@db/host`,
        route: '/api/workspace/import',
        status: 500,
        db_driver: 'pg',
      },
    };
    const serialized = JSON.stringify(scrubSentryEvent(event));
    for (const marker of markers) {
      assert.ok(!serialized.includes(marker), `leaked marker: ${marker}`);
    }
    // Technical context survives scrubbing.
    assert.ok(serialized.includes('/api/workspace/import'));
    assert.ok(serialized.includes('db-pg.js'));
    assert.ok(serialized.includes('limit=10'));
  });
});
