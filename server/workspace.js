/**
 * User-workspace shared contract (P0 server foundation).
 *
 * Eight user-owned tracker collections live here. Every operation is
 * scoped by an explicit userId that callers MUST derive from the
 * authenticated session (req.userId). Client-supplied owner fields are
 * stripped, never trusted.
 *
 * P0 scope: scalar record metadata only. Document binary/fileData stays
 * local-only by explicit decision and is stripped here, so a future
 * binary-storage change is a deliberate new decision, not an accident.
 */

export const WORKSPACE_COLLECTIONS = Object.freeze([
  'applications',
  'companies',
  'requirements',
  'documents',
  'contacts',
  'tasks',
  'tags',
  'savedViews',
])

export function workspaceTable(collection) {
  if (!WORKSPACE_COLLECTIONS.includes(collection)) {
    throw new WorkspaceValidationError(
      `Unknown workspace collection: ${String(collection)}`,
    )
  }
  return `user_${collection}`
}

export class WorkspaceValidationError extends Error {
  constructor(message) {
    super(message)
    this.name = 'WorkspaceValidationError'
    this.statusCode = 400
  }
}

/**
 * Validate an inbound record and bind it to the session owner.
 * Throws WorkspaceValidationError (→ 400) on any malformed input.
 * Never returns a client-supplied user identity.
 */
export function sanitizeWorkspaceRecord(collection, id, body, userId) {
  workspaceTable(collection)

  if (typeof id !== 'string' || id.length === 0) {
    throw new WorkspaceValidationError('Record id must be a non-empty string')
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new WorkspaceValidationError('Record body must be a JSON object')
  }

  if (body.id !== undefined && body.id !== id) {
    throw new WorkspaceValidationError('Record id does not match request path')
  }

  if (typeof userId !== 'string' || userId.length === 0) {
    throw new WorkspaceValidationError('Missing record owner')
  }

  const data = { ...body, id }
  delete data.user_id
  delete data.userId

  if (collection === 'documents') {
    delete data.fileData
  }

  return { id, user_id: userId, data }
}

/** Shape a stored row for API responses. Owner identity stays server-side. */
export function toWorkspaceApiRecord(row) {
  if (!row) return null
  const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data
  return { ...data, id: row.id }
}
