// Structured normalization for finance recruiting semantics
// Maps ATS title variations → canonical programme/division/cycle concepts

const PROGRAMME_SYNONYMS = {
  // Spring Week / Insight programmes
  'spring_week': [
    'spring week', 'spring insight', 'insight programme', 'insight program',
    'discovery programme', 'discovery program', 'taster programme', 'taster program',
    'explorer programme', 'first year insight', 'first year programme',
    'spring internship', 'week long insight',
  ],
  // Summer Internship / Analyst programmes
  'summer_intern': [
    'summer intern', 'summer analyst', 'summer associate', 'summer internship',
    'internship programme', 'intern programme', 'intern program',
    'off-cycle intern', 'off cycle intern', 'off-cycle internship',
    'off cycle internship', 'industrial placement', 'year in industry',
    'sandwich year', 'placement year', 'praktikant', 'stagiaire',
    'stagiaire', 'prácticas', 'werkstudent',
    // Flexible patterns: "Summer ... Analyst" (e.g., "Summer Private Equity Analyst")
    'summer',
    // Standalone "intern" in job title (e.g., "Quantitative Research Intern")
    'intern',
  ],
  // Graduate / Full-time programmes
  'graduate': [
    'graduate programme', 'graduate program', 'graduate analyst',
    'graduate associate', 'full time analyst', 'full-time analyst',
    'full time associate', 'full-time associate', 'new analyst',
    'entry level', 'junior analyst', 'analyst programme',
    'analyst program', 'management trainee', 'rotational programme',
    'rotational program', 'first year analyst', 'analyst i',
  ],
  // Experienced hire / Lateral
  'experienced': [
    'experienced hire', 'lateral', 'senior analyst', 'associate',
    'vice president', 'vp', 'director', 'managing director',
    'executive director', 'partner', 'principal', 'senior associate',
    'senior manager', 'lead',
  ],
}

const DIVISION_SYNONYMS = {
  'IB': [
    'investment banking', 'ib', 'ibd', 'investment bank',
    'corporate finance', 'capital markets', 'dcm', 'ecm',
    'debt capital markets', 'equity capital markets', 'm&a',
    'mergers and acquisitions', 'mergers & acquisitions',
    'advisory', 'financial advisory', 'restructuring',
    'coverage', 'industry group', 'product group',
  ],
  'PE': [
    'private equity', 'pe', 'buyout', 'growth equity',
    'leveraged buyout', 'lbo', 'direct lending', 'private markets',
    'secondaries', 'real assets', 'infrastructure',
  ],
  'HF': [
    'hedge fund', 'hf', 'long short', 'long/short',
    'multi strategy', 'multi-strategy', 'event driven', 'event-driven',
    'macro', 'global macro', 'relative value', 'credit',
    'activist', 'pod', 'multi-manager',
  ],
  'AM': [
    'asset management', 'am', 'investment management',
    'wealth management', 'private wealth', 'pwm',
    'institutional', 'fund management', 'portfolio management',
    'equity research', 'fixed income', 'alternatives',
  ],
  'S&T': [
    'sales and trading', 'sales & trading', 's&t',
    'trading', 'trader', 'markets', 'global markets', 'ficc',
    'fixed income currencies and commodities', 'equities',
    'electronic trading', 'structuring', 'flow trading',
    'sales', 'prime brokerage',
  ],
  'Quant': [
    'quantitative', 'quant', 'quantitative research',
    'quantitative trading', 'quantitative analysis',
    'systematic', 'algorithms', 'alpha research',
    'risk analytics', 'financial engineering',
  ],
  'Consulting': [
    'consulting', 'consultant', 'advisory',
    'strategy consulting', 'management consulting',
    'transaction advisory', 'deals',
  ],
  'Tech': [
    'technology', 'tech', 'engineering', 'software',
    'product', 'data science', 'machine learning',
    'ai', 'artificial intelligence', 'cybersecurity',
    'infrastructure', 'devops', 'platform',
  ],
}

