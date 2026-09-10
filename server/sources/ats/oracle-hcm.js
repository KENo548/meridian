/**
 * Oracle HCM Candidate Experience API Adapter
 * 
 * Fetches jobs from Oracle's public Candidate Experience REST API.
 * No authentication required.
 * 
 * Known employers: Goldman Sachs, JPMorgan Chase, Schroders, Lazard (disabled)
 * 
 * API Pattern:
 * GET https://{hostname}/hcmRestApi/resources/latest/recruitingCEJobRequisitions
 *   ?onlyData=true&expand=requisitionList&finder=findReqs;siteNumber={site},limit={n},offset={n}
 */

const DEFAULT_LIMIT = 200

// Known Oracle HCM configurations
const ORACLE_CONFIGS = {
  'goldman-sachs': {
    hostname: 'hdpc.fa.us2.oraclecloud.com',
    siteNumber: 'LateralHiring',
  },
  'jpmorgan': {
    hostname: 'jpmc.fa.oraclecloud.com',
    siteNumber: 'CX_1001',
  },
  'schroders': {
    hostname: 'icbpjb.fa.ocs.oraclecloud.com',
    siteNumber: 'CX_1001',
  },
  'lazard': {
    hostname: 'icbpjb.fa.ocs.oraclecloud.com',
    siteNumber: 'CX_3',
  },
}

function buildApiUrl(hostname, siteNumber, opts = {}) {
  const params = new URLSearchParams({
    onlyData: 'true',
    expand: 'requisitionList',
  })

  const finderParts = [`siteNumber=${siteNumber}`]
  if (opts.limit) finderParts.push(`limit=${opts.limit}`)
  if (opts.offset !== undefined) finderParts.push(`offset=${opts.offset}`)
  if (opts.keyword) finderParts.push(`keyword=${encodeURIComponent(opts.keyword)}`)
  if (opts.location) finderParts.push(`location=${encodeURIComponent(opts.location)}`)

  params.set('finder', `findReqs;${finderParts.join(',')}`)

  return `https://${hostname}/hcmRestApi/resources/latest/recruitingCEJobRequisitions?${params.toString()}`
}

function mapEmploymentType(job) {
  const text = `${job.Title || ''} ${job.JobFamily || ''} ${job.JobFunction || ''}`.toLowerCase()
  if (text.includes('intern') || text.includes('internship') || text.includes('co-op')) return 'internship'
  if (text.includes('apprentice') || text.includes('training')) return 'apprenticeship'
  return 'full_time'
}

function extractCountry(location) {
  if (!location) return ''
  const lower = location.toLowerCase()
  if (lower.includes('london') || lower.includes('united kingdom') || lower.includes('uk')) return 'gb'
  if (lower.includes('new york') || lower.includes('san francisco') || lower.includes('chicago') || lower.includes('houston') || lower.includes('charlotte') || lower.includes('plano') || lower.includes('columbus')) return 'us'
  if (lower.includes('frankfurt') || lower.includes('germany')) return 'de'
  if (lower.includes('paris') || lower.includes('france')) return 'fr'
  if (lower.includes('hong kong')) return 'hk'
  if (lower.includes('singapore')) return 'sg'
  if (lower.includes('tokyo') || lower.includes('japan')) return 'jp'
  if (lower.includes('sydney') || lower.includes('melbourne') || lower.includes('australia')) return 'au'
  if (lower.includes('zurich') || lower.includes('switzerland')) return 'ch'
  if (lower.includes('mumbai') || lower.includes('india')) return 'in'
  if (lower.includes('bahrain')) return 'bh'
  if (lower.includes('dubai') || lower.includes('uae')) return 'ae'
  if (lower.includes('dublin') || lower.includes('ireland')) return 'ie'
  if (lower.includes('toronto') || lower.includes('canada')) return 'ca'
  return ''
}

function stripHtml(html) {
  if (!html) return ''
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 5000)
}

async function fetchOracleHcmJobs(firm, opts = {}) {
  const config = ORACLE_CONFIGS[firm.id] || {}
  const hostname = config.hostname || firm.atsHostname
  const siteNumber = config.siteNumber || firm.atsSiteNumber

  if (!hostname || !siteNumber) {
    return {
      jobs: [],
      error: `No Oracle HCM config for ${firm.name} (need hostname + siteNumber)`,
      source: 'oracle_hcm',
    }
  }

  const limit = opts.limit || DEFAULT_LIMIT
  let offset = 0
  const allJobs = []
  let totalReported = null
  let pagesFetched = 0
  const maxPages = 10 // Safety limit: 2000 jobs max

  try {
    while (pagesFetched < maxPages) {
      const url = buildApiUrl(hostname, siteNumber, { limit, offset })
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        },
        signal: AbortSignal.timeout(20000),
      })

      if (!response.ok) {
        const body = await response.text().catch(() => '')
        return {
          jobs: allJobs,
          error: `Oracle HCM API ${response.status} for ${hostname}: ${body.substring(0, 200)}`,
          source: 'oracle_hcm',
          total: totalReported,
        }
      }

      const data = await response.json()
      const items = data.items || []
      
      if (items.length === 0) break

      const firstItem = items[0] || {}
      const requisitionList = firstItem.requisitionList || []
      
      if (totalReported === null) {
        totalReported = firstItem.TotalJobsCount || 0
      }

      if (requisitionList.length === 0) break

      for (const job of requisitionList) {
        const location = job.PrimaryLocation || ''
        allJobs.push({
          id: String(job.Id || ''),
          source: 'oracle_hcm',
          sourceJobId: String(job.Id || ''),
          company: firm.name,
          title: job.Title || '',
          location: location,
          country: extractCountry(location),
          url: `https://${hostname}/hcmUI/CandidateExperience/en/sites/CX_1001/requisitions/${job.Id}`,
          applyUrl: `https://${hostname}/hcmUI/CandidateExperience/en/sites/CX_1001/requisitions/${job.Id}`,
          description: stripHtml(job.ShortDescriptionStr || ''),
          posted: job.PostedDate || null,
          employmentType: mapEmploymentType(job),
          departments: job.Department ? [job.Department] : [],
          offices: job.PrimaryLocation ? [job.PrimaryLocation] : [],
          source: 'oracle_hcm',
        })
      }

      pagesFetched++
      offset += limit

      // Stop if we've fetched all jobs
      if (totalReported && offset >= totalReported) break
      if (requisitionList.length < limit) break
    }

    return {
      jobs: allJobs,
      source: 'oracle_hcm',
      total: totalReported || allJobs.length,
      firm: firm.name,
      pagesFetched,
    }
  } catch (err) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      return {
        jobs: allJobs,
        error: `Oracle HCM timeout for ${hostname}`,
        source: 'oracle_hcm',
        total: totalReported,
      }
    }
    return {
      jobs: allJobs,
      error: `Oracle HCM error for ${hostname}: ${err.message}`,
      source: 'oracle_hcm',
      total: totalReported,
    }
  }
}

export { fetchOracleHcmJobs, ORACLE_CONFIGS }
