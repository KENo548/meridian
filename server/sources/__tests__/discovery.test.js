import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import * as store from '../discovery/store.js'
import { resolveFirm, matchByAlias, matchByDomain, matchByFuzzy, extractDomain, levenshtein } from '../discovery/resolve.js'
import { normalizeTrackerEntry, deriveTrackerIntel, classifyProgramme } from '../discovery/normalize.js'
import { classifyUrl } from '../ats/classifier.js'

describe('Discovery Store', () => {
  beforeEach(() => {
    store.clear()
  })

  describe('createEntry', () => {
    it('creates entry with default discovered status', () => {
      const entry = store.createEntry({ companyName: 'JPMorgan' })
      assert.equal(entry.status, 'discovered')
      assert.equal(entry.companyName, 'JPMorgan')
      assert.ok(entry.id)
      assert.ok(entry.createdAt)
    })

    it('rejects entry without companyName', () => {
      const entry = store.createEntry({})
      assert.equal(entry, null)
    })

    it('includes observations', () => {
      const entry = store.createEntry({
        companyName: 'Goldman Sachs',
        observations: [{ source: 'fyntraq', programme: 'Summer Internship' }],
      })
      assert.equal(entry.observations.length, 1)
      assert.equal(entry.observations[0].source, 'fyntraq')
    })
  })

  describe('transition', () => {
    it('allows valid transition', () => {
      const entry = store.createEntry({ companyName: 'Test' })
      const result = store.transition(entry.id, store.STATES.RESOLVED)
      assert.equal(result.status, 'resolved')
    })

    it('rejects invalid transition', () => {
      const entry = store.createEntry({ companyName: 'Test' })
      const result = store.transition(entry.id, store.STATES.ENABLED)
      assert.ok(result.error)
    })

    it('returns null for unknown entry', () => {
      const result = store.transition('nonexistent', store.STATES.RESOLVED)
      assert.equal(result, null)
    })
  })

  describe('findOrCreate', () => {
    it('creates new entry', () => {
      const result = store.findOrCreate({ companyName: 'New Firm' })
      assert.equal(result.created, true)
      assert.equal(result.companyName, 'New Firm')
    })

    it('finds existing entry', () => {
      store.findOrCreate({ companyName: 'Existing', programme: 'Summer' })
      const result = store.findOrCreate({ companyName: 'Existing', programme: 'Summer' })
      assert.equal(result.created, false)
    })

    it('adds observations to existing entry', () => {
      store.findOrCreate({ companyName: 'Test', programme: 'Spring' })
      const result = store.findOrCreate({
        companyName: 'Test',
        programme: 'Spring',
        observations: [{ source: 'landtheoffer' }],
      })
      assert.equal(result.observations.length, 1)
    })
  })

  describe('getStats', () => {
    it('returns empty stats', () => {
      const stats = store.getStats()
      assert.equal(stats.total, 0)
    })

    it('counts entries by status', () => {
      store.findOrCreate({ companyName: 'Alpha Corp' })
      store.findOrCreate({ companyName: 'Bravo Inc' })
      const stats = store.getStats()
      assert.equal(stats.total, 2)
      assert.equal(stats.byStatus.discovered, 2)
    })
  })

  describe('event emitters', () => {
    it('emits created event', () => {
      let received = false
      store.on('created', () => { received = true })
      store.createEntry({ companyName: 'Event Test' })
      assert.equal(received, true)
    })
  })
})

describe('Firm Identity Resolver', () => {
  describe('matchByAlias', () => {
    it('matches exact alias', () => {
      const r = matchByAlias('J.P. Morgan')
      assert.equal(r.firmId, 'jpmorgan')
      assert.equal(r.confidence, 'high')
    })

    it('matches case-insensitive alias', () => {
      const r = matchByAlias('GOLDMAN SACHS')
      assert.equal(r.firmId, 'goldman-sachs')
    })

    it('matches partial alias', () => {
      const r = matchByAlias('JPMorgan Chase')
      assert.equal(r.firmId, 'jpmorgan')
    })

    it('returns null for unknown firm', () => {
      const r = matchByAlias('Unknown Corp')
      assert.equal(r, null)
    })
  })

  describe('matchByDomain', () => {
    it('matches domain', () => {
      const r = matchByDomain('https://www.gs.com/careers')
      assert.equal(r.firmId, 'goldman-sachs')
      assert.equal(r.confidence, 'high')
    })

    it('matches subdomain', () => {
      const r = matchByDomain('https://careers.blackstone.com/jobs')
      assert.equal(r.firmId, 'blackstone')
    })

    it('returns null for unknown domain', () => {
      const r = matchByDomain('https://unknown.com')
      assert.equal(r, null)
    })
  })

  describe('matchByFuzzy', () => {
    it('matches similar name', () => {
      const r = matchByFuzzy('Morgan Stanely')
      assert.equal(r.firmId, 'morgan-stanley')
      assert.equal(r.method, 'fuzzy')
    })

    it('returns null for very different name', () => {
      const r = matchByFuzzy('Completely Different Corp')
      assert.equal(r, null)
    })
  })

  describe('resolveFirm', () => {
    it('resolves by alias first', () => {
      const r = resolveFirm('J.P. Morgan')
      assert.equal(r.firmId, 'jpmorgan')
      assert.equal(r.method, 'alias')
    })

    it('resolves by domain if alias is medium confidence', () => {
      const r = resolveFirm('Random', 'https://www.gs.com')
      assert.equal(r.firmId, 'goldman-sachs')
    })

    it('returns none for completely unknown', () => {
      const r = resolveFirm('Unknown Corp', 'https://unknown.com')
      assert.equal(r.confidence, 'none')
    })
  })

  describe('levenshtein', () => {
    it('calculates distance', () => {
      assert.equal(levenshtein('kitten', 'sitting'), 3)
      assert.equal(levenshtein('same', 'same'), 0)
    })
  })

  describe('extractDomain', () => {
    it('extracts domain from URL', () => {
      assert.equal(extractDomain('https://www.gs.com/careers'), 'gs.com')
      assert.equal(extractDomain('https://careers.blackstone.com'), 'careers.blackstone.com')
    })

    it('returns null for invalid URL', () => {
      assert.equal(extractDomain(null), null)
    })
  })
})

