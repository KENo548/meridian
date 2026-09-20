/**
 * P1A export-safety tests (node:test, no external deps).
 *
 * Synthetic fixtures only — never real browser data. Fixtures are
 * deep-frozen, so any mutation of the source by the export builder
 * throws instead of passing silently.
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  WORKSPACE_EXPORT_FORMAT,
  WORKSPACE_EXPORT_SCHEMA_VERSION,
  buildWorkspaceExport,
  summarizeFileData,
  validateWorkspaceExport,
} from './workspaceExport.ts'

const FILE_BYTES_A = `data:application/pdf;base64,${'A'.repeat(100)}`
const FILE_BYTES_B = `data:image/png;base64,${'B'.repeat(50)}`

function fixtures(): Record<string, unknown[]> {
  return {
    applications: [
      { id: 'app_1', companyName: 'Bank', jobTitle: 'Analyst' },
      { id: 'app_2', companyName: 'Fund', jobTitle: 'Associate' },
    ],
    companies: [{ id: 'co_1', name: 'Bank' }],
    requirements: [{ id: 'req_1', applicationId: 'app_1' }],
    documents: [
      { id: 'doc_1', name: 'CV', fileData: FILE_BYTES_A },
      { id: 'doc_2', name: 'Cover', fileData: FILE_BYTES_B },
      { id: 'doc_3', name: 'Notes' },
    ],
    contacts: [{ id: 'con_1', name: 'Person' }],
    tasks: [],
    tags: [{ id: 'tag_1', name: 'Banking' }],
    savedViews: [{ id: 'sv_1', name: 'All', filters: {} }],
  }
}

function freezeDeep(value: unknown): void {
  if (typeof value !== 'object' || value === null) return
  Object.freeze(value)
  for (const child of Object.values(value as Record<string, unknown>)) {
    freezeDeep(child)
  }
}

describe('workspace export', () => {
  it('builds a versioned payload without mutating the source', () => {
    const records = fixtures()
    const before = JSON.stringify(records)
    freezeDeep(records)

    const payload = buildWorkspaceExport({
      userId: 'usr_test',
      exportedAt: '2026-01-01T00:00:00.000Z',
      records: records as never,
    })

    assert.equal(payload.format, WORKSPACE_EXPORT_FORMAT)
    assert.equal(payload.schemaVersion, WORKSPACE_EXPORT_SCHEMA_VERSION)
    assert.equal(payload.userId, 'usr_test')
    assert.deepEqual(payload.counts, {
      applications: 2,
      companies: 1,
      requirements: 1,
      documents: 3,
      contacts: 1,
      tasks: 0,
      tags: 1,
      savedViews: 1,
    })
    assert.equal(JSON.stringify(records), before)
  })

  it('preserves record IDs exactly', () => {
    const records = fixtures()
    freezeDeep(records)
    const payload = buildWorkspaceExport({
      userId: 'usr_test',
      exportedAt: '2026-01-01T00:00:00.000Z',
      records: records as never,
    })
    assert.deepEqual(
      payload.records.applications.map((a) => (a as { id: string }).id),
      ['app_1', 'app_2'],
    )
  })

  it('counts fileData presence and bytes without exposing contents', () => {
    const stats = summarizeFileData(fixtures().documents)
    assert.equal(stats.documentsWithFileData, 2)
    assert.equal(stats.totalEncodedBytes, FILE_BYTES_A.length + FILE_BYTES_B.length)

    const records = fixtures()
    freezeDeep(records)
    const payload = buildWorkspaceExport({
      userId: 'usr_test',
      exportedAt: '2026-01-01T00:00:00.000Z',
      records: records as never,
    })
    assert.equal(payload.fileData.presentLocallyNotMigrated, true)
    assert.equal(payload.fileData.documentsWithFileData, 2)
    assert.equal(
      payload.fileData.totalEncodedBytes,
      FILE_BYTES_A.length + FILE_BYTES_B.length,
    )
    const summaryJson = JSON.stringify({
      counts: payload.counts,
      fileData: payload.fileData,
    })
    assert.ok(!summaryJson.includes('A'.repeat(100)))
    assert.ok(!summaryJson.includes('B'.repeat(50)))
  })

  it('validates a well-formed export', () => {
    const records = fixtures()
    freezeDeep(records)
    const payload = buildWorkspaceExport({
      userId: 'usr_test',
      exportedAt: '2026-01-01T00:00:00.000Z',
      records: records as never,
    })
    const check = validateWorkspaceExport(JSON.parse(JSON.stringify(payload)))
    assert.equal(check.ok, true)
    assert.deepEqual(check.errors, [])
    assert.equal(check.summary?.totalRecords, 10)
    assert.equal(check.summary?.userId, 'usr_test')
  })

  it('rejects tampered or malformed exports', () => {
    const records = fixtures()
    const good = buildWorkspaceExport({
      userId: 'usr_test',
      exportedAt: '2026-01-01T00:00:00.000Z',
      records: records as never,
    })
    const clone = () => JSON.parse(JSON.stringify(good)) as Record<string, unknown>

    const wrongFormat = clone()
    wrongFormat['format'] = 'other'
    assert.equal(validateWorkspaceExport(wrongFormat).ok, false)

    const noUser = clone()
    noUser['userId'] = ''
    assert.equal(validateWorkspaceExport(noUser).ok, false)

    const missingCollection = clone()
    const recs = missingCollection['records'] as Record<string, unknown>
    delete recs['tasks']
    assert.equal(validateWorkspaceExport(missingCollection).ok, false)

    const badCounts = clone()
    const counts = badCounts['counts'] as Record<string, unknown>
    counts['tags'] = 99
    assert.equal(validateWorkspaceExport(badCounts).ok, false)

    const badId = clone()
    const recs2 = badId['records'] as Record<string, unknown[]>
    recs2['tags'] = [{ name: 'no-id' }]
    assert.equal(validateWorkspaceExport(badId).ok, false)

    const badFileStats = clone()
    const fileData = badFileStats['fileData'] as Record<string, unknown>
    fileData['totalEncodedBytes'] = 1
    assert.equal(validateWorkspaceExport(badFileStats).ok, false)

    assert.equal(validateWorkspaceExport(null).ok, false)
    assert.equal(validateWorkspaceExport('text').ok, false)
  })
})