const LOCATION_ALIASES = {
  // City → canonical city
  'london': 'London',
  'city of london': 'London',
  'canary wharf': 'London',
  'london, uk': 'London',
  'new york': 'New York',
  'nyc': 'New York',
  'new york city': 'New York',
  'manhattan': 'New York',
  'new york, ny': 'New York',
  'hong kong': 'Hong Kong',
  'hk': 'Hong Kong',
  'singapore': 'Singapore',
  'frankfurt': 'Frankfurt',
  'paris': 'Paris',
  'zurich': 'Zurich',
  'tokyo': 'Tokyo',
  'sydney': 'Sydney',
  'melbourne': 'Melbourne',
  'dubai': 'Dubai',
  'san francisco': 'San Francisco',
  'sf': 'San Francisco',
  'boston': 'Boston',
  'chicago': 'Chicago',
  'los angeles': 'Los Angeles',
  'amsterdam': 'Amsterdam',
  'munich': 'Munich',
  'berlin': 'Berlin',
  'madrid': 'Madrid',
  'milan': 'Milan',
  'rome': 'Rome',
  'dublin': 'Dublin',
  'edinburgh': 'Edinburgh',
  'manchester': 'Manchester',
  'toronto': 'Toronto',
  'vancouver': 'Vancouver',
  'montréal': 'Montreal',
  'montreal': 'Montreal',
  'seattle': 'Seattle',
  'washington': 'Washington',
  'd.c.': 'Washington',
  'dc': 'Washington',
  'atlanta': 'Atlanta',
  'dallas': 'Dallas',
  'houston': 'Houston',
  'denver': 'Denver',
  'miami': 'Miami',
  'tel aviv': 'Tel Aviv',
  'seoul': 'Seoul',
  'shanghai': 'Shanghai',
  'beijing': 'Beijing',
  'mumbai': 'Mumbai',
  'bangalore': 'Bangalore',
  'johannesburg': 'Johannesburg',
  'cape town': 'Cape Town',
  'são paulo': 'São Paulo',
  'sao paulo': 'São Paulo',
  'mexico city': 'Mexico City',
  'buenos aires': 'Buenos Aires',
  'santiago': 'Santiago',
  'lima': 'Lima',
  'bogotá': 'Bogotá',
  'bogota': 'Bogotá',
  'istanbul': 'Istanbul',
  'bangkok': 'Bangkok',
  'jakarta': 'Jakarta',
  'manila': 'Manila',
  'taipei': 'Taipei',
  'vienna': 'Vienna',
  'brussels': 'Brussels',
  'copenhagen': 'Copenhagen',
  'stockholm': 'Stockholm',
  'oslo': 'Oslo',
  'helsinki': 'Helsinki',
  'warsaw': 'Warsaw',
  'prague': 'Prague',
  'budapest': 'Budapest',
  'lisbon': 'Lisbon',
  'cairo': 'Cairo',
  'nairobi': 'Nairobi',
  'lagos': 'Lagos',
}

