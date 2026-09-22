/**
 * Store persistence + saved-view compatibility tests (PR #1 T1/T5/U4).
 *
 * fetch is stubbed: no network, no IndexedDB assertions (the fileData
 * merge failure is swallowed by hydrate itself). Run with:
 * `node --test --import ./src/test/register-alias.ts src/lib/storeWorkspace.test.ts`
 */
import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { useMeridianStore } from './store.ts'
import { setWorkspaceApiBase } from './workspaceApi.ts'
import { DEFAULT_SAVED_VIEWS } from '../constants/index.ts'
import type { Application } from '../types/index.ts'

interface CapturedCall {
  url: string
  method: string
  body: unknown
}

let remoteDump: Record<string, unknown[]>
const calls: CapturedCall[] = []

function emptyDump(): Record<string, unknown[]> {
  return {
    applications: [],
    companies: [],
    requirements: [],
    documents: [],
    contacts: [],
    tasks: [],
    tags: [],
    savedViews: [],
  }
}

function installFetch(): void {
  setWorkspaceApiBase('http://test.invalid')
  globalThis.fetch = (async (url: URL | RequestInfo, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const body = init?.body ? (JSON.parse(String(init.body)) as unknown) : undefined
    const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url
    calls.push({ url: urlStr, method, body })
    if (method === 'GET') {
      return { ok: true, status: 200, redirected: false, statusText: 'OK', type: 'basic' as ResponseType, url: urlStr, headers: new Headers(), json: async () => remoteDump, text: async () => '', arrayBuffer: async () => new ArrayBuffer(0), blob: async () => new Blob(), clone: () => new Response(), body: null, bodyUsed: false, formData: async () => new FormData() } as unknown as Response
    }
    if (urlStr.includes('/import')) {
      return { ok: true, status: 200, redirected: false, statusText: 'OK', type: 'basic' as ResponseType, url: urlStr, headers: new Headers(), json: async () => ({ counts: {} as Record<string, number> }), text: async () => '', arrayBuffer: async () => new ArrayBuffer(0), blob: async () => new Blob(), clone: () => new Response(), body: null, bodyUsed: false, formData: async () => new FormData() } as unknown as Response
    }
    return { ok: true, status: 200, redirected: false, statusText: 'OK', type: 'basic' as ResponseType, url: urlStr, headers: new Headers(), json: async () => ({ deleted: true, record: body }), text: async () => '', arrayBuffer: async () => new ArrayBuffer(0), blob: async () => new Blob(), clone: () => new Response(), body: null, bodyUsed: false, formData: async () => new FormData() } as unknown as Response
  }) as typeof fetch
}

function resetStore(): void {
  useMeridianStore.setState({
    hydrated: false,
    applications: [],
    companies: [],
    requirements: [],
    documents: [],
    contacts: [],
    tasks: [],
    tags: [],
    savedViews: [],
    selectedIds: [],
    toasts: [],
  })
}

function fullV2Input(): Parameters<ReturnType<typeof useMeridianStore.getState>['createApplication']>[0] {
  return {
    companyName: 'Blackstone',
    jobTitle: 'Summer Analyst',
    roleType: 'summer_internship',
    status: 'interested',
    deadlineType: 'specific',
    divisions: ['investment_banking'],
    specializations: ['manda'],
    specificTeam: 'FIG — Banks',
    languageRequirements: [{ language: 'German', requirement: 'required' }],
    targetGraduationYears: [2027],
    eligibleUniversityYears: ['first_year'],
    eligibilityRequirements: 'On track.',
    workAuthorization: 'existing_authorization_required',
    visaNotes: 'UK right to work.',
    timingNotes: 'Opens soon.',
    priority: 'high',
    recommendedTiming: 'within_1_week',
    nextAction: 'Draft cover letter',
    nextActionDate: '2026-09-20',
    dateInformationVerified: '2026-09-15T10:00:00.000Z',
    cvRequired: 'yes',
    coverLetterRequired: 'no',
    transcriptRequired: 'optional',
    referencesRequired: 'yes',
    applicationQuestions: 'no',
    requirementsNotes: 'None.',
    assessments: ['hirevue'],
    assessmentNotes: 'Strengths-based.',
    applicationProcess: 'Apply → HireVue',
    interviewProcess: 'One round.',
    expectedInterviewTimeline: 'Two weeks.',
    force: true,
  }
}

const V2_KEYS = [
  'divisions',
  'specializations',
  'specificTeam',
  'languageRequirements',
  'targetGraduationYears',
  'eligibleUniversityYears',
  'eligibilityRequirements',
  'workAuthorization',
  'visaNotes',
  'timingNotes',
  'priority',
  'recommendedTiming',
  'nextAction',
  'nextActionDate',
  'dateInformationVerified',
  'cvRequired',
  'coverLetterRequired',
  'transcriptRequired',
  'referencesRequired',
  'applicationQuestions',
  'requirementsNotes',
  'assessments',
  'assessmentNotes',
  'applicationProcess',
  'interviewProcess',
  'expectedInterviewTimeline',
] as const

