const PROGRAMME_PATTERNS = [
  { pattern: /spring\s*week/i, category: 'spring_week' },
  { pattern: /spring\s*insight/i, category: 'spring_week' },
  { pattern: /summer\s*(analyst|intern|internship)/i, category: 'summer_intern' },
  { pattern: /intern(ship)?/i, category: 'summer_intern' },
  { pattern: /off[\s-]?cycle/i, category: 'off_cycle' },
  { pattern: /werkstudent/i, category: 'off_cycle' },
  { pattern: /grad(uate)?/i, category: 'grad' },
  { pattern: /full[\s-]?time/i, category: 'grad' },
  { pattern: /insight/i, category: 'spring_week' },
  { pattern: /placement/i, category: 'summer_intern' },
  { pattern: /year[\s-]?in[\s-]?industry/i, category: 'summer_intern' },
  { pattern: /sandwich/i, category: 'summer_intern' },
]

const CATEGORY_LABELS = {
  spring_week: 'Spring Week',
  summer_intern: 'Summer Internship',
  off_cycle: 'Off-Cycle / Werkstudent',
  grad: 'Graduate / Full-Time',
  unknown: 'Unknown',
}

const DIVISION_PATTERNS = [
  { pattern: /investment\s*banking/i, division: 'IB' },
  { pattern: /\bIB\b/, division: 'IB' },
  { pattern: /private\s*equity/i, division: 'PE' },
  { pattern: /\bPE\b/, division: 'PE' },
  { pattern: /asset\s*management/i, division: 'AM' },
  { pattern: /\bAM\b/, division: 'AM' },
  { pattern: /sales\s*&?\s*trading/i, division: 'S&T' },
  { pattern: /\bS&T\b/, division: 'S&T' },
  { pattern: /markets/i, division: 'Markets' },
  { pattern: /quant/i, division: 'Quant' },
  { pattern: /consulting/i, division: 'Consulting' },
  { pattern: /advisory/i, division: 'Advisory' },
  { pattern: /corporate\s*finance/i, division: 'Corporate Finance' },
  { pattern: /M&A/i, division: 'M&A' },
  { pattern: /DCM/i, division: 'DCM' },
  { pattern: /ECM/i, division: 'ECM' },
  { pattern: /equity\s*research/i, division: 'Equity Research' },
  { pattern: /risk/i, division: 'Risk' },
  { pattern: /technology/i, division: 'Technology' },
  { pattern: /engineering/i, division: 'Engineering' },
]

const OFFICE_PATTERNS = [
  { pattern: /\blondon\b/i, office: 'London' },
  { pattern: /\bnew\s*york\b/i, office: 'New York' },
  { pattern: /\bfrankfurt\b/i, office: 'Frankfurt' },
  { pattern: /\bhong\s*kong\b/i, office: 'Hong Kong' },
  { pattern: /\bsingapore\b/i, office: 'Singapore' },
  { pattern: /\bsydney\b/i, office: 'Sydney' },
  { pattern: /\btokyo\b/i, office: 'Tokyo' },
  { pattern: /\bzurich\b/i, office: 'Zurich' },
  { pattern: /\bparis\b/i, office: 'Paris' },
  { pattern: /\bamsterdam\b/i, office: 'Amsterdam' },
  { pattern: /\bdublin\b/i, office: 'Dublin' },
  { pattern: /\btoronto\b/i, office: 'Toronto' },
  { pattern: /\bdubai\b/i, office: 'Dubai' },
  { pattern: /\bmumbai\b/i, office: 'Mumbai' },
  { pattern: /\bbangalore\b/i, office: 'Bangalore' },
]

function classifyProgramme(text) {
  if (!text || typeof text !== 'string') return 'unknown'
  for (const { pattern, category } of PROGRAMME_PATTERNS) {
    if (pattern.test(text)) return category
  }
  return 'unknown'
}

function extractDivision(text) {
  if (!text || typeof text !== 'string') return null
  for (const { pattern, division } of DIVISION_PATTERNS) {
    if (pattern.test(text)) return division
  }
  return null
}

function extractOffice(text) {
  if (!text || typeof text !== 'string') return null
  for (const { pattern, office } of OFFICE_PATTERNS) {
    if (pattern.test(text)) return office
  }
  return null
}

function extractProgrammeIdentity(text) {
  if (!text || typeof text !== 'string') {
    return { category: 'unknown', division: null, office: null, year: null }
  }

  const category = classifyProgramme(text)
  const division = extractDivision(text)
  const office = extractOffice(text)

  const yearMatch = text.match(/\b(20\d{2})\b/)
  const year = yearMatch ? yearMatch[1] : null

  return { category, division, office, year }
}

function parseDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return null
  const trimmed = dateStr.trim()
  if (!trimmed || trimmed.toLowerCase() === 'rolling' || trimmed.toLowerCase() === 'n/a') return null

  const t = Date.parse(trimmed)
  if (isNaN(t)) return null
  return new Date(t).toISOString().split('T')[0]
}