const COUNTRY_ALIASES = {
  'uk': 'UK', 'united kingdom': 'UK', 'gb': 'UK', 'great britain': 'UK',
  'england': 'UK', 'scotland': 'UK', 'wales': 'UK',
  'us': 'US', 'united states': 'US', 'usa': 'US', 'america': 'US',
  'de': 'Germany', 'germany': 'Germany', 'deutschland': 'Germany',
  'fr': 'France', 'france': 'France',
  'ch': 'Switzerland', 'switzerland': 'Switzerland', 'schweiz': 'Switzerland',
  'hk': 'Hong Kong', 'hong kong': 'Hong Kong',
  'sg': 'Singapore', 'singapore': 'Singapore',
  'jp': 'Japan', 'japan': 'Japan',
  'au': 'Australia', 'australia': 'Australia',
  'ae': 'UAE', 'uae': 'UAE', 'emirates': 'UAE',
  'ie': 'Ireland', 'ireland': 'Ireland',
  'nl': 'Netherlands', 'netherlands': 'Netherlands', 'holland': 'Netherlands',
  'se': 'Sweden', 'sweden': 'Sweden',
  'no': 'Norway', 'norway': 'Norway',
  'dk': 'Denmark', 'denmark': 'Denmark',
  'fi': 'Finland', 'finland': 'Finland',
  'ca': 'Canada', 'canada': 'Canada',
  'in': 'India', 'india': 'India',
  'il': 'Israel', 'israel': 'Israel',
  'kr': 'South Korea', 'south korea': 'South Korea', 'korea': 'South Korea',
  'cn': 'China', 'china': 'China',
  'br': 'Brazil', 'brazil': 'Brazil',
  'mx': 'Mexico', 'mexico': 'Mexico',
  'za': 'South Africa', 'south africa': 'South Africa',
  'es': 'Spain', 'spain': 'Spain',
  'it': 'Italy', 'italy': 'Italy',
  'pt': 'Portugal', 'portugal': 'Portugal',
  'pl': 'Poland', 'poland': 'Poland',
  'cz': 'Czech Republic', 'czech republic': 'Czech Republic',
  'hu': 'Hungary', 'hungary': 'Hungary',
  'tr': 'Turkey', 'turkey': 'Turkey', 'türkiye': 'Turkey',
  'ng': 'Nigeria', 'nigeria': 'Nigeria',
  'ke': 'Kenya', 'kenya': 'Kenya',
  'eg': 'Egypt', 'egypt': 'Egypt',
  'ar': 'Argentina', 'argentina': 'Argentina',
  'cl': 'Chile', 'chile': 'Chile',
  'co': 'Colombia', 'colombia': 'Colombia',
  'pe': 'Peru', 'peru': 'Peru',
  'tw': 'Taiwan', 'taiwan': 'Taiwan',
  'th': 'Thailand', 'thailand': 'Thailand',
  'id': 'Indonesia', 'indonesia': 'Indonesia',
  'ph': 'Philippines', 'philippines': 'Philippines',
  'vn': 'Vietnam', 'vietnam': 'Vietnam',
  'my': 'Malaysia', 'malaysia': 'Malaysia',
  'nz': 'New Zealand', 'new zealand': 'New Zealand',
}

// Seniority levels from title
const SENIORITY_LEVELS = {
  'intern': ['intern', 'internship', 'summer analyst', 'summer associate', 'praktikant', 'stagiaire', 'student'],
  'analyst': ['analyst', 'graduate analyst', 'new analyst', 'junior analyst'],
  'associate': ['associate', 'senior analyst'],
  'vp': ['vice president', 'vp', 'executive director'],
  'director': ['director', 'managing director', 'partner', 'principal'],
}

function normalizeProgramme(str) {
  if (!str) return null
  const lower = str.toLowerCase()

  // Check specific synonyms first (longer matches before shorter)
  for (const [canonical, synonyms] of Object.entries(PROGRAMME_SYNONYMS)) {
    if (canonical === 'summer_intern') {
      // Special handling for flexible patterns
      for (const syn of synonyms) {
        if (syn === 'summer') {
          // Match "Summer ... Analyst" or "Summer ... Intern" patterns
          if (/summer\s+.*(?:analyst|intern|associate)/i.test(lower)) {
            return canonical
          }
          // Match bare "Summer" in title that looks like an internship
          if (/^summer\b/i.test(lower) && !/full\s*time|graduate|experienced/i.test(lower)) {
            return canonical
          }
          continue
        }
        if (syn === 'intern') {
          // Word-boundary match for "intern" to avoid "Internal", "International"
          if (/\bintern\b/i.test(lower) && !/full\s*time|graduate|experienced|internal|international/i.test(lower)) {
            return canonical
          }
          continue
        }
        if (lower.includes(syn)) return canonical
      }
    } else {
      for (const syn of synonyms) {
        if (lower.includes(syn)) return canonical
      }
    }
  }
  return null
}

