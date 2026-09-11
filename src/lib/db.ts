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

    // Version 2: Future — add new indexes/tables here with migration
    // Example:
    // this.version(2).stores({
    //   applications: 'id, companyName, companyId, status, roleType, specialization, country, city, deadline, openingDate, applicationDate, startDate, updatedAt, archived, recruitmentCycle, newField, *tagIds',
    //   // newTable: 'id, name',
    // }).upgrade(tx => {
    //   // Migrate existing data — preserve everything
    //   return tx.table('applications').toCollection().modify(app => {
    //     app.newField = app.newField || null
    //   })
    // })
  }
}

// Default instance for unauthenticated / legacy usage
export const db = new MeridianDB()

let activeDb: MeridianDB = db
let activeUserId: string | null = null

export function getUserDb(userId: string): MeridianDB {
  if (activeDb !== db && activeUserId === userId) {
    // Already have this user's db open
    return activeDb
  }
  activeDb = new MeridianDB(`meridian-finance-tracker-${userId}`)
  activeUserId = userId
  return activeDb
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