function extractCountry(location) {
  if (!location) return undefined
  const lower = location.toLowerCase()
  const map = {
    'united kingdom': 'gb', 'uk': 'gb', 'england': 'gb', 'london': 'gb',
    'united states': 'us', 'usa': 'us', 'new york': 'us', 'san francisco': 'us',
    'germany': 'de', 'deutschland': 'de', 'frankfurt': 'de',
    'france': 'fr', 'paris': 'fr',
    'singapore': 'sg',
    'hong kong': 'hk',
    'dubai': 'ae', 'uae': 'ae',
    'canada': 'ca', 'toronto': 'ca',
    'australia': 'au', 'sydney': 'au',
    'ireland': 'ie', 'dublin': 'ie',
    'japan': 'jp', 'tokyo': 'jp',
    'switzerland': 'ch', 'zurich': 'ch',
    'netherlands': 'nl', 'amsterdam': 'nl',
    'sweden': 'se', 'stockholm': 'se',
    'spain': 'es', 'madrid': 'es',
    'israel': 'il', 'tel aviv': 'il',
  }
  for (const [key, code] of Object.entries(map)) {
    if (lower.includes(key)) return code
  }
  return undefined
}

// Reject company names that are timestamps, relative dates, or other non-entity values
const INVALID_COMPANY_PATTERNS = [
  /^\d+[hm]\s+ago$/i,              // "22h ago", "6h ago", "11m ago"
  /^\d+\s+(?:min|hour|day|week|month|year)s?\s+ago$/i,  // "3 days ago"
  /^(?:yesterday|today|tomorrow)$/i,
  /^(?:just\s+now|recently|new|latest|updated)$/i,
  /^(?:loading|error|unknown|n\/a|tbd|na)$/i,
  /^\d{1,2}:\d{2}/,                // times like "14:30"
  /^\d{4}-\d{2}-\d{2}/,           // ISO dates like "2026-09-05"
  /^[•\-–—]\s*$/,                  // bullet/dash-only entries
]

function isInvalidCompanyName(name) {
  if (!name || name.length > 120) return true
  const trimmed = name.trim()
  if (trimmed.length < 2) return true
  for (const pat of INVALID_COMPANY_PATTERNS) {
    if (pat.test(trimmed)) return true
  }
  return false
}

function normalizeTrackerEntry(raw, source) {
  if (!raw || typeof raw !== 'object') return null

  const companyName = String(raw.company || raw.companyName || '').trim()
  const programme = String(raw.programme || raw.programmeName || raw.role || '').trim()
  const location = String(raw.location || '').trim()

  if (!companyName) return null

  // Reject timestamp-polluted or non-company values
  if (isInvalidCompanyName(companyName)) return null

  const identity = extractProgrammeIdentity(programme || companyName)

  return {
    companyName,
    programme: programme || null,
    category: identity.category,
    division: identity.division,
    office: identity.office,
    year: identity.year,
    location: location || null,
    country: extractCountry(location) || null,
    applyUrl: raw.applyUrl || raw.url || null,
    openingDate: parseDate(raw.openingDate),
    closingDate: parseDate(raw.closingDate),
    rolling: Boolean(raw.rolling) || (typeof raw.rolling === 'string' && raw.rolling.toLowerCase() === 'yes'),
    status: raw.status || null,
    eligibility: raw.eligibility || null,
    process: raw.process || null,
    source,
    sourceUrl: raw.sourceUrl || null,
  }
}

function normalizeTrackerBatch(items, source) {
  if (!Array.isArray(items)) return []
  return items.map(item => normalizeTrackerEntry(item, source)).filter(Boolean)
}

function deriveTrackerIntel(observations) {
  if (!observations || observations.length === 0) return null

  const programme = observations.find(o => o.programme)?.programme || null
  const category = observations.find(o => o.category && o.category !== 'unknown')?.category || 'unknown'

  const openingDates = observations.filter(o => o.openingDate).map(o => o.openingDate)
  const closingDates = observations.filter(o => o.closingDate).map(o => o.closingDate)

  const sortedOpenings = openingDates.sort()
  const sortedClosings = closingDates.sort()

  const rolling = observations.some(o => o.rolling)

  const latestObs = observations.reduce((latest, o) => {
    const t = new Date(o.lastSeenAt || 0).getTime()
    return t > new Date(latest.lastSeenAt || 0).getTime() ? o : latest
  }, observations[0])

  const earliestObs = observations.reduce((earliest, o) => {
    const t = new Date(o.firstSeenAt || Infinity).getTime()
    return t < new Date(earliest.firstSeenAt || Infinity).getTime() ? o : earliest
  }, observations[0])

  return {
    programme,
    category,
    openingDate: sortedOpenings.length > 0
      ? { value: sortedOpenings[0], source: earliestObs.source, confidence: 'tracker' }
      : null,
    closingDate: sortedClosings.length > 0
      ? { value: sortedClosings[sortedClosings.length - 1], source: latestObs.source, confidence: 'tracker' }
      : null,
    rolling: { value: rolling, source: latestObs.source, confidence: 'tracker' },
    eligibility: observations.find(o => o.eligibility)?.eligibility || null,
    process: observations.find(o => o.process)?.process || null,
    observations: observations.map(o => ({
      source: o.source,
      sourceUrl: o.sourceUrl,
      firstSeenAt: o.firstSeenAt,
      lastSeenAt: o.lastSeenAt,
      status: o.status,
    })),
  }
}

export {
  classifyProgramme,
  extractDivision,
  extractOffice,
  extractProgrammeIdentity,
  parseDate,
  extractCountry,
  normalizeTrackerEntry,
  normalizeTrackerBatch,
  deriveTrackerIntel,
  PROGRAMME_PATTERNS,
  CATEGORY_LABELS,
  DIVISION_PATTERNS,
  OFFICE_PATTERNS,
}
