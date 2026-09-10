import Parser from 'rss-parser'

const parser = new Parser({
  timeout: 15000,
  headers: { 'User-Agent': 'Meridian-Job-Tracker/1.0' },
})

async function fetchAvatureJobs(firm) {
  const rssUrl = firm.avatureRssUrl
  if (!rssUrl) {
    return { jobs: [], error: `No Avature RSS URL for ${firm.name}`, source: 'avature' }
  }

  try {
    const feed = await parser.parseURL(rssUrl)
    const items = feed.items || []

    const jobs = items.map(item => {
      const id = extractId(item)
      const title = item.title || ''
      const content = item.contentSnippet || item.content || ''
      const location = extractLocation(title, content)
      const link = item.link || item.guid || ''

      return {
        id,
        source: 'avature',
        sourceJobId: id,
        company: firm.name,
        title,
        location,
        country: extractCountryFromLocation(location),
        url: link,
        applyUrl: link,
        description: content.substring(0, 5000),
        posted: item.pubDate || item.isoDate || null,
        deadline: null,
        employmentType: mapEmploymentType(title),
      }
    })

    return { jobs, source: 'avature', total: jobs.length, firm: firm.name }
  } catch (err) {
    return { jobs: [], error: `Avature RSS error for ${firm.name}: ${err.message}`, source: 'avature' }
  }
}

function extractId(item) {
  const link = item.link || item.guid || item.id || ''
  const match = link.match(/\/JobDetail\/[^/]+\/(\d+)/)
  if (match) return `avature:${match[1]}`
  const guidMatch = (item.guid || '').match(/\/(\d+)$/)
  if (guidMatch) return `avature:${guidMatch[1]}`
  return `avature:${Buffer.from(link).toString('base64').slice(0, 20)}`
}

function extractLocation(title, content) {
  const combined = `${title} ${content}`
  const locationPatterns = [
    /\(([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\)/,
    /(London|New York|Frankfurt|Paris|Amsterdam|Zurich|Madrid|Stockholm|Hong Kong|Singapore|Tokyo|Dubai|Tel Aviv|Dublin|Sydney|Toronto|Charlotte|Houston|San Francisco|Chicago)/i,
  ]
  for (const pattern of locationPatterns) {
    const match = combined.match(pattern)
    if (match) return match[1] || match[0]
  }
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

export { fetchAvatureJobs }
