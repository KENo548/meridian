import Parser from 'rss-parser'

const parser = new Parser({
  timeout: 15000,
  headers: { 'User-Agent': 'Meridian-Job-Tracker/1.0' },
})

const EIGHTFOLD_API_PATH = '/api/apply/v2/jobs'
const EIGHTFOLD_SITEMAP_PATH = '/careers/sitemap.xml'
const PAGE_SIZE = 50

async function fetchEightfoldJobs(firm) {
  const config = firm.eightfold
  if (!config || !config.domain) {
    return { jobs: [], error: `No Eightfold config for ${firm.name}`, source: 'eightfold' }
  }

  const { domain, slug } = config
  const host = `https://${slug || domain}.eightfold.ai`

  // Try API first
  try {
    const jobs = await fetchViaApi(host, domain)
    if (jobs.length > 0) {
      return { jobs, source: 'eightfold', total: jobs.length, firm: firm.name }
    }
  } catch (err) {
    // API blocked, try sitemap fallback
  }

  // Fallback: sitemap + detail pages
  try {
    const jobs = await fetchViaSitemap(host, domain, firm.name)
    return { jobs, source: 'eightfold', total: jobs.length, firm: firm.name }
  } catch (err) {
    return { jobs: [], error: `Eightfold error for ${firm.name}: ${err.message}`, source: 'eightfold' }
  }
}

async function fetchViaApi(host, domain) {
  const allJobs = []
  let start = 0

  while (start < 1000) {
    const url = `${host}${EIGHTFOLD_API_PATH}?domain=${domain}&start=${start}&num=${PAGE_SIZE}&sort_by=timestamp`
    const resp = await fetch(url, {
      headers: { 'User-Agent': 'Meridian-Job-Tracker/1.0' },
      signal: AbortSignal.timeout(15000),
    })

    if (!resp.ok) {
      throw new Error(`Eightfold API ${resp.status}`)
    }

    const data = await resp.json()
    const positions = data.positions || []
    if (positions.length === 0) break

    for (const pos of positions) {
      allJobs.push(normalizeApiJob(pos, domain))
    }

    start += PAGE_SIZE
    if (positions.length < PAGE_SIZE) break
  }

  return allJobs
}

async function fetchViaSitemap(host, domain, companyName) {
  const sitemapUrl = `${host}${EIGHTFOLD_SITEMAP_PATH}`
  const resp = await fetch(sitemapUrl, {
    headers: { 'User-Agent': 'Meridian-Job-Tracker/1.0' },
    signal: AbortSignal.timeout(15000),
  })

  if (!resp.ok) {
    throw new Error(`Eightfold sitemap ${resp.status}`)
  }

  const xml = await resp.text()
  const jobs = []

  // Extract job URLs from sitemap
  const urlPattern = /<loc>([^<]+)<\/loc>/g
  const lastmodPattern = /<lastmod>([^<]+)<\/lastmod>/g
  const urls = []
  const lastmods = []
  let match

  while ((match = urlPattern.exec(xml)) !== null) {
    urls.push(match[1])
  }
  while ((match = lastmodPattern.exec(xml)) !== null) {
    lastmods.push(match[1])
  }

  // Filter to job URLs only
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]
    if (!url.includes('/careers/job/')) continue

    const id = extractIdFromUrl(url)
    const lastmod = lastmods[i] || null

    jobs.push({
      id: `eightfold:${id}`,
      source: 'eightfold',
      sourceJobId: id,
      company: companyName,
      title: extractTitleFromUrl(url),
      location: '',
      country: '',
      url,
      applyUrl: url,
      description: '',
      posted: lastmod,
      deadline: null,
      employmentType: 'unknown',
    })
  }

  return jobs
}

function normalizeApiJob(pos, domain) {
  const id = pos.ats_job_id || String(pos.id)
  const url = pos.canonicalPositionUrl || `https://${domain}.eightfold.ai/careers/job/${pos.id}`

  return {
    id: `eightfold:${id}`,
    source: 'eightfold',
    sourceJobId: id,
    company: '',
    title: pos.name || '',
    location: pos.location || '',
    country: extractCountryFromLocation(pos.location || ''),
    url,
    applyUrl: url,
    description: pos.job_description || '',
    posted: pos.t_update ? new Date(pos.t_update * 1000).toISOString() : null,
    deadline: null,
    employmentType: mapEmploymentType(pos.name || ''),
  }
}

function extractIdFromUrl(url) {
  const match = url.match(/\/careers\/job\/(\d+)/)
  if (match) return match[1]
  const idMatch = url.match(/[?&]id=(\d+)/)
  if (idMatch) return idMatch[1]
  return Buffer.from(url).toString('base64').slice(0, 20)
}

function extractTitleFromUrl(url) {
  const match = url.match(/\/careers\/job\/\d+-(.+?)(?:\?|$)/)
  if (match) return match[1].replace(/-/g, ' ')
  return ''
}

function extractCountryFromLocation(location) {
  if (!location) return ''
  const lower = location.toLowerCase()
  const map = {
    'london': 'gb', 'new york': 'us', 'san francisco': 'us', 'chicago': 'us',
    'houston': 'us', 'charlotte': 'us', 'frankfurt': 'de', 'paris': 'fr',
    'amsterdam': 'nl', 'zurich': 'ch', 'madrid': 'es', 'stockholm': 'se',
    'hong kong': 'hk', 'singapore': 'sg', 'tokyo': 'jp', 'dubai': 'ae',
    'tel aviv': 'il', 'dublin': 'ie', 'sydney': 'au', 'toronto': 'ca',
  }
  for (const [key, code] of Object.entries(map)) {
    if (lower.includes(key)) return code
  }
  return ''
}

function mapEmploymentType(title) {
  const lower = (title || '').toLowerCase()
  if (lower.includes('intern') || lower.includes('spring week')) return 'internship'
  if (lower.includes('off-cycle')) return 'internship'
  if (lower.includes('summer analyst') || lower.includes('summer associate')) return 'internship'
  if (lower.includes('graduate programme') || lower.includes('graduate program')) return 'full_time'
  if (lower.includes('full time') || lower.includes('full-time')) return 'full_time'
  return 'unknown'
}

export { fetchEightfoldJobs }
