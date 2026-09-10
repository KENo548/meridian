async function fetchSuccessFactorsJobs(firm) {
  const config = firm.successfactors
  if (!config || !config.searchUrl) {
    return { jobs: [], error: `No SuccessFactors config for ${firm.name}`, source: 'successfactors' }
  }

  const { searchUrl, companyId } = config

  try {
    const resp = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Meridian-Job-Tracker/1.0',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(20000),
      redirect: 'follow',
    })

    if (!resp.ok) {
      return { jobs: [], error: `SuccessFactors HTTP ${resp.status} for ${firm.name}`, source: 'successfactors' }
    }

    const html = await resp.text()
    const jobs = parseJobListings(html, firm.name)

    return { jobs, source: 'successfactors', total: jobs.length, firm: firm.name }
  } catch (err) {
    return { jobs: [], error: `SuccessFactors error for ${firm.name}: ${err.message}`, source: 'successfactors' }
  }
}

function parseJobListings(html, companyName) {
  const jobs = []

  // Pattern 1: Look for job listing cards/items in HTML
  // SuccessFactors career sites typically have job cards with title, location, and link
  const jobCardPattern = /<a[^>]*href="([^"]*\/job\/[^"]*)"[^>]*>([^<]+)<\/a>/gi
  let match

  while ((match = jobCardPattern.exec(html)) !== null) {
    const url = match[1]
    const title = match[2].trim()
    if (title.length > 5 && title.length < 200) {
      const id = extractIdFromUrl(url)
      jobs.push({
        id: `sf:${id}`,
        source: 'successfactors',
        sourceJobId: id,
        company: companyName,
        title,
        location: '',
        country: '',
        url: normalizeUrl(url),
        applyUrl: normalizeUrl(url),
        description: '',
        posted: null,
        deadline: null,
        employmentType: mapEmploymentType(title),
      })
    }
  }

  // Pattern 2: Look for JSON-LD structured data
  const jsonLdPattern = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
  while ((match = jsonLdPattern.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1])
      if (data['@type'] === 'JobPosting' || data.itemListElement) {
        const items = data.itemListElement || [data]
        for (const item of items) {
          if (item.url || item.name) {
            const id = extractIdFromUrl(item.url || '')
            jobs.push({
              id: `sf:${id}`,
              source: 'successfactors',
              sourceJobId: id,
              company: companyName,
              title: item.name || '',
              location: item.jobLocation?.address?.addressLocality || '',
              country: item.jobLocation?.address?.addressCountry || '',
              url: item.url || '',
              applyUrl: item.url || '',
              description: item.description || '',
              posted: item.datePosted || null,
              deadline: item.validThrough || null,
              employmentType: mapEmploymentType(item.name || ''),
            })
          }
        }
      }
    } catch (e) {
      // invalid JSON-LD, skip
    }
  }

  // Pattern 3: Look for requisition IDs in HTML
  const reqIdPattern = /(?:requisition|req|job)[\s_-]*(?:id|#)[:\s]*(\d{4,})/gi
  const reqIds = new Set()
  while ((match = reqIdPattern.exec(html)) !== null) {
    reqIds.add(match[1])
  }

  // Deduplicate by sourceJobId
  const seen = new Set()
  return jobs.filter(j => {
    if (seen.has(j.sourceJobId)) return false
    seen.add(j.sourceJobId)
    return true
  })
}

function extractIdFromUrl(url) {
  if (!url) return 'unknown'
  const match = url.match(/\/job\/(\d+)/)
  if (match) return match[1]
  const idMatch = url.match(/[?&](?:jobId|reqId|requisitionId)=(\d+)/)
  if (idMatch) return idMatch[1]
  return Buffer.from(url).toString('base64').slice(0, 20)
}

function normalizeUrl(url) {
  if (!url) return ''
  if (url.startsWith('http')) return url
  // Handle relative URLs
  return url
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

export { fetchSuccessFactorsJobs }
