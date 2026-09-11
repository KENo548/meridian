/**
 * AnalystClass DACH adapter
 * Scrapes analystclass.com/internships/dach (and other regions)
 * for verified investment banking internship opportunities.
 *
 * Each record links to the employer's own posting and carries
 * a last-checked date. Data is server-rendered HTML.
 *
 * Regions: dach, uk-and-ireland, france, nordics, cee, iberia, italy
 */

const BASE_URL = 'https://analystclass.com/internships'
const TIMEOUT_MS = 15000
const SOURCE = 'analystclass'

const REGIONS = ['dach', 'uk-and-ireland', 'france', 'nordics', 'cee', 'iberia', 'italy']

// ─── HTML Parsing (no cheerio — regex-based) ────────────────────

function extractTableRows(html) {
  const rows = []

  // Table structure: <tr> contains <th> (firm) + 6 <td> (programme, location, status, deadline, lastChecked, source)
  // Status is in a <span> inside the 4th cell; source is in <a> tag
  const trRegex = /<tr[^>]*>\s*<th[^>]*>([\s\S]*?)<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/gi

  let match
  while ((match = trRegex.exec(html)) !== null) {
    rows.push({
      firm: stripHtml(match[1]),
      programme: stripHtml(match[2]),
      location: stripHtml(match[3]),
      status: stripHtml(match[4]),
      deadline: stripHtml(match[5]),
      lastChecked: stripHtml(match[6]),
      sourceUrl: extractFirstUrl(match[7]) || '',
      sourceLabel: stripHtml(match[7]),
    })
  }

  return rows
}

function extractFromStructuredData(html) {
  const entries = []

  // Look for application/ld+json with Dataset type (AnalystClass uses this)
  const jsonLdRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
  let match

  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1])
      if (data['@type'] === 'Dataset') {
        // Found the dataset — extract description for metadata
        entries.push({
          _dataset: true,
          name: data.name || '',
          description: data.description || '',
          dateModified: data.dateModified || '',
        })
      }
    } catch {}
  }

  return entries
}

function extractFromTextBlocks(html) {
  // Fallback: extract from visible text patterns like "Firm | Programme | Location | Status | Deadline | Last checked | Source"
  const entries = []
  const text = html.replace(/<[^>]+>/g, '\n').replace(/\n\s*\n/g, '\n')

  // Look for lines that look like table rows (contain " | " separators)
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  for (const line of lines) {
    if (line.includes(' | ') && line.split(' | ').length >= 5) {
      const parts = line.split(' | ').map(p => p.trim())
      if (parts.length >= 6) {
        entries.push({
          firm: parts[0],
          programme: parts[1],
          location: parts[2],
          status: parts[3],
          deadline: parts[4],
          lastChecked: parts[5],
          sourceUrl: '',
          sourceLabel: parts[6] || '',
        })
      }
    }
  }

  return entries
}

