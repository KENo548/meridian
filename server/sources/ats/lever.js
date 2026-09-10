const BASE_URL = 'https://api.lever.co/v0/postings'
const TIMEOUT_MS = 15000

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
  const commitment = (posting.categories?.commitment || '').toLowerCase()
  if (commitment.includes('intern')) return 'internship'
  if (commitment.includes('contract')) return 'contract'
  if (commitment.includes('part')) return 'part_time'
  return 'unknown'
}

function normalizePosting(posting, firm) {
  const location = posting.categories?.location || ''
  const team = posting.categories?.team || ''
  const department = posting.categories?.department || ''

  return {
    id: String(posting.id || ''),
    source: 'lever',
    sourceJobId: String(posting.id || ''),
    company: firm.name,
    title: (posting.text || '').trim(),
    location: location.trim(),
    country: extractCountry(location),
    url: posting.hostedUrl || '',
    applyUrl: posting.applyUrl || posting.hostedUrl || '',
    description: (posting.descriptionPlain || posting.description || '').slice(0, 5000),
    posted: posting.created ? new Date(posting.created).toISOString() : null,
    employmentType: mapEmploymentType(posting),
    departments: department ? [department] : [],
    offices: team ? [team] : [],
  }
}

async function fetchLeverJobs(firm, sourceConfig = {}) {
  const companyId = sourceConfig.companyId || firm.leverCompanyId || firm.id

  try {
    const url = `${BASE_URL}/${companyId}`
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
        source: 'lever',
        total: 0,
        firm: firm.name,
        error: `Lever API ${response.status} for ${companyId}: ${body.slice(0, 200)}`,
      }
    }

    const postings = await response.json()

    if (!Array.isArray(postings)) {
      return {
        jobs: [],
        source: 'lever',
        total: 0,
        firm: firm.name,
        error: `Lever unexpected response format for ${companyId}: expected array`,
      }
    }

    const jobs = postings
      .map((p) => normalizePosting(p, firm))
      .filter((j) => j.title)

    return {
      jobs,
      source: 'lever',
      total: jobs.length,
      firm: firm.name,
    }
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return {
        jobs: [],
        source: 'lever',
        total: 0,
        firm: firm.name,
        error: `Lever timeout for ${companyId}`,
      }
    }
    return {
      jobs: [],
      source: 'lever',
      total: 0,
      firm: firm.name,
      error: `Lever error for ${companyId}: ${err.message}`,
    }
  }
}

export { fetchLeverJobs }
