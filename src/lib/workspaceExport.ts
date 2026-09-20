/**
 * P1A — operator-controlled workspace export (export safety only).
 *
 * Pure module: builds a versioned, self-describing JSON backup of the
 * currently authenticated user's eight IndexedDB workspace collections
 * and validates such a payload on re-read. No DOM, no fetch, no store
 * access, no mutation of inputs. Wired only to the existing Settings
 * "JSON backup" button; storage authority is unchanged.
 *
 * Document binary/fileData is counted (records + encoded bytes) but its
 * contents never appear in any summary. fileData stays local-only by
 * explicit decision and is NOT eligible for P0/P1 server migration.
 */

export const WORKSPACE_EXPORT_FORMAT = 'meridian-workspace-export'

export const WORKSPACE_EXPORT_SCHEMA_VERSION = 1

export const WORKSPACE_EXPORT_COLLECTIONS = [
  'applications',
  'companies',
  'requirements',
  'documents',
  'contacts',
  'tasks',
  'tags',
  'savedViews',
] as const

export type WorkspaceExportCollection =
  (typeof WORKSPACE_EXPORT_COLLECTIONS)[number]

export interface WorkspaceExportRecords {
  applications: unknown[]
  companies: unknown[]
  requirements: unknown[]
  documents: unknown[]
  contacts: unknown[]
  tasks: unknown[]
  tags: unknown[]
  savedViews: unknown[]
  [collection: string]: unknown[]
}

export interface WorkspaceExportFileData {
  presentLocallyNotMigrated: true
  documentsWithFileData: number
  totalEncodedBytes: number
}

export interface WorkspaceExportPayload {
  format: typeof WORKSPACE_EXPORT_FORMAT
  schemaVersion: typeof WORKSPACE_EXPORT_SCHEMA_VERSION
  userId: string
  exportedAt: string
  counts: Record<WorkspaceExportCollection, number>
  fileData: WorkspaceExportFileData
  records: WorkspaceExportRecords
}

export interface WorkspaceExportValidation {
  ok: boolean
  errors: string[]
  summary: {
    userId: string
    exportedAt: string
    counts: Record<WorkspaceExportCollection, number>
    totalRecords: number
    documentsWithFileData: number
    totalEncodedBytes: number
  } | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function fileDataLength(document: unknown): number {
  if (!isRecord(document)) return 0
  const fileData = document['fileData']
  return typeof fileData === 'string' ? fileData.length : 0
}

export function summarizeFileData(documents: unknown[]): {
  documentsWithFileData: number
  totalEncodedBytes: number
} {
  let documentsWithFileData = 0
  let totalEncodedBytes = 0

  for (const document of documents) {
    const bytes = fileDataLength(document)
    if (bytes > 0) {
      documentsWithFileData += 1
      totalEncodedBytes += bytes
    }
  }

  return { documentsWithFileData, totalEncodedBytes }
}

export function buildWorkspaceExport(input: {
  userId: string
  exportedAt: string
  records: WorkspaceExportRecords
}): WorkspaceExportPayload {
  if (typeof input.userId !== 'string' || input.userId.length === 0) {
    throw new Error('Workspace export requires an authenticated userId')
  }

  if (typeof input.exportedAt !== 'string' || input.exportedAt.length === 0) {
    throw new Error('Workspace export requires an exportedAt timestamp')
  }

  const counts = {} as Record<WorkspaceExportCollection, number>
  const records = {} as WorkspaceExportRecords

  for (const collection of WORKSPACE_EXPORT_COLLECTIONS) {
    const items = input.records[collection]
    if (!Array.isArray(items)) {
      throw new Error(`Workspace export requires an array for ${collection}`)
    }
    counts[collection] = items.length
    records[collection] = [...items]
  }

  const { documentsWithFileData, totalEncodedBytes } = summarizeFileData(
    records.documents,
  )

  return {
    format: WORKSPACE_EXPORT_FORMAT,
    schemaVersion: WORKSPACE_EXPORT_SCHEMA_VERSION,
    userId: input.userId,
    exportedAt: input.exportedAt,
    counts,
    fileData: {
      presentLocallyNotMigrated: true,
      documentsWithFileData,
      totalEncodedBytes,
    },
    records,
  }
}

export function validateWorkspaceExport(
  payload: unknown,
): WorkspaceExportValidation {
  const errors: string[] = []

  if (!isRecord(payload)) {
    return { ok: false, errors: ['Export payload must be a JSON object'], summary: null }
  }

  if (payload['format'] !== WORKSPACE_EXPORT_FORMAT) {
    errors.push('Export format is not a Meridian workspace export')
  }

  if (payload['schemaVersion'] !== WORKSPACE_EXPORT_SCHEMA_VERSION) {
    errors.push('Unsupported workspace export schema version')
  }

  const userId = payload['userId']
  if (typeof userId !== 'string' || userId.length === 0) {
    errors.push('Export userId is missing')
  }

  const exportedAt = payload['exportedAt']
  if (typeof exportedAt !== 'string' || exportedAt.length === 0) {
    errors.push('Export timestamp is missing')
  }

  const records = payload['records']
  if (!isRecord(records)) {
    errors.push('Export records block is missing')
  }

  const counts = payload['counts']
  if (!isRecord(counts)) {
    errors.push('Export counts block is missing')
  }

  if (errors.length > 0) {
    return { ok: false, errors, summary: null }
  }

  const recordBlock = records as Record<string, unknown>
  const countBlock = counts as Record<string, unknown>
  const expectedKeys = new Set<string>(WORKSPACE_EXPORT_COLLECTIONS)

  for (const key of Object.keys(recordBlock)) {
    if (!expectedKeys.has(key)) {
      errors.push(`Unexpected workspace collection: ${key}`)
    }
  }

  const verifiedCounts = {} as Record<WorkspaceExportCollection, number>

  for (const collection of WORKSPACE_EXPORT_COLLECTIONS) {
    const items = recordBlock[collection]
    if (!Array.isArray(items)) {
      errors.push(`Workspace collection is missing or not an array: ${collection}`)
      continue
    }

    for (const item of items) {
      if (!isRecord(item) || typeof item['id'] !== 'string' || item['id'].length === 0) {
        errors.push(`Record without a valid string id in ${collection}`)
        break
      }
    }

    if (countBlock[collection] !== items.length) {
      errors.push(`Count mismatch for ${collection}`)
    }

    verifiedCounts[collection] = items.length
  }

  const fileData = payload['fileData']
  const documents = Array.isArray(recordBlock['documents'])
    ? (recordBlock['documents'] as unknown[])
    : []
  const actual = summarizeFileData(documents)

  if (
    !isRecord(fileData) ||
    fileData['presentLocallyNotMigrated'] !== true ||
    fileData['documentsWithFileData'] !== actual.documentsWithFileData ||
    fileData['totalEncodedBytes'] !== actual.totalEncodedBytes
  ) {
    errors.push('Document fileData summary does not match the exported documents')
  }

  if (errors.length > 0 || typeof userId !== 'string' || typeof exportedAt !== 'string') {
    return { ok: false, errors, summary: null }
  }

  const totalRecords = WORKSPACE_EXPORT_COLLECTIONS.reduce(
    (sum, collection) => sum + verifiedCounts[collection],
    0,
  )

  return {
    ok: true,
    errors: [],
    summary: {
      userId,
      exportedAt,
      counts: verifiedCounts,
      totalRecords,
      documentsWithFileData: actual.documentsWithFileData,
      totalEncodedBytes: actual.totalEncodedBytes,
    },
  }
}
