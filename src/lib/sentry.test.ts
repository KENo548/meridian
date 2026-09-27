/**
 * Frontend Sentry tests (Round 1: requirements A, B, D, F).
 *
 * Deterministic: the real SDK is never loaded (injectable loader), and
 * sentry.io is never contacted. Run with:
 * `node --test --import ./src/test/register-alias.ts src/lib/sentry.test.ts`
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  REDACTED,
  captureTechnicalError,
  initSentry,
  isSentryEnabled,
  resetSentryForTests,
  scrubCaptureContext,
  scrubString,
  scrubSentryEvent,
  scrubUrl,
  scrubValue,
  stripUrlUserinfo,
  withoutContextLines,
} from './sentry.ts'

function throwingLoader(): Promise<never> {
  return Promise.reject(new Error('synthetic SDK failure'))
}

describe('frontend Sentry init (A: DSN absent, B: failure fail-open)', () => {
  it('no DSN → no-op, loader never invoked, app continues', async () => {
    resetSentryForTests()
    let loaderCalls = 0
    const enabled = await initSentry({
      dsn: '',
      loader: async () => {
        loaderCalls += 1
        throw new Error('must not be called')
      },
    })
    assert.equal(enabled, false)
    assert.equal(loaderCalls, 0)
    assert.equal(isSentryEnabled(), false)
    // Capture without init is a silent no-op, never a throw.
    assert.equal(captureTechnicalError(new Error('boom')), false)
  })

  it('SDK init throwing → fail-open false, app continues', async () => {
    resetSentryForTests()
    const enabled = await initSentry({
      dsn: 'https://public@example.com/1',
      loader: throwingLoader,
    })
    assert.equal(enabled, false)
    assert.equal(isSentryEnabled(), false)
    assert.equal(captureTechnicalError(new Error('boom')), false)
  })

  it('capture throwing inside the client → fail-open false, never throws', async () => {
    resetSentryForTests()
    const enabled = await initSentry({
      dsn: 'https://public@example.com/1',
      loader: async () => ({
        init() {},
        captureException() {
          throw new Error('synthetic transport failure')
        },
      }),
    })
    assert.equal(enabled, true)
    assert.equal(isSentryEnabled(), true)
    assert.equal(captureTechnicalError(new Error('boom'), { route: '/test' }), false)
    resetSentryForTests()
  })
})

describe('frontend scrubber (D: sensitive classes removed)', () => {
  it('strips auth headers, cookies, bodies, and user identity', () => {
    const scrubbed = scrubSentryEvent({
      user: { email: 'candidate@example.com', username: 'candidate' },
      request: {
        method: 'PUT',
        url: 'https://app/api/workspace/applications/abc',
        headers: {
          Authorization: 'Bearer secret-jwt',
          Cookie: 'meridian_token=secret-token',
          'Content-Type': 'application/json',
        },
        data: { notes: 'private note', fileData: 'base64bytes' },
        cookies: { meridian_token: 'secret-token' },
      },
      tags: { environment: 'production' },
    })
    assert.equal(scrubbed.user, undefined)
    const request = scrubbed.request as Record<string, unknown>
    assert.equal(request.cookies, undefined)
    assert.equal(request.data, undefined)
    const headers = request.headers as Record<string, unknown>
    assert.equal(headers.Authorization, REDACTED)
    assert.equal(headers.Cookie, REDACTED)
    assert.equal(headers['Content-Type'], 'application/json')
    assert.equal((scrubbed.tags as Record<string, unknown>).environment, 'production')
  })

  it('redacts workspace free-text keys and request bodies', () => {
    assert.equal(scrubValue('hello', 'notes'), REDACTED)
    assert.equal(scrubValue('hello', 'fileData'), REDACTED)
    assert.equal(scrubValue('hello', 'jobDescription'), REDACTED)
    assert.equal(scrubValue('hello', 'password'), REDACTED)
    assert.equal(scrubValue('hello', 'meridian_token'), REDACTED)
    assert.equal(scrubValue('hello', 'DATABASE_URL'), REDACTED)
    // Technical keys survive by name.
    assert.equal(scrubValue('GET', 'method'), 'GET')
    assert.equal(scrubValue(500, 'status'), 500)
    assert.equal(scrubValue('/api/jobs', 'route'), '/api/jobs')
  })

  it('scrubs secrets embedded in strings and URLs', () => {
    assert.ok(
      !scrubString('conn postgres://user:pass@host/db failed').includes('pass@host'),
    )
    assert.ok(!scrubString('Bearer abc.def.ghi').includes('abc.def.ghi'))
    const url = scrubUrl('https://app/api/auth/reset?token=abc123&limit=10#frag')
    assert.ok(!url.includes('abc123'))
    assert.ok(url.includes('limit=10'))
    assert.ok(!url.includes('frag'))
    const normalized = scrubUrl(
      'https://app/api/opportunities/123e4567-e89b-12d3-a456-426614174000',
    )
    assert.ok(normalized.endsWith(':id'))
  })

  it('capture context keeps technical fields, drops workspace content', () => {
    const context = scrubCaptureContext({
      route: '/api/workspace',
      status: 500,
      notes: 'private',
      email: 'candidate@example.com',
    })
    assert.equal(context.route, '/api/workspace')
    assert.equal(context.status, 500)
    assert.equal(context.notes, REDACTED)
    assert.equal(context.email, REDACTED)
  })
})

describe('URL userinfo stripping (Round 1A repair)', () => {
  it('1. removes username + password userinfo', () => {
    assert.equal(
      scrubUrl('https://user:pass@example.com/path'),
      'https://example.com/path',
    )
  })

  it('2. removes username-only userinfo', () => {
    assert.equal(scrubUrl('https://user@example.com/path'), 'https://example.com/path')
  })

  it('3. removes encoded userinfo', () => {
    assert.equal(
      scrubUrl('https://user%40name:p%40ss@example.com/path'),
      'https://example.com/path',
    )
  })

  it('4. preserves port after userinfo removal', () => {
    assert.equal(
      scrubUrl('https://user:pass@example.com:8443/path'),
      'https://example.com:8443/path',
    )
  })

  it('5. still redacts sensitive query values after userinfo removal', () => {
    assert.equal(
      scrubUrl('https://user:pass@example.com/path?token=abc123&limit=10'),
      'https://example.com/path?token=[Redacted]&limit=10',
    )
  })

  it('6. still removes fragments', () => {
    assert.equal(
      scrubUrl('https://user:pass@example.com/path?limit=10#frag'),
      'https://example.com/path?limit=10',
    )
  })

  it('7. existing UUID normalization still works', () => {
    assert.equal(
      scrubUrl(
        'https://user:pass@example.com/api/123e4567-e89b-12d3-a456-426614174000?limit=1',
      ),
      'https://example.com/api/:id?limit=1',
    )
  })

  it('8. credential-free URLs keep established behavior; scrubbed events carry no markers', () => {
    assert.equal(
      scrubUrl('https://app.example.com/api/jobs?limit=10'),
      'https://app.example.com/api/jobs?limit=10',
    )
    assert.equal(scrubUrl('/api/jobs?limit=10'), '/api/jobs?limit=10')
    const userMarker = 'MARKER-USERINFO-USER-ab12'
    const passMarker = 'MARKER-USERINFO-PASS-xy98'
    const scrubbed = scrubSentryEvent({
      request: {
        method: 'GET',
        url: `https://${userMarker}:${passMarker}@example.com/path?limit=10`,
      },
    })
    const serialized = JSON.stringify(scrubbed)
    assert.ok(!serialized.includes(userMarker), 'URL username leaked')
    assert.ok(!serialized.includes(passMarker), 'URL password leaked')
    assert.ok(serialized.includes('https://example.com/path?limit=10'))
  })
})

describe('free-text URL userinfo (Round 1B repair)', () => {
  const userMarker = 'MARKER-FREETEXT-USER-m1n2'
  const passMarker = 'MARKER-FREETEXT-PASS-p3q4'

  it('1. strips username + password URL in prose', () => {
    const out = scrubString(`failed fetching https://${userMarker}:${passMarker}@example.com/path`)
    assert.ok(!out.includes(userMarker), 'username leaked')
    assert.ok(!out.includes(passMarker), 'password leaked')
    assert.ok(out.includes('https://example.com/path'))
  })

  it('2. strips username-only URL', () => {
    const out = scrubString(`redirect to https://${userMarker}@example.com/x`)
    assert.ok(!out.includes(userMarker), 'username leaked')
    assert.ok(out.includes('https://example.com/x'))
  })

  it('3. strips encoded userinfo', () => {
    const out = scrubString(`err https://us%40er:p%40ss@example.com/p`)
    assert.ok(!out.includes('us%40er'), 'encoded user leaked')
    assert.ok(!out.includes('p%40ss'), 'encoded pass leaked')
    assert.ok(out.includes('https://example.com/p'))
  })

  it('4. preserves port after stripping', () => {
    assert.equal(
      scrubString(`up https://${userMarker}:${passMarker}@example.com:8443/a`),
      'up https://example.com:8443/a',
    )
  })

  it('5. strips multiple credential URLs in one string', () => {
    const out = scrubString(
      `a https://${userMarker}:${passMarker}@example.com/1 and https://${userMarker}@example.org/2`,
    )
    assert.ok(!out.includes(userMarker), 'username leaked')
    assert.ok(!out.includes(passMarker), 'password leaked')
    assert.ok(out.includes('https://example.com/1'))
    assert.ok(out.includes('https://example.org/2'))
  })

  it('6. handles prose and punctuation around the URL', () => {
    assert.equal(
      scrubString(`note: check https://${userMarker}:${passMarker}@example.com/path, then retry.`),
      'note: check https://example.com/path, then retry.',
    )
  })

  it('7. leaves ordinary URLs and bare emails unchanged', () => {
    assert.equal(
      scrubString('plain https://example.com/docs?a=1 ok'),
      'plain https://example.com/docs?a=1 ok',
    )
    assert.equal(
      scrubString('contact jane@example.com for help'),
      'contact jane@example.com for help',
    )
  })

  it('8. existing postgres/Bearer/pair redaction remains intact', () => {
    const out = scrubString(`db postgres://adm:xyz@db:5432/app with Bearer tok-abc and password=hunter2`)
    assert.ok(!out.includes('adm:xyz@db'), 'connection userinfo leaked')
    assert.ok(out.includes(REDACTED))
    assert.ok(out.includes('Bearer [Redacted]'))
    assert.ok(out.includes('password=[Redacted]'))
  })

  it('9. real event locations carry no credential markers', () => {
    const serialized = JSON.stringify(
      scrubSentryEvent({
        exception: {
          values: [
            { type: 'Error', value: `fetch failed: https://${userMarker}:${passMarker}@example.com/api` },
          ],
        },
        breadcrumbs: [
          { message: `navigated from https://${userMarker}@example.com/start` },
        ],
        extra: { detail: `retrying https://${userMarker}:${passMarker}@example.com:8443/job` },
      }),
    )
    assert.ok(!serialized.includes(userMarker), 'username leaked via event')
    assert.ok(!serialized.includes(passMarker), 'password leaked via event')
    assert.ok(serialized.includes('https://example.com/api'))
  })

  it('stripUrlUserinfo is the shared primitive behind both paths', () => {
    assert.equal(
      stripUrlUserinfo(`x https://${userMarker}:${passMarker}@example.com/p y`),
      'x https://example.com/p y',
    )
  })
})

describe('frontend seeded-secret proof (F)', () => {
  it('serialized scrubbed output contains none of the seeded markers', () => {
    const markers = [
      'MARKER-AUTH-9f8e7d',
      'MARKER-COOKIE-4b2c1a',
      'MARKER-FILEDATA-77aa',
      'MARKER-NOTES-31cc',
      'MARKER-BODY-dead',
      'MARKER-EMAIL-55ee',
      'MARKER-DBURL-90ab',
      'MARKER-JWT-12cd',
      'MARKER-RESET-66ff',
    ]
    const event = {
      user: { email: `candidate+${markers[5]}@example.com` },
      request: {
        method: 'PUT',
        url: `https://app/api/auth/reset?token=${markers[8]}&limit=10`,
        headers: {
          Authorization: `Bearer ${markers[0]}`,
          Cookie: `meridian_token=${markers[1]}`,
        },
        data: { notes: `private ${markers[3]}`, body: markers[4] },
        cookies: { meridian_token: markers[1] },
      },
      exception: {
        values: [
          {
            type: 'Error',
            value: `connect postgres://meridian:${markers[6]}@db/host failed; token=${markers[7]}`,
          },
        ],
      },
      extra: {
        fileData: markers[2],
        route: '/api/workspace',
        status: 500,
      },
      contexts: { runtime: { name: 'browser' }, release: 'meridian@1.1.0+ebdd0be' },
    }
    const serialized = JSON.stringify(scrubSentryEvent(event))
    for (const marker of markers) {
      assert.ok(!serialized.includes(marker), `leaked marker: ${marker}`)
    }
    // Technical context survives scrubbing.
    assert.ok(serialized.includes('/api/workspace'))
    assert.ok(serialized.includes('meridian@1.1.0+ebdd0be'))
    assert.ok(serialized.includes('limit=10'))
  })
})

describe('frame source-context suppression (Round 1A)', () => {
  it('strips pre_context/context_line/post_context everywhere, keeps stack location', () => {
    const markers = [
      'MARKER-CTX-PRE-gg11',
      'MARKER-CTX-LINE-hh22',
      'MARKER-CTX-POST-ii33',
      'MARKER-CTX-NESTED-jj44',
      'MARKER-CTX-THREAD-kk55',
      'MARKER-CTX-EXTRA-ll66',
    ]
    const event = {
      exception: {
        values: [
          {
            type: 'Error',
            value: 'synthetic failure',
            stacktrace: {
              frames: [
                {
                  filename: 'src/lib/sentry.ts',
                  function: 'captureTechnicalError',
                  module: 'sentry',
                  lineno: 10,
                  colno: 5,
                  in_app: true,
                  pre_context: [`const x = '${markers[0]}';`],
                  context_line: `throw new Error('${markers[1]}');`,
                  post_context: [`// ${markers[2]}`],
                },
              ],
            },
          },
          {
            type: 'Error',
            value: 'synthetic cause',
            stacktrace: {
              frames: [
                {
                  filename: 'src/App.tsx',
                  function: 'App',
                  lineno: 99,
                  colno: 2,
                  in_app: true,
                  pre_context: [`// ${markers[3]}`],
                  context_line: 'render();',
                  post_context: [],
                },
              ],
            },
          },
        ],
      },
      threads: {
        values: [
          {
            id: '0',
            stacktrace: {
              frames: [
                {
                  filename: 'src/worker.ts',
                  function: 'work',
                  lineno: 7,
                  colno: 3,
                  in_app: true,
                  context_line: `// ${markers[4]}`,
                },
              ],
            },
          },
        ],
      },
      extra: { fileData: markers[5], route: '/synthetic' },
    }
    const scrubbed = scrubSentryEvent(event)
    const serialized = JSON.stringify(scrubbed)
    for (const marker of markers) {
      assert.ok(!serialized.includes(marker), `source-context leak: ${marker}`)
    }
    // Stack LOCATION is preserved on every frame.
    const exception = scrubbed.exception as {
      values: Array<{
        stacktrace: {
          frames: Array<Record<string, unknown>>
        }
      }>
    }
    const first = exception.values[0].stacktrace.frames[0]
    assert.equal(first.filename, 'src/lib/sentry.ts')
    assert.equal(first.function, 'captureTechnicalError')
    assert.equal(first.lineno, 10)
    assert.equal(first.colno, 5)
    assert.ok(!('pre_context' in first))
    assert.ok(!('context_line' in first))
    assert.ok(!('post_context' in first))
    const nested = exception.values[1].stacktrace.frames[0]
    assert.equal(nested.filename, 'src/App.tsx')
    assert.equal(nested.lineno, 99)
    assert.ok(!('pre_context' in nested))
    const threads = scrubbed.threads as {
      values: Array<{
        stacktrace: {
          frames: Array<Record<string, unknown>>
        }
      }>
    }
    const threadFrame = threads.values[0].stacktrace.frames[0]
    assert.equal(threadFrame.filename, 'src/worker.ts')
    assert.equal(threadFrame.colno, 3)
    assert.ok(!('context_line' in threadFrame))
    // Structured scrubbing still applies alongside frame stripping.
    const extra = scrubbed.extra as Record<string, unknown>
    assert.equal(extra.fileData, REDACTED)
    assert.equal(extra.route, '/synthetic')
  })

  it('withoutContextLines drops only the ContextLines integration', () => {
    const defaults = [{ name: 'ContextLines' }, { name: 'LinkedErrors' }, { name: 'Http' }]
    assert.deepEqual(withoutContextLines(defaults), [
      { name: 'LinkedErrors' },
      { name: 'Http' },
    ])
    assert.deepEqual(withoutContextLines([]), [])
    assert.deepEqual(withoutContextLines(null), [])
    assert.deepEqual(withoutContextLines(undefined), [])
  })

  it('initSentry wires the ContextLines-removing integrations filter', async () => {
    resetSentryForTests()
    const holder: { integrations?: unknown } = {}
    await initSentry({
      dsn: 'https://public@example.com/1',
      loader: async () => ({
        init(options: Record<string, unknown>) {
          holder.integrations = options.integrations
        },
        captureException() {},
      }),
    })
    assert.equal(typeof holder.integrations, 'function')
    const filter = holder.integrations as (
      defaults: Array<{ name: string }>,
    ) => Array<{ name: string }>
    assert.deepEqual(filter([{ name: 'ContextLines' }, { name: 'Dedupe' }]), [
      { name: 'Dedupe' },
    ])
    resetSentryForTests()
  })
})
