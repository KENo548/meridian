const MATCH_THRESHOLDS = {
  auto: 0.90,
  review: 0.70,
}

function normalizeForMatch(str) {
  if (!str) return ''
  return str.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(str) {
  if (!str) return []
  return normalizeForMatch(str)
    .split(' ')
    .filter(t => t.length > 1)
}

function extractYear(str) {
  if (!str) return null
  const match = str.match(/20[2-3]\d/)
  return match ? match[0] : null
}

function extractProgrammeType(str) {
  if (!str) return null
  const lower = str.toLowerCase()
  if (lower.includes('spring') && lower.includes('week')) return 'spring_week'
  if (lower.includes('summer') && (lower.includes('intern') || lower.includes('analyst'))) return 'summer_intern'
  if (lower.includes('off-cycle') || lower.includes('off cycle')) return 'off_cycle'
  if (lower.includes('graduate') || lower.includes('grad ') || lower.includes('full time')) return 'grad'
  if (lower.includes('intern')) return 'summer_intern'
  return null
}

function extractDivision(str) {
  if (!str) return null
  const lower = str.toLowerCase()
  if (lower.includes('investment bank') || lower.includes(' ib ') || lower.includes('ibd')) return 'IB'
  if (lower.includes('private equity') || lower.includes(' pe ')) return 'PE'
  if (lower.includes('hedge fund') || lower.includes(' hf ')) return 'HF'
  if (lower.includes('asset management') || lower.includes(' am ')) return 'AM'
  if (lower.includes('sales') && lower.includes('trading')) return 'S&T'
  if (lower.includes('trading') || lower.includes('quant')) return 'Quant'
  if (lower.includes('wealth')) return 'Wealth'
  if (lower.includes('advisory') || lower.includes('m&a')) return 'Advisory'
  if (lower.includes('consulting')) return 'Consulting'
  if (lower.includes('technology') || lower.includes('tech')) return 'Tech'
  return null
}

function extractLocation(str) {
  if (!str) return { city: null, country: null }
  const lower = str.toLowerCase()

  const cities = {
    'london': 'London', 'new york': 'New York', 'nyc': 'New York',
    'hong kong': 'Hong Kong', 'hk': 'Hong Kong', 'singapore': 'Singapore',
    'frankfurt': 'Frankfurt', 'zurich': 'Zurich', 'tokyo': 'Tokyo',
    'sydney': 'Sydney', 'melbourne': 'Melbourne', 'dubai': 'Dubai',
    'san francisco': 'San Francisco', 'sf': 'San Francisco',
    'boston': 'Boston', 'chicago': 'Chicago', 'los angeles': 'Los Angeles',
    'paris': 'Paris', 'amsterdam': 'Amsterdam', 'munich': 'Munich',
    'hong kong': 'Hong Kong', 'shanghai': 'Shanghai', 'beijing': 'Beijing',
    'mumbai': 'Mumbai', 'delhi': 'Delhi', 'bangalore': 'Bangalore',
    'toronto': 'Toronto', 'vancouver': 'Vancouver', 'montréal': 'Montreal',
    'montreal': 'Montreal', 'seattle': 'Seattle', 'washington': 'Washington',
    'd.c.': 'Washington', 'dc': 'Washington', 'atlanta': 'Atlanta',
    'dallas': 'Dallas', 'houston': 'Houston', 'denver': 'Denver',
    'miami': 'Miami', 'berlin': 'Berlin', 'madrid': 'Madrid',
    'milan': 'Milan', 'rome': 'Rome', 'dublin': 'Dublin',
    'edinburgh': 'Edinburgh', 'manchester': 'Manchester', 'leeds': 'Leeds',
    'istanbul': 'Istanbul', 'sao paulo': 'São Paulo', 'são paulo': 'São Paulo',
    'mexico city': 'Mexico City', 'lima': 'Lima', 'bogotá': 'Bogotá',
    'bogota': 'Bogotá', 'santiago': 'Santiago', 'buenos aires': 'Buenos Aires',
    'johannesburg': 'Johannesburg', 'cape town': 'Cape Town', 'nairobi': 'Nairobi',
    'lagos': 'Lagos', 'cairo': 'Cairo', 'tel aviv': 'Tel Aviv',
    'istanbul': 'Istanbul', 'seoul': 'Seoul', 'bangkok': 'Bangkok',
    'jakarta': 'Jakarta', 'manila': 'Manila', 'taipei': 'Taipei',
    'vienna': 'Vienna', 'brussels': 'Brussels', 'copenhagen': 'Copenhagen',
    'stockholm': 'Stockholm', 'oslo': 'Oslo', 'helsinki': 'Helsinki',
    'warsaw': 'Warsaw', 'prague': 'Prague', 'budapest': 'Budapest',
    'lisbon': 'Lisbon', 'london': 'London',
  }

  let city = null
  for (const [key, value] of Object.entries(cities)) {
    if (lower.includes(key)) {
      city = value
      break
    }
  }

  const countries = {
    'united kingdom': 'UK', 'uk': 'UK', 'gb': 'UK', 'great britain': 'UK',
    'united states': 'US', 'us': 'US', 'usa': 'US', 'america': 'US',
    'china': 'China', 'hong kong': 'Hong Kong', 'hk': 'Hong Kong',
    'singapore': 'Singapore', 'japan': 'Japan', 'tokyo': 'Japan',
    'australia': 'Australia', 'germany': 'Germany', 'france': 'France',
    'switzerland': 'Switzerland', 'uae': 'UAE', 'emirates': 'UAE',
    'dubai': 'UAE', 'india': 'India', 'canada': 'Canada',
    'brazil': 'Brazil', 'mexico': 'Mexico', 'ireland': 'Ireland',
    'netherlands': 'Netherlands', 'holland': 'Netherlands',
    'italy': 'Italy', 'spain': 'Spain', 'sweden': 'Sweden',
    'norway': 'Norway', 'denmark': 'Denmark', 'finland': 'Finland',
    'poland': 'Poland', 'czech': 'Czech Republic', 'hungary': 'Hungary',
    'portugal': 'Portugal', 'israel': 'Israel', 'south korea': 'South Korea',
    'korea': 'South Korea', 'taiwan': 'Taiwan', 'thailand': 'Thailand',
    'indonesia': 'Indonesia', 'philippines': 'Philippines', 'vietnam': 'Vietnam',
    'malaysia': 'Malaysia', 'new zealand': 'New Zealand', 'zealand': 'New Zealand',
    'south africa': 'South Africa', 'nigeria': 'Nigeria', 'kenya': 'Kenya',
    'egypt': 'Egypt', 'turkey': 'Turkey', 'türkiye': 'Turkey',
    'argentina': 'Argentina', 'chile': 'Chile', 'colombia': 'Colombia',
    'peru': 'Peru', 'london': 'UK', 'edinburgh': 'UK',
  }

  let country = null
  for (const [key, value] of Object.entries(countries)) {
    if (lower.includes(key)) {
      country = value
      break
    }
  }

  return { city, country }
}

function scoreCompanyMatch(tracker, direct) {
  const t = normalizeForMatch(tracker.companyName || '')
  const d = normalizeForMatch(direct.companyName || direct.company || '')

  if (!t || !d) return 0

  if (t === d) return 1.0

  if (t.includes(d) || d.includes(t)) return 0.95

  const tTokens = new Set(tokenize(tracker.companyName))
  const dTokens = new Set(tokenize(direct.companyName || direct.company || ''))
  const intersection = [...tTokens].filter(x => dTokens.has(x))
  const union = new Set([...tTokens, ...dTokens])

  if (intersection.length === 0) return 0
  return intersection.length / union.size
}

function scoreTitleMatch(tracker, direct) {
  const tTitle = normalizeForMatch(tracker.programme || tracker.jobTitle || '')
  const dTitle = normalizeForMatch(direct.title || direct.jobTitle || '')

  if (!tTitle || !dTitle) return 0.5

  if (tTitle === dTitle) return 1.0

  const tTokens = new Set(tokenize(tTitle))
  const dTokens = new Set(tokenize(dTitle))
  const intersection = [...tTokens].filter(x => dTokens.has(x))
  const union = new Set([...tTokens, ...dTokens])

  if (intersection.length === 0) return 0
  return intersection.length / union.size
}

function scoreLocationMatch(tracker, direct) {
  const tLoc = extractLocation(tracker.location || tracker.office || '')
  const dLoc = extractLocation(direct.location || direct.office || '')

  if (!tLoc.city && !tLoc.country && !dLoc.city && !dLoc.country) return 0.5
  if (!tLoc.city && !tLoc.country) return 0.3
  if (!dLoc.city && !dLoc.country) return 0.3

  let score = 0
  let factors = 0

  if (tLoc.city && dLoc.city) {
    factors++
    if (tLoc.city === dLoc.city) score += 1.0
    else if (tLoc.country === dLoc.country) score += 0.5
  }

  if (tLoc.country && dLoc.country) {
    factors++
    if (tLoc.country === dLoc.country) score += 1.0
  }

  return factors > 0 ? score / factors : 0.5
}

function scoreDivisionMatch(tracker, direct) {
  const tDiv = extractDivision(tracker.division || tracker.programme || '')
  const dDiv = extractDivision(direct.division || direct.title || '')

  if (!tDiv && !dDiv) return 0.5
  if (!tDiv || !dDiv) return 0.3

  if (tDiv === dDiv) return 1.0

  const related = {
    'IB': ['Advisory', 'M&A', 'DCM', 'ECM'],
    'Advisory': ['IB', 'M&A'],
    'PE': ['HF', 'AM'],
    'HF': ['PE', 'AM', 'Quant'],
    'AM': ['PE', 'HF', 'Wealth'],
    'Quant': ['HF', 'S&T'],
    'S&T': ['Quant', 'Trading'],
  }

  if (related[tDiv]?.includes(dDiv) || related[dDiv]?.includes(tDiv)) {
    return 0.7
  }

  return 0.2
}

function scoreCycleMatch(tracker, direct) {
  const tYear = extractYear(tracker.programme || tracker.recruitmentCycle || '')
  const dYear = extractYear(direct.title || direct.recruitmentCycle || '')

  const tType = extractProgrammeType(tracker.programme || '')
  const dType = extractProgrammeType(direct.title || '')

  let score = 0
  let factors = 0

  if (tYear && dYear) {
    factors++
    if (tYear === dYear) score += 1.0
    else if (Math.abs(parseInt(tYear) - parseInt(dYear)) <= 1) score += 0.5
  }

  if (tType && dType) {
    factors++
    if (tType === dType) score += 1.0
    else score += 0.2
  }

  return factors > 0 ? score / factors : 0.5
}

function matchOpportunity(trackerEntry, directJob) {
  const weights = {
    company: 0.30,
    title: 0.25,
    location: 0.20,
    division: 0.15,
    cycle: 0.10,
  }

  const scores = {
    company: scoreCompanyMatch(trackerEntry, directJob),
    title: scoreTitleMatch(trackerEntry, directJob),
    location: scoreLocationMatch(trackerEntry, directJob),
    division: scoreDivisionMatch(trackerEntry, directJob),
    cycle: scoreCycleMatch(trackerEntry, directJob),
  }

  const total = Object.entries(weights).reduce((sum, [key, weight]) => {
    return sum + scores[key] * weight
  }, 0)

  let confidence = 'low'
  if (total >= MATCH_THRESHOLDS.auto) confidence = 'auto'
  else if (total >= MATCH_THRESHOLDS.review) confidence = 'review'

  return {
    total,
    confidence,
    scores,
    weights,
    trackerId: trackerEntry.id,
    directJobId: directJob.id || null,
    trackerCompany: trackerEntry.companyName,
    directCompany: directJob.companyName || directJob.company,
    trackerProgramme: trackerEntry.programme,
    directTitle: directJob.title || directJob.jobTitle,
  }
}

function matchTrackerToDirectJobs(trackerEntry, directJobs) {
  const matches = directJobs
    .map(direct => matchOpportunity(trackerEntry, direct))
    .sort((a, b) => b.total - a.total)

  return {
    trackerEntry,
    bestMatch: matches[0] || null,
    allMatches: matches.slice(0, 5),
    hasAutoMatch: matches.some(m => m.confidence === 'auto'),
    hasReviewMatch: matches.some(m => m.confidence === 'review'),
  }
}

function batchMatch(trackerEntries, directJobsByFirm) {
  const results = []
  const stats = {
    total: trackerEntries.length,
    autoMatched: 0,
    reviewNeeded: 0,
    unmatched: 0,
  }

  for (const tracker of trackerEntries) {
    const firmId = tracker.resolvedFirmId || tracker.companyName?.toLowerCase().replace(/\s+/g, '-')
    const directJobs = directJobsByFirm[firmId] || []

    const matchResult = matchTrackerToDirectJobs(tracker, directJobs)
    results.push(matchResult)

    if (matchResult.hasAutoMatch) stats.autoMatched++
    else if (matchResult.hasReviewMatch) stats.reviewNeeded++
    else stats.unmatched++
  }

  return { results, stats }
}

export {
  matchOpportunity,
  matchTrackerToDirectJobs,
  batchMatch,
  scoreCompanyMatch,
  scoreTitleMatch,
  scoreLocationMatch,
  scoreDivisionMatch,
  scoreCycleMatch,
  normalizeForMatch,
  tokenize,
  extractYear,
  extractProgrammeType,
  extractDivision,
  extractLocation,
  MATCH_THRESHOLDS,
}
