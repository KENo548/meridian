import type { Application } from '@/types'

const API_BASE = import.meta.env.VITE_API_BASE
  || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001'
    : `http://${window.location.hostname}:3001`)

async function fetchAuth(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { ...init, credentials: 'include' })
}

export interface JobResult {
  id: string
  source: string
  sourceJobId?: string
  canonicalUrl?: string
  title: string
  company: string
  location: string
  country?: string
  city?: string
  url: string
  applyUrl?: string
  companyUrl?: string
  description?: string
  salary?: string
  posted?: string
  deadline?: string
  type?: string
  remote?: boolean
  tags?: string[]
  languages?: string[]
  division?: string
  specialization?: string
  seniority?: string
  programme?: string
  startDate?: string
  firstSeenAt?: string
  lastSeenAt?: string
}

export interface FirmInfo {
  id: string
  name: string
  category: string
  careersProvider: string
  careersUrl: string
  atsSlug: string | null
  enabled: boolean
  priority: string
  notes?: string
}

export interface SourceStatus {
  id: string
  name: string
  enabled?: boolean
  configured: boolean
  description?: string
  lastChecked?: string
}

export interface ScanResult {
  status: string
  timestamp?: string
  durationMs?: number
  firmsScanned?: number
  firmsSucceeded?: number
  firmsFailed?: number
  totalJobs?: number
  newJobs?: number
  upcomingDeadlines?: Array<{ title: string; company: string; deadline: string; url: string }>
  firmResults?: Array<{ firmId: string; firmName: string; provider: string; count: number; error: string | null }>
  jobs?: JobResult[]
}

export interface SearchFilters {
  query: string
  location?: string
  country?: string
  sources?: string[]
  maxAge?: number
  page?: number
}

export async function searchJobs(filters: SearchFilters): Promise<JobResult[]> {
  const params = new URLSearchParams()
  params.set('q', filters.query)
  if (filters.location) params.set('location', filters.location)
  if (filters.country) params.set('country', filters.country)
  if (filters.sources?.length) params.set('sources', filters.sources.join(','))
  if (filters.maxAge) params.set('maxAge', String(filters.maxAge))
  if (filters.page) params.set('page', String(filters.page))

  try {
    const res = await fetchAuth(`${API_BASE}/api/search?${params.toString()}`)
    if (!res.ok) throw new Error(`Search failed: ${res.status}`)
    const data = await res.json()
    return Array.isArray(data) ? data : data.jobs ?? data.results ?? []
  } catch (err) {
    console.error('[jobSources] searchJobs error:', err)
    throw err
  }
}

export async function getSourceStatus(): Promise<SourceStatus[]> {
  try {
    const res = await fetchAuth(`${API_BASE}/api/sources`)
    if (!res.ok) throw new Error(`Sources failed: ${res.status}`)
    const data = await res.json()
    const list = data.sources ?? data ?? []
    return list.map((s: any) => ({
      id: s.id,
      name: s.name,
      configured: s.configured,
      description: s.description,
      enabled: s.configured,
      lastChecked: s.lastChecked,
    }))
  } catch (err) {
    console.error('[jobSources] getSourceStatus error:', err)
    return []
  }
}

// ─── Registry ──────────────────────────────────────────────────

export async function getRegistry(): Promise<{ firms: FirmInfo[]; stats: any }> {
  try {
    const res = await fetchAuth(`${API_BASE}/api/registry`)
    if (!res.ok) throw new Error(`Registry failed: ${res.status}`)
    return await res.json()
  } catch (err) {
    console.error('[jobSources] getRegistry error:', err)
    return { firms: [], stats: {} }
  }
}

