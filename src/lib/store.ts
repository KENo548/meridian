import { create } from 'zustand'
import { DEFAULT_TAGS } from '@/constants'
import { getDb, nowIso, uid } from '@/lib/db'
import { emptyFilters, findDuplicate } from '@/lib/utils'
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

async function refreshCollections(set: (partial: Partial<MeridianState>) => void) {
  const d = getDb()
  const [applications, companies, requirements, documents, contacts, tasks, tags, savedViews] =
    await Promise.all([
      d.applications.toArray(),
      d.companies.toArray(),
      d.requirements.toArray(),
      d.documents.toArray(),
      d.contacts.toArray(),
      d.tasks.toArray(),
      d.tags.toArray(),
      d.savedViews.toArray(),
    ])
  set({ applications, companies, requirements, documents, contacts, tasks, tags, savedViews })
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
    await refreshCollections(set)
    const d = getDb()
    const meta = await d.meta.get('seeded')
    if (!meta && get().applications.length === 0) {
      // First launch — seed tags only; demo data is opt-in
      const tags = DEFAULT_TAGS.map((name) => ({ id: uid('tag'), name }))
      await d.tags.bulkPut(tags)
      await d.meta.put({ key: 'seeded', value: '1' })
      await refreshCollections(set)
    }
    set({ hydrated: true })
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
    // Optimistic
    set({
      companies: [
        ...get().companies.filter((c) => c.id !== company.id),
        company,
      ].sort((a, b) => a.name.localeCompare(b.name)),
    })
    await getDb().companies.put(company)
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

    set({
      applications: [...get().applications, app],
      requirements: [...get().requirements, ...reqs],
    })

    await getDb().transaction('rw', getDb().applications, getDb().requirements, async () => {
      await getDb().applications.put(app)
      if (reqs.length) await getDb().requirements.bulkPut(reqs)
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

    set({
      applications: get().applications.map((a) => (a.id === id ? next : a)),
    })
    await getDb().applications.put(next)
  },

  deleteApplications: async (ids) => {
    const idSet = new Set(ids)
    set({
      applications: get().applications.filter((a) => !idSet.has(a.id)),
      requirements: get().requirements.filter((r) => !idSet.has(r.applicationId)),
      contacts: get().contacts.filter((c) => !c.applicationId || !idSet.has(c.applicationId)),
      tasks: get().tasks.filter((t) => !t.applicationId || !idSet.has(t.applicationId)),
      documents: get().documents.filter((d) => !d.applicationId || !idSet.has(d.applicationId)),
      selectedIds: get().selectedIds.filter((id) => !idSet.has(id)),
      activeApplicationId: idSet.has(get().activeApplicationId ?? '') ? null : get().activeApplicationId,
    })
    await getDb().transaction(
      'rw',
      getDb().applications,
      getDb().requirements,
      getDb().contacts,
      getDb().tasks,
      getDb().documents,
      async () => {
        await getDb().applications.bulkDelete(ids)
        await getDb().requirements.where('applicationId').anyOf(ids).delete()
        await getDb().contacts.where('applicationId').anyOf(ids).delete()
        await getDb().tasks.where('applicationId').anyOf(ids).delete()
        await getDb().documents.where('applicationId').anyOf(ids).delete()
      },
    )
    get().pushToast('success', ids.length === 1 ? 'Application deleted' : `${ids.length} applications deleted`)
  },

  archiveApplications: async (ids, archived = true) => {
    const ts = nowIso()
    set({
      applications: get().applications.map((a) =>
        ids.includes(a.id) ? { ...a, archived, updatedAt: ts } : a,
      ),
      selectedIds: [],
    })
    await Promise.all(
      ids.map(async (id) => {
        const a = await getDb().applications.get(id)
        if (a) await getDb().applications.put({ ...a, archived, updatedAt: ts })
      }),
    )
    get().pushToast('success', archived ? 'Archived' : 'Restored')
  },

  bulkUpdateStatus: async (ids, status) => {
    await get().bulkPatch(ids, { status })
    get().pushToast('success', 'Status updated')
  },

  bulkPatch: async (ids, patch) => {
    const ts = nowIso()
    set({
      applications: get().applications.map((a) => {
        if (!ids.includes(a.id)) return a
        const next = { ...a, ...patch, updatedAt: ts }
        if (patch.status === 'applied' && !next.applicationDate) {
          next.applicationDate = ts.slice(0, 10)
        }
        return next
      }),
    })
    await Promise.all(
      ids.map(async (id) => {
        const a = await getDb().applications.get(id)
        if (!a) return
        const next = { ...a, ...patch, updatedAt: ts }
        if (patch.status === 'applied' && !next.applicationDate) {
          next.applicationDate = ts.slice(0, 10)
        }
        await getDb().applications.put(next)
      }),
    )
  },

  setRequirementStatus: async (id, status) => {
    const existing = get().requirements.find((r) => r.id === id)
    if (!existing) return
    const next = { ...existing, status, updatedAt: nowIso() }
    set({ requirements: get().requirements.map((r) => (r.id === id ? next : r)) })
    await getDb().requirements.put(next)
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
    set({
      requirements: [...get().requirements.filter((r) => r.id !== next.id), next],
    })
    await getDb().requirements.put(next)
  },

  deleteRequirement: async (id) => {
    set({ requirements: get().requirements.filter((r) => r.id !== id) })
    await getDb().requirements.delete(id)
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
    set({ documents: [...get().documents.filter((d) => d.id !== next.id), next] })
    await getDb().documents.put(next)
  },

  deleteDocument: async (id) => {
    set({ documents: get().documents.filter((d) => d.id !== id) })
    await getDb().documents.delete(id)
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
    set({ contacts: [...get().contacts.filter((c) => c.id !== next.id), next] })
    await getDb().contacts.put(next)
  },

  deleteContact: async (id) => {
    set({ contacts: get().contacts.filter((c) => c.id !== id) })
    await getDb().contacts.delete(id)
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
    set({ tasks: [...get().tasks.filter((t) => t.id !== next.id), next] })
    await getDb().tasks.put(next)
  },

  toggleTask: async (id) => {
    const existing = get().tasks.find((t) => t.id === id)
    if (!existing) return
    const next = { ...existing, completed: !existing.completed, updatedAt: nowIso() }
    set({ tasks: get().tasks.map((t) => (t.id === id ? next : t)) })
    await getDb().tasks.put(next)
  },

  deleteTask: async (id) => {
    set({ tasks: get().tasks.filter((t) => t.id !== id) })
    await getDb().tasks.delete(id)
  },

  ensureTag: async (name) => {
    const trimmed = name.trim()
    const existing = get().tags.find((t) => t.name.toLowerCase() === trimmed.toLowerCase())
    if (existing) return existing
    const tag: Tag = { id: uid('tag'), name: trimmed }
    set({ tags: [...get().tags, tag] })
    await getDb().tags.put(tag)
    return tag
  },

  deleteTag: async (id) => {
    set({ tags: get().tags.filter((t) => t.id !== id) })
    await getDb().tags.delete(id)
    // Remove tag from all applications that reference it
    const apps = get().applications.filter((a) => a.tagIds.includes(id))
    if (apps.length) {
      const ts = nowIso()
      set({
        applications: get().applications.map((a) =>
          a.tagIds.includes(id) ? { ...a, tagIds: a.tagIds.filter((t) => t !== id), updatedAt: ts } : a,
        ),
      })
      await Promise.all(
        apps.map(async (a) => {
          await getDb().applications.put({ ...a, tagIds: a.tagIds.filter((t) => t !== id), updatedAt: ts })
        }),
      )
    }
  },

  saveView: async (name) => {
    const view: SavedView = {
      id: uid('view'),
      name,
      filters: { ...get().filters },
      createdAt: nowIso(),
    }
    set({ savedViews: [...get().savedViews, view] })
    await getDb().savedViews.put(view)
    get().pushToast('success', `Saved view “${name}”`)
  },

  deleteSavedView: async (id) => {
    set({ savedViews: get().savedViews.filter((v) => v.id !== id) })
    await getDb().savedViews.delete(id)
  },

  applySavedView: (id) => {
    const view = get().savedViews.find((v) => v.id === id)
    if (view) set({ filters: { ...view.filters } })
  },

  loadDemoData: async () => {
    const seed = createDemoSeed()
    await getDb().transaction(
      'rw',
      [getDb().applications, getDb().companies, getDb().requirements, getDb().tasks, getDb().contacts, getDb().documents, getDb().tags],
      async () => {
        await getDb().companies.bulkPut(seed.companies)
        await getDb().applications.bulkPut(seed.applications)
        await getDb().requirements.bulkPut(seed.requirements)
        await getDb().tasks.bulkPut(seed.tasks)
        await getDb().contacts.bulkPut(seed.contacts)
        await getDb().documents.bulkPut(seed.documents)
        await getDb().tags.bulkPut(seed.tags)
      },
    )
    await refreshCollections(set)
    get().pushToast('info', 'Demo sample data loaded (clearly marked)')
  },

  clearAllData: async () => {
    await Promise.all([
      getDb().applications.clear(),
      getDb().companies.clear(),
      getDb().requirements.clear(),
      getDb().documents.clear(),
      getDb().contacts.clear(),
      getDb().tasks.clear(),
      getDb().savedViews.clear(),
    ])
    // Keep tags
    await refreshCollections(set)
    get().pushToast('success', 'All applications cleared')
  },

  importApplications: async (apps, requirements = []) => {
    await getDb().transaction('rw', getDb().applications, getDb().requirements, async () => {
      await getDb().applications.bulkPut(apps)
      if (requirements.length) await getDb().requirements.bulkPut(requirements)
    })
    await refreshCollections(set)
    get().pushToast('success', `Imported ${apps.length} applications`)
    return apps.length
  },
}))
