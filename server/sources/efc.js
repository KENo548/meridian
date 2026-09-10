import { normalizeBatch } from './normalize.js'

const EFC_API_BASE = 'https://www.efinancialcareers.com/v1/efc/jobs/search'
const EFC_ENABLED = process.env.EFC_ENABLED === 'true'

async function searchEFC({ query, country = 'gb', page = 1, pageSize = 50 }) {
  if (!EFC_ENABLED) {
    return { jobs: [], source: 'efc', error: 'EFC is disabled (set EFC_ENABLED=true)', total: 0 }
  }

  const params = new URLSearchParams({
    countryCode2: country.toUpperCase(),
    page: String(page),
    pageSize: String(Math.min(pageSize, 50)),
  })

  if (query) params.set('q', query)

  const url = `${EFC_API_BASE}?${params.toString()}`

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Meridian-Job-Tracker/1.0',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      return { jobs: [], source: 'efc', error: `EFC API ${response.status}: ${body}`, total: 0 }
    }

    const data = await response.json()
    const rawJobs = data.results || data.jobs || data || []

    const jobs = normalizeBatch(
      rawJobs.map(job => ({
        id: job.id || job.jobId || job.identifier || '',
        title: job.title || job.jobTitle || '',
        company: job.company || job.employer || '',
        location: job.location || job.area || '',
        country: job.countryCode || country,
        url: job.url || job.applyUrl || job.link || '',
        description: job.description || job.snippet || '',
        posted: job.datePosted || job.created || null,
        deadline: job.dateClosing || job.deadline || null,
        type: job.type || job.contractType || null,
      })),
      'efc'
    )

    return { jobs, source: 'efc', total: jobs.length, query: query || '' }
  } catch (err) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      return { jobs: [], source: 'efc', error: 'EFC API timed out', total: 0 }
    }
    return { jobs: [], source: 'efc', error: `EFC error: ${err.message}`, total: 0 }
  }
}

export { searchEFC }
