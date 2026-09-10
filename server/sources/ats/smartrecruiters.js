const BASE_URL = 'https://api.smartrecruiters.com/v1/companies'
const PAGE_SIZE = 100
const TIMEOUT_MS = 15000

function stripHtml(html) {
  if (!html) return ''
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 5000)
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

function mapEmploymentType(posting) {
  const roleType = (posting.roleType || '').toLowerCase()
  if (roleType.includes('intern')) return 'internship'
  if (roleType.includes('contract')) return 'contract'
  if (roleType.includes('part')) return 'part_time'
  return 'unknown'
}

function normalizePosting(posting, firm) {
  const location = posting.location
    ? (typeof posting.location === 'string' ? posting.location : posting.location.name || '')
    : ''

  const url = posting.applyUrl || posting.ref || ''
  const fullUrl = url.startsWith('http')
    ? url
    : `https://jobs.smartrecruiters.com/${firm.smartRecruitersCompanyId || firm.id}${url.startsWith('/') ? '' : '/'}${url}`

  return {
    id: String(posting.id || ''),
    source: 'smartrecruiters',
    sourceJobId: String(posting.id || ''),
    company: firm.name,
    title: (posting.name || '').trim(),
    location: location.trim(),
    country: extractCountry(location),
    url: fullUrl,
    applyUrl: fullUrl,
    description: stripHtml(posting.description),
    posted: posting.releasedDate || null,
    employmentType: mapEmploymentType(posting),
    departments: posting.department ? [posting.department] : [],
    offices: posting.location && typeof posting.location === 'object' && posting.location.city
      ? [posting.location.city]
      : [],
  }
}

async function fetchSmartRecruitersJobs(firm, sourceConfig = {}) {
  const companyId = sourceConfig.companyId || firm.smartRecruitersCompanyId || firm.id
  const allJobs = []
  let offset = 0
  let total = null

  try {
    while (total === null || offset < total) {
      const url = `${BASE_URL}/${companyId}/postings?offset=${offset}&limit=${PAGE_SIZE}`

      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        return {
          jobs: [],
          source: 'smartrecruiters',
          total: 0,
          firm: firm.name,
          error: `SmartRecruiters API ${response.status} for ${companyId}: ${body.slice(0, 200)}`,
        }
      }

      const data = await response.json()

      if (total === null) {
        total = data.totalResults || 0
      }

      const postings = data.content || []
      if (postings.length === 0) break

      for (const posting of postings) {
        const job = normalizePosting(posting, firm)
        if (job.title) {
          allJobs.push(job)
        }
      }

      offset += postings.length
    }

    return {
      jobs: allJobs,
      source: 'smartrecruiters',
      total: allJobs.length,
      firm: firm.name,
    }
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return {
        jobs: [],
        source: 'smartrecruiters',
        total: 0,
        firm: firm.name,
        error: `SmartRecruiters timeout for ${companyId}`,
      }
    }
    return {
      jobs: [],
      source: 'smartrecruiters',
      total: 0,
      firm: firm.name,
      error: `SmartRecruiters error for ${companyId}: ${err.message}`,
    }
  }
}

export { fetchSmartRecruitersJobs }
