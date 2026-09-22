/**
 * CSV compatibility tests (node:test, papaparse only).
 *
 * Old 21-column exports must import unchanged; new columns are
 * additive; export→import round-trips preserve every structured
 * field. Run with:
 * `node --test --import ./src/test/register-alias.ts src/lib/csv.test.ts`
 */
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import Papa from 'papaparse'
import {
  exportApplicationsCsv,
  parseApplicationsCsv,
  parseLanguageCell,
  serializeLanguageCell,
} from './csv.ts'
import type { Application } from '../types/index.ts'

const OLD_HEADER =
  'Company,Job Title,Status,Role Type,Division,Specialization,Location,City,Country,Opening Date,Deadline,Deadline Type,Application Date,Start Date,End Date,Source,Application Link,Job URL,Company URL,Notes,Cycle'

function fullApp(): Application {
  return {
    id: 'app_roundtrip',
    companyName: 'Morgan Stanley',
    jobTitle: 'Spring Insight Programme',
    companyType: 'bulge_bracket',
    country: 'UK',
    city: 'London',
    location: 'London, UK',
    division: 'Investment Banking',
    divisions: ['investment_banking', 'capital_markets'],
    team: 'FIG',
    specificTeam: 'FIG — Banks',
    specialization: 'manda',
    specializations: ['manda', 'financial_institutions'],
    languageRequirements: [
      { language: 'German', requirement: 'required', proficiency: 'fluent' },
      { language: 'French', requirement: 'preferred' },
    ],
    targetGraduationYears: [2027, 2028],
    eligibleUniversityYears: ['first_year', 'second_year'],
    eligibilityRequirements: 'On track for a 2:1; first-year only.',
    workAuthorization: 'existing_authorization_required',
    visaNotes: 'Must hold UK right to work.',
    roleType: 'spring_insight',
    workArrangement: 'onsite',
    openingDate: '2026-09-01',
    deadline: '2026-10-31',
    deadlineType: 'specific',
    timingNotes: 'Opens early September.',
    applicationDate: '2026-09-10',
    startDate: '2027-04-06',
    endDate: '2027-04-10',
    duration: '1 week',
    status: 'applied',
    priority: 'high',
    recommendedTiming: 'within_1_week',
    nextAction: 'Prepare HireVue',
    nextActionDate: '2026-09-20',
    lastChecked: '2026-09-15T10:00:00.000Z',
    dateInformationVerified: '2026-09-15T10:00:00.000Z',
    cvRequired: 'yes',
    coverLetterRequired: 'no',
    transcriptRequired: 'optional',
    referencesRequired: 'unknown',
    applicationQuestions: 'yes',
    requirementsNotes: 'Two motivational questions.',
    assessments: ['numerical_reasoning', 'situational_judgement', 'hirevue'],
    assessmentNotes: 'Amalfi-style SJT.',
    applicationProcess: 'Application → Numerical Test → HireVue → AC → Offer',
    interviewProcess: 'Two HireVue questions, strengths-based.',
    expectedInterviewTimeline: 'HireVue invite within 2 weeks.',
    source: 'bright_network',
    sourceUrl: 'https://brightnetwork.example/offer',
    applicationUrl: 'https://apply.example/ms',
    jobUrl: 'https://jobs.example/ms',
    companyUrl: 'https://morganstanley.example',
    notes: 'Line one, with comma.\n"Quoted" line with | pipe.',
    recruitmentCycle: 'Spring 2027',
    archived: false,
    tagIds: [],
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  }
}

