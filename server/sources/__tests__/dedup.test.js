import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { deduplicateJobs, mergeWithPersisted, getDedupKey, DIRECT_SOURCES } from '../ats/dedup.js'

describe('getDedupKey', () => {
  it('uses canonicalId when available', () => {
    const job = { canonicalId: 'url:https://example.com/job/1' }
    assert.equal(getDedupKey(job), 'url:https://example.com/job/1')
  })

  it('falls back to text key', () => {
    const job = { company: 'GS', title: 'Analyst', location: 'London' }
    assert.equal(getDedupKey(job), 'text:gs:analyst:london')
  })
})

describe('DIRECT_SOURCES', () => {
  it('contains expected providers', () => {
    assert.ok(DIRECT_SOURCES.has('greenhouse'))
    assert.ok(DIRECT_SOURCES.has('workday'))
    assert.ok(DIRECT_SOURCES.has('oleeo_rss'))
    assert.ok(DIRECT_SOURCES.has('smartrecruiters'))
    assert.ok(DIRECT_SOURCES.has('lever'))
    assert.ok(!DIRECT_SOURCES.has('efc'))
    assert.ok(!DIRECT_SOURCES.has('rss'))
  })
})

describe('deduplicateJobs', () => {
  it('removes duplicate jobs by canonicalId', () => {
    const jobs = [
      { canonicalId: 'url:https://example.com/1', source: 'greenhouse', title: 'A', company: 'X', firstSeenAt: '2026-01-01T00:00:00Z', lastSeenAt: '2026-01-01T00:00:00Z' },
      { canonicalId: 'url:https://example.com/1', source: 'workday', title: 'A', company: 'X', firstSeenAt: '2026-01-02T00:00:00Z', lastSeenAt: '2026-01-02T00:00:00Z' },
    ]
    const { jobs: deduped, report } = deduplicateJobs(jobs)
    assert.equal(deduped.length, 1)
    assert.equal(report.deduplicated, 1)
  })

  it('preserves earliest firstSeenAt', () => {
    const jobs = [
      { canonicalId: 'url:https://example.com/1', source: 'greenhouse', title: 'A', company: 'X', firstSeenAt: '2026-01-03T00:00:00Z', lastSeenAt: '2026-01-03T00:00:00Z' },
      { canonicalId: 'url:https://example.com/1', source: 'greenhouse', title: 'A', company: 'X', firstSeenAt: '2026-01-01T00:00:00Z', lastSeenAt: '2026-01-02T00:00:00Z' },
    ]
    const { jobs: deduped } = deduplicateJobs(jobs)
    assert.equal(deduped[0].firstSeenAt, '2026-01-01T00:00:00Z')
  })

  it('updates lastSeenAt to latest observation', () => {
    const jobs = [
      { canonicalId: 'url:https://example.com/1', source: 'greenhouse', title: 'A', company: 'X', firstSeenAt: '2026-01-01T00:00:00Z', lastSeenAt: '2026-01-01T00:00:00Z' },
      { canonicalId: 'url:https://example.com/1', source: 'greenhouse', title: 'A', company: 'X', firstSeenAt: '2026-01-02T00:00:00Z', lastSeenAt: '2026-01-03T00:00:00Z' },
    ]
    const { jobs: deduped } = deduplicateJobs(jobs)
    assert.equal(deduped[0].lastSeenAt, '2026-01-03T00:00:00Z')
  })

  it('direct ATS sources beat indirect sources', () => {
    const jobs = [
      { canonicalId: 'url:https://example.com/1', source: 'efc', title: 'A', company: 'X', firstSeenAt: '2026-01-01T00:00:00Z', lastSeenAt: '2026-01-01T00:00:00Z' },
      { canonicalId: 'url:https://example.com/1', source: 'greenhouse', title: 'A', company: 'X', firstSeenAt: '2026-01-02T00:00:00Z', lastSeenAt: '2026-01-02T00:00:00Z' },
    ]
    const { jobs: deduped } = deduplicateJobs(jobs)
    assert.equal(deduped[0].source, 'greenhouse')
  })

  it('falls back to text key when no canonicalId', () => {
    const jobs = [
      { source: 'greenhouse', title: 'Analyst', company: 'GS', location: 'London' },
      { source: 'workday', title: 'Analyst', company: 'GS', location: 'London' },
    ]
    const { jobs: deduped, report } = deduplicateJobs(jobs)
    assert.equal(deduped.length, 1)
    assert.equal(report.deduplicated, 1)
  })

  it('generates dedup report', () => {
    const jobs = [
      { canonicalId: 'url:1', source: 'greenhouse', title: 'A', company: 'X' },
      { canonicalId: 'url:2', source: 'greenhouse', title: 'B', company: 'Y' },
      { canonicalId: 'url:1', source: 'workday', title: 'A', company: 'X' },
    ]
    const { report } = deduplicateJobs(jobs)
    assert.equal(report.total, 3)
    assert.equal(report.deduplicated, 1)
    assert.equal(report.bySource.greenhouse, 2)
    assert.equal(report.bySource.workday, 1)
  })
})

describe('mergeWithPersisted', () => {
  it('identifies new jobs', () => {
    const newJobs = [
      { canonicalId: 'url:1', source: 'greenhouse', title: 'A', company: 'X', firstSeenAt: '2026-01-01T00:00:00Z', lastSeenAt: '2026-01-01T00:00:00Z' },
    ]
    const persisted = []
    const { jobs, report } = mergeWithPersisted(newJobs, persisted)
    assert.equal(jobs.length, 1)
    assert.equal(report.newJobs, 1)
    assert.equal(report.updatedJobs, 0)
  })

  it('identifies updated jobs and preserves firstSeenAt', () => {
    const newJobs = [
      { canonicalId: 'url:1', source: 'greenhouse', title: 'A', company: 'X', firstSeenAt: '2026-01-02T00:00:00Z', lastSeenAt: '2026-01-02T00:00:00Z' },
    ]
    const persisted = [
      { canonicalId: 'url:1', source: 'greenhouse', title: 'A', company: 'X', firstSeenAt: '2026-01-01T00:00:00Z', lastSeenAt: '2026-01-01T00:00:00Z' },
    ]
    const { jobs, report } = mergeWithPersisted(newJobs, persisted)
    assert.equal(jobs.length, 1)
    assert.equal(report.updatedJobs, 1)
    assert.equal(jobs[0].firstSeenAt, '2026-01-01T00:00:00Z')
  })

  it('updates lastSeenAt to latest', () => {
    const newJobs = [
      { canonicalId: 'url:1', source: 'greenhouse', title: 'A', company: 'X', firstSeenAt: '2026-01-02T00:00:00Z', lastSeenAt: '2026-01-03T00:00:00Z' },
    ]
    const persisted = [
      { canonicalId: 'url:1', source: 'greenhouse', title: 'A', company: 'X', firstSeenAt: '2026-01-01T00:00:00Z', lastSeenAt: '2026-01-01T00:00:00Z' },
    ]
    const { jobs } = mergeWithPersisted(newJobs, persisted)
    assert.equal(jobs[0].lastSeenAt, '2026-01-03T00:00:00Z')
  })

  it('preserves persisted-only jobs', () => {
    const newJobs = []
    const persisted = [
      { canonicalId: 'url:1', source: 'greenhouse', title: 'A', company: 'X', firstSeenAt: '2026-01-01T00:00:00Z', lastSeenAt: '2026-01-01T00:00:00Z' },
    ]
    const { jobs, report } = mergeWithPersisted(newJobs, persisted)
    assert.equal(jobs.length, 1)
    assert.equal(report.persistedUnchanged, 1)
  })
})
