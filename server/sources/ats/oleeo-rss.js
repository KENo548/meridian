import Parser from 'rss-parser'

const parser = new Parser({
  timeout: 15000,
  headers: { 'User-Agent': 'Meridian-Job-Tracker/1.0' },
})

async function fetchOleeoRssJobs(firm) {
  const rssUrl = firm.oleeoRssUrl
  if (!rssUrl) {
    return { jobs: [], error: `No Oleeo RSS URL for ${firm.name}`, source: 'oleeo_rss' }
  }

  try {
    const feed = await parser.parseURL(rssUrl)
    const items = feed.items || []

    const jobs = items.map(item => {
      const id = extractId(item)
      const title = item.title || ''
      const content = item.contentSnippet || item.content || ''
      const deadline = extractDeadline(content)
      const location = extractLocation(title, content)
      const link = item.link || ''

      return {
        id,
        source: 'oleeo_rss',
        sourceJobId: id,
        company: firm.name,
        title,
        location,
        country: extractCountryFromLocation(location),
        url: link,
        applyUrl: link,
        description: content.substring(0, 5000),
        posted: item.pubDate || item.isoDate || null,
        deadline: deadline || null,
        employmentType: mapEmploymentType(title),
      }
    })

    return { jobs, source: 'oleeo_rss', total: jobs.length, firm: firm.name }
  } catch (err) {
    return { jobs: [], error: `Oleeo RSS error for ${firm.name}: ${err.message}`, source: 'oleeo_rss' }
  }
}

function extractId(item) {
  const link = item.link || item.guid || item.id || ''
  const match = link.match(/\/opp\/(\d+)-/)
  if (match) return `oleeo:${match[1]}`
  return `oleeo:${Buffer.from(link).toString('base64').slice(0, 20)}`
}

function extractDeadline(content) {
  if (!content) return null
  const match = content.match(/Application Deadline:\s*(\d{1,2}\s+\w+\s+\d{4}\s+\d{1,2}:\d{2}\s+[AP]M\s+\w+)/i)
  if (match) {
    const parsed = new Date(match[1])
    if (!isNaN(parsed.getTime())) return parsed.toISOString()
  }
  return null
}

function extractLocation(title, content) {
  const combined = `${title} ${content}`
  const locationPatterns = [
    /- ([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\s*$/, 
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

export { fetchOleeoRssJobs }