export async function toggleFirmEnabled(firmId: string, enabled: boolean): Promise<void> {
  const res = await fetchAuth(`${API_BASE}/api/registry/${firmId}/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ enabled }),
  })
  if (!res.ok) throw new Error(`Toggle firm failed: ${res.status}`)
}

// ─── Scan ──────────────────────────────────────────────────────

export async function triggerScan(): Promise<ScanResult> {
  try {
    const res = await fetchAuth(`${API_BASE}/api/scan`, { method: 'POST' })
    if (!res.ok) throw new Error(`Scan failed: ${res.status}`)
    return await res.json()
  } catch (err) {
    console.error('[jobSources] triggerScan error:', err)
    return { status: 'error' }
  }
}

export async function getScanStatus(): Promise<{ scanning: boolean; lastScan: any }> {
  try {
    const res = await fetchAuth(`${API_BASE}/api/scan/status`)
    if (!res.ok) throw new Error(`Scan status failed: ${res.status}`)
    return await res.json()
  } catch (err) {
    console.error('[jobSources] getScanStatus error:', err)
    return { scanning: false, lastScan: null }
  }
}

export async function getLastScanResult(): Promise<ScanResult | null> {
  try {
    const res = await fetchAuth(`${API_BASE}/api/scan/last`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function scanFirm(firmId: string): Promise<any> {
  try {
    const res = await fetchAuth(`${API_BASE}/api/scan/${firmId}`, { method: 'POST' })
    if (!res.ok) throw new Error(`Scan firm failed: ${res.status}`)
    return await res.json()
  } catch (err) {
    console.error('[jobSources] scanFirm error:', err)
    return { error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

// ─── RSS (legacy) ──────────────────────────────────────────────

export async function getRssFeeds(): Promise<string[]> {
  try {
    const res = await fetchAuth(`${API_BASE}/api/rss/feeds`)
    if (!res.ok) throw new Error(`RSS feeds failed: ${res.status}`)
    const data = await res.json()
    const feeds = data.feeds ?? data ?? []
    return feeds.map((f: any) => (typeof f === 'string' ? f : f.url ?? ''))
  } catch (err) {
    console.error('[jobSources] getRssFeeds error:', err)
    return []
  }
}

export async function addRssFeed(url: string): Promise<void> {
  const res = await fetchAuth(`${API_BASE}/api/rss/feeds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'add', url }),
  })
  if (!res.ok) throw new Error(`Add RSS feed failed: ${res.status}`)
}

