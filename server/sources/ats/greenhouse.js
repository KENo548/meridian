const BOARD_TOKENS = {
  'williamblair': 'williamblair',
  'point72': 'point72',
  'janestreet': 'janestreet',
  'optiver': 'optiverus',
  'imc': 'imc',
}

const BASE_URL = 'https://boards-api.greenhouse.io/v1/boards'

async function fetchGreenhouseJobs(firm) {
  const slug = firm.atsSlug || BOARD_TOKENS[firm.id]
  if (!slug) {
    return { jobs: [], error: `No Greenhouse board token for ${firm.name}`, source: 'greenhouse' }
  }

  const url = `${BASE_URL}/${slug}/jobs?content=true`

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      return { jobs: [], error: `Greenhouse API ${response.status} for ${slug}: ${body}`, source: 'greenhouse' }
    }

    const data = await response.json()
    const rawJobs = data.jobs || []

    const jobs = rawJobs.map(job => ({
      id: String(job.id),
      source: 'greenhouse',
      sourceJobId: String(job.id),
      company: firm.name,
      title: job.title || '',
      location: job.location?.name || '',
      country: extractCountry(job.location?.name || ''),
      url: job.absolute_url || `https://boards.greenhouse.io/${slug}/jobs/${job.id}`,
      applyUrl: job.absolute_url || `https://boards.greenhouse.io/${slug}/jobs/${job.id}`,
      description: stripHtml(job.content || ''),
      posted: job.updated_at || job.created_at || null,
      employmentType: mapEmploymentType(job),
      departments: (job.departments || []).map(d => d.name),
      offices: (job.offices || []).map(o => o.name),
      source: 'greenhouse',
    }))

    return { jobs, source: 'greenhouse', total: jobs.length, firm: firm.name }
  } catch (err) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      return { jobs: [], error: `Greenhouse timeout for ${slug}`, source: 'greenhouse' }
    }
    return { jobs: [], error: `Greenhouse error for ${slug}: ${err.message}`, source: 'greenhouse' }
  }
}

function stripHtml(html) {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 5000)
}

function extractCountry(location) {
  if (!location) return ''
  const lower = location.toLowerCase()
  const map = {
    'london': 'gb', 'united kingdom': 'gb', 'uk': 'gb',
    'new york': 'us', 'san francisco': 'us', 'chicago': 'us', 'houston': 'us', 'charlotte': 'us',
    'frankfurt': 'de', 'germany': 'de',
    'paris': 'fr', 'france': 'fr',
    'hong kong': 'hk',
    'singapore': 'sg',
    'tokyo': 'jp', 'japan': 'jp',
    'zurich': 'ch', 'switzerland': 'ch',
    'amsterdam': 'nl', 'netherlands': 'nl',
    'stockholm': 'se', 'sweden': 'se',
    'dubai': 'ae', 'uae': 'ae',
    'tel aviv': 'il', 'israel': 'il',
    'madrid': 'spain', 'spain': 'es',
    'dublin': 'ie', 'ireland': 'ie',
    'sydney': 'au', 'australia': 'au',
    'toronto': 'ca', 'canada': 'ca',
  }
  for (const [key, code] of Object.entries(map)) {
    if (lower.includes(key)) return code
  }
  return ''
}

function mapEmploymentType(job) {
  const title = (job.title || '').toLowerCase()
  if (title.includes('intern')) return 'internship'
  if (title.includes('summer analyst') || title.includes('spring week')) return 'internship'
  if (title.includes('full time') || title.includes('full-time')) return 'full_time'
  if (title.includes('part time') || title.includes('part-time')) return 'part_time'
  if (title.includes('contract')) return 'contract'
  return 'full_time'
}

export { fetchGreenhouseJobs, BOARD_TOKENS }