describe('Tracker Normalization', () => {
  describe('classifyProgramme', () => {
    it('classifies spring week', () => {
      assert.equal(classifyProgramme('Spring Week'), 'spring_week')
      assert.equal(classifyProgramme('Spring Insight'), 'spring_week')
    })

    it('classifies summer internship', () => {
      assert.equal(classifyProgramme('Summer Internship'), 'summer_intern')
      assert.equal(classifyProgramme('Summer Analyst'), 'summer_intern')
    })

    it('classifies off-cycle', () => {
      assert.equal(classifyProgramme('Off-Cycle'), 'off_cycle')
      assert.equal(classifyProgramme('Werkstudent'), 'off_cycle')
    })

    it('classifies grad programme', () => {
      assert.equal(classifyProgramme('Graduate Programme'), 'grad')
    })

    it('returns unknown for unrecognized text', () => {
      assert.equal(classifyProgramme('Unknown'), 'unknown')
    })
  })

  describe('normalizeTrackerEntry', () => {
    it('normalizes landtheoffer entry', () => {
      const entry = normalizeTrackerEntry({
        company: 'J.P. Morgan',
        programme: 'Summer Internship 2025',
        location: 'London',
        country: 'UK',
        applyUrl: 'https://jpmorgan.com/apply',
        openingDate: '2024-09-01',
        closingDate: '2024-10-15',
        category: 'summer_intern',
      }, 'landtheoffer')
      assert.equal(entry.companyName, 'J.P. Morgan')
      assert.equal(entry.category, 'summer_intern')
      assert.equal(entry.applyUrl, 'https://jpmorgan.com/apply')
    })
  })

  describe('deriveTrackerIntel', () => {
    it('derives intel from observations', () => {
      const intel = deriveTrackerIntel([
        { source: 'landtheoffer', programme: 'Summer Internship', closingDate: '2024-10-15', lastSeenAt: new Date().toISOString() },
        { source: 'fyntraq', programme: 'Summer Intern', closingDate: '2024-10-10', lastSeenAt: new Date().toISOString() },
      ])
      assert.equal(intel.closingDate.value, '2024-10-15')
    })

    it('returns latest closing date', () => {
      const intel = deriveTrackerIntel([
        { source: 'landtheoffer', closingDate: '2024-11-01', lastSeenAt: new Date().toISOString() },
        { source: 'fyntraq', closingDate: '2024-10-01', lastSeenAt: new Date().toISOString() },
      ])
      assert.equal(intel.closingDate.value, '2024-11-01')
    })
  })
})

describe('URL Classifier', () => {
  it('classifies Greenhouse URL', () => {
    const r = classifyUrl('https://boards.greenhouse.io/williamblair')
    assert.equal(r.provider, 'greenhouse')
  })

  it('classifies Workday URL', () => {
    const r = classifyUrl('https://blackstone.wd1.myworkdayjobs.com')
    assert.equal(r.provider, 'workday')
  })

  it('classifies Oleeo URL', () => {
    const r = classifyUrl('https://evercore.tal.net/vex/portal')
    assert.equal(r.provider, 'oleeo_rss')
  })

  it('classifies SmartRecruiters URL', () => {
    const r = classifyUrl('https://jobs.smartrecruiters.com/goldmansachs')
    assert.equal(r.provider, 'smartrecruiters')
  })

  it('classifies Lever URL', () => {
    const r = classifyUrl('https://jobs.lever.co/company')
    assert.equal(r.provider, 'lever')
  })

  it('returns unknown for unrecognized URL', () => {
    const r = classifyUrl('https://example.com')
    assert.equal(r.provider, 'unknown')
  })
})
