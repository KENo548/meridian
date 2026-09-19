/**
 * P0 workspace API tests (node:test, no external deps).
 *
 * Boots the real Express app on an ephemeral port with the local SQLite
 * driver and exercises the Neon-authoritative workspace contract over
 * HTTP with real JWT cookies:
 *  1. Authenticated CRUD works.
 *  2. Unauthenticated access is rejected (401).
 *  3. User B cannot read, overwrite, or delete user A's records,
 *     even knowing A's record IDs (404, no existence leak).
 *  4. Upserts/imports are idempotent.
 *  5. Malformed entity/type requests fail closed (400).
 *  6. Client-supplied owner fields are ignored; document fileData is
 *     stripped (P0 defers binary storage).
 *
 * Test users are removed in teardown (workspace rows cascade).
 */
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'

process.env.JWT_SECRET ??= 'p0-workspace-test-secret-not-production'
process.env.NODE_ENV ??= 'test'
process.env.PORT = '0'
delete process.env.DATABASE_URL
delete process.env.CRON_ENABLED

const { server } = await import('../index.js')
const { getDb } = await import('../db.js')

const base = `http://127.0.0.1:${server.address().port}`
const stamp = Date.now()

async function api(method, path, { body, cookie } = {}) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  const setCookies =
    typeof res.headers.getSetCookie === 'function'
      ? res.headers.getSetCookie()
      : []
  return { status: res.status, data, setCookies }
}

const cookieOf = (r) =>
  r.setCookies.map((c) => c.split(';')[0]).join('; ')

const users = {}

