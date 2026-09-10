const API_BASE = 'https://api.the-trackr.com'
const TIMEOUT_MS = 15000
const SOURCE = 'trackr'

const TRACKER_ENDPOINTS = [
  { path: '/v1/companies', name: 'companies' },
  { path: '/v1/trackers', name: 'trackers' },
  { path: '/v1/jobs', name: 'jobs' },
  { path: '/api/companies', name: 'companies-alt' },
  { path: '/api/trackers', name: 'trackers-alt' },
  { path: '/api/jobs', name: 'jobs-alt' },
]

const UK_FINANCE_SLUGS = [
  'uk-finance',
  'uk-finance-summer-internships',
  'uk-finance-spring-weeks',
  'uk-finance-graduate',
]

async function tryEndpoint(endpoint, slug) {
  const urls = slug
    ? [`${API_BASE}${endpoint.path}/${slug}`, `${API_BASE}${endpoint.path}?tracker=${slug}`]
    : [`${API_BASE}${endpoint.path}`]

  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })

      if (response.ok) {
        const data = await response.json()
        if (data && (Array.isArray(data) || data.companies || data.trackers || data.jobs || data.data)) {
          return { url, data, endpoint: endpoint.name }
        }
      }
    } catch {}
  }

  return null
}

function normalizeTrackrEntry(entry) {
  const company = entry.companyName || entry.company || entry.name || ''
  const programme = entry.programmeName || entry.programme || entry.role || entry.title || ''
  const location = entry.location || ''
  const openingDate = entry.openingDate || entry.opening || ''
  const closingDate = entry.closingDate || entry.closing || ''
  const status = entry.status || entry.latestStage || ''
  const process = entry.process || ''
  const rolling = entry.rolling || false
  const category = entry.category || ''

  return {
    company,
    programme,
    programmeName: programme,
    location,
    openingDate,
    closingDate,
    status,
    process,
    applyUrl: entry.applyUrl || entry.url || entry.link || '',
    category,
    rolling: rolling === true || rolling === 'Yes' || rolling === 'yes',
  }
}

function extractEntries(data) {
  if (Array.isArray(data)) return data
  if (data.companies && Array.isArray(data.companies)) return data.companies
  if (data.trackers && Array.isArray(data.trackers)) return data.trackers
  if (data.jobs && Array.isArray(data.jobs)) return data.jobs
  if (data.data && Array.isArray(data.data)) return data.data
  return []
}

async function fetchTrackr() {
  const allEntries = []
  const errors = []

  for (const slug of UK_FINANCE_SLUGS) {
    for (const endpoint of TRACKER_ENDPOINTS) {
      const result = await tryEndpoint(endpoint, slug)
      if (result) {
        const rawEntries = extractEntries(result.data)
        const normalized = rawEntries
          .map(normalizeTrackrEntry)
          .filter(e => e.company)
        allEntries.push(...normalized)
        break
      }
    }
  }

  if (allEntries.length === 0) {
    for (const endpoint of TRACKER_ENDPOINTS) {
      const result = await tryEndpoint(endpoint, null)
      if (result) {
        const rawEntries = extractEntries(result.data)
        const normalized = rawEntries
          .map(normalizeTrackrEntry)
          .filter(e => e.company)
        allEntries.push(...normalized)
        break
      }
    }
  }

  if (allEntries.length === 0) {
    return {
      entries: [],
      source: SOURCE,
      total: 0,
      error: 'Trackr API endpoints not accessible or format changed',
      errors,
    }
  }

  return {
    entries: allEntries,
    source: SOURCE,
    total: allEntries.length,
  }
}

export { fetchTrackr, normalizeTrackrEntry, API_BASE, TRACKER_ENDPOINTS }