function normalizeDivision(str) {
  if (!str) return null
  const lower = str.toLowerCase()

  // Collect all matches with their specificity (longer synonym = more specific)
  const matches = []
  for (const [canonical, synonyms] of Object.entries(DIVISION_SYNONYMS)) {
    for (const syn of synonyms) {
      let matched = false
      if (syn.length <= 3) {
        const regex = new RegExp(`\\b${syn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
        matched = regex.test(lower)
      } else {
        matched = lower.includes(syn)
      }
      if (matched) {
        matches.push({ canonical, synonym: syn, specificity: syn.length })
      }
    }
  }

  if (matches.length === 0) return null

  // Return the match with highest specificity (longest synonym)
  matches.sort((a, b) => b.specificity - a.specificity)
  return matches[0].canonical
}

function normalizeLocation(str) {
  if (!str) return { city: null, country: null, raw: str }
  const lower = str.toLowerCase().trim()

  // Try city match first
  for (const [alias, canonical] of Object.entries(LOCATION_ALIASES)) {
    if (lower.includes(alias)) {
      return { city: canonical, country: null, raw: str }
    }
  }

  // Try country match
  for (const [alias, canonical] of Object.entries(COUNTRY_ALIASES)) {
    if (lower.includes(alias)) {
      return { city: null, country: canonical, raw: str }
    }
  }

  return { city: null, country: null, raw: str }
}

function normalizeSeniority(str) {
  if (!str) return null
  const lower = str.toLowerCase()

  for (const [level, keywords] of Object.entries(SENIORITY_LEVELS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return level
    }
  }
  return null
}

function extractYear(str) {
  if (!str) return null
  const match = str.match(/20[2-3]\d/)
  return match ? parseInt(match[0]) : null
}

function normalizeCycle(str) {
  if (!str) return { year: null, programme: null }
  return {
    year: extractYear(str),
    programme: normalizeProgramme(str),
  }
}

// Full normalization of a tracker entry or direct job
function normalizeEntry(entry) {
  const title = entry.programme || entry.jobTitle || entry.title || ''
  const division = entry.division || title
  const location = entry.location || entry.office || ''

  return {
    programme: normalizeProgramme(title),
    division: normalizeDivision(division),
    location: normalizeLocation(location),
    seniority: normalizeSeniority(title),
    year: extractYear(entry.year || title),
    raw: { title, division, location },
  }
}

// Check if two normalized entries are compatible
function areCompatible(normA, normB) {
  const incompatibilities = []

  // Programme type must match
  if (normA.programme && normB.programme) {
    if (normA.programme === 'spring_week' && normB.programme !== 'spring_week') {
      incompatibilities.push({ type: 'programme_mismatch', a: normA.programme, b: normB.programme })
    }
    if (normA.programme === 'summer_intern' && normB.programme === 'graduate') {
      incompatibilities.push({ type: 'programme_mismatch', a: normA.programme, b: normB.programme })
    }
    if (normA.programme === 'graduate' && normB.programme === 'summer_intern') {
      incompatibilities.push({ type: 'programme_mismatch', a: normA.programme, b: normB.programme })
    }
    if (normA.programme === 'experienced' && ['spring_week', 'summer_intern', 'graduate'].includes(normB.programme)) {
      incompatibilities.push({ type: 'seniority_mismatch', a: normA.programme, b: normB.programme })
    }
    if (normB.programme === 'experienced' && ['spring_week', 'summer_intern', 'graduate'].includes(normA.programme)) {
      incompatibilities.push({ type: 'seniority_mismatch', a: normA.programme, b: normB.programme })
    }
  }

  // Location must be compatible (same country or both unspecified)
  if (normA.location.country && normB.location.country) {
    if (normA.location.country !== normB.location.country) {
      incompatibilities.push({ type: 'country_mismatch', a: normA.location.country, b: normB.location.country })
    }
  }

  // Year must be compatible (same or adjacent)
  if (normA.year && normB.year) {
    if (Math.abs(normA.year - normB.year) > 1) {
      incompatibilities.push({ type: 'year_mismatch', a: normA.year, b: normB.year })
    }
  }

  return {
    compatible: incompatibilities.length === 0,
    incompatibilities,
  }
}

export {
  PROGRAMME_SYNONYMS,
  DIVISION_SYNONYMS,
  LOCATION_ALIASES,
  COUNTRY_ALIASES,
  SENIORITY_LEVELS,
  normalizeProgramme,
  normalizeDivision,
  normalizeLocation,
  normalizeSeniority,
  extractYear,
  normalizeCycle,
  normalizeEntry,
  areCompatible,
}