describe('workspace P0 contract', () => {
  before(async () => {
    for (const who of ['alpha', 'bravo']) {
      const uname = `__ws_${who}_${stamp}__`
      const email = `__ws_${who}_${stamp}@example.invalid`
      const r = await api('POST', '/api/auth/signup', {
        body: { username: uname, email, password: 'TestPass123' },
      })
      assert.equal(r.status, 201, `signup ${who}: ${JSON.stringify(r.data)}`)
      users[who] = { id: r.data.user.id, cookie: cookieOf(r) }
    }
    assert.notEqual(users.alpha.id, users.bravo.id)
  })

  after(() => {
    getDb()
      .prepare('DELETE FROM users WHERE id IN (?, ?)')
      .run(users.alpha.id, users.bravo.id)
    server.close()
  })

  it('rejects unauthenticated access on every workspace route', async () => {
    for (const [method, path, body] of [
      ['GET', '/api/workspace', undefined],
      ['PUT', '/api/workspace/tasks/t0', { id: 't0' }],
      ['DELETE', '/api/workspace/tasks/t0', undefined],
      ['POST', '/api/workspace/import', { records: {} }],
    ]) {
      const r = await api(method, path, { body })
      assert.equal(r.status, 401, `${method} ${path}`)
    }
  })

  it('authenticated CRUD works for the owner', async () => {
    const put = await api('PUT', '/api/workspace/tasks/wt1', {
      cookie: users.alpha.cookie,
      body: { id: 'wt1', title: 'Call bank', completed: false },
    })
    assert.equal(put.status, 200)
    assert.equal(put.data.record.id, 'wt1')
    assert.equal(put.data.record.title, 'Call bank')

    const dump = await api('GET', '/api/workspace', {
      cookie: users.alpha.cookie,
    })
    assert.equal(dump.status, 200)
    assert.equal(dump.data.tasks.length, 1)
    assert.equal(dump.data.applications.length, 0)

    const del = await api('DELETE', '/api/workspace/tasks/wt1', {
      cookie: users.alpha.cookie,
    })
    assert.equal(del.status, 200)
    assert.equal(del.data.deleted, true)

    const afterDel = await api('GET', '/api/workspace', {
      cookie: users.alpha.cookie,
    })
    assert.equal(afterDel.data.tasks.length, 0)
  })

  it('user B cannot read, overwrite, or delete user A records', async () => {
    await api('PUT', '/api/workspace/tasks/owned1', {
      cookie: users.alpha.cookie,
      body: { id: 'owned1', title: 'Alpha private' },
    })

    const bDump = await api('GET', '/api/workspace', {
      cookie: users.bravo.cookie,
    })
    assert.equal(bDump.status, 200)
    assert.deepEqual(bDump.data.tasks, [])

    const bOverwrite = await api('PUT', '/api/workspace/tasks/owned1', {
      cookie: users.bravo.cookie,
      body: { id: 'owned1', title: 'Bravo hijack' },
    })
    assert.equal(bOverwrite.status, 404)

    const bDelete = await api('DELETE', '/api/workspace/tasks/owned1', {
      cookie: users.bravo.cookie,
    })
    assert.equal(bDelete.status, 404)

    const aDump = await api('GET', '/api/workspace', {
      cookie: users.alpha.cookie,
    })
    assert.equal(aDump.data.tasks.length, 1)
    assert.equal(aDump.data.tasks[0].title, 'Alpha private')

    await api('DELETE', '/api/workspace/tasks/owned1', {
      cookie: users.alpha.cookie,
    })
  })

  it('upserts and imports are idempotent', async () => {
    const record = { id: 'idem1', title: 'Same' }
    const first = await api('PUT', '/api/workspace/tasks/idem1', {
      cookie: users.alpha.cookie,
      body: record,
    })
    const second = await api('PUT', '/api/workspace/tasks/idem1', {
      cookie: users.alpha.cookie,
      body: record,
    })
    assert.equal(first.status, 200)
    assert.equal(second.status, 200)

    const dump = await api('GET', '/api/workspace', {
      cookie: users.alpha.cookie,
    })
    assert.equal(
      dump.data.tasks.filter((t) => t.id === 'idem1').length,
      1,
    )

    const payload = { records: { tags: [{ id: 'tag1', name: 'Banking' }] } }
    const imp1 = await api('POST', '/api/workspace/import', {
      cookie: users.alpha.cookie,
      body: payload,
    })
    const imp2 = await api('POST', '/api/workspace/import', {
      cookie: users.alpha.cookie,
      body: payload,
    })
    assert.deepEqual(imp1.data.counts, { tags: 1 })
    assert.deepEqual(imp2.data.counts, { tags: 1 })

    await api('DELETE', '/api/workspace/tasks/idem1', {
      cookie: users.alpha.cookie,
    })
    await api('DELETE', '/api/workspace/tags/tag1', {
      cookie: users.alpha.cookie,
    })
  })

  it('malformed entity/type requests fail closed', async () => {
    const unknown = await api('PUT', '/api/workspace/nope/x1', {
      cookie: users.alpha.cookie,
      body: { id: 'x1' },
    })
    assert.equal(unknown.status, 400)

    const mismatch = await api('PUT', '/api/workspace/tasks/t9', {
      cookie: users.alpha.cookie,
      body: { id: 'other' },
    })
    assert.equal(mismatch.status, 400)

    const arrayBody = await api('PUT', '/api/workspace/tasks/t9', {
      cookie: users.alpha.cookie,
      body: [{ id: 't9' }],
    })
    assert.equal(arrayBody.status, 400)

    const badImport = await api('POST', '/api/workspace/import', {
      cookie: users.alpha.cookie,
      body: { records: { nope: [] } },
    })
    assert.equal(badImport.status, 400)

    const nonArrayImport = await api('POST', '/api/workspace/import', {
      cookie: users.alpha.cookie,
      body: { records: { tasks: {} } },
    })
    assert.equal(nonArrayImport.status, 400)
  })

  it('ignores client-supplied owner fields and strips document fileData', async () => {
    const spoof = await api('PUT', '/api/workspace/tasks/spoof1', {
      cookie: users.alpha.cookie,
      body: { id: 'spoof1', title: 'Mine', user_id: users.bravo.id, userId: users.bravo.id },
    })
    assert.equal(spoof.status, 200)
    assert.ok(!('user_id' in spoof.data.record))
    assert.ok(!('userId' in spoof.data.record))

    const bDump = await api('GET', '/api/workspace', {
      cookie: users.bravo.cookie,
    })
    assert.deepEqual(bDump.data.tasks, [])

    const doc = await api('PUT', '/api/workspace/documents/doc1', {
      cookie: users.alpha.cookie,
      body: { id: 'doc1', name: 'CV', fileData: 'QUJDREVGRw==', fileType: 'application/pdf' },
    })
    assert.equal(doc.status, 200)
    assert.equal(doc.data.record.name, 'CV')
    assert.ok(!('fileData' in doc.data.record))

    await api('DELETE', '/api/workspace/tasks/spoof1', {
      cookie: users.alpha.cookie,
    })
    await api('DELETE', '/api/workspace/documents/doc1', {
      cookie: users.alpha.cookie,
    })
  })
})
