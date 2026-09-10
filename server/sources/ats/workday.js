const WORKDAY_HOST_PATTERN = /^([a-z0-9]+)\.wd([0-9]+)\.myworkdayjobs\.com$/

async function fetchWorkdayJobs(firm) {
  if (!firm.workdayTenant || !firm.workdaySite) {
    return { jobs: [], error: `No Workday tenant/site for ${firm.name}`, source: 'workday' }
  }

  const tenant = firm.workdayTenant
  const site = firm.workdaySite
  const host = firm.atsSlug

  if (!host) {
    return { jobs: [], error: `No Workday host for ${firm.name}`, source: 'workday' }
  }

  const url = `https://${host}/wday/cxs/${tenant}/${site}/jobs`
  const allJobs = []
  let offset = 0
  const limit = 20
  let totalCount = null

  try {
    while (true) {
      const body = JSON.stringify({
        appliedFacets: {},
        limit,
        offset,
        searchText: '',
      })

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'Referer': `https://${host}/`,
          'Origin': `https://${host}`,
        },
        body,
        signal: AbortSignal.timeout(15000),
      })

      if (!response.ok) {
        const text = await response.text().catch(() => '')
        let hint = ''
        if (response.status === 422) {
          hint = ' — likely Cloudflare anti-bot protection or incorrect tenant/site'
        } else if (response.status === 404) {
          hint = ' — site name may have changed or Workday instance relocated'
        } else if (response.status === 500) {
          hint = ' — Workday server error, may be temporarily unavailable'
        }
        return { jobs: [], error: `Workday API ${response.status} for ${host}${hint}`, source: 'workday' }
      }

      const data = await response.json()

      if (totalCount === null) {
        totalCount = data.total || 0
      }

      const jobPostings = data.jobPostings || []
      if (jobPostings.length === 0) break

      for (const posting of jobPostings) {
        const extPath = posting.extPath || ''
        const jobUrl = `https://${host}${extPath}`

        // Extract stable job ID from extPath (e.g., "/wday/cxs/tenant/site/job/12345" → "12345")
        const extPathMatch = extPath.match(/\/job\/(\d+)/)
        const extPathJobId = extPathMatch ? extPathMatch[1] : null

        // Extract requisition ID from bulletFields if available
        const requisitionId = posting.bulletFields?.[0] || null

        // Build stable ID: prefer extPath job ID > requisition ID > hash of title+location
        let stableId
        if (extPathJobId) {
          stableId = `workday:${tenant}:${extPathJobId}`
        } else if (requisitionId && /^\d+$/.test(requisitionId)) {
          stableId = `workday:${tenant}:req:${requisitionId}`
        } else {
          // Fallback: deterministic hash of title + location to avoid offset instability
          const titleLoc = `${posting.title || ''}:${posting.locationsText || ''}`
          let hash = 0
          for (let i = 0; i < titleLoc.length; i++) {
            hash = ((hash << 5) - hash + titleLoc.charCodeAt(i)) | 0
          }
          stableId = `workday:${tenant}:h:${Math.abs(hash).toString(36)}`
        }

        allJobs.push({
          id: stableId,
          source: 'workday',
          sourceJobId: extPathJobId || requisitionId || stableId,
          company: firm.name,
          title: posting.title || '',
          location: posting.locationsText || posting.bulletFields?.[1] || '',
          country: extractCountry(posting.locationsText || ''),
          url: jobUrl,
          applyUrl: jobUrl,
          description: (posting.bulletFields || []).join(' | '),
          posted: posting.postedOn || null,
          employmentType: 'unknown',
        })
      }

      offset += limit

      if (offset >= totalCount) break
    }

    return { jobs: allJobs, source: 'workday', total: allJobs.length, firm: firm.name }
  } catch (err) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      return { jobs: [], error: `Workday timeout for ${host}`, source: 'workday' }
    }
    return { jobs: [], error: `Workday error for ${host}: ${err.message}`, source: 'workday' }
  }
}

function extractCountry(location) {
  if (!location) return ''
  const lower = location.toLowerCase()
  const map = {
    'london': 'gb', 'united kingdom': 'gb', 'uk': 'gb',
    'new york': 'us', 'san francisco': 'us', 'chicago': 'us',
    'frankfurt': 'de', 'germany': 'de',
    'paris': 'fr', 'france': 'fr',
    'hong kong': 'hk', 'singapore': 'sg',
    'tokyo': 'jp', 'japan': 'jp',
    'zurich': 'ch', 'switzerland': 'ch',
    'dubai': 'ae', 'uae': 'ae',
    'dublin': 'ie', 'ireland': 'ie',
    'sydney': 'au', 'australia': 'au',
    'toronto': 'ca', 'canada': 'ca',
  }
  for (const [key, code] of Object.entries(map)) {
    if (lower.includes(key)) return code
  }
  return ''
}

export { fetchWorkdayJobs }
