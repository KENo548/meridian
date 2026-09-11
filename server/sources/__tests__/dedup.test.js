import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { deduplicateJobs, mergeWithPersisted, getDedupKey, EMPLOYER_ATS_SOURCES, computeFingerprint, buildExternalKey } from '../ats/dedup.js'

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

describe('EMPLOYER_ATS_SOURCES', () => {
  it('contains expected providers', () => {
    assert.ok(EMPLOYER_ATS_SOURCES.has('greenhouse'))
    assert.ok(EMPLOYER_ATS_SOURCES.has('workday'))
    assert.ok(EMPLOYER_ATS_SOURCES.has('oleeo_rss'))
    assert.ok(EMPLOYER_ATS_SOURCES.has('smartrecruiters'))
    assert.ok(EMPLOYER_ATS_SOURCES.has('lever'))
    assert.ok(!EMPLOYER_ATS_SOURCES.has('efc'))
    assert.ok(!EMPLOYER_ATS_SOURCES.has('rss'))
  })
})

describe('computeFingerprint', () => {
  it('generates consistent fingerprint for same job', () => {
    const job = { company: 'Goldman Sachs', title: 'Summer Analyst', location: 'London', programmeType: 'summer_intern' }
    const fp1 = computeFingerprint(job)
    const fp2 = computeFingerprint(job)
    assert.equal(fp1, fp2)
    assert.ok(fp1.length > 0)
  })

  it('generates different fingerprint for different jobs', () => {
    const job1 = { company: 'Goldman Sachs', title: 'Summer Analyst', location: 'London' }
    const job2 = { company: 'Morgan Stanley', title: 'Summer Analyst', location: 'London' }
    assert.notEqual(computeFingerprint(job1), computeFingerprint(job2))
  })

  it('returns null for insufficient data', () => {
    assert.equal(computeFingerprint({}), null)
    assert.equal(computeFingerprint({ company: 'GS' }), null)
  })
})

describe('buildExternalKey', () => {
  it('builds key from ATS req ID', () => {
    const job = { atsReqId: '12345' }
    assert.equal(buildExternalKey('greenhouse', job), 'greenhouse:12345')
  })

  it('builds key from source job ID', () => {
    const job = { sourceJobId: 'abc-123' }
    assert.equal(buildExternalKey('workday', job), 'workday:abc-123')
  })

  it('builds key from URL hash', () => {
    const job = { url: 'https://careers.example.com/job/123' }
    const key = buildExternalKey('lever', job)
    assert.ok(key.startsWith('lever:url:'))
  })

  it('returns null when no identifier available', () => {
    assert.equal(buildExternalKey('lever', {}), null)
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