export async function removeRssFeed(url: string): Promise<void> {
  const res = await fetchAuth(`${API_BASE}/api/rss/feeds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'remove', url }),
  })
  if (!res.ok) throw new Error(`Remove RSS feed failed: ${res.status}`)
}

export async function checkRssFeeds(): Promise<JobResult[]> {
  try {
    const res = await fetchAuth(`${API_BASE}/api/rss/check`)
    if (!res.ok) throw new Error(`Check RSS feeds failed: ${res.status}`)
    const data = await res.json()
    return Array.isArray(data) ? data : data.jobs ?? data.results ?? []
  } catch (err) {
    console.error('[jobSources] checkRssFeeds error:', err)
    return []
  }
}

// ─── Opportunities ─────────────────────────────────────────────

export interface Opportunity {
  id: string
  companyName: string
  resolvedFirmId: string | null
  programme: string | null
  category: string
  division: string | null
  office: string | null
  year: string | null
  location: string | null
  country: string | null
  applyUrl: string | null
  status: 'verified_open' | 'tracker_open' | 'unknown' | 'closed'
  deadline: string | null
  opening: string | null
  rolling: boolean
  daysUntilClose: number | null
  sources: string[]
  sourceCount: number
  languages: string[]
  observations: Array<{
    source: string
    sourceUrl: string | null
    firstSeenAt: string
    lastSeenAt: string
    programme: string | null
    closingDate: string | null
    openingDate: string | null
    rolling: boolean
    status: string | null
    eligibility: string | null
    process: string | null
  }>
  createdAt: string
  updatedAt: string
  lastObservationAt: string | null
  consecutiveMisses: number
  totalObservations: number
}

export interface OpportunityMetrics {
  total: number
  live: number
  verified_open: number
  tracker_open: number
  unknown: number
  closed: number
  rolling: number
  closing_soon: number
  byCategory: Record<string, number>
  byCountry: Record<string, number>
  bySource: Record<string, number>
  byLanguage: Record<string, number>
}

export interface OpportunityFilters {
  q?: string
  category?: string
  country?: string
  status?: string
  source?: string
  firm?: string
  deadline?: string
  programme?: string
  division?: string
  office?: string
  language?: string
  sort?: string
  order?: 'asc' | 'desc'
  page?: number
  limit?: number
}

export async function getOpportunities(filters: OpportunityFilters = {}): Promise<{
  opportunities: Opportunity[]
  total: number
  page: number
  limit: number
  totalPages: number
  metrics: OpportunityMetrics
}> {
  const params = new URLSearchParams()
  if (filters.q) params.set('q', filters.q)
  if (filters.category) params.set('category', filters.category)
  if (filters.country) params.set('country', filters.country)
  if (filters.status) params.set('status', filters.status)
  if (filters.source) params.set('source', filters.source)
  if (filters.firm) params.set('firm', filters.firm)
  if (filters.deadline) params.set('deadline', filters.deadline)
  if (filters.programme) params.set('programme', filters.programme)
  if (filters.division) params.set('division', filters.division)
  if (filters.office) params.set('office', filters.office)
  if (filters.language) params.set('language', filters.language)
  if (filters.sort) params.set('sort', filters.sort)
  if (filters.order) params.set('order', filters.order)
  if (filters.page) params.set('page', String(filters.page))
  if (filters.limit) params.set('limit', String(filters.limit))

  try {
    const res = await fetchAuth(`${API_BASE}/api/opportunities?${params.toString()}`)
    if (!res.ok) throw new Error(`Opportunities failed: ${res.status}`)
    return await res.json()
  } catch (err) {
    console.error('[jobSources] getOpportunities error:', err)
    return { opportunities: [], total: 0, page: 1, limit: 50, totalPages: 0, metrics: { total: 0, live: 0, verified_open: 0, tracker_open: 0, unknown: 0, closed: 0, rolling: 0, closing_soon: 0, byCategory: {}, byCountry: {}, bySource: {}, byLanguage: {} } }
  }
}

export async function getOpportunityMetrics(): Promise<OpportunityMetrics> {
  try {
    const res = await fetchAuth(`${API_BASE}/api/opportunities/metrics`)
    if (!res.ok) throw new Error(`Metrics failed: ${res.status}`)
    return await res.json()
  } catch (err) {
    console.error('[jobSources] getOpportunityMetrics error:', err)
    return { total: 0, live: 0, verified_open: 0, tracker_open: 0, unknown: 0, closed: 0, rolling: 0, closing_soon: 0, byCategory: {}, byCountry: {}, bySource: {}, byLanguage: {} }
  }
}

export async function getOpportunity(id: string): Promise<Opportunity | null> {
  try {
    const res = await fetchAuth(`${API_BASE}/api/opportunities/${id}`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// ─── Resolution & Verification ─────────────────────────────────

export interface ResolutionResult {
  id: string
  companyName: string
  classifiedProvider: string
  verificationStatus: string
  verificationReason: string | null
  canAttemptDirect: boolean
}

export interface CoverageGapReport {
  timestamp: string
  totalEntries: number
  byProvider: Record<string, { count: number; entries: Array<{ id: string; companyName: string; applyUrl: string }>; resolvable: boolean }>
  byDomain: Record<string, { count: number; provider: string; entries: string[] }>
  byResolutionStatus: {
    direct_resolved: number
    firm_resolved: number
    reachable: number
    unresolved: number
  }
  recommendations: Array<{
    type: string
    message: string
    providers?: Array<{ provider: string; count: number }>
    domains?: Array<{ domain: string; count: number }>
  }>
}

export interface StalenessReport {
  timestamp: string
  total: number
  fresh: number
  stale: number
  missing: number
  expired: number
  unknown: number
  transitions: number
  byReason: Record<string, number>
}

export async function resolveOpportunities(options: { verify?: boolean; limit?: number } = {}): Promise<{
  stats: { total: number; classified: number; reachable: number; verified: number; unverified: number; firmResolved: number; newlyReachable: number; newlyVerified: number; errors: number }
  coverageGap: CoverageGapReport
}> {
  try {
    const res = await fetchAuth(`${API_BASE}/api/opportunities/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    })
    if (!res.ok) throw new Error(`Resolve failed: ${res.status}`)
    return await res.json()
  } catch (err) {
    console.error('[jobSources] resolveOpportunities error:', err)
    return { stats: { total: 0, classified: 0, reachable: 0, verified: 0, unverified: 0, firmResolved: 0, newlyReachable: 0, newlyVerified: 0, errors: 1 }, coverageGap: { timestamp: new Date().toISOString(), totalEntries: 0, byProvider: {}, byDomain: {}, byResolutionStatus: { direct_resolved: 0, firm_resolved: 0, reachable: 0, unresolved: 0 }, recommendations: [] } }
  }
}

