// Tracker Enrichment: Parse structured semantics from programme/title fields
// Extracts: year, programme, function, division, specialization, assetClass, seniority, geography
// Each field has { value, confidence: 'explicit' | 'title_inferred' | 'unknown' }

const YEAR_PATTERN = /\b(20[2-3]\d)\b/

const PROGRAMME_PATTERNS = [
  { value: 'spring_week', patterns: [/spring\s*week/i, /spring\s*insight/i, /insight\s*programme/i, /insight\s*program/i, /discovery\s*programme/i, /taster/i] },
  { value: 'summer_intern', patterns: [/summer\s*(?:analyst|intern|associate)/i, /intern(?:ship)?\s*(?:programme|program)?/i, /off[\s-]*cycle\s*intern/i, /praktikant/i, /stagiaire/i] },
  { value: 'graduate', patterns: [/graduate\s*(?:programme|program|analyst|associate)/i, /full[\s-]*time\s*(?:analyst|associate)/i, /new\s*analyst/i, /management\s*trainee/i, /rotational\s*(?:programme|program)/i] },
  { value: 'experienced', patterns: [/experienced\s*hire/i, /lateral/i, /vice\s*president/i, /\bvp\b/i, /\bmd\b/i, /managing\s*director/i, /director/i, /partner/i, /principal/i] },
]

const FUNCTION_PATTERNS = [
  // Order matters: more specific patterns first
  { value: 'private_equity', patterns: [/private\s*equity/i, /\bpe\b(?!\s*analyst)/i, /buyout/i, /growth\s*equity/i, /lbo/i, /leveraged\s*buyout/i] },
  { value: 'private_credit', patterns: [/private\s*credit/i, /direct\s*lending/i] },
  { value: 'investment_banking', patterns: [/investment\s*bank/i, /\bibd\b/i, /corporate\s*finance/i, /mergers?\s*(?:and|&)\s*acquisitions/i, /restructuring/i, /dcm/i, /ecm/i, /capital\s*markets/i, /coverage/i] },
  { value: 'asset_management', patterns: [/asset\s*management/i, /investment\s*management/i, /fund\s*management/i, /portfolio\s*management/i, /wealth\s*management/i, /private\s*wealth/i, /\bpwm\b/i] },
  { value: 'research', patterns: [/research/i, /equity\s*research/i, /quantitative\s*research/i, /credit\s*research/i] },
  { value: 'risk_management', patterns: [/risk\s*management/i, /market\s*risk/i, /credit\s*risk/i, /operational\s*risk/i] },
  { value: 'trading', patterns: [/sales\s*(?:and|&)\s*trading/i, /\bs&t\b/i, /global\s*markets/i, /ficc/i, /flow\s*trading/i, /structuring/i, /prime\s*brokerage/i, /electronic\s*trading/i, /\btrading\b/i, /\btrader\b/i] },
  { value: 'quantitative', patterns: [/quantitative/i, /\bquant\b/i, /systematic/i, /algorithms/i, /financial\s*engineering/i, /alpha\s*research/i] },
  { value: 'business_management', patterns: [/business\s*management/i, /business\s*development/i] },
  { value: 'product', patterns: [/product\s*(?:analyst|management|manager)/i] },
  { value: 'technology', patterns: [/technology/i, /\btech\b/i, /engineering/i, /software/i, /data\s*science/i, /machine\s*learning/i, /\bml\b/i, /\bai\b/i, /cyber/i, /infrastructure/i, /platform/i, /devops/i] },
  { value: 'human_resources', patterns: [/human\s*resources/i, /\bhr\b/i, /talent/i, /recruiting/i, /recruitment/i] },
  { value: 'finance', patterns: [/finance/i, /financial/i, /controller/i, /accounting/i] },
  { value: 'consulting', patterns: [/consulting/i, /consultant/i, /transaction\s*advisory/i, /deals/i] },
  { value: 'strategy', patterns: [/strategy/i, /strategic/i] },
  // M&A after PE/IB to avoid false captures
  { value: 'investment_banking', patterns: [/m&a/i] },
]

const DIVISION_PATTERNS = [
  // More specific patterns first
  { value: 'private_equity', patterns: [/private\s*equity/i, /\bpe\b/i, /buyout/i] },
  { value: 'private_credit', patterns: [/private\s*credit/i, /direct\s*lending/i] },
  { value: 'investment_banking', patterns: [/investment\s*bank/i, /\bibd\b/i, /\bib\b/i, /corporate\s*finance/i, /restructuring/i] },
  { value: 'equities', patterns: [/equities/i] },
  { value: 'fixed_income', patterns: [/fixed\s*income/i, /\bfi\b/i] },
  { value: 'credit', patterns: [/credit/i] },
  { value: 'multi_asset', patterns: [/multi[\s-]*asset/i, /global\s*macro/i] },
  { value: 'real_assets', patterns: [/real\s*assets/i, /real\s*estate/i, /infrastructure/i] },
  { value: 'fund_of_funds', patterns: [/fund\s*of\s*funds/i, /\bfof\b/i, /secondaries/i] },
  // M&A after PE/IB
  { value: 'investment_banking', patterns: [/m&a/i, /advisory/i] },
]

