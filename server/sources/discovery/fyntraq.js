/**
 * Fyntraq blog adapter
 * Scrapes Fyntraq's SEO blog pages for finance internship listings.
 *
 * Blog pages expose:
 * - JSON-LD ItemList with top 10 most recently detected roles
 * - HTML list items with company, title, location, contract type
 * - Summary stats (total open positions, firms hiring, cities)
 *
 * Limitation: Blog pages show only ~10 recent listings, not the full
 * tracker dataset (500+ roles). The tracker SPA requires client-side
 * rendering. This adapter provides recent listings as supplementary data.
 *
 * Pages scraped:
 * - /investment-banking-internships-europe (IB roles)
 * - /private-equity-internships-europe (PE roles)
 * - /finance-summer-internships-2027 (Summer 2027 roles)
 */

const BLOG_PAGES = [
  { url: 'https://fyntraq.io/investment-banking-internships-europe', category: 'investment_banking', specialty: 'IB' },
  { url: 'https://fyntraq.io/private-equity-internships-europe', category: 'private_equity', specialty: 'PE' },
  { url: 'https://fyntraq.io/finance-summer-internships-2027', category: 'summer_internship', specialty: 'Summer' },
]

const TIMEOUT_MS = 15000
const SOURCE = 'fyntraq'

// ─── HTML Parsing ───────────────────────────────────────────────

function extractJsonLdList(html) {
  const entries = []
  const jsonLdRegex = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
  let match

  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1])
      if (data['@type'] === 'ItemList' && data.itemListElement) {
        for (const item of data.itemListElement) {
          // Name format: "Role Title at Company Name"
          const name = item.name || ''
          const atMatch = name.match(/^(.+?)\s+at\s+(.+)$/)
          if (atMatch) {
            entries.push({
              programme: atMatch[1].trim(),
              company: atMatch[2].trim(),
              position: item.position,
            })
          } else {
            // Fallback: treat whole name as programme, company unknown
            entries.push({
              programme: name,
              company: '',
              position: item.position,
            })
          }
        }
      }
    } catch {}
  }

  return entries
}

function extractFromListItems(html) {
  const entries = []

  // Pattern: <li><a ... href="..."><div ...>logo</div><div class="min-w-0 flex-1">
  //   <p class="...font-semibold...">TITLE</p>
  //   <p class="...text-xs...">COMPANY · [map-pin SVG] LOCATION</p>
  // </div><span class="...">CONTRACT_TYPE</span>...</a></li>
  const liRegex = /<li[^>]*>\s*<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>\s*<\/li>/gi
  let match

  while ((match = liRegex.exec(html)) !== null) {
    const href = match[1]
    const content = match[2]

    // Only process job-like list items (have font-semibold title and map-pin for location)
    if (!content.includes('font-semibold') || !content.includes('map-pin')) continue

    // Extract title (first font-semibold paragraph)
    const titleMatch = content.match(/<p[^>]*class="[^"]*font-semibold[^"]*"[^>]*>([\s\S]*?)<\/p>/i)
    const title = titleMatch ? stripHtml(titleMatch[1]) : ''

    // Extract company and location from text-xs paragraph
    // Structure: COMPANY<!-- --> · <svg...map-pin...>...</svg> <!-- -->LOCATION
    const metaMatch = content.match(/<p[^>]*class="[^"]*text-xs[^"]*"[^>]*>([\s\S]*?)<\/p>/i)
    let company = ''
    let location = ''
    if (metaMatch) {
      const metaHtml = metaMatch[1]
      // Split on the SVG element (map pin icon) to separate company from location
      const svgParts = metaHtml.split(/<svg[\s\S]*?<\/svg>/i)
      if (svgParts.length >= 2) {
        // Before SVG = company · (with trailing separator and HTML comments)
        company = stripHtml(svgParts[0]).replace(/\s*·\s*$/, '').trim()
        // After SVG = location (may have leading HTML comment)
        location = stripHtml(svgParts[1]).trim()
      } else {
        // No SVG found, try splitting on "·"
        const metaText = stripHtml(metaHtml)
        const parts = metaText.split('·').map(p => p.trim())
        if (parts.length >= 2) {
          company = parts[0]
          location = parts[1]
        } else {
          company = metaText
        }
      }
    }

    // Extract contract type badge (hidden on mobile via sm:inline-flex)
    const badgeMatch = content.match(/<span[^>]*class="[^"]*rounded-md[^"]*"[^>]*>([\s\S]*?)<\/span>/i)
    const contractType = badgeMatch ? stripHtml(badgeMatch[1]) : ''

    if (title || company) {
      entries.push({
        programme: title,
        company,
        location,
        contractType,
        trackerUrl: href.startsWith('http') ? href : `https://fyntraq.io${href}`,
      })
    }
  }

  return entries
}

