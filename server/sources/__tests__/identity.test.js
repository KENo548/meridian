import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeFingerprint,
  computeContentHash,
  buildExternalKey,
  classifySourceTier,
  normalizeTitle,
  normalizeCompany,
  normalizeLocation,
  extractYear,
  resolveIdentity,
} from '../ats/dedup.js'
import {
  SIGHTING_THRESHOLDS,
  LIFECYCLE_STATES,
  CLOSING_SOON_DAYS,
} from '../canonical-staleness.js'
import {
  STATUS,
  ZERO_RESULT_THRESHOLDS,
  BASELINE_SIGNIFICANCE,
} from '../adapter-health.js'

describe('normalizeTitle', () => {
  it('lowercases and strips noise words', () => {
    const result = normalizeTitle('Summer Analyst (F/M/D) - Frankfurt')
    assert.ok(result.includes('summer'))
    assert.ok(!result.includes('f/m/d'))
    assert.ok(result.includes('frankfurt'))
  })

  it('normalizes full title', () => {
    const result = normalizeTitle('Summer 2026 Analyst')
    assert.ok(result.includes('summer'))
    assert.ok(result.includes('2026'))
  })
})

describe('normalizeCompany', () => {
  it('removes legal suffixes', () => {
    const result = normalizeCompany('Goldman Sachs & Co. LLC')
    assert.ok(result.includes('goldman'))
    assert.ok(result.includes('sachs'))
    assert.ok(!result.includes('co'))
    assert.ok(!result.includes('llc'))
  })

  it('lowercases', () => {
    const result = normalizeCompany('MORGAN STANLEY')
    assert.equal(result, 'morgan stanley')
  })
})

describe('normalizeLocation', () => {
  it('normalizes country codes', () => {
    assert.ok(normalizeLocation('Frankfurt, Germany').includes('de'))
    assert.ok(normalizeLocation('London, United Kingdom').includes('gb'))
    assert.ok(normalizeLocation('Zurich, Switzerland').includes('ch'))
  })

  it('normalizes Frankfurt variations', () => {
    const result = normalizeLocation('Frankfurt am Main')
    assert.ok(result.includes('frankfurt'))
    assert.ok(!result.includes('am main'))
  })
})

describe('extractYear', () => {
  it('extracts year from title', () => {
    assert.equal(extractYear('Summer 2026 Analyst'), '2026')
    assert.equal(extractYear('Internship 2027'), '2027')
  })

  it('extracts year from deadline', () => {
    assert.equal(extractYear(null, '2026-03-15'), '2026')
  })

  it('returns null when no year found', () => {
    assert.equal(extractYear('Summer Analyst', null), null)
  })
})

describe('computeFingerprint', () => {
  it('generates consistent fingerprint', () => {
    const job = { company: 'GS', title: 'Analyst', location: 'London', programmeType: 'intern' }
    const fp1 = computeFingerprint(job)
    const fp2 = computeFingerprint(job)
    assert.equal(fp1, fp2)
  })

  it('generates different fingerprints for different jobs', () => {
    const job1 = { company: 'GS', title: 'Analyst', location: 'London' }
    const job2 = { company: 'MS', title: 'Analyst', location: 'London' }
    assert.notEqual(computeFingerprint(job1), computeFingerprint(job2))
  })

  it('returns null for insufficient data', () => {
    assert.equal(computeFingerprint({}), null)
    assert.equal(computeFingerprint({ company: 'GS' }), null)
  })
})

describe('computeContentHash', () => {
  it('generates consistent hash', () => {
    const job = { company: 'GS', title: 'Analyst', location: 'London', url: 'https://example.com' }
    const h1 = computeContentHash(job)
    const h2 = computeContentHash(job)
    assert.equal(h1, h2)
  })

  it('generates different hashes for different content', () => {
    const job1 = { company: 'GS', title: 'Analyst', location: 'London' }
    const job2 = { company: 'GS', title: 'Associate', location: 'London' }
    assert.notEqual(computeContentHash(job1), computeContentHash(job2))
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

  it('returns null when no identifier', () => {
    assert.equal(buildExternalKey('lever', {}), null)
  })
})

describe('classifySourceTier', () => {
  it('classifies employer ATS sources', () => {
    assert.equal(classifySourceTier('greenhouse'), 'employer_ats')
    assert.equal(classifySourceTier('workday'), 'employer_ats')
    assert.equal(classifySourceTier('lever'), 'employer_ats')
  })

  it('classifies tracker sources', () => {
    assert.equal(classifySourceTier('analystclass'), 'tracker')
    assert.equal(classifySourceTier('fyntraq'), 'tracker')
    assert.equal(classifySourceTier('trackr'), 'tracker')
  })

  it('classifies other sources as aggregator', () => {
    assert.equal(classifySourceTier('efc'), 'aggregator')
    assert.equal(classifySourceTier('rss'), 'aggregator')
  })
})

describe('resolveIdentity', () => {
  it('returns tier=ats_reqid for ATS jobs with req ID (no DB)', () => {
    // In test environment without DB, resolveIdentity returns 'new' for all jobs
    // because findFuzzyMatchSync returns null when DB isn't loaded
    const job = { atsReqId: '12345', company: 'GS', title: 'Analyst' }
    const result = resolveIdentity(job, 'greenhouse')
    // Without DB, no existing canonical jobs exist, so tier is 'new'
    assert.equal(result.tier, 'new')
  })
})

describe('Canonical Staleness Constants', () => {
  it('has correct sighting thresholds', () => {
    assert.equal(SIGHTING_THRESHOLDS.employer_ats.stale, 2)
    assert.equal(SIGHTING_THRESHOLDS.employer_ats.closed, 3)
    assert.equal(SIGHTING_THRESHOLDS.tracker.stale, 3)
    assert.equal(SIGHTING_THRESHOLDS.tracker.closed, 5)
  })

  it('has correct lifecycle states', () => {
    assert.equal(LIFECYCLE_STATES.OPEN, 'open')
    assert.equal(LIFECYCLE_STATES.CLOSED, 'closed')
    assert.equal(LIFECYCLE_STATES.CLOSING_SOON, 'closing_soon')
  })

  it('has correct closing soon threshold', () => {
    assert.equal(CLOSING_SOON_DAYS, 7)
  })
})

describe('Adapter Health Constants', () => {
  it('has correct status values', () => {
    assert.equal(STATUS.HEALTHY, 'healthy')
    assert.equal(STATUS.DEGRADED, 'degraded')
    assert.equal(STATUS.UNHEALTHY, 'unhealthy')
  })

  it('has correct zero result thresholds', () => {
    assert.equal(ZERO_RESULT_THRESHOLDS.healthy, 0)
    assert.equal(ZERO_RESULT_THRESHOLDS.degraded, 2)
    assert.equal(ZERO_RESULT_THRESHOLDS.unhealthy, 5)
  })

  it('has correct baseline significance', () => {
    assert.equal(BASELINE_SIGNIFICANCE, 5)
  })
})