export async function getCoverageGapReport(): Promise<CoverageGapReport> {
  try {
    const res = await fetchAuth(`${API_BASE}/api/opportunities/coverage`)
    if (!res.ok) throw new Error(`Coverage failed: ${res.status}`)
    return await res.json()
  } catch (err) {
    console.error('[jobSources] getCoverageGapReport error:', err)
    return { timestamp: new Date().toISOString(), totalEntries: 0, byProvider: {}, byDomain: {}, byResolutionStatus: { direct_resolved: 0, firm_resolved: 0, reachable: 0, unresolved: 0 }, recommendations: [] }
  }
}

export async function getStalenessReport(): Promise<StalenessReport> {
  try {
    const res = await fetchAuth(`${API_BASE}/api/opportunities/staleness`)
    if (!res.ok) throw new Error(`Staleness failed: ${res.status}`)
    return await res.json()
  } catch (err) {
    console.error('[jobSources] getStalenessReport error:', err)
    return { timestamp: new Date().toISOString(), total: 0, fresh: 0, stale: 0, missing: 0, expired: 0, unknown: 0, transitions: 0, byReason: {} }
  }
}

export async function applyStalenessTransitions(): Promise<{ total: number; transitions: number }> {
  try {
    const res = await fetchAuth(`${API_BASE}/api/opportunities/staleness/apply`, { method: 'POST' })
    if (!res.ok) throw new Error(`Apply staleness failed: ${res.status}`)
    return await res.json()
  } catch (err) {
    console.error('[jobSources] applyStalenessTransitions error:', err)
    return { total: 0, transitions: 0 }
  }
}

// ─── Conversion ────────────────────────────────────────────────

export function jobToApplication(job: JobResult): Partial<Application> {
  const sourceMap: Record<string, Application['source']> = {
    greenhouse: 'other',
    workday: 'other',
    oleeo_rss: 'other',
    adzuna: 'other',
    jsearch: 'other',
    efc: 'other',
    indeed: 'indeed',
    glassdoor: 'other',
    linkedin: 'linkedin',
    rss: 'other',
  }

  const locationParts = job.location?.split(',').map((s) => s.trim()) ?? []
  const city = job.city ?? locationParts[0] ?? ''
  const country = job.country ?? locationParts[1] ?? ''

  return {
    jobTitle: job.title,
    companyName: job.company,
    location: job.location,
    city,
    country,
    source: sourceMap[job.source] ?? 'other',
    sourceUrl: job.url,
    jobUrl: job.applyUrl || job.url,
    companyUrl: job.companyUrl,
    status: 'interested',
    roleType: 'full_time',
    deadlineType: job.deadline ? 'specific' : 'unknown',
    deadline: job.deadline,
    notes: [
      job.salary ? `Salary: ${job.salary}` : '',
      job.type ? `Type: ${job.type}` : '',
      job.division ? `Division: ${job.division}` : '',
      job.specialization ? `Specialization: ${job.specialization}` : '',
      job.description ? `\n\nDescription:\n${job.description}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    tagIds: [],
    languages: job.languages || [],
  }
}
