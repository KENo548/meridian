/**
 * Cloud workspace API client tests (node:test, mocked fetch).
 *
 * Proves the exact HTTP contract the server-first store relies on:
 * URLs, methods, credentials, JSON bodies, client-side fileData
 * stripping, and server-error propagation (no fabricated state —
 * every failure throws before any caller can commit local changes).
 */
import { describe, it, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import {
  deleteWorkspaceRecord,
  fetchWorkspace,
  importWorkspace,
  putWorkspaceRecord,
  setWorkspaceApiBase,
  withoutFileData,
} from './workspaceApi.ts'

interface Seen {
  url: string
  init: RequestInit
}

let seen: Seen[] = []

function mockFetch(response: { ok: boolean; status: number; body: unknown }): void {
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    seen.push({ url: String(url), init: init ?? {} })
    return {
      ok: response.ok,
      status: response.status,
      json: async () => {
        if (response.body instanceof Error) throw response.body
        return response.body
      },
    }
  }) as unknown as typeof fetch
}

describe('workspaceApi', () => {
  beforeEach(() => {
    seen = []
    setWorkspaceApiBase('https://api.test')
  })

  after(() => {
    setWorkspaceApiBase(null)
  })

  it('fetches the whole workspace with credentials', async () => {
    mockFetch({ ok: true, status: 200, body: { tasks: [] } })
    const data = await fetchWorkspace()
    assert.equal(seen.length, 1)
    assert.equal(seen[0].url, 'https://api.test/api/workspace')
    assert.equal(seen[0].init.credentials, 'include')
    assert.deepEqual(data, { tasks: [] })
  })

  it('puts a record to its scoped URL as JSON', async () => {
    mockFetch({ ok: true, status: 200, body: { record: { id: 't1' } } })
    const result = await putWorkspaceRecord('tasks', { id: 't1', title: 'x' })
    assert.equal(seen[0].url, 'https://api.test/api/workspace/tasks/t1')
    assert.equal(seen[0].init.method, 'PUT')
    assert.equal(seen[0].init.credentials, 'include')
    assert.deepEqual(JSON.parse(String(seen[0].init.body)), {
      id: 't1',
      title: 'x',
    })
    assert.deepEqual(result, { record: { id: 't1' } })
  })

  it('strips document fileData client-side before upload', () => {
    const doc = { id: 'd1', name: 'CV', fileData: 'QUJD' }
    const stripped = withoutFileData('documents', doc)
    const strippedName = stripped.name
    assert.ok(!('fileData' in stripped))
    assert.equal(strippedName, 'CV')
    assert.equal(doc.fileData, 'QUJD')
  })

  it('never sends document bytes to the server', async () => {
    mockFetch({ ok: true, status: 200, body: { record: { id: 'd1' } } })
    await putWorkspaceRecord('documents', {
      id: 'd1',
      name: 'CV',
      fileData: 'QUJD',
    })
    const sent = JSON.parse(String(seen[0].init.body)) as Record<string, unknown>
    assert.ok(!('fileData' in sent))
    assert.equal(sent['name'], 'CV')
  })

  it('deletes by scoped URL', async () => {
    mockFetch({ ok: true, status: 200, body: { deleted: true } })
    const result = await deleteWorkspaceRecord('tags', 'tag1')
    assert.equal(seen[0].url, 'https://api.test/api/workspace/tags/tag1')
    assert.equal(seen[0].init.method, 'DELETE')
    assert.deepEqual(result, { deleted: true })
  })

  it('imports bulk records with documents stripped', async () => {
    mockFetch({ ok: true, status: 200, body: { counts: { tasks: 1 } } })
    const result = await importWorkspace({
      tasks: [{ id: 't1' }],
      documents: [{ id: 'd1', fileData: 'QUJD' }],
    })
    assert.equal(seen[0].url, 'https://api.test/api/workspace/import')
    assert.equal(seen[0].init.method, 'POST')
    const sent = JSON.parse(String(seen[0].init.body)) as {
      records: Record<string, Array<Record<string, unknown>>>
    }
    assert.deepEqual(sent.records['tasks'], [{ id: 't1' }])
    assert.ok(!('fileData' in sent.records['documents'][0]))
    assert.deepEqual(result, { counts: { tasks: 1 } })
  })

  it('throws the server error message on failure', async () => {
    mockFetch({ ok: false, status: 404, body: { error: 'Record not found' } })
    await assert.rejects(fetchWorkspace(), /Record not found/)
  })

  it('throws a status-shaped error when the body is unreadable', async () => {
    mockFetch({ ok: false, status: 503, body: new Error('no json') })
    await assert.rejects(
      fetchWorkspace(),
      /Workspace request failed \(503\)/,
    )
  })
})