describe('old CSV import', () => {
  it('imports the legacy 21-column format unchanged', () => {
    const csv =
      `${OLD_HEADER}\n` +
      `"Goldman Sachs","Spring Week",To Apply,Spring Week,Investment Banking,,London,London,UK,,2026-11-30,Rolling,,2027-04-01,,LinkedIn,,,,"Researching FIG",Spring 2027`
    const { apps, errors } = parseApplicationsCsv(csv)
    assert.equal(errors.length, 0)
    assert.equal(apps.length, 1)
    const [a] = apps
    assert.equal(a.companyName, 'Goldman Sachs')
    assert.equal(a.roleType, 'spring_week')
    assert.equal(a.status, 'to_apply')
    assert.equal(a.deadlineType, 'rolling')
    assert.equal(a.source, 'linkedin')
    assert.equal(a.recruitmentCycle, 'Spring 2027')
    // Legacy division preserved verbatim AND normalized for filtering.
    assert.equal(a.division, 'Investment Banking')
    assert.deepEqual(a.divisions, ['investment_banking'])
  })
})

describe('new CSV import', () => {
  it('parses additive structured columns', () => {
    const { apps } = parseApplicationsCsv(
      'Company,Job Title,Divisions,Assessments,Graduation Years,Eligible Years,Languages,CV Required,Cover Letter Required,Work Authorization,Priority\n' +
        'Barclays,Spring Insight,investment_banking|capital_markets,numerical_reasoning|hirevue,2027|2028,first_year,German:required:fluent|French:preferred,yes,no,existing_authorization_required,high',
    )
    assert.equal(apps.length, 1)
    const [a] = apps
    assert.deepEqual(a.divisions, ['investment_banking', 'capital_markets'])
    assert.deepEqual(a.assessments, ['numerical_reasoning', 'hirevue'])
    assert.deepEqual(a.targetGraduationYears, [2027, 2028])
    assert.deepEqual(a.eligibleUniversityYears, ['first_year'])
    assert.deepEqual(a.languageRequirements, [
      { language: 'German', requirement: 'required', proficiency: 'fluent' },
      { language: 'French', requirement: 'preferred' },
    ])
    assert.equal(a.cvRequired, 'yes')
    assert.equal(a.coverLetterRequired, 'no')
    assert.equal(a.workAuthorization, 'existing_authorization_required')
    assert.equal(a.priority, 'high')
  })

  it('reads unknown document cells as undefined, never no', () => {
    const { apps } = parseApplicationsCsv(
      'Company,Job Title,CV Required,Cover Letter Required\nAcme,Analyst,unknown,',
    )
    assert.equal(apps[0]?.cvRequired, undefined)
    assert.equal(apps[0]?.coverLetterRequired, undefined)
  })
})

describe('language cell format', () => {
  it('round-trips proficiency containing a colon', () => {
    const parsed = parseLanguageCell('German:required:fluent:C1 level|French:preferred')
    assert.deepEqual(parsed, [
      { language: 'German', requirement: 'required', proficiency: 'fluent:C1 level' },
      { language: 'French', requirement: 'preferred' },
    ])
    assert.equal(serializeLanguageCell(parsed), 'German:required:fluent:C1 level|French:preferred')
  })
})

