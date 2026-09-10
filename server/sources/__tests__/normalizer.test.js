import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { normalize, normalizeBatch, validateUrl, validateDate, validateJob, ALLOWED_SOURCES } from '../normalize.js'

describe('ALLOWED_SOURCES', () => {
  it('includes smartrecruiters and lever', () => {
    assert.ok(ALLOWED_SOURCES.includes('smartrecruiters'))
    assert.ok(ALLOWED_SOURCES.includes('lever'))
  })
})

describe('validateUrl', () => {
  it('validates a proper URL', () => {
    const r = validateUrl('https://example.com')
    assert.equal(r, 'https://example.com/')
  })

  it('prepends https to bare URLs', () => {
    const r = validateUrl('example.com')
    assert.ok(r)
    assert.ok(r.startsWith('https://example.com'))
  })

  it('returns null for invalid URLs', () => {
    assert.equal(validateUrl('not a url'), null)
    assert.equal(validateUrl(''), null)
    assert.equal(validateUrl(null), null)
  })
})

describe('validateDate', () => {
  it('validates a proper date string', () => {
    const r = validateDate('2026-01-15')
    assert.ok(r)
    assert.ok(r.includes('2026'))
  })

  it('returns null for invalid dates', () => {
    assert.equal(validateDate('not-a-date'), null)
    assert.equal(validateDate(''), null)
    assert.equal(validateDate(null), null)
  })
})

describe('validateJob', () => {
  it('validates a complete job', () => {
    const r = validateJob({
      title: 'Analyst',
      company: 'Goldman Sachs',
      url: 'https://example.com/job/1',
      posted: '2026-01-15',
    }, 'greenhouse')
    assert.ok(r.valid)
    assert.equal(r.errors.length, 0)
  })

  it('rejects job without title', () => {
    const r = validateJob({ company: 'GS' }, 'greenhouse')
    assert.ok(r.errors.some(e => e.includes('Missing title')))
  })

  it('rejects job without company', () => {
    const r = validateJob({ title: 'Analyst' }, 'greenhouse')
    assert.ok(r.errors.some(e => e.includes('Missing company')))
  })

  it('warns about invalid URL', () => {
    const r = validateJob({
      title: 'Analyst',
      company: 'GS',
      url: '://invalid',
    }, 'greenhouse')
    assert.ok(r.errors.some(e => e.includes('Invalid URL')))
  })

  it('warns about invalid date', () => {
    const r = validateJob({
      title: 'Analyst',
      company: 'GS',
      posted: 'not-a-date',
    }, 'greenhouse')
    assert.ok(r.errors.some(e => e.includes('Invalid date')))
  })
})

describe('normalize', () => {
  it('normalizes a Greenhouse job', () => {
    const raw = {
      id: '12345',
      source: 'greenhouse',
      company: 'William Blair',
      title: 'Summer Analyst',
      location: 'London',
      url: 'https://boards.greenhouse.io/williamblair/jobs/12345',
      employmentType: 'internship',
    }
    const r = normalize(raw, 'greenhouse')
    assert.ok(r)
    assert.equal(r.source, 'greenhouse')
    assert.equal(r.company, 'William Blair')
    assert.equal(r.title, 'Summer Analyst')
    assert.equal(r.id, 'greenhouse:12345')
  })

  it('normalizes a SmartRecruiters job', () => {
    const raw = {
      id: 'sr-123',
      source: 'smartrecruiters',
      company: 'Evercore',
      title: 'Analyst',
      location: 'New York',
      url: 'https://jobs.smartrecruiters.com/Evercore/123',
    }
    const r = normalize(raw, 'smartrecruiters')
    assert.ok(r)
    assert.equal(r.source, 'smartrecruiters')
    assert.equal(r.id, 'smartrecruiters:sr-123')
  })

  it('normalizes a Lever job', () => {
    const raw = {
      id: 'lev-456',
      source: 'lever',
      company: 'Anthropic',
      title: 'Research Engineer',
      location: 'San Francisco',
      url: 'https://jobs.lever.co/anthropic/456',
    }
    const r = normalize(raw, 'lever')
    assert.ok(r)
    assert.equal(r.source, 'lever')
    assert.equal(r.id, 'lever:lev-456')
  })

  it('returns null for empty input', () => {
    assert.equal(normalize(null, 'greenhouse'), null)
    assert.equal(normalize({}, 'greenhouse'), null)
  })

  it('returns null for disallowed source', () => {
    assert.equal(normalize({ title: 'x', company: 'y' }, 'unknown_source'), null)
  })

  it('returns null for job without title or company', () => {
    assert.equal(normalize({ location: 'London' }, 'greenhouse'), null)
  })

  it('validates dates', () => {
    const raw = {
      id: '1',
      title: 'Analyst',
      company: 'GS',
      posted: 'not-a-date',
    }
    const r = normalize(raw, 'greenhouse')
    assert.ok(r)
    assert.equal(r.posted, undefined)
  })
})

describe('normalizeBatch', () => {
  it('normalizes a batch of jobs', () => {
    const items = [
      { id: '1', title: 'A', company: 'X' },
      { id: '2', title: 'B', company: 'Y' },
      null,
    ]
    const r = normalizeBatch(items, 'greenhouse')
    assert.equal(r.length, 2)
  })

  it('returns empty for non-array', () => {
    assert.deepEqual(normalizeBatch(null, 'greenhouse'), [])
  })
})
