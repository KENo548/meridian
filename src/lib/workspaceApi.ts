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

// Same-origin API: the default base is empty so every call is a relative
// /api/* path, routed by the Vercel rewrite (or the Vite dev proxy
// locally). The override seam stays for tests only.
function resolveApiBase(): string {
  if (apiBaseOverride) return apiBaseOverride
  return ''
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

/**
 * Honor the server's Retry-After hint (GitHub pattern): one idempotent
 * retry after the indicated wait, then a friendly error. Every workspace
 * operation is an idempotent upsert/delete scoped by record ID (Stripe
 * pattern), so a single retry can neither duplicate nor lose data.
 */
export function parseRetryAfterMs(
  headers: { get: (name: string) => string | null },
  fallbackMs = 2000,
): number {
  const seconds = headers.get('retry-after')
  const parsed = seconds === null ? NaN : Number(seconds)
  if (!Number.isFinite(parsed) || parsed < 0) return fallbackMs
  return Math.min(parsed * 1000, 30000)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function request<T>(
  path: string,
  init?: RequestInit,
  retried = false,
): Promise<T> {
  const res = await fetch(`${resolveApiBase()}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  if (res.status === 429 && !retried) {
    await sleep(parseRetryAfterMs(res.headers))
    return request<T>(path, init, true)
  }
  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    data = null
  }
  if (!res.ok) {
    if (res.status === 429) {
      throw new Error(
        'The server is busy. Please wait a few seconds and retry — nothing was saved or lost.',
      )
    }
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
