import { create } from 'zustand'
import { DEFAULT_SAVED_VIEWS, DEFAULT_TAGS } from '@/constants'
import { getDb, nowIso, uid } from '@/lib/db'
import { emptyFilters, findDuplicate } from '@/lib/utils'
import {
  deleteWorkspaceRecord,
  fetchWorkspace,
  importWorkspace,
  putWorkspaceRecord,
} from '@/lib/workspaceApi'
import type {
  Application,
  ApplicationFilters,
  ApplicationStatus,
  Company,
  Contact,
  DocumentRecord,
  Requirement,
  RequirementStatus,
  SavedView,
  SortState,
  Tag,
  Task,
  Toast,
  ViewMode,
} from '@/types'
import { createDemoSeed } from '@/data/demo'

interface MeridianState {
  hydrated: boolean
  applications: Application[]
  companies: Company[]
  requirements: Requirement[]
  documents: DocumentRecord[]
  contacts: Contact[]
  tasks: Task[]
  tags: Tag[]
  savedViews: SavedView[]
  filters: ApplicationFilters
  sort: SortState
  viewMode: ViewMode
  selectedIds: string[]
  activeApplicationId: string | null
  addWizardOpen: boolean
  toasts: Toast[]
  hydrate: () => Promise<void>
  setFilters: (patch: Partial<ApplicationFilters>) => void
  resetFilters: () => void
  setSort: (sort: SortState) => void
  setViewMode: (mode: ViewMode) => void
  setSelectedIds: (ids: string[]) => void
  toggleSelected: (id: string) => void
  setActiveApplicationId: (id: string | null) => void
  setAddWizardOpen: (open: boolean) => void
  pushToast: (type: Toast['type'], message: string) => void
  dismissToast: (id: string) => void
  upsertCompany: (input: Omit<Company, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<Company>
  createApplication: (
    input: Omit<Application, 'id' | 'createdAt' | 'updatedAt' | 'archived' | 'tagIds'> & {
      tagIds?: string[]
      requirements?: Array<{ type: Requirement['type']; name: string; status: RequirementStatus }>
      force?: boolean
    },
  ) => Promise<{ app: Application; duplicate?: Application }>
  updateApplication: (id: string, patch: Partial<Application>) => Promise<void>
  deleteApplications: (ids: string[]) => Promise<void>
  archiveApplications: (ids: string[], archived?: boolean) => Promise<void>
  bulkUpdateStatus: (ids: string[], status: ApplicationStatus) => Promise<void>
  bulkPatch: (ids: string[], patch: Partial<Application>) => Promise<void>
  setRequirementStatus: (id: string, status: RequirementStatus) => Promise<void>
  upsertRequirement: (req: Omit<Requirement, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<void>
  deleteRequirement: (id: string) => Promise<void>
  upsertDocument: (doc: Omit<DocumentRecord, 'id' | 'dateCreated' | 'lastUpdated'> & { id?: string }) => Promise<void>
  deleteDocument: (id: string) => Promise<void>
  upsertContact: (contact: Omit<Contact, 'id'> & { id?: string }) => Promise<void>
  deleteContact: (id: string) => Promise<void>
  upsertTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<void>
  toggleTask: (id: string) => Promise<void>
  deleteTask: (id: string) => Promise<void>
  ensureTag: (name: string) => Promise<Tag>
  deleteTag: (id: string) => Promise<void>
  saveView: (name: string) => Promise<void>
  deleteSavedView: (id: string) => Promise<void>
  applySavedView: (id: string) => void
  loadDemoData: () => Promise<void>
  clearAllData: () => Promise<void>
  importApplications: (apps: Application[], requirements?: Requirement[]) => Promise<number>
}

/**
 * Run a cloud workspace write. Server first, local state only after
 * success — a failed server mutation must never fabricate local state.
 * Failures toast visibly and propagate with existing throw semantics.
 */
async function cloud<T>(
  get: () => MeridianState,
  action: string,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    get().pushToast(
      'error',
      err instanceof Error ? err.message : `${action} failed`,
    )
    throw err
  }
}

export const useMeridianStore = create<MeridianState>((set, get) => ({
  hydrated: false,
  applications: [],
  companies: [],
  requirements: [],
  documents: [],
  contacts: [],
  tasks: [],
  tags: [],
  savedViews: [],
  filters: emptyFilters(),
  sort: { field: 'deadline', direction: 'asc' },
  viewMode: 'table',
  selectedIds: [],
  activeApplicationId: null,
  addWizardOpen: false,
  toasts: [],

  hydrate: async () => {
    // Server-authoritative hydration. IndexedDB is no longer read for
    // workspace state, except for the frozen local fileData bytes merged
    // below (read-only — the rollback copy is never written).
    try {
      const remote = await cloud(get, 'Workspace load', () => fetchWorkspace())

      let tags = (remote.tags ?? []) as unknown as Tag[]
      const remoteApplications = (remote.applications ?? []) as unknown as Application[]
      let savedViews = (remote.savedViews ?? []) as unknown as SavedView[]

      if (remoteApplications.length === 0 && tags.length === 0) {
        // First launch for this account — seed default tags server-side.
        const fresh: Tag[] = DEFAULT_TAGS.map((name) => ({ id: uid('tag'), name }))
        await cloud(get, 'Workspace setup', () => importWorkspace({ tags: fresh }))
        tags = fresh
      }

      if (savedViews.length === 0) {
        // Seed the default quick views once. They are ordinary saved
        // views — same filter model, no special logic — and the user
        // can delete or extend them freely.
        const fresh: SavedView[] = DEFAULT_SAVED_VIEWS.map((view) => ({
          id: uid('view'),
          name: view.name,
          filters: { ...emptyFilters(), ...view.filters },
          createdAt: nowIso(),
        }))
        await cloud(get, 'Workspace setup', () => importWorkspace({ savedViews: fresh }))
        savedViews = fresh
      }

      set({
        applications: remoteApplications,
        companies: (remote.companies ?? []) as unknown as Company[],
        requirements: (remote.requirements ?? []) as unknown as Requirement[],
        documents: (remote.documents ?? []) as unknown as DocumentRecord[],
        contacts: (remote.contacts ?? []) as unknown as Contact[],
        tasks: (remote.tasks ?? []) as unknown as Task[],
        tags,
        savedViews,
        hydrated: true,
      })

      // Attach local file bytes (frozen rollback copy, read-only) so
      // previously uploaded documents keep rendering while their bytes
      // stay off the server by explicit decision.
      try {
        const localDocs = await getDb().documents.toArray()
        const bytes = new Map<string, DocumentRecord>()
        for (const doc of localDocs) {
          if (typeof doc.fileData === 'string' && doc.fileData.length > 0) {
            bytes.set(doc.id, doc)
          }
        }
        if (bytes.size > 0) {
          set({
            documents: get().documents.map((doc) => {
              const local = bytes.get(doc.id)
              return local
                ? {
                    ...doc,
                    fileData: local.fileData,
                    fileType: local.fileType ?? doc.fileType,
                    fileName: local.fileName ?? doc.fileName,
                  }
                : doc
            }),
          })
        }
      } catch {
        // Frozen copy unreadable — server metadata still stands.
      }
    } catch {
      // cloud() already toasted the failure; never hang the gate.
      set({ hydrated: true })
    }
  },

  setFilters: (patch) => set({ filters: { ...get().filters, ...patch } }),
  resetFilters: () => set({ filters: emptyFilters() }),
  setSort: (sort) => set({ sort }),
  setViewMode: (viewMode) => set({ viewMode }),
  setSelectedIds: (selectedIds) => set({ selectedIds }),
  toggleSelected: (id) => {
    const cur = get().selectedIds
    set({ selectedIds: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] })
  },
  setActiveApplicationId: (activeApplicationId) => set({ activeApplicationId }),
  setAddWizardOpen: (addWizardOpen) => set({ addWizardOpen }),

  pushToast: (type, message) => {
    const id = uid('toast')
    set({ toasts: [...get().toasts, { id, type, message }] })
    window.setTimeout(() => get().dismissToast(id), 3200)
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),

  upsertCompany: async (input) => {
    const ts = nowIso()
    const company: Company = {
      id: input.id ?? uid('co'),
      name: input.name,
      logo: input.logo,
      companyType: input.companyType,
      industry: input.industry,
      website: input.website,
      careersPage: input.careersPage,
      offices: input.offices ?? [],
      notes: input.notes,
      createdAt: input.id
        ? (get().companies.find((c) => c.id === input.id)?.createdAt ?? ts)
        : ts,
      updatedAt: ts,
    }
    await cloud(get, 'Save company', () =>
      putWorkspaceRecord('companies', company),
    )
    set({
      companies: [
        ...get().companies.filter((c) => c.id !== company.id),
        company,
      ].sort((a, b) => a.name.localeCompare(b.name)),
    })
    return company
  },

  createApplication: async (input) => {
    const duplicate = findDuplicate(get().applications, input)
    if (duplicate && !input.force) {
      return { app: duplicate, duplicate }
    }

    const ts = nowIso()
    const app: Application = {
      id: uid('app'),
      companyId: input.companyId,
      companyName: input.companyName.trim(),
      companyType: input.companyType,
      companyWebsite: input.companyWebsite,
      companyCareersPage: input.companyCareersPage,
      companyLogo: input.companyLogo,
      industry: input.industry,
      country: input.country,
      city: input.city,
      office: input.office,
      companyNotes: input.companyNotes,
      jobTitle: input.jobTitle.trim(),
      division: input.division,
      team: input.team,
      specialization: input.specialization,
      roleType: input.roleType,
      employmentType: input.employmentType,
      location: input.location,
      workArrangement: input.workArrangement,
      startDate: input.startDate,
      endDate: input.endDate,
      duration: input.duration,
      recruitmentCycle: input.recruitmentCycle,
      openingDate: input.openingDate,
      deadline: input.deadline,
      deadlineType: input.deadlineType,
      applicationDate: input.applicationDate,
      interviewDate: input.interviewDate,
      offerDeadline: input.offerDeadline,
      closingDate: input.closingDate,
      status: input.status,
      source: input.source,
      sourceUrl: input.sourceUrl,
      applicationUrl: input.applicationUrl,
      jobUrl: input.jobUrl,
      companyUrl: input.companyUrl,
      notes: input.notes,
      followUpDate: input.followUpDate,
      archived: false,
      isDemo: input.isDemo,
      tagIds: input.tagIds ?? [],
      createdAt: ts,
      updatedAt: ts,
    }

    const reqs: Requirement[] = (input.requirements ?? []).map((r) => ({
      id: uid('req'),
      applicationId: app.id,
      type: r.type,
      name: r.name,
      status: r.status,
      createdAt: ts,
      updatedAt: ts,
    }))

    await cloud(get, 'Create application', () =>
      importWorkspace({ applications: [app], requirements: reqs }),
    )

    set({
      applications: [...get().applications, app],
      requirements: [...get().requirements, ...reqs],
    })

    return { app }
  },

  updateApplication: async (id, patch) => {
    const existing = get().applications.find((a) => a.id === id)
    if (!existing) return

    const next: Application = {
      ...existing,
      ...patch,
      updatedAt: nowIso(),
    }

    // Smart defaults
    if (patch.status === 'applied' && !next.applicationDate) {
      next.applicationDate = nowIso().slice(0, 10)
    }

    await cloud(get, 'Update application', () =>
      putWorkspaceRecord('applications', next),
    )
    set({
      applications: get().applications.map((a) => (a.id === id ? next : a)),
    })
  },

  deleteApplications: async (ids) => {
    const idSet = new Set(ids)
    const state = get()
    const removals: Array<Promise<unknown>> = [
      ...ids.map((appId) => deleteWorkspaceRecord('applications', appId)),
      ...state.requirements
        .filter((r) => idSet.has(r.applicationId))
        .map((r) => deleteWorkspaceRecord('requirements', r.id)),
      ...state.contacts
        .filter((c) => c.applicationId && idSet.has(c.applicationId))
        .map((c) => deleteWorkspaceRecord('contacts', c.id)),
      ...state.tasks
        .filter((t) => t.applicationId && idSet.has(t.applicationId))
        .map((t) => deleteWorkspaceRecord('tasks', t.id)),
      ...state.documents
        .filter((d) => d.applicationId && idSet.has(d.applicationId))
        .map((d) => deleteWorkspaceRecord('documents', d.id)),
    ]
    await cloud(get, 'Delete applications', () => Promise.all(removals))
    set({
      applications: get().applications.filter((a) => !idSet.has(a.id)),
      requirements: get().requirements.filter((r) => !idSet.has(r.applicationId)),
      contacts: get().contacts.filter((c) => !c.applicationId || !idSet.has(c.applicationId)),
      tasks: get().tasks.filter((t) => !t.applicationId || !idSet.has(t.applicationId)),
      documents: get().documents.filter((d) => !d.applicationId || !idSet.has(d.applicationId)),
      selectedIds: get().selectedIds.filter((id) => !idSet.has(id)),
      activeApplicationId: idSet.has(get().activeApplicationId ?? '') ? null : get().activeApplicationId,
    })
    get().pushToast('success', ids.length === 1 ? 'Application deleted' : `${ids.length} applications deleted`)
  },

  archiveApplications: async (ids, archived = true) => {
    const ts = nowIso()
    await cloud(get, archived ? 'Archive' : 'Restore', () =>
      Promise.all(
        ids.map((id) => {
          const current = get().applications.find((a) => a.id === id)
          if (!current) return Promise.resolve()
          return putWorkspaceRecord('applications', { ...current, archived, updatedAt: ts })
        }),
      ),
    )
    set({
      applications: get().applications.map((a) =>
        ids.includes(a.id) ? { ...a, archived, updatedAt: ts } : a,
      ),
      selectedIds: [],
    })
    get().pushToast('success', archived ? 'Archived' : 'Restored')
  },

  bulkUpdateStatus: async (ids, status) => {
    await get().bulkPatch(ids, { status })
    get().pushToast('success', 'Status updated')
  },

  bulkPatch: async (ids, patch) => {
    const ts = nowIso()
    const applyPatch = (a: Application) => {
      if (!ids.includes(a.id)) return a
      const next = { ...a, ...patch, updatedAt: ts }
      if (patch.status === 'applied' && !next.applicationDate) {
        next.applicationDate = ts.slice(0, 10)
      }
      return next
    }
    await cloud(get, 'Bulk update', () =>
      Promise.all(
        ids.map((id) => {
          const current = get().applications.find((a) => a.id === id)
          if (!current) return Promise.resolve()
          return putWorkspaceRecord('applications', applyPatch(current))
        }),
      ),
    )
    set({
      applications: get().applications.map(applyPatch),
    })
  },

  setRequirementStatus: async (id, status) => {
    const existing = get().requirements.find((r) => r.id === id)
    if (!existing) return
    const next = { ...existing, status, updatedAt: nowIso() }
    await cloud(get, 'Update requirement', () =>
      putWorkspaceRecord('requirements', next),
    )
    set({ requirements: get().requirements.map((r) => (r.id === id ? next : r)) })
    if (status === 'completed' || status === 'submitted') {
      get().pushToast('success', `${existing.name} marked ${status}`)
    }
  },

  upsertRequirement: async (req) => {
    const ts = nowIso()
    const next: Requirement = {
      id: req.id ?? uid('req'),
      applicationId: req.applicationId,
      type: req.type,
      name: req.name,
      status: req.status,
      dueDate: req.dueDate,
      notes: req.notes,
      createdAt: req.id
        ? (get().requirements.find((r) => r.id === req.id)?.createdAt ?? ts)
        : ts,
      updatedAt: ts,
    }
    await cloud(get, 'Save requirement', () =>
      putWorkspaceRecord('requirements', next),
    )
    set({
      requirements: [...get().requirements.filter((r) => r.id !== next.id), next],
    })
  },

  deleteRequirement: async (id) => {
    await cloud(get, 'Delete requirement', () =>
      deleteWorkspaceRecord('requirements', id),
    )
    set({ requirements: get().requirements.filter((r) => r.id !== id) })
  },

  upsertDocument: async (doc) => {
    const ts = nowIso()
    const existing = doc.id ? get().documents.find((d) => d.id === doc.id) : undefined
    const next: DocumentRecord = {
      id: doc.id ?? uid('doc'),
      applicationId: doc.applicationId,
      companyId: doc.companyId,
      type: doc.type,
      name: doc.name,
      version: doc.version,
      fileUrl: doc.fileUrl,
      fileData: doc.fileData,
      fileType: doc.fileType,
      fileName: doc.fileName,
      notes: doc.notes,
      dateCreated: existing?.dateCreated ?? ts,
      lastUpdated: ts,
    }
    await cloud(get, 'Save document', () =>
      putWorkspaceRecord('documents', next),
    )
    set({ documents: [...get().documents.filter((d) => d.id !== next.id), next] })
  },

  deleteDocument: async (id) => {
    await cloud(get, 'Delete document', () =>
      deleteWorkspaceRecord('documents', id),
    )
    set({ documents: get().documents.filter((d) => d.id !== id) })
  },

  upsertContact: async (contact) => {
    const next: Contact = {
      id: contact.id ?? uid('ct'),
      applicationId: contact.applicationId,
      companyId: contact.companyId,
      name: contact.name,
      position: contact.position,
      company: contact.company,
      email: contact.email,
      linkedinUrl: contact.linkedinUrl,
      relationship: contact.relationship,
      dateContacted: contact.dateContacted,
      lastContact: contact.lastContact,
      notes: contact.notes,
    }
    await cloud(get, 'Save contact', () =>
      putWorkspaceRecord('contacts', next),
    )
    set({ contacts: [...get().contacts.filter((c) => c.id !== next.id), next] })
  },

  deleteContact: async (id) => {
    await cloud(get, 'Delete contact', () =>
      deleteWorkspaceRecord('contacts', id),
    )
    set({ contacts: get().contacts.filter((c) => c.id !== id) })
  },

  upsertTask: async (task) => {
    const ts = nowIso()
    const existing = task.id ? get().tasks.find((t) => t.id === task.id) : undefined
    const next: Task = {
      id: task.id ?? uid('task'),
      applicationId: task.applicationId,
      title: task.title,
      dueDate: task.dueDate,
      completed: task.completed,
      notes: task.notes,
      createdAt: existing?.createdAt ?? ts,
      updatedAt: ts,
    }
    await cloud(get, 'Save task', () =>
      putWorkspaceRecord('tasks', next),
    )
    set({ tasks: [...get().tasks.filter((t) => t.id !== next.id), next] })
  },

  toggleTask: async (id) => {
    const existing = get().tasks.find((t) => t.id === id)
    if (!existing) return
    const next = { ...existing, completed: !existing.completed, updatedAt: nowIso() }
    await cloud(get, 'Update task', () =>
      putWorkspaceRecord('tasks', next),
    )
    set({ tasks: get().tasks.map((t) => (t.id === id ? next : t)) })
  },

  deleteTask: async (id) => {
    await cloud(get, 'Delete task', () =>
      deleteWorkspaceRecord('tasks', id),
    )
    set({ tasks: get().tasks.filter((t) => t.id !== id) })
  },

  ensureTag: async (name) => {
    const trimmed = name.trim()
    const existing = get().tags.find((t) => t.name.toLowerCase() === trimmed.toLowerCase())
    if (existing) return existing
    const tag: Tag = { id: uid('tag'), name: trimmed }
    await cloud(get, 'Create tag', () =>
      putWorkspaceRecord('tags', tag),
    )
    set({ tags: [...get().tags, tag] })
    return tag
  },

  deleteTag: async (id) => {
    const ts = nowIso()
    // Remove tag from all applications that reference it
    const apps = get().applications.filter((a) => a.tagIds.includes(id))
    await cloud(get, 'Delete tag', async () => {
      await deleteWorkspaceRecord('tags', id)
      await Promise.all(
        apps.map((a) =>
          putWorkspaceRecord('applications', {
            ...a,
            tagIds: a.tagIds.filter((t) => t !== id),
            updatedAt: ts,
          }),
        ),
      )
    })
    set({ tags: get().tags.filter((t) => t.id !== id) })
    if (apps.length) {
      set({
        applications: get().applications.map((a) =>
          a.tagIds.includes(id) ? { ...a, tagIds: a.tagIds.filter((t) => t !== id), updatedAt: ts } : a,
        ),
      })
    }
  },

  saveView: async (name) => {
    const view: SavedView = {
      id: uid('view'),
      name,
      filters: { ...get().filters },
      createdAt: nowIso(),
    }
    await cloud(get, 'Save view', () =>
      putWorkspaceRecord('savedViews', view),
    )
    set({ savedViews: [...get().savedViews, view] })
    get().pushToast('success', `Saved view “${name}”`)
  },

  deleteSavedView: async (id) => {
    await cloud(get, 'Delete view', () =>
      deleteWorkspaceRecord('savedViews', id),
    )
    set({ savedViews: get().savedViews.filter((v) => v.id !== id) })
  },

  applySavedView: (id) => {
    const view = get().savedViews.find((v) => v.id === id)
    if (view) set({ filters: { ...view.filters } })
  },

  loadDemoData: async () => {
    const seed = createDemoSeed()
    await cloud(get, 'Load demo data', () =>
      importWorkspace({
        companies: seed.companies,
        applications: seed.applications,
        requirements: seed.requirements,
        tasks: seed.tasks,
        contacts: seed.contacts,
        documents: seed.documents,
        tags: seed.tags,
      }),
    )
    await get().hydrate()
    get().pushToast('info', 'Demo sample data loaded (clearly marked)')
  },

  clearAllData: async () => {
    const state = get()
    await cloud(get, 'Clear workspace', () =>
      Promise.all([
        ...state.applications.map((a) => deleteWorkspaceRecord('applications', a.id)),
        ...state.companies.map((c) => deleteWorkspaceRecord('companies', c.id)),
        ...state.requirements.map((r) => deleteWorkspaceRecord('requirements', r.id)),
        ...state.documents.map((d) => deleteWorkspaceRecord('documents', d.id)),
        ...state.contacts.map((c) => deleteWorkspaceRecord('contacts', c.id)),
        ...state.tasks.map((t) => deleteWorkspaceRecord('tasks', t.id)),
        ...state.savedViews.map((v) => deleteWorkspaceRecord('savedViews', v.id)),
      ]),
    )
    // Keep tags
    set({
      applications: [],
      companies: [],
      requirements: [],
      documents: [],
      contacts: [],
      tasks: [],
      savedViews: [],
    })
    get().pushToast('success', 'All applications cleared')
  },

  importApplications: async (apps, requirements = []) => {
    await cloud(get, 'Import applications', () =>
      importWorkspace({ applications: apps, requirements }),
    )
    await get().hydrate()
    get().pushToast('success', `Imported ${apps.length} applications`)
    return apps.length
  },
}))