const SPECIALIZATION_PATTERNS = [
  { value: 'quantitative', patterns: [/quantitative/i, /\bquant\b/i, /systematic/i] },
  { value: 'fundamental', patterns: [/fundamental/i] },
  { value: 'macro', patterns: [/macro/i, /global\s*macro/i] },
  { value: 'event_driven', patterns: [/event[\s-]*driven/i] },
  { value: 'relative_value', patterns: [/relative\s*value/i] },
  { value: 'activist', patterns: [/activist/i] },
]

const ASSET_CLASS_PATTERNS = [
  { value: 'equities', patterns: [/equities/i, /equity/i, /stocks/i] },
  { value: 'fixed_income', patterns: [/fixed\s*income/i, /bonds/i, /rates/i] },
  { value: 'credit', patterns: [/credit/i, /high\s*yield/i, /ig\b/i] },
  { value: 'commodities', patterns: [/commodities/i, /commod/i] },
  { value: 'currencies', patterns: [/currencies/i, /forex/i, /\bfx\b/i] },
  { value: 'multi_asset', patterns: [/multi[\s-]*asset/i] },
  { value: 'alternatives', patterns: [/alternatives/i, /alt\b/i] },
  { value: 'real_estate', patterns: [/real\s*estate/i] },
  { value: 'infrastructure', patterns: [/infrastructure/i] },
]

const SENIORITY_PATTERNS = [
  { value: 'intern', patterns: [/intern/i, /internship/i, /summer\s*(?:\d{4}\s*)?(?:analyst|associate)/i, /spring\s*(?:week)?/i, /praktikant/i, /stagiaire/i] },
  { value: 'analyst', patterns: [/\banalyst\b/i, /graduate\s*analyst/i, /new\s*analyst/i] },
  { value: 'associate', patterns: [/associate/i, /senior\s*analyst/i] },
  { value: 'vp', patterns: [/vice\s*president/i, /\bvp\b/i] },
  { value: 'director', patterns: [/director/i, /managing\s*director/i, /\bmd\b/i, /executive\s*director/i] },
  { value: 'partner', patterns: [/partner/i, /principal/i] },
]

const GEOGRAPHY_PATTERNS = [
  // Cities
  { value: { city: 'London', country: 'UK' }, patterns: [/london/i, /canary\s*wharf/i, /city\s*of\s*london/i] },
  { value: { city: 'New York', country: 'US' }, patterns: [/\bnyc\b/i, /new\s*york/i, /manhattan/i] },
  { value: { city: 'Hong Kong', country: 'Hong Kong' }, patterns: [/hong\s*kong/i, /\bhk\b/i] },
  { value: { city: 'Singapore', country: 'Singapore' }, patterns: [/singapore/i, /\bsg\b/i] },
  { value: { city: 'Frankfurt', country: 'Germany' }, patterns: [/frankfurt/i] },
  { value: { city: 'Paris', country: 'France' }, patterns: [/paris/i] },
  { value: { city: 'Zurich', country: 'Switzerland' }, patterns: [/zurich/i] },
  { value: { city: 'Tokyo', country: 'Japan' }, patterns: [/tokyo/i] },
  { value: { city: 'Sydney', country: 'Australia' }, patterns: [/sydney/i] },
  { value: { city: 'Amsterdam', country: 'Netherlands' }, patterns: [/amsterdam/i] },
  { value: { city: 'San Francisco', country: 'US' }, patterns: [/san\s*francisco/i, /\bsf\b/i] },
  { value: { city: 'Chicago', country: 'US' }, patterns: [/chicago/i] },
  { value: { city: 'Boston', country: 'US' }, patterns: [/boston/i] },
  { value: { city: 'Dubai', country: 'UAE' }, patterns: [/dubai/i] },
  { value: { city: 'Tel Aviv', country: 'Israel' }, patterns: [/tel\s*aviv/i] },
  { value: { city: 'Toronto', country: 'Canada' }, patterns: [/toronto/i] },
  { value: { city: 'Munich', country: 'Germany' }, patterns: [/munich/i] },
  { value: { city: 'Berlin', country: 'Germany' }, patterns: [/berlin/i] },
  { value: { city: 'Madrid', country: 'Spain' }, patterns: [/madrid/i] },
  { value: { city: 'Milan', country: 'Italy' }, patterns: [/milan/i] },
  { value: { city: 'Dublin', country: 'Ireland' }, patterns: [/dublin/i] },
  { value: { city: 'Stockholm', country: 'Sweden' }, patterns: [/stockholm/i] },
  { value: { city: 'Seoul', country: 'South Korea' }, patterns: [/seoul/i] },
  { value: { city: 'Shanghai', country: 'China' }, patterns: [/shanghai/i] },
  { value: { city: 'Mumbai', country: 'India' }, patterns: [/mumbai/i] },
  { value: { city: 'Johannesburg', country: 'South Africa' }, patterns: [/johannesburg/i] },
  // Countries
  { value: { city: null, country: 'UK' }, patterns: [/\buk\b/i, /united\s*kingdom/i, /great\s*britain/i] },
  { value: { city: null, country: 'US' }, patterns: [/\bus\b/i, /united\s*states/i, /usa/i] },
  { value: { city: null, country: 'Germany' }, patterns: [/germany/i, /deutschland/i] },
  { value: { city: null, country: 'France' }, patterns: [/france/i] },
  { value: { city: null, country: 'Switzerland' }, patterns: [/switzerland/i, /schweiz/i] },
  { value: { city: null, country: 'Japan' }, patterns: [/japan/i] },
  { value: { city: null, country: 'Australia' }, patterns: [/australia/i] },
  { value: { city: null, country: 'Canada' }, patterns: [/canada/i] },
  { value: { city: null, country: 'UAE' }, patterns: [/\buae\b/i, /emirates/i] },
  { value: { city: null, country: 'Israel' }, patterns: [/israel/i] },
  { value: { city: null, country: 'Netherlands' }, patterns: [/netherlands/i, /holland/i] },
  { value: { city: null, country: 'Singapore' }, patterns: [/singapore/i] },
  { value: { city: null, country: 'Hong Kong' }, patterns: [/hong\s*kong/i] },
  { value: { city: null, country: 'China' }, patterns: [/china/i] },
  { value: { city: null, country: 'India' }, patterns: [/india/i] },
]