function stripHtml(html) {
  return (html || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractFirstUrl(html) {
  const match = (html || '').match(/href="([^"]*?)"/i)
  return match ? match[1] : ''
}

// ─── Status Mapping ─────────────────────────────────────────────

function normalizeStatus(raw) {
  const lower = (raw || '').toLowerCase().trim()
  if (lower.includes('open now') || lower === 'open') return 'open'
  if (lower.includes('opening soon')) return 'opening_soon'
  if (lower.includes('rolling')) return 'rolling'
  if (lower.includes('closed')) return 'closed'
  if (lower.includes('unconfirmed') || lower.includes('programme')) return 'unconfirmed'
  return 'unknown'
}

function isCurrentlyOpen(status) {
  return status === 'open' || status === 'rolling' || status === 'opening_soon'
}

// ─── Location Parsing ───────────────────────────────────────────

function parseLocation(raw) {
  const cleaned = (raw || '')
    .replace(/DACH/gi, '')
    .replace(/Multiple/gi, '')
    .replace(/UK\s*&\s*Ireland/gi, '')
    .trim()
    .replace(/\s+/g, ' ')

  // Extract city and region
  const cities = []
  const regionMatch = cleaned.match(/\b(Frankfurt|Munich|Zurich|Vienna|Berlin|Hamburg|London|Paris|Madrid|Milan|Stockholm|Helsinki|Prague|Warsaw|Lisbon|Amsterdam|Dublin|Multiple)\b/gi)
  if (regionMatch) {
    cities.push(...regionMatch)
  }

  return {
    raw: cleaned || 'DACH',
    city: cities[0] || '',
    region: 'DACH',
  }
}

// ─── Deadline Parsing ───────────────────────────────────────────

function parseDeadline(raw) {
  if (!raw || raw.toLowerCase().includes('not stated') || raw.toLowerCase().includes('not publicly')) {
    return null
  }
  if (raw.toLowerCase().includes('rolling')) {
    return null // Rolling — no fixed deadline
  }

  // Try to parse date strings like "31 December 2026" or "6 August 2026"
  try {
    const date = new Date(raw)
    if (!isNaN(date.getTime())) {
      return date.toISOString()
    }
  } catch {}

  return null
}

// ─── Main Fetch Function ────────────────────────────────────────

async function fetchAnalystClassRegion(region = 'dach') {
  const url = `${BASE_URL}/${region}`

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!response.ok) {
      return { entries: [], source: SOURCE, total: 0, error: `AnalystClass HTTP ${response.status} for ${region}` }
    }

    const html = await response.text()

    if (!html || html.length < 500) {
      return { entries: [], source: SOURCE, total: 0, error: `AnalystClass empty content for ${region}` }
    }

    let rows = extractTableRows(html)

    if (rows.length === 0) {
      rows = extractFromTextBlocks(html)
    }

    const entries = rows
      .filter(r => r.firm && r.firm.length > 1)
      .map(r => normalizeEntry(r, region))

    return {
      entries,
      source: SOURCE,
      total: entries.length,
      region,
    }
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return { entries: [], source: SOURCE, total: 0, error: `AnalystClass timeout for ${region}` }
    }
    return { entries: [], source: SOURCE, total: 0, error: `AnalystClass error for ${region}: ${err.message}` }
  }
}

function normalizeEntry(row, region) {
  const status = normalizeStatus(row.status)
  const location = parseLocation(row.location)
  const deadline = parseDeadline(row.deadline)

  return {
    id: `analystclass:${region}:${ slugify(row.firm) }:${ slugify(row.programme) }`,
    source: SOURCE,
    sourceJobId: `${region}:${slugify(row.firm)}:${slugify(row.programme)}`,
    company: row.firm,
    programme: row.programme,
    programmeName: row.programme,
    location: location.raw,
    city: location.city,
    region: region.toUpperCase(),
    country: mapRegionToCountry(region),
    status,
    deadline,
    deadlineRaw: row.deadline,
    lastChecked: row.lastChecked,
    sourceUrl: row.sourceUrl,
    employerUrl: row.sourceUrl, // AnalystClass sourceUrl IS the employer posting
    rolling: status === 'rolling',
    isOpen: isCurrentlyOpen(status),
    category: 'investment_banking',
  }
}

function slugify(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60)
}

function mapRegionToCountry(region) {
  const map = {
    'dach': 'de',
    'uk-and-ireland': 'gb',
    'france': 'fr',
    'nordics': 'se',
    'cee': 'cz',
    'iberia': 'es',
    'italy': 'it',
  }
  return map[region] || ''
}

// ─── Aggregate Fetch (all regions) ──────────────────────────────

async function fetchAnalystClass(options = {}) {
  const { regions = REGIONS } = options
  const allEntries = []
  const errors = []

  for (const region of regions) {
    const result = await fetchAnalystClassRegion(region)
    if (result.entries) allEntries.push(...result.entries)
    if (result.error) errors.push({ region, error: result.error })
  }

  return {
    entries: allEntries,
    source: SOURCE,
    total: allEntries.length,
    regions: regions.length,
    errors: errors.length > 0 ? errors : undefined,
  }
}

export { fetchAnalystClass, fetchAnalystClassRegion, REGIONS, normalizeStatus, isCurrentlyOpen }
