import Dexie, { type EntityTable } from 'dexie'
import type {
  Application,
  Company,
  Contact,
  DocumentRecord,
  Requirement,
  SavedView,
  Tag,
  Task,
} from '@/types'

const SESSION_KEY = 'meridian_user_id'

export class MeridianDB extends Dexie {
  applications!: EntityTable<Application, 'id'>
  companies!: EntityTable<Company, 'id'>
  requirements!: EntityTable<Requirement, 'id'>
  documents!: EntityTable<DocumentRecord, 'id'>
  contacts!: EntityTable<Contact, 'id'>
  tasks!: EntityTable<Task, 'id'>
  tags!: EntityTable<Tag, 'id'>
  savedViews!: EntityTable<SavedView, 'id'>
  meta!: EntityTable<{ key: string; value: string }, 'key'>

  constructor(dbName: string = 'meridian-finance-tracker') {
    super(dbName)

    // Version 1: Original schema
    this.version(1).stores({
      applications:
        'id, companyName, companyId, status, roleType, specialization, country, city, deadline, openingDate, applicationDate, startDate, updatedAt, archived, recruitmentCycle, *tagIds',
      companies: 'id, name, companyType, updatedAt',
      requirements: 'id, applicationId, type, status, updatedAt',
      documents: 'id, applicationId, companyId, type, lastUpdated',
      contacts: 'id, applicationId, companyId, name',
      tasks: 'id, applicationId, dueDate, completed, updatedAt',
      tags: 'id, name',
      savedViews: 'id, name',
      meta: 'key',
    })
  }
}

// Restore userId from sessionStorage so the correct DB is opened immediately
// after module re-evaluation (e.g., full page reload, HMR boundary break)
let activeUserId: string | null = null
let activeDb: MeridianDB

try {
  const savedUserId = sessionStorage.getItem(SESSION_KEY)
  if (savedUserId) {
    activeUserId = savedUserId
    activeDb = new MeridianDB(`meridian-finance-tracker-${savedUserId}`)
  } else {
    activeDb = new MeridianDB()
  }
} catch {
  // sessionStorage unavailable (SSR, incognito quirks) — fall back to default
  activeDb = new MeridianDB()
}

export function getUserDb(userId: string): MeridianDB {
  if (activeDb && activeUserId === userId) {
    return activeDb
  }
  activeDb = new MeridianDB(`meridian-finance-tracker-${userId}`)
  activeUserId = userId
  // Persist so it survives module re-evaluation
  try { sessionStorage.setItem(SESSION_KEY, userId) } catch { /* ignore */ }
  return activeDb
}

export function clearUserSession() {
  activeUserId = null
  try { sessionStorage.removeItem(SESSION_KEY) } catch { /* ignore */ }
}

export function setActiveDb(database: MeridianDB) {
  activeDb = database
}

export function getActiveDb(): MeridianDB {
  return activeDb
}

/** Convenience getter — call inside store actions to get current DB */
export function getDb(): MeridianDB {
  return activeDb
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`
}

export function nowIso(): string {
  return new Date().toISOString()
}