function extractYear(str) {
  if (!str) return { value: null, confidence: 'unknown' }
  const match = str.match(YEAR_PATTERN)
  return match
    ? { value: parseInt(match[1]), confidence: 'explicit' }
    : { value: null, confidence: 'unknown' }
}

function extractFirstMatch(str, patterns) {
  if (!str) return { value: null, confidence: 'unknown' }
  for (const { value, patterns: pats } of patterns) {
    for (const pat of pats) {
      if (pat.test(str)) {
        return { value, confidence: 'title_inferred' }
      }
    }
  }
  return { value: null, confidence: 'unknown' }
}

function extractGeography(str) {
  if (!str) return { city: null, country: null, confidence: 'unknown' }
  for (const { value, patterns } of GEOGRAPHY_PATTERNS) {
    for (const pat of patterns) {
      if (pat.test(str)) {
        return { ...value, confidence: 'title_inferred' }
      }
    }
  }
  return { city: null, country: null, confidence: 'unknown' }
}

function enrichTrackerEntry(entry) {
  const title = entry.programme || entry.jobTitle || entry.title || ''
  const division = entry.division || ''
  const location = entry.location || entry.office || ''

  // Extract from title
  const yearFromTitle = extractYear(title)
  const programmeFromTitle = extractFirstMatch(title, PROGRAMME_PATTERNS)
  const functionFromTitle = extractFirstMatch(title, FUNCTION_PATTERNS)
  const divisionFromTitle = extractFirstMatch(title, DIVISION_PATTERNS)
  const specFromTitle = extractFirstMatch(title, SPECIALIZATION_PATTERNS)
  const assetClassFromTitle = extractFirstMatch(title, ASSET_CLASS_PATTERNS)
  const seniorityFromTitle = extractFirstMatch(title, SENIORITY_PATTERNS)
  const geoFromTitle = extractGeography(title)

  // Extract from explicit fields
  const yearFromField = entry.year ? { value: parseInt(entry.year) || null, confidence: 'explicit' } : { value: null, confidence: 'unknown' }
  const divisionFromField = division ? { value: division, confidence: 'explicit' } : { value: null, confidence: 'unknown' }
  const geoFromField = extractGeography(location)

  // Merge: explicit fields > title-inferred > unknown
  const year = yearFromField.confidence === 'explicit' ? yearFromField : yearFromTitle
  const programme = programmeFromTitle
  const func = functionFromTitle
  const div = divisionFromField.confidence === 'explicit' ? divisionFromField : divisionFromTitle
  const spec = specFromTitle
  const assetClass = assetClassFromTitle
  const seniority = seniorityFromTitle
  const geo = geoFromField.confidence !== 'unknown' ? geoFromField : geoFromTitle

  return {
    raw: {
      programme: entry.programme || null,
      division: entry.division || null,
      office: entry.office || null,
      location: entry.location || null,
      year: entry.year || null,
    },
    enriched: {
      year,
      programme,
      function: func,
      division: div,
      specialization: spec,
      assetClass,
      seniority,
      geography: geo,
    },
  }
}

export {
  enrichTrackerEntry,
  extractYear,
  extractFirstMatch,
  extractGeography,
  PROGRAMME_PATTERNS,
  FUNCTION_PATTERNS,
  DIVISION_PATTERNS,
  SPECIALIZATION_PATTERNS,
  ASSET_CLASS_PATTERNS,
  SENIORITY_PATTERNS,
  GEOGRAPHY_PATTERNS,
}