describe('export/import round trip', () => {
  it('preserves every structured field', () => {
    const original = fullApp()
    const csv = exportApplicationsCsv([original])
    const { apps, errors } = parseApplicationsCsv(csv)
    assert.equal(errors.length, 0)
    assert.equal(apps.length, 1)
    const [back] = apps
    for (const key of [
      'companyName',
      'jobTitle',
      'companyType',
      'country',
      'city',
      'location',
      'division',
      'divisions',
      'team',
      'team',
      'specificTeam',
      'specializations',
      'languageRequirements',
      'targetGraduationYears',
      'eligibleUniversityYears',
      'eligibilityRequirements',
      'workAuthorization',
      'visaNotes',
      'roleType',
      'workArrangement',
      'openingDate',
      'deadline',
      'deadlineType',
      'timingNotes',
      'applicationDate',
      'startDate',
      'endDate',
      'duration',
      'status',
      'priority',
      'recommendedTiming',
      'nextAction',
      'nextActionDate',
      'lastChecked',
      'dateInformationVerified',
      'specialization',
      'duration',
      'cvRequired',
      'coverLetterRequired',
      'transcriptRequired',
      'applicationQuestions',
      'requirementsNotes',
      'assessments',
      'assessmentNotes',
      'applicationProcess',
      'interviewProcess',
      'expectedInterviewTimeline',
      'source',
      'sourceUrl',
      'applicationUrl',
      'jobUrl',
      'companyUrl',
      'notes',
      'recruitmentCycle',
    ] as const) {
      assert.deepEqual(back[key], original[key], `round trip: ${key}`)
    }
    // referencesRequired 'unknown' exports as empty and re-imports as
    // undefined — both read as unknown, never no.
    assert.equal(back.referencesRequired, undefined)
  })

  it('survives commas, quotes, pipes and multiline notes', () => {
    const { apps } = parseApplicationsCsv(exportApplicationsCsv([fullApp()]))
    assert.equal(apps[0]?.notes, 'Line one, with comma.\n"Quoted" line with | pipe.')
  })

  it('round-trips a pipe inside a free-text field exactly (pre-registered edge)', () => {
    // Pipe is the multi-value separator, but legacy text fields are never
    // pipe-split: PapaParse quoting must carry the literal through.
    const app = { ...fullApp(), companyName: 'A | B', notes: 'x|y|z' }
    const { apps } = parseApplicationsCsv(exportApplicationsCsv([app]))
    assert.equal(apps[0]?.companyName, 'A | B')
    assert.equal(apps[0]?.notes, 'x|y|z')
  })
})

describe('canonical identifier round trip (PR #1 T2/T3/T4)', () => {
  it('preserves canonical statuses instead of resetting to interested', () => {
    const first = { ...fullApp(), status: 'first_round' as const }
    const missed = { ...fullApp(), status: 'missed_deadline' as const }
    const { apps } = parseApplicationsCsv(exportApplicationsCsv([first, missed]))
    assert.equal(apps[0]?.status, 'first_round')
    assert.equal(apps[1]?.status, 'missed_deadline')
  })

  it('round-trips deadlineType unknown even with a deadline present', () => {
    const app = { ...fullApp(), deadlineType: 'unknown' as const }
    const { apps } = parseApplicationsCsv(exportApplicationsCsv([app]))
    assert.equal(apps[0]?.deadlineType, 'unknown')
  })

  it('imports Spring Insight as spring_insight, not spring_week', () => {
    const { apps } = parseApplicationsCsv('Company,Job Title,Role Type\nAcme,Analyst,Spring Insight')
    assert.equal(apps[0]?.roleType, 'spring_insight')
  })

  it('prefers the longest alias so generic spring never wins', () => {
    // "Spring Insight Programme" contains both `spring insight` (14) and
    // `insight programme` (17): longest-first deterministically resolves it
    // without ever falling through to generic `spring`.
    const { apps } = parseApplicationsCsv('Company,Job Title,Role Type\nAcme,Analyst,Spring Insight Programme')
    assert.equal(apps[0]?.roleType, 'insight_programme')
  })

  it('preserves the legacy specialization scalar canonically', () => {
    const { apps } = parseApplicationsCsv('Company,Job Title,Specialization\nAcme,Analyst,M&A')
    assert.equal(apps[0]?.specialization, 'manda')
    assert.deepEqual(apps[0]?.specializations, ['manda'])
  })
})

describe('legacy column contract (PR #1 U1)', () => {
  it('keeps the original 21 columns first, V2 columns appended', () => {
    const parsed = Papa.parse<string[]>(exportApplicationsCsv([fullApp()]))
    const header = parsed.data[0] ?? []
    assert.deepEqual(header.slice(0, 21), OLD_HEADER.split(','))
    const cycleIdx = header.indexOf('Cycle')
    for (const key of ['Divisions', 'Specializations', 'Last Checked', 'Date Verified']) {
      assert.ok(header.indexOf(key) > cycleIdx, `${key} must follow Cycle`)
    }
  })
})