function extractMetaStats(html) {
  const stats = {}

  // Extract total open positions from meta description or visible text
  const posMatch = html.match(/(\d[\d,]*)\s*(?:open\s+)?positions?\s+across/i)
  if (posMatch) stats.totalPositions = parseInt(posMatch[1].replace(/,/g, ''))

  const firmMatch = html.match(/(\d[\d,]*)\s*firms?/i)
  if (firmMatch) stats.totalFirms = parseInt(firmMatch[1].replace(/,/g, ''))

  const cityMatch = html.match(/(\d[\d,]*)\s*cities?/i)
  if (cityMatch) stats.totalCities = parseInt(cityMatch[1].replace(/,/g, ''))

  return stats
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

// ─── Location Parsing ───────────────────────────────────────────

function parseLocation(raw) {
  const cleaned = (raw || '').trim()
  const cities = []
  const cityPatterns = [
    'London', 'Paris', 'Frankfurt', 'Munich', 'Milan', 'Zurich',
    'Vienna', 'Berlin', 'Hamburg', 'Amsterdam', 'Madrid', 'Barcelona',
    'Stockholm', 'Helsinki', 'Dublin', 'Singapore', 'Hong Kong',
    'New York', 'San Francisco', 'Chicago',
  ]

  for (const city of cityPatterns) {
    if (cleaned.toLowerCase().includes(city.toLowerCase())) {
      cities.push(city)
    }
  }

  return {
    raw: cleaned,
    city: cities[0] || '',
    country: mapCityToCountry(cities[0] || ''),
  }
}

function mapCityToCountry(city) {
  const map = {
    'London': 'gb', 'Paris': 'fr', 'Frankfurt': 'de', 'Munich': 'de',
    'Milan': 'it', 'Zurich': 'ch', 'Vienna': 'at', 'Berlin': 'de',
    'Hamburg': 'de', 'Amsterdam': 'nl', 'Madrid': 'es', 'Barcelona': 'es',
    'Stockholm': 'se', 'Helsinki': 'fi', 'Dublin': 'ie',
    'Singapore': 'sg', 'Hong Kong': 'hk',
    'New York': 'us', 'San Francisco': 'us', 'Chicago': 'us',
  }
  return map[city] || ''
}

// ─── Specialty Detection ────────────────────────────────────────

function detectSpecialty(title, programme) {
  const text = `${title} ${programme}`.toLowerCase()
  const specialties = []

  if (text.includes('m&a') || text.includes('merger') || text.includes('acquisition')) specialties.push('M&A')
  if (text.includes('levfin') || text.includes('leveraged')) specialties.push('LevFin')
  if (text.includes('ecm') || text.includes('equity capital')) specialties.push('ECM')
  if (text.includes('dcm') || text.includes('debt capital')) specialties.push('DCM')
  if (text.includes('private equity') || text.includes('pe ') || text.includes('buyout')) specialties.push('PE')
  if (text.includes('growth')) specialties.push('PE Growth')
  if (text.includes('sales') && text.includes('trading')) specialties.push('S&T')
  if (text.includes('asset management') || text.includes('am ')) specialties.push('AM')
  if (text.includes('venture capital') || text.includes('vc ')) specialties.push('VC')
  if (text.includes('restructur')) specialties.push('Restructuring')
  if (text.includes('infrastructure') || text.includes('real estate')) specialties.push('Infra/RE')
  if (text.includes('corporate finance')) specialties.push('Corporate Finance')
  if (text.includes('investment banking') || text.includes('ib ')) specialties.push('IB')

  return specialties.length > 0 ? specialties : ['Finance']
}

// ─── Single Page Fetch ──────────────────────────────────────────

async function fetchFyntraqPage(pageConfig) {
  const { url, category, specialty } = pageConfig

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!response.ok) {
      return { entries: [], source: SOURCE, total: 0, error: `Fyntraq HTTP ${response.status} for ${category}` }
    }

    const html = await response.text()

    if (!html || html.length < 500) {
      return { entries: [], source: SOURCE, total: 0, error: `Fyntraq empty content for ${category}` }
    }

    const stats = extractMetaStats(html)

    // Prefer HTML list items (have location data) over JSON-LD (no location)
    let entries = extractFromListItems(html)

    // Fall back to JSON-LD if no list items found
    if (entries.length === 0) {
      entries = extractJsonLdList(html)
    }

    // Normalize entries
    const normalized = entries
      .filter(e => e.company || e.programme)
      .map((e, idx) => {
        const loc = parseLocation(e.location || '')
        const specialties = detectSpecialty(e.programme || '', e.programme || '')

        return {
          id: `fyntraq:${category}:${slugify(e.company)}:${slugify(e.programme)}`,
          source: SOURCE,
          sourceJobId: `${category}:${slugify(e.company)}:${slugify(e.programme)}`,
          company: e.company,
          programme: e.programme,
          programmeName: e.programme,
          location: loc.raw || e.location || '',
          city: loc.city,
          country: loc.country,
          category,
          specialties,
          specialty,
          trackerUrl: e.trackerUrl || url,
          contractType: e.contractType || 'Internship',
          isOpen: true, // Blog pages only show current openings
          rolling: false,
        }
      })

    return {
      entries: normalized,
      source: SOURCE,
      total: normalized.length,
      category,
      stats,
    }
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return { entries: [], source: SOURCE, total: 0, error: `Fyntraq timeout for ${category}` }
    }
    return { entries: [], source: SOURCE, total: 0, error: `Fyntraq error for ${category}: ${err.message}` }
  }
}

function slugify(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60)
}

// ─── Aggregate Fetch ────────────────────────────────────────────

async function fetchFyntraq(options = {}) {
  const { pages = BLOG_PAGES } = options
  const allEntries = []
  const errors = []
  const allStats = {}

  for (const page of pages) {
    const result = await fetchFyntraqPage(page)
    if (result.entries) allEntries.push(...result.entries)
    if (result.error) errors.push({ category: page.category, error: result.error })
    if (result.stats) Object.assign(allStats, result.stats)
  }

  return {
    entries: allEntries,
    source: SOURCE,
    total: allEntries.length,
    pages: pages.length,
    stats: allStats,
    errors: errors.length > 0 ? errors : undefined,
  }
}

export { fetchFyntraq, fetchFyntraqPage, BLOG_PAGES, detectSpecialty }
