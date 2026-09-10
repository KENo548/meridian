import { extractLanguagesFromJob } from './extractLanguages.js'

const ALLOWED_SOURCES = [
  'adzuna', 'jsearch', 'rss', 'glassdoor', 'linkedin',
  'greenhouse', 'workday', 'oleeo_rss', 'custom',
  'efc', 'oracle_hcm', 'eightfold', 'successfactors', 'avature',
  'smartrecruiters', 'lever',
  'landtheoffer', 'fyntraq', 'trackr',
]

function validateUrl(url) {
  if (!url || typeof url !== 'string') return null
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
    return parsed.href
  } catch {
    return null
  }
}

function validateDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null
  const t = Date.parse(dateStr)
  if (isNaN(t)) return null
  return new Date(t).toISOString()
}

function validateJob(raw, source) {
  const errors = []

  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['Input is not an object'] }
  }

  const title = String(raw.title ?? raw.job_title ?? '').trim()
  const company = String(raw.company ?? raw.company_name ?? raw.employer ?? '').trim()
  if (!title) errors.push('Missing title')
  if (!company) errors.push('Missing company')

  const url = raw.url ?? raw.apply_url ?? raw.applyUrl ?? raw.link ?? raw.job_url
  if (url) {
    const validated = validateUrl(String(url))
    if (!validated) errors.push(`Invalid URL: ${url}`)
  }

  const posted = raw.posted ?? raw.date_posted ?? raw.created
  if (posted) {
    const validated = validateDate(String(posted))
    if (!validated) errors.push(`Invalid date: ${posted}`)
  }

  return {
    valid: errors.length === 0 || (title && company),
    errors,
  }
}

function normalize(raw, source) {
  if (!raw || typeof raw !== 'object') return null
  if (!ALLOWED_SOURCES.includes(source)) return null

  const id = String(raw.id ?? raw.sourceJobId ?? raw.job_id ?? raw.link ?? crypto.randomUUID())
  const title = String(raw.title ?? raw.job_title ?? '').trim()
  const company = String(raw.company ?? raw.company_name ?? raw.employer ?? '').trim()
  const location = String(raw.location ?? raw.formattedLocation ?? raw.place ?? '').trim()
  const rawUrl = String(raw.url ?? raw.apply_url ?? raw.applyUrl ?? raw.link ?? raw.job_url ?? '')
  const url = validateUrl(rawUrl) || rawUrl

  if (!title && !company) return null

  const country = raw.country ?? raw.country_code ?? extractCountry(location)
  const city = raw.city ?? raw.formattedLocationShort ?? extractCity(location)
  const salary = raw.salary ?? raw.salary_min ?? raw.salary_max ?? null
  const rawPosted = raw.posted ?? raw.date_posted ?? raw.created ?? null
  const posted = rawPosted ? validateDate(String(rawPosted)) || null : null
  const rawDeadline = raw.deadline ?? raw.expiry ?? null
  const deadline = rawDeadline ? validateDate(String(rawDeadline)) || null : null
  const type = raw.type ?? raw.employment_type ?? raw.employmentType ?? raw.contract_type ?? null
  const remote = Boolean(raw.remote ?? raw.remote_flag ?? false)
  const tags = Array.isArray(raw.tags) ? raw.tags : []

  const now = new Date().toISOString()

  return {
    id: `${source}:${id}`,
    source,
    sourceJobId: raw.sourceJobId || id,
    canonicalUrl: raw.canonicalUrl || url,
    title,
    company,
    location,
    country: country || undefined,
    city: city || undefined,
    url,
    applyUrl: raw.applyUrl || url,
    companyUrl: raw.companyUrl ?? raw.company_url ?? undefined,
    description: raw.description ?? raw.snippet ?? undefined,
    salary: salary || undefined,
    posted: posted || undefined,
    deadline: deadline || undefined,
    type: type || undefined,
    remote,
    tags,
    languages: extractLanguagesFromJob(raw),
    division: raw.division || undefined,
    specialization: raw.specialization || undefined,
    seniority: raw.seniority || undefined,
    programme: raw.programme || undefined,
    startDate: raw.startDate || undefined,
    firstSeenAt: raw.firstSeenAt || now,
    lastSeenAt: raw.lastSeenAt || now,
    departments: raw.departments || undefined,
    offices: raw.offices || undefined,
  }
}

function extractCountry(location) {
  if (!location) return undefined
  const lower = location.toLowerCase()
  const map = {
    'united kingdom': 'gb', 'uk': 'gb', 'england': 'gb', 'london': 'gb',
    'united states': 'us', 'usa': 'us', 'new york': 'us', 'san francisco': 'us',
    'germany': 'de', 'deutschland': 'de', 'frankfurt': 'de',
    'france': 'fr', 'paris': 'fr',
    'singapore': 'sg',
    'hong kong': 'hk',
    'dubai': 'ae', 'uae': 'ae',
    'canada': 'ca', 'toronto': 'ca',
    'australia': 'au', 'sydney': 'au',
    'ireland': 'ie', 'dublin': 'ie',
    'japan': 'jp', 'tokyo': 'jp',
    'switzerland': 'ch', 'zurich': 'ch',
    'netherlands': 'nl', 'amsterdam': 'nl',
    'sweden': 'se', 'stockholm': 'se',
    'spain': 'es', 'madrid': 'es',
    'israel': 'il', 'tel aviv': 'il',
  }
  for (const [key, code] of Object.entries(map)) {
    if (lower.includes(key)) return code
  }
  return undefined
}

function extractCity(location) {
  if (!location) return undefined
  const parts = location.split(',').map(s => s.trim())
  return parts[0] || undefined
}

function normalizeBatch(items, source) {
  if (!Array.isArray(items)) return []
  return items.map(item => normalize(item, source)).filter(Boolean)
}

function deduplicateJobs(jobs) {
  const seen = new Map()
  const deduped = []

  for (const job of jobs) {
    const key = `${job.company.toLowerCase()}:${job.title.toLowerCase()}:${job.location.toLowerCase()}`
    if (!seen.has(key)) {
      seen.set(key, job)
      deduped.push(job)
    } else {
      const existing = seen.get(key)
      if (job.source === 'greenhouse' || job.source === 'workday' || job.source === 'oleeo_rss') {
        const idx = deduped.indexOf(existing)
        if (idx !== -1) deduped[idx] = job
        seen.set(key, job)
      }
    }
  }

  return deduped
}

export {
  normalize, normalizeBatch, deduplicateJobs, ALLOWED_SOURCES,
  validateUrl, validateDate, validateJob,
}
