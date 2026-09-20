/**
 * Cloud workspace API client (server-authoritative tracker data).
 *
 * Thin fetch wrapper over /api/workspace. Document fileData is stripped
 * client-side before upload (server strips it again): binary bytes stay
 * local-only by explicit decision and are never sent to the server.
 */

export const WORKSPACE_API_COLLECTIONS = [
  'applications',
  'companies',
  'requirements',
  'documents',
  'contacts',
  'tasks',
  'tags',
  'savedViews',
] as const

export type WorkspaceApiCollection =
  (typeof WORKSPACE_API_COLLECTIONS)[number]

let apiBaseOverride: string | null = null

/** Test seam: pin the API base without touching Vite/browser globals. */
export function setWorkspaceApiBase(url: string | null): void {
  apiBaseOverride = url
}

function resolveApiBase(): string {
  if (apiBaseOverride) return apiBaseOverride
  const fromEnv = (
    import.meta as unknown as {
      env?: Record<string, string | undefined>
    }
  ).env?.VITE_API_BASE
  if (fromEnv) return fromEnv
  const host =
    typeof window === 'undefined' ? 'localhost' : window.location.hostname
  return host === 'localhost' || host === '127.0.0.1'
    ? 'http://localhost:3001'
    : `http://${host}:3001`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Remove local-only binary bytes before any server upload. */
export function withoutFileData<T>(collection: string, record: T): T {
  if (collection !== 'documents' || !isRecord(record)) return record
  if (!('fileData' in record)) return record
  const { fileData: _dropped, ...rest } = record
  return rest as T
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${resolveApiBase()}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  if (!res.ok) {
    const message =
      (isRecord(data) && typeof data['error'] === 'string' && data['error']) ||
      `Workspace request failed (${res.status})`
    throw new Error(message)
  }
  return data as T
}

export function fetchWorkspace(): Promise<
  Record<WorkspaceApiCollection, Array<Record<string, unknown>>>
> {
  return request('/api/workspace')
}

export function putWorkspaceRecord<T>(
  collection: string,
  record: T,
): Promise<{ record: T }> {
  const id = isRecord(record) ? record['id'] : undefined
  return request(`/api/workspace/${collection}/${String(id ?? '')}`, {
    method: 'PUT',
    body: JSON.stringify(withoutFileData(collection, record)),
  })
}

export function deleteWorkspaceRecord(
  collection: string,
  id: string,
): Promise<{ deleted: boolean }> {
  return request(`/api/workspace/${collection}/${id}`, { method: 'DELETE' })
}

export function importWorkspace(records: Record<string, unknown[]>): Promise<{
  counts: Record<string, number>
}> {
  const eligible: Record<string, unknown[]> = {}
  for (const [collection, items] of Object.entries(records)) {
    eligible[collection] = items.map((item) =>
      withoutFileData(collection, item),
    )
  }
  return request('/api/workspace/import', {
    method: 'POST',
    body: JSON.stringify({ records: eligible }),
  })
}