describe('V2 application persistence (PR #1 T1)', () => {
  beforeEach(() => {
    calls.length = 0
    remoteDump = emptyDump()
    resetStore()
    installFetch()
  })

  it('persists every wizard-supplied V2 field to the server-bound record', async () => {
    const input = fullV2Input()
    const { app } = await useMeridianStore.getState().createApplication(input)
    for (const key of V2_KEYS) {
      assert.deepEqual(
        app[key as keyof Application],
        input[key as keyof typeof input],
        `persisted app retains ${key}`,
      )
    }
    const post = calls.find((c) => c.method === 'POST' && c.url.includes('/import'))
    assert.ok(post, 'expected an import POST')
    const sent = (post!.body as { records: { applications: Application[] } }).records.applications[0]
    for (const key of V2_KEYS) {
      assert.deepEqual(
        sent[key as keyof Application],
        input[key as keyof typeof input],
        `server-bound record retains ${key}`,
      )
    }
  })
})

describe('saved-view compatibility (PR #1 T5/U4)', () => {
  beforeEach(() => {
    calls.length = 0
    resetStore()
    installFetch()
  })

  it('hydrates a pre-V2 partial view without crashing V2 readers', async () => {
    remoteDump = {
      ...emptyDump(),
      tags: [{ id: 'tag_1', name: 'core' }],
      savedViews: [{ id: 'view_old', name: 'Old', filters: { search: 'bank' }, createdAt: 'x' }],
    }
    await useMeridianStore.getState().hydrate()
    assert.doesNotThrow(() => useMeridianStore.getState().applySavedView('view_old'))
    const filters = useMeridianStore.getState().filters
    assert.deepEqual(filters.assessments, [])
    assert.deepEqual(filters.divisions, [])
    assert.equal(filters.search, 'bank')
  })

  it('seeds defaults once for a genuinely new workspace', async () => {
    remoteDump = emptyDump()
    await useMeridianStore.getState().hydrate()
    const seeded = useMeridianStore.getState().savedViews
    assert.equal(seeded.length, DEFAULT_SAVED_VIEWS.length)
    const importPosts = calls.filter((c) => c.method === 'POST' && c.url.includes('/import'))
    assert.ok(importPosts.some((c) => (c.body as { records: Record<string, unknown[]> }).records.savedViews?.length === DEFAULT_SAVED_VIEWS.length))
  })

  it('does not reseed defaults after the user deletes every view', async () => {
    remoteDump = {
      ...emptyDump(),
      tags: [{ id: 'tag_1', name: 'core' }],
      savedViews: [],
    }
    await useMeridianStore.getState().hydrate()
    assert.deepEqual(useMeridianStore.getState().savedViews, [])
    const viewImports = calls.filter(
      (c) =>
        c.method === 'POST' &&
        c.url.includes('/import') &&
        (c.body as { records: Record<string, unknown[]> }).records.savedViews !== undefined,
    )
    assert.equal(viewImports.length, 0)
  })
})

describe('legacy scalar clearing (PR #1 T6)', () => {
  beforeEach(() => {
    calls.length = 0
    remoteDump = emptyDump()
    resetStore()
    installFetch()
  })

  it('clears legacy division scalar when divisions array is toggled', async () => {
    // Pre-seed with legacy scalar + canonical array (migration result)
    remoteDump = {
      ...emptyDump(),
      applications: [
        {
          id: 'app_g4',
          companyName: 'GS',
          jobTitle: 'Analyst',
          roleType: 'summer_internship',
          deadlineType: 'rolling',
          status: 'to_apply',
          archived: false,
          tagIds: [],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          division: 'Investment Banking',
          divisions: ['investment_banking'],
          specialization: 'M&A',
          specializations: ['manda'],
        },
      ],
    }
    await useMeridianStore.getState().hydrate()
    const { updateApplication } = useMeridianStore.getState()
    // Simulate toggleList clearing legacy scalar when removing last canonical value
    await updateApplication('app_g4', {
      divisions: [],
      division: undefined,
    })
    const updated = useMeridianStore.getState().applications.find((a) => a.id === 'app_g4')
    assert.ok(updated, 'app exists')
    // Server-bound PUT must omit legacy scalar
    const put = calls.find(
      (c) => c.method === 'PUT' && c.url.includes('/api/workspace/applications/'),
    )
    assert.ok(put, 'expected a PUT')
    const sent = put?.body as Application
    // undefined fields are stripped by JSON.stringify
    const divisionKey = Object.keys(sent).find((k) => k === 'division')
    assert.ok(!divisionKey, 'PUT record omits legacy division field')
  })
})
