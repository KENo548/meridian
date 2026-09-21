/**
 * V2 recruiting-database logic tests (node:test, no external deps).
 *
 * Covers normalization (legacy → canonical, never mutating), compound
 * filtering (AND across categories, OR/intersection within), unknown
 * vs no semantics, and derived availability. Run with:
 * `node --test --import ./src/test/register-alias.ts src/lib/recruitingDb.test.ts`
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  emptyFilters,
  filterApplications,
  getAvailability,
  getDivisions,
  getLanguages,
  getSpecializations,
  normalizeDivision,
  normalizeSpecialization,
  resolveDocRequirement,
} from './utils.ts'
import type { Application, ApplicationFilters, Specialization } from '../types/index.ts'

function app(overrides: Partial<Application> = {}): Application {
  return {
    id: 'app_test',
    companyName: 'Goldman Sachs',
    jobTitle: 'Spring Week',
    roleType: 'spring_week',
    deadlineType: 'rolling',
    status: 'to_apply',
    archived: false,
    tagIds: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function filters(overrides: Partial<ApplicationFilters> = {}): ApplicationFilters {
  return { ...emptyFilters(), ...overrides }
}

function isoInDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

describe('division normalization', () => {
  it('maps legacy display names and aliases to canonical values', () => {
    assert.equal(normalizeDivision('Investment Banking'), 'investment_banking')
    assert.equal(normalizeDivision('investment_banking'), 'investment_banking')
    assert.equal(normalizeDivision('IB'), 'investment_banking')
    assert.equal(normalizeDivision('S&T'), 'sales_and_trading')
    assert.equal(normalizeDivision(undefined), undefined)
    assert.equal(normalizeDivision(''), undefined)
    assert.equal(normalizeDivision('Not A Division'), undefined)
  })

  it('prefers canonical divisions, falls back to legacy, else empty', () => {
    assert.deepEqual(
      getDivisions(app({ divisions: ['markets'], division: 'Investment Banking' })),
      ['markets'],
    )
    assert.deepEqual(getDivisions(app({ division: 'Investment Banking' })), ['investment_banking'])
    assert.deepEqual(getDivisions(app({})), [])
  })

  it('maps legacy specialization labels including M&A', () => {
    assert.equal(normalizeSpecialization('M&A'), 'manda')
    assert.equal(normalizeSpecialization('Leveraged Finance'), 'leveraged_finance')
    assert.deepEqual(getSpecializations(app({ specialization: 'dcm' })), ['dcm'])
    assert.deepEqual(
      getSpecializations(app({ specializations: ['ecm'], specialization: 'dcm' })),
      ['ecm'],
    )
  })
})

describe('language normalization', () => {
  it('passes structured requirements through and maps legacy strings to unknown', () => {
    assert.deepEqual(getLanguages(app({})), [])
    assert.deepEqual(getLanguages(app({ languages: ['German'] })), [
      { language: 'German', requirement: 'unknown' },
    ])
    assert.deepEqual(
      getLanguages(
        app({ languageRequirements: [{ language: 'German', requirement: 'required', proficiency: 'fluent' }] }),
      ),
      [{ language: 'German', requirement: 'required', proficiency: 'fluent' }],
    )
  })
})

describe('unknown vs no', () => {
  it('missing metadata resolves to unknown, never no', () => {
    assert.equal(resolveDocRequirement(undefined), 'unknown')
    assert.equal(resolveDocRequirement('yes'), 'yes')
    assert.equal(resolveDocRequirement('no'), 'no')
    assert.equal(resolveDocRequirement('optional'), 'optional')
  })

  it('a "No" cover-letter filter matches explicit no and excludes unknown', () => {
    const explicit = app({ id: 'a', coverLetterRequired: 'no' })
    const missing = app({ id: 'b' })
    const yes = app({ id: 'c', coverLetterRequired: 'yes' })
    const matched = filterApplications([explicit, missing, yes], filters({ coverLetterRequired: ['no'] }))
    assert.deepEqual(matched.map((a) => a.id), ['a'])
  })

  it('an "Unknown" filter surfaces records missing the field', () => {
    const missing = app({ id: 'b' })
    const explicit = app({ id: 'a', coverLetterRequired: 'no' })
    const matched = filterApplications([missing, explicit], filters({ coverLetterRequired: ['unknown'] }))
    assert.deepEqual(matched.map((a) => a.id), ['b'])
  })
})

describe('compound filtering', () => {
  const springLondonIB = app({
    id: 'match',
    roleType: 'spring_week',
    city: 'London',
    divisions: ['investment_banking'],
    coverLetterRequired: 'no',
    assessments: ['numerical_reasoning', 'situational_judgement', 'hirevue'],
  })
  const frankfurtIB = app({
    id: 'frankfurt',
    roleType: 'spring_week',
    city: 'Frankfurt',
    divisions: ['investment_banking'],
  })
  const summerLondon = app({ id: 'summer', roleType: 'summer_internship', city: 'London' })

  it('ANDs across categories', () => {
    const matched = filterApplications(
      [springLondonIB, frankfurtIB, summerLondon],
      filters({ roleTypes: ['spring_week'], cities: ['London'], divisions: ['investment_banking'] }),
    )
    assert.deepEqual(matched.map((a) => a.id), ['match'])
  })

  it('ORs within a category', () => {
    const matched = filterApplications(
      [springLondonIB, frankfurtIB, summerLondon],
      filters({ roleTypes: ['spring_week'], cities: ['London', 'Frankfurt'] }),
    )
    assert.deepEqual(matched.map((a) => a.id).sort(), ['frankfurt', 'match'])
  })

  it('matches assessments on intersection, not equality', () => {
    const all = [springLondonIB, summerLondon]
    assert.deepEqual(
      filterApplications(all, filters({ assessments: ['numerical_reasoning'] })).map((a) => a.id),
      ['match'],
    )
    assert.deepEqual(
      filterApplications(all, filters({ assessments: ['numerical_reasoning', 'coding'] })).map(
        (a) => a.id,
      ),
      ['match'],
    )
    assert.deepEqual(filterApplications(all, filters({ assessments: ['coding'] })), [])
  })

  it('filters eligibility without exact-array matching', () => {
    const firstYear = app({ id: 'fy', eligibleUniversityYears: ['first_year', 'second_year'] })
    const penultimate = app({ id: 'pen', eligibleUniversityYears: ['penultimate_year'] })
    const unknown = app({ id: 'unk' })
    const matched = filterApplications(
      [firstYear, penultimate, unknown],
      filters({ eligibleUniversityYears: ['first_year'] }),
    )
    assert.deepEqual(matched.map((a) => a.id), ['fy'])
  })

  it('combines search text with filters', () => {
    const matched = filterApplications(
      [springLondonIB, frankfurtIB],
      filters({ search: 'goldman', cities: ['Frankfurt'] }),
    )
    assert.deepEqual(matched.map((a) => a.id), ['frankfurt'])
  })

  it('matches graduation years on intersection', () => {
    const a = app({ id: 'a', targetGraduationYears: [2027, 2028] })
    const b = app({ id: 'b', targetGraduationYears: [2029] })
    const matched = filterApplications([a, b], filters({ targetGraduationYears: [2028] }))
    assert.deepEqual(matched.map((a) => a.id), ['a'])
  })
})

describe('deadline filtering and availability', () => {
  it('deadlineWithinDays matches upcoming, excludes past and rolling', () => {
    const soon = app({ id: 'soon', deadlineType: 'specific', deadline: isoInDays(3) })
    const later = app({ id: 'later', deadlineType: 'specific', deadline: isoInDays(30) })
    const past = app({ id: 'past', deadlineType: 'specific', deadline: isoInDays(-2) })
    const rolling = app({ id: 'rolling', deadlineType: 'rolling' })
    const matched = filterApplications([soon, later, past, rolling], filters({ deadlineWithinDays: 7 }))
    assert.deepEqual(matched.map((a) => a.id), ['soon'])
  })

  it('derives availability from opening, deadline, type and status together', () => {
    assert.equal(
      getAvailability(app({ openingDate: isoInDays(5), deadlineType: 'specific', deadline: isoInDays(30) })),
      'not_yet_open',
    )
    assert.equal(
      getAvailability(app({ deadlineType: 'specific', deadline: isoInDays(30) })),
      'open',
    )
    assert.equal(
      getAvailability(app({ deadlineType: 'specific', deadline: isoInDays(3) })),
      'closing_soon',
    )
    assert.equal(getAvailability(app({ deadlineType: 'rolling' })), 'rolling')
    assert.equal(
      getAvailability(app({ deadlineType: 'specific', deadline: isoInDays(-2) })),
      'closed',
    )
    assert.equal(getAvailability(app({ status: 'rejected' })), 'closed')
    assert.equal(getAvailability(app({ deadlineType: 'unknown' })), 'unknown')
  })
})

describe('legacy compatibility', () => {
  it('normalizes legacy records without mutating them', () => {
    // 'M&A' is a display alias, not canonical — legacy stored rows can
    // contain it, so model the runtime shape with a targeted cast.
    const legacy = app({ division: 'Sales & Trading', specialization: 'M&A' as Specialization, languages: ['English'] })
    const frozen = structuredClone(legacy)
    assert.deepEqual(getDivisions(legacy), ['sales_and_trading'])
    assert.deepEqual(getSpecializations(legacy), ['manda'])
    assert.deepEqual(getLanguages(legacy), [{ language: 'English', requirement: 'unknown' }])
    assert.deepEqual(legacy, frozen)
  })
})
