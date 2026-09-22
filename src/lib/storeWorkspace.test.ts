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
import { DEFAULT_SAVED_VIEWS, WORKSPACE_INIT_SENTINEL } from '../constants/index.ts'
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
    // Combined import: tags + sentinel + savedViews in one call
    const importPosts = calls.filter((c) => c.method === 'POST' && c.url.includes('/import'))
    assert.ok(importPosts.length >= 1, 'expected at least one import POST')
    const lastImport = importPosts[importPosts.length - 1]
    const records = (lastImport.body as { records: Record<string, unknown[]> }).records
    assert.ok(Array.isArray(records.tags), 'import includes tags')
    assert.ok(
      (records.tags as Array<{ name: string }>).some((t) => t.name === WORKSPACE_INIT_SENTINEL),
      'sentinel tag included in seed',
    )
    assert.ok(
      Array.isArray(records.savedViews) && records.savedViews.length === DEFAULT_SAVED_VIEWS.length,
      'default views included in seed',
    )
  })

  it('does not reseed defaults after the user deletes every view', async () => {
    remoteDump = {
      ...emptyDump(),
      // Sentinel present → init completed, no reseed even with views empty
      tags: [{ id: 'tag_1', name: 'core' }, { id: 'tag_sys', name: WORKSPACE_INIT_SENTINEL }],
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

describe('F3 — initialization atomicity / partial-failure recovery', () => {
  beforeEach(() => {
    calls.length = 0
    resetStore()
    installFetch()
  })

  it('seeds tags + sentinel + views in one combined import', async () => {
    remoteDump = emptyDump()
    await useMeridianStore.getState().hydrate()
    const importPosts = calls.filter((c) => c.method === 'POST' && c.url.includes('/import'))
    assert.equal(importPosts.length, 1, 'exactly one import call for fresh workspace')
    const records = (importPosts[0].body as { records: Record<string, unknown[]> }).records
    // Tags include sentinel
    const tagNames = (records.tags as Array<{ name: string }>).map((t) => t.name)
    assert.ok(tagNames.includes(WORKSPACE_INIT_SENTINEL), 'sentinel tag present')
    assert.ok(tagNames.length > DEFAULT_SAVED_VIEWS.length, 'user tags + sentinel')
    // Views included
    assert.equal((records.savedViews as unknown[]).length, DEFAULT_SAVED_VIEWS.length)
  })

  it('retries views after partial failure (tags exist but no sentinel, no views)', async () => {
    // Simulate: tags were committed by a previous partial import, but
    // sentinel and views were not (server crash mid-loop).
    remoteDump = {
      ...emptyDump(),
      tags: [{ id: 'tag_existing', name: 'Priority' }],
      savedViews: [],
    }
    await useMeridianStore.getState().hydrate()
    // Should seed views + sentinel (not duplicate tags)
    const savedViews = useMeridianStore.getState().savedViews
    assert.equal(savedViews.length, DEFAULT_SAVED_VIEWS.length, 'views seeded on retry')
    const importPosts = calls.filter((c) => c.method === 'POST' && c.url.includes('/import'))
    assert.ok(importPosts.length >= 1, 'import POST fired')
    const lastImport = importPosts[importPosts.length - 1]
    const records = (lastImport.body as { records: Record<string, unknown[]> }).records
    assert.ok(
      Array.isArray(records.savedViews) && records.savedViews.length > 0,
      'retry includes views',
    )
    assert.ok(
      (records.tags as Array<{ name: string }>).some((t) => t.name === WORKSPACE_INIT_SENTINEL),
      'retry includes sentinel',
    )
  })

  it('does not reseed when sentinel is present even if views are empty', async () => {
    remoteDump = {
      ...emptyDump(),
      tags: [{ id: 'tag_sys', name: WORKSPACE_INIT_SENTINEL }],
      savedViews: [],
    }
    await useMeridianStore.getState().hydrate()
    assert.deepEqual(useMeridianStore.getState().savedViews, [])
    const importPosts = calls.filter((c) => c.method === 'POST' && c.url.includes('/import'))
    assert.equal(importPosts.length, 0, 'no import when sentinel exists')
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
