const TRACKER_URL = 'https://fyntraq.io/tracker'
const TIMEOUT_MS = 15000
const SOURCE = 'fyntraq'

function extractTableRows(html) {
  const rows = []
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let trMatch

  while ((trMatch = trRegex.exec(html)) !== null) {
    const trContent = trMatch[1]
    const cells = []
    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi
    let tdMatch

    while ((tdMatch = tdRegex.exec(trContent)) !== null) {
      cells.push(tdMatch[1].replace(/<[^>]+>/g, '').trim())
    }

    if (cells.length >= 3) {
      rows.push(cells)
    }
  }

  return rows
}

function extractLinks(html) {
  const links = {}
  const linkRegex = /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi
  let match

  while ((match = linkRegex.exec(html)) !== null) {
    const text = match[2].replace(/<[^>]+>/g, '').trim()
    const href = match[1]
    if (text && href && href.startsWith('http')) {
      links[text.toLowerCase()] = href
    }
  }

  return links
}

function extractFromRscPayload(html) {
  const entries = []
  const rscRegex = /\["([^"]+)",\s*\{[^}]*"company":\s*"([^"]*)"[^}]*"role":\s*"([^"]*)"[^}]*\}/g
  let match

  while ((match = rscRegex.exec(html)) !== null) {
    entries.push({
      company: match[2],
      programme: match[3],
      location: '',
      applyUrl: match[1],
    })
  }

  return entries
}

function extractFromStructuredData(html) {
  const entries = []
  const jsonLdRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
  let match

  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1])
      if (data['@type'] === 'JobPosting' || data.itemListElement) {
        entries.push({
          company: data.hiringOrganization?.name || '',
          programme: data.title || '',
          location: data.jobLocation?.address?.addressLocality || '',
          applyUrl: data.url || data.applyUrl || '',
        })
      }
    } catch {}
  }

  return entries
}

function extractFromBodyText(html) {
  const entries = []
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

  const companyRolePattern = /([A-Z][A-Za-z\s&.]+?)\s*[-–—]\s*([A-Z][A-Za-z\s/]+?)(?:\s+(?:in|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*))?/g
  let match

  while ((match = companyRolePattern.exec(text)) !== null) {
    if (match[1].length > 2 && match[1].length < 50 && match[2].length > 2) {
      entries.push({
        company: match[1].trim(),
        programme: match[2].trim(),
        location: match[3] || '',
        applyUrl: null,
      })
    }
  }

  return entries
}

async function fetchFyntraq() {
  try {
    const response = await fetch(TRACKER_URL, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!response.ok) {
      return {
        entries: [],
        source: SOURCE,
        total: 0,
        error: `Fyntraq HTTP ${response.status}`,
      }
    }

    const html = await response.text()

    if (!html || html.length < 100) {
      return {
        entries: [],
        source: SOURCE,
        total: 0,
        error: 'Fyntraq returned empty content',
      }
    }

    let entries = extractFromRscPayload(html)

    if (entries.length === 0) {
      entries = extractFromStructuredData(html)
    }

    if (entries.length === 0) {
      const rows = extractTableRows(html)
      entries = rows.map(cells => ({
        company: cells[0],
        programme: cells[1] || '',
        location: cells[2] || '',
        applyUrl: cells[3] || null,
      }))
    }

    if (entries.length === 0) {
      entries = extractFromBodyText(html)
    }

    entries = entries.filter(e => e.company && e.company.length > 1)

    return {
      entries,
      source: SOURCE,
      total: entries.length,
    }
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return {
        entries: [],
        source: SOURCE,
        total: 0,
        error: 'Fyntraq request timed out',
      }
    }
    return {
      entries: [],
      source: SOURCE,
      total: 0,
      error: `Fyntraq error: ${err.message}`,
    }
  }
}

export { fetchFyntraq, extractTableRows, extractLinks }
