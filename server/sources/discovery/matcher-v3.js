// Matcher V3: Available-evidence scoring, semantic compatibility, ambiguity detection
// Uses enriched tracker + direct job data for precise matching

import { enrichTrackerEntry } from './enrich.js'
import { normalizeEntry, normalizeLocation, normalizeSeniority } from './normalizer-v2.js'

const MATCH_THRESHOLDS = {
  auto: 0.90,
  review: 0.70,
}

const AMBIGUITY_MARGIN = 0.05 // best - second must exceed this

// ─── Direct ID Match ───────────────────────────────────────────────────
function matchById(tracker, direct) {
  if (tracker.applyUrl && direct.url && tracker.applyUrl === direct.url) {
    return { matched: true, confidence: 1.0, method: 'url_exact' }
  }
  if (tracker.sourceJobId && direct.sourceJobId && tracker.sourceJobId === direct.sourceJobId) {
    return { matched: true, confidence: 1.0, method: 'source_job_id' }
  }
  return { matched: false }
}

// ─── Function Compatibility ────────────────────────────────────────────
// Precise semantic matching between tracker function and direct job function
const FUNCTION_COMPAT = {
  // Exact matches
  'investment_banking': { investment_banking: 1.0 },
  'private_equity': { private_equity: 1.0 },
  'private_credit': { private_credit: 1.0, credit: 0.8 },
  'trading': { trading: 1.0 },
  'research': { research: 1.0 },
  'risk_management': { risk_management: 1.0 },
  'asset_management': { asset_management: 1.0 },
  'quantitative': { quantitative: 1.0, trading: 0.7, research: 0.7 },
  'product': { product: 1.0 },
  'business_management': { business_management: 1.0, strategy: 0.8 },
  'technology': { technology: 1.0 },
  'human_resources': { human_resources: 1.0 },
  'finance': { finance: 1.0 },
  'consulting': { consulting: 1.0 },
  'strategy': { strategy: 1.0, business_management: 0.8 },
  // Incompatible pairs (hard mismatch)
  '_incompatible': {
    'investment_banking': ['trading', 'risk_management', 'human_resources', 'technology', 'product'],
    'private_equity': ['trading', 'risk_management', 'human_resources', 'technology', 'product'],
    'trading': ['investment_banking', 'private_equity', 'risk_management', 'human_resources', 'technology', 'product'],
    'research': ['trading', 'risk_management', 'human_resources', 'technology', 'product'],
    'risk_management': ['investment_banking', 'private_equity', 'trading', 'research', 'human_resources'],
    'asset_management': ['trading', 'risk_management', 'human_resources', 'technology'],
    'quantitative': ['human_resources', 'technology', 'product', 'business_management'],
    'product': ['investment_banking', 'private_equity', 'trading', 'research', 'risk_management'],
    'business_management': ['investment_banking', 'trading', 'research'],
    'technology': ['investment_banking', 'private_equity', 'trading', 'research', 'risk_management', 'asset_management'],
    'human_resources': ['investment_banking', 'private_equity', 'trading', 'research', 'risk_management', 'asset_management', 'technology'],
    'finance': ['trading', 'risk_management', 'human_resources', 'technology'],
    'consulting': ['trading', 'risk_management', 'human_resources', 'technology'],
    'strategy': ['trading', 'risk_management', 'human_resources', 'technology'],
  },
}

function scoreFunctionMatch(trackerEnriched, directEnriched) {
  const t = trackerEnriched.function.value
  const d = directEnriched.function.value

  if (!t && !d) return { score: 0.5, confidence: 'unknown', reason: 'both_unknown' }
  if (!t || !d) return { score: 0.5, confidence: 'unknown', reason: 'one_unknown' }

  // Check incompatibility first
  if (FUNCTION_COMPAT._incompatible[t]?.includes(d) || FUNCTION_COMPAT._incompatible[d]?.includes(t)) {
    return { score: 0.0, confidence: 'high', reason: 'incompatible' }
  }

  // Check exact match
  if (FUNCTION_COMPAT[t]?.[d] !== undefined) {
    const s = FUNCTION_COMPAT[t][d]
    return { score: s, confidence: s >= 0.8 ? 'high' : 'medium', reason: s === 1.0 ? 'exact' : 'related' }
  }

  return { score: 0.2, confidence: 'low', reason: 'unrelated' }
}

// ─── Division Compatibility ────────────────────────────────────────────
function scoreDivisionMatch(trackerEnriched, directEnriched) {
  const t = trackerEnriched.division.value
  const d = directEnriched.division.value

  if (!t && !d) return { score: 0.5, confidence: 'unknown', reason: 'both_unknown' }
  if (!t || !d) return { score: 0.5, confidence: 'unknown', reason: 'one_unknown' }

  if (t === d) return { score: 1.0, confidence: 'high', reason: 'exact' }

  // Related divisions within same asset class
  const related = {
    'investment_banking': ['private_credit'],
    'private_equity': ['private_credit'],
    'private_credit': ['investment_banking', 'private_equity', 'credit'],
    'equities': ['multi_asset'],
    'fixed_income': ['credit', 'multi_asset'],
    'credit': ['fixed_income', 'private_credit'],
    'multi_asset': ['equities', 'fixed_income'],
  }

  if (related[t]?.includes(d) || related[d]?.includes(t)) {
    return { score: 0.7, confidence: 'medium', reason: 'related' }
  }

  return { score: 0.1, confidence: 'medium', reason: 'unrelated' }
}

// ─── Specialization Match ──────────────────────────────────────────────
function scoreSpecializationMatch(trackerEnriched, directEnriched) {
  const t = trackerEnriched.specialization.value
  const d = directEnriched.specialization.value

  if (!t && !d) return { score: 0.5, confidence: 'unknown', reason: 'both_unknown' }
  if (!t || !d) return { score: 0.5, confidence: 'unknown', reason: 'one_unknown' }

  if (t === d) return { score: 1.0, confidence: 'high', reason: 'exact' }

  // Quantitative is compatible with trading/research specializations
  if (t === 'quantitative' && ['trading', 'research'].includes(d)) {
    return { score: 0.7, confidence: 'medium', reason: 'related' }
  }
  if (d === 'quantitative' && ['trading', 'research'].includes(t)) {
    return { score: 0.7, confidence: 'medium', reason: 'related' }
  }

  return { score: 0.2, confidence: 'medium', reason: 'unrelated' }
}

// ─── Programme Match ───────────────────────────────────────────────────
function scoreProgrammeMatch(trackerEnriched, directEnriched) {
  const t = trackerEnriched.programme.value
  const d = directEnriched.programme.value

  if (!t && !d) return { score: 0.5, confidence: 'unknown', reason: 'both_unknown' }
  if (!t || !d) return { score: 0.5, confidence: 'unknown', reason: 'one_unknown' }

  if (t === d) return { score: 1.0, confidence: 'high', reason: 'exact' }

  // Incompatible programme types
  const internTypes = ['spring_week', 'summer_intern']
  const fullTimeTypes = ['graduate', 'experienced']
  if (internTypes.includes(t) && fullTimeTypes.includes(d)) {
    return { score: 0.0, confidence: 'high', reason: 'incompatible' }
  }
  if (fullTimeTypes.includes(t) && internTypes.includes(d)) {
    return { score: 0.0, confidence: 'high', reason: 'incompatible' }
  }

  return { score: 0.2, confidence: 'low', reason: 'different_type' }
}

// ─── Location Match ────────────────────────────────────────────────────
function scoreLocationMatch(trackerEnriched, directEnriched) {
  const tGeo = trackerEnriched.geography
  const dGeo = directEnriched.geography

  const tHasGeo = tGeo.city || tGeo.country
  const dHasGeo = dGeo.city || dGeo.country

  // Both unknown → neutral (not negative)
  if (!tHasGeo && !dHasGeo) return { score: 0.5, confidence: 'unknown', reason: 'both_unknown' }
  // Tracker unknown → neutral
  if (!tHasGeo) return { score: 0.5, confidence: 'unknown', reason: 'tracker_unknown' }
  // Direct unknown → neutral
  if (!dHasGeo) return { score: 0.5, confidence: 'unknown', reason: 'direct_unknown' }

  // City match
  if (tGeo.city && dGeo.city && tGeo.city === dGeo.city) {
    return { score: 1.0, confidence: 'high', reason: 'city_exact' }
  }

  // Country match
  if (tGeo.country && dGeo.country && tGeo.country === dGeo.country) {
    return { score: 0.8, confidence: 'high', reason: 'country_exact' }
  }

  // Hard incompatibility: different countries
  return { score: 0.0, confidence: 'high', reason: 'country_conflict' }
}

// ─── Cycle Match ───────────────────────────────────────────────────────
function scoreCycleMatch(trackerEnriched, directEnriched) {
  const tYear = trackerEnriched.year.value
  const dYear = directEnriched.year.value

  if (!tYear && !dYear) return { score: 0.5, confidence: 'unknown', reason: 'both_unknown' }
  if (!tYear || !dYear) return { score: 0.5, confidence: 'unknown', reason: 'one_unknown' }

  if (tYear === dYear) return { score: 1.0, confidence: 'high', reason: 'exact' }
  if (Math.abs(tYear - dYear) <= 1) return { score: 0.6, confidence: 'medium', reason: 'adjacent' }

  // Hard incompatibility: >1 year apart
  return { score: 0.0, confidence: 'high', reason: 'year_conflict' }
}

// ─── Seniority Match ───────────────────────────────────────────────────
function scoreSeniorityMatch(trackerEnriched, directEnriched) {
  const t = trackerEnriched.seniority.value
  const d = directEnriched.seniority.value

  if (!t && !d) return { score: 0.5, confidence: 'unknown', reason: 'both_unknown' }
  if (!t || !d) return { score: 0.5, confidence: 'unknown', reason: 'one_unknown' }

  if (t === d) return { score: 1.0, confidence: 'high', reason: 'exact' }

  // Hard incompatibility: intern vs director+
  const internLevels = ['intern']
  const seniorLevels = ['vp', 'director', 'partner']
  if (internLevels.includes(t) && seniorLevels.includes(d)) return { score: 0.0, confidence: 'high', reason: 'seniority_conflict' }
  if (seniorLevels.includes(t) && internLevels.includes(d)) return { score: 0.0, confidence: 'high', reason: 'seniority_conflict' }

  return { score: 0.3, confidence: 'low', reason: 'different_level' }
}

// ─── Enrich Direct Job ─────────────────────────────────────────────────
function enrichDirectJob(directJob) {
  const title = directJob.title || directJob.jobTitle || ''
  const location = directJob.location || ''

  // Filter: exclude non-job roles
  const titleLower = title.toLowerCase()
  const isExcluded = /campus\s*recruiter|recruiter|networking\s*event|career\s*fair|information\s*session|webinar|panel|presentation|coffee|chat|office\s*tour|open\s*day|taster|insight\s*day|explorer|\bsim\b/i.test(title)
  const isFullTimeOnly = /vice\s*president|\bvp\b|director|managing\s*director|\bmd\b|partner|principal|executive|senior\b|lead\b|head\s*of/i.test(title) && !/intern/i.test(title)
  const isInternRole = /intern|summer|spring|placement|sandwich|year\s*in|gap\s*year/i.test(title)
  const isRoleType = /(?:engineer|developer|specialist|manager|strategist|broker|trader|trading|sales|researcher|architect|administrator|coordinator|consultant|officer|commissioner|inspector|auditor|analyst)\b/i.test(title) && !isInternRole
  const isNotIntern = /full\s*time|permanent|staff|mid[- ]?level|entry[- ]?level(?!.*intern)/i.test(title) && !isInternRole

  // Parse function from title
  const FUNCTION_PATTERNS = [
    { value: 'private_equity', patterns: [/private\s*equity/i, /\bpe\b/i] },
    { value: 'private_credit', patterns: [/private\s*credit/i, /direct\s*lending/i] },
    { value: 'investment_banking', patterns: [/investment\s*bank/i, /\bibd\b/i, /\bib\b/i, /corporate\s*finance/i, /restructuring/i] },
    { value: 'asset_management', patterns: [/asset\s*management/i, /investment\s*management/i, /fund\s*management/i, /portfolio\s*management/i, /wealth\s*management/i, /private\s*wealth/i] },
    { value: 'technology', patterns: [/technology/i, /\btech\b/i, /engineering/i, /software/i, /data\s*science/i, /machine\s*learning/i, /infrastructure/i, /platform/i, /systems?\b/i, /compiler/i, /\bapi\b/i, /\bdevops\b/i, /\bcloud\b/i, /\bsecurity\b/i, /cybersecurity/i, /blockchain/i, /\bweb\b/i, /\bapp(?:lication)?\b/i, /\btool/i, /\bbuild\b/i, /\bdeploy/i, /\bautomat/i, /\bdata\b/i, /\bml\b/i, /\bai\b/i, /\bdeep\s*learning/i, /\bnatural\s*language/i, /\bcomputer\s*vision/i, /\brecommender/i] },
    { value: 'research', patterns: [/research/i, /equity\s*research/i, /quantitative\s*research/i] },
    { value: 'risk_management', patterns: [/risk\s*management/i, /market\s*risk/i, /credit\s*risk/i] },
    { value: 'trading', patterns: [/sales\s*(?:and|&)\s*trading/i, /\bs&t\b/i, /global\s*markets/i, /ficc/i, /flow\s*trading/i, /structuring/i, /\btrading\b/i, /\btrader\b/i] },
    { value: 'quantitative', patterns: [/quantitative/i, /\bquant\b/i, /systematic/i] },
    { value: 'product', patterns: [/product\s*(?:analyst|management|manager)/i] },
    { value: 'business_management', patterns: [/business\s*management/i, /business\s*development/i] },
    { value: 'human_resources', patterns: [/human\s*resources/i, /\bhr\b/i, /talent/i, /recruiting/i] },
    { value: 'finance', patterns: [/finance/i, /financial/i] },
    { value: 'strategy', patterns: [/strategy/i, /strategic/i] },
  ]

  let func = null
  for (const { value, patterns } of FUNCTION_PATTERNS) {
    for (const pat of patterns) {
      if (pat.test(title)) { func = value; break }
    }
    if (func) break
  }

  // Parse division from title/department
  const DIVISION_PATTERNS = [
    { value: 'private_equity', patterns: [/private\s*equity/i, /\bpe\b/i] },
    { value: 'private_credit', patterns: [/private\s*credit/i] },
    { value: 'investment_banking', patterns: [/investment\s*bank/i, /\bibd\b/i, /\bib\b/i] },
    { value: 'equities', patterns: [/equities/i] },
    { value: 'fixed_income', patterns: [/fixed\s*income/i] },
    { value: 'credit', patterns: [/credit/i] },
  ]

  let div = null
  for (const { value, patterns } of DIVISION_PATTERNS) {
    for (const pat of patterns) {
      if (pat.test(title)) { div = value; break }
    }
    if (div) break
  }

  // Parse specialization
  let spec = null
  if (/quantitative/i.test(title) || /\bquant\b/i.test(title)) spec = 'quantitative'
  else if (/fundamental/i.test(title)) spec = 'fundamental'
  else if (/macro/i.test(title)) spec = 'macro'

  // Parse seniority
  const seniority = normalizeSeniority(title)

  // Parse year
  const yearMatch = title.match(/20[2-3]\d/)
  const year = yearMatch ? parseInt(yearMatch[0]) : null

  // Parse programme type
  let programme = null
  if (/summer\s*(?:analyst|intern|associate)/i.test(title) || /intern(?:ship)?/i.test(title)) programme = 'summer_intern'
  else if (/spring/i.test(title)) programme = 'spring_week'
  else if (/graduate/i.test(title) || /full[\s-]*time/i.test(title)) programme = 'graduate'

  // Parse geography
  const geo = normalizeLocation(location)

  return {
    enriched: {
      year: { value: year, confidence: year ? 'title_inferred' : 'unknown' },
      programme: { value: programme, confidence: programme ? 'title_inferred' : 'unknown' },
      function: { value: func, confidence: func ? 'title_inferred' : 'unknown' },
      division: { value: div, confidence: div ? 'title_inferred' : 'unknown' },
      specialization: { value: spec, confidence: spec ? 'title_inferred' : 'unknown' },
      seniority: { value: seniority, confidence: seniority ? 'title_inferred' : 'unknown' },
      geography: { city: geo.city, country: geo.country, confidence: geo.city || geo.country ? 'title_inferred' : 'unknown' },
    },
    meta: { isExcluded, isFullTimeOnly, isRoleType, isNotIntern, isInternRole },
    raw: { title, location },
  }
}

// ─── Main Match Function ───────────────────────────────────────────────
function matchOpportunityV3(trackerEntry, directJob) {
  // Step 1: Direct ID match
  const idMatch = matchById(trackerEntry, directJob)
  if (idMatch.matched) {
    return {
      total: idMatch.confidence,
      confidence: 'auto',
      scores: { id: idMatch.confidence },
      weights: { id: 1.0 },
      method: idMatch.method,
      incompatibilities: [],
      ambiguous: false,
      trackerId: trackerEntry.id,
      directJobId: directJob.id || null,
    }
  }

  // Step 2: Enrich both sides
  const trackerEnriched = trackerEntry._enriched || enrichTrackerEntry(trackerEntry).enriched
  const directResult = enrichDirectJob(directJob)
  const directEnriched = directResult.enriched
  const directMeta = directResult.meta

  // Determine tracker role type (intern, event/programme, etc.)
  const trackerIsInternRole = trackerEnriched.seniority.value === 'intern' || trackerEnriched.programme.value === 'summer_intern' || trackerEnriched.programme.value === 'spring_week'
  const trackerIsEventOrProgramme = /diversity|women|non[- ]binary|lgbtq|neurodiverse|networking|insight|explorer|outreach|flagship|taster|discovery/i.test(trackerEntry.programme || '')

  // Step 2.5: Filter out excluded roles (events, recruiters, full-time only)
  if (directMeta.isExcluded) {
    return {
      total: 0,
      confidence: 'low',
      scores: {},
      scoreReasons: {},
      weights: {},
      method: 'semantic_v3',
      incompatibilities: [],
      hasHardIncompatibility: false,
      ambiguous: false,
      filtered: true,
      filterReason: 'excluded_role',
      trackerId: trackerEntry.id,
      directJobId: directJob.id || null,
    }
  }

  // Filter: event/programme trackers should not match any direct jobs
  if (trackerIsEventOrProgramme) {
    return {
      total: 0,
      confidence: 'low',
      scores: {},
      scoreReasons: {},
      weights: {},
      method: 'semantic_v3',
      incompatibilities: [{ dimension: 'seniority', reason: 'event_tracker' }],
      hasHardIncompatibility: true,
      ambiguous: false,
      filtered: true,
      filterReason: 'event_tracker',
      trackerId: trackerEntry.id,
      directJobId: directJob.id || null,
    }
  }
  if (directMeta.isFullTimeOnly) {
    // Check if tracker is an internship or event/programme
    if (trackerIsInternRole || trackerIsEventOrProgramme) {
      return {
        total: 0,
        confidence: 'low',
        scores: {},
        scoreReasons: {},
        weights: {},
        method: 'semantic_v3',
        incompatibilities: [{ dimension: 'seniority', reason: 'full_time_vs_intern' }],
        hasHardIncompatibility: true,
        ambiguous: false,
        filtered: true,
        filterReason: 'full_time_vs_intern',
        trackerId: trackerEntry.id,
        directJobId: directJob.id || null,
      }
    }
  }
  if (directMeta.isRoleType) {
    // Direct job is a non-intern role type (engineer, manager, specialist, etc.)
    const trackerIsIntern = trackerIsInternRole || trackerIsEventOrProgramme
    if (trackerIsIntern && !directMeta.isInternRole) {
      return {
        total: 0,
        confidence: 'low',
        scores: {},
        scoreReasons: {},
        weights: {},
        method: 'semantic_v3',
        incompatibilities: [{ dimension: 'seniority', reason: 'full_time_role_vs_intern' }],
        hasHardIncompatibility: true,
        ambiguous: false,
        filtered: true,
        filterReason: 'full_time_role_vs_intern',
        trackerId: trackerEntry.id,
        directJobId: directJob.id || null,
      }
    }
  }

  // Step 3: Score each dimension
  const scores = {
    function: scoreFunctionMatch(trackerEnriched, directEnriched),
    programme: scoreProgrammeMatch(trackerEnriched, directEnriched),
    division: scoreDivisionMatch(trackerEnriched, directEnriched),
    cycle: scoreCycleMatch(trackerEnriched, directEnriched),
    location: scoreLocationMatch(trackerEnriched, directEnriched),
    specialization: scoreSpecializationMatch(trackerEnriched, directEnriched),
    seniority: scoreSeniorityMatch(trackerEnriched, directEnriched),
  }

  // Step 4: Check for hard incompatibilities
  const incompatibilities = Object.entries(scores)
    .filter(([_, s]) => s.reason?.includes('incompatible') || s.reason?.includes('conflict'))
    .map(([dim, s]) => ({ dimension: dim, reason: s.reason, detail: s.score === 0 ? `${dim} conflict` : s.reason }))

  const hasHardIncompatibility = incompatibilities.length > 0

  // Step 5: Available-evidence scoring
  // Only count dimensions where BOTH sides have evidence (not unknown)
  // Unknown dimensions are excluded entirely, not scored as 0.5
  const DIMENSION_WEIGHTS = { function: 0.30, programme: 0.25, division: 0.15, cycle: 0.10, location: 0.10, specialization: 0.05, seniority: 0.05 }

  const scorableDimensions = Object.entries(scores).filter(([dim, s]) => {
    // Only score if at least one side has real evidence
    return s.confidence !== 'unknown'
  })

  // Require minimum evidence: function OR division must have evidence
  // Without knowing what the role IS, programme+seniority alone can't distinguish
  // "Summer Internship in IB" from "Summer Internship in HR"
  const hasFunctionEvidence = scores.function.confidence !== 'unknown'
  const hasDivisionEvidence = scores.division.confidence !== 'unknown'
  const hasEnoughEvidence = hasFunctionEvidence || hasDivisionEvidence

  if (!hasEnoughEvidence) {
    // Not enough evidence to make a meaningful match
    return {
      total: 0,
      confidence: 'low',
      scores: Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, v.score])),
      scoreReasons: Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, v.reason])),
      scoreConfidence: Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, v.confidence])),
      weights: {},
      method: 'semantic_v3',
      incompatibilities,
      hasHardIncompatibility,
      ambiguous: false,
      trackerId: trackerEntry.id,
      directJobId: directJob.id || null,
      trackerCompany: trackerEntry.companyName,
      directCompany: directJob.companyName || directJob.company,
      trackerProgramme: trackerEntry.programme,
      directTitle: directJob.title || directJob.jobTitle,
      insufficientEvidence: true,
    }
  }

  const totalWeight = scorableDimensions.reduce((sum, [dim]) => sum + (DIMENSION_WEIGHTS[dim] || 0), 0)

  let total = 0
  if (totalWeight > 0) {
    total = scorableDimensions.reduce((sum, [dim, s]) => {
      return sum + (s.score * (DIMENSION_WEIGHTS[dim] || 0) / totalWeight)
    }, 0)
  }

  // Step 6: Apply hard incompatibility penalty
  if (hasHardIncompatibility) {
    total *= 0.1
  }

  // Step 7: Determine confidence
  let confidence = 'low'
  if (total >= MATCH_THRESHOLDS.auto) confidence = 'auto'
  else if (total >= MATCH_THRESHOLDS.review) confidence = 'review'

  return {
    total,
    confidence,
    scores: Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, v.score])),
    scoreReasons: Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, v.reason])),
    scoreConfidence: Object.fromEntries(Object.entries(scores).map(([k, v]) => [k, v.confidence])),
    weights: totalWeight > 0
      ? Object.fromEntries(scorableDimensions.map(([dim]) => [dim, (DIMENSION_WEIGHTS[dim] || 0) / totalWeight]))
      : {},
    method: 'semantic_v3',
    incompatibilities,
    hasHardIncompatibility,
    ambiguous: false, // Set by batch matching
    trackerId: trackerEntry.id,
    directJobId: directJob.id || null,
    trackerCompany: trackerEntry.companyName,
    directCompany: directJob.companyName || directJob.company,
    trackerProgramme: trackerEntry.programme,
    directTitle: directJob.title || directJob.jobTitle,
  }
}

// ─── Match Tracker Against All Direct Jobs for a Firm ──────────────────
function matchTrackerToDirectJobsV3(trackerEntry, directJobs) {
  const matches = directJobs
    .map(direct => matchOpportunityV3(trackerEntry, direct))
    .sort((a, b) => b.total - a.total)

  const best = matches[0] || null
  const second = matches[1] || null

  // Ambiguity detection: if best and second are too close, mark as ambiguous
  let ambiguous = false
  if (best && second) {
    const margin = best.total - second.total
    if (margin < AMBIGUITY_MARGIN && best.confidence !== 'auto') {
      ambiguous = true
    }
  }

  if (best) best.ambiguous = ambiguous

  return {
    trackerEntry,
    bestMatch: best,
    allMatches: matches.slice(0, 5),
    hasAutoMatch: !ambiguous && best?.confidence === 'auto',
    hasReviewMatch: !ambiguous && best?.confidence === 'review',
    ambiguous,
    margin: best && second ? best.total - second.total : null,
  }
}

// ─── Batch Match ───────────────────────────────────────────────────────
function batchMatchV3(trackerEntries, directJobsByFirm) {
  const results = []
  const stats = {
    total: trackerEntries.length,
    autoMatched: 0,
    reviewNeeded: 0,
    ambiguous: 0,
    unmatched: 0,
    hardIncompatible: 0,
  }

  for (const tracker of trackerEntries) {
    const firmId = tracker.resolvedFirmId || tracker.companyName?.toLowerCase().replace(/\s+/g, '-')
    const directJobs = directJobsByFirm[firmId] || []

    const matchResult = matchTrackerToDirectJobsV3(tracker, directJobs)
    results.push(matchResult)

    if (matchResult.hasAutoMatch) stats.autoMatched++
    else if (matchResult.hasReviewMatch) stats.reviewNeeded++
    else if (matchResult.ambiguous) stats.ambiguous++
    else stats.unmatched++

    if (matchResult.bestMatch?.hasHardIncompatibility) stats.hardIncompatible++
  }

  return { results, stats }
}

export {
  matchById,
  scoreFunctionMatch,
  scoreDivisionMatch,
  scoreSpecializationMatch,
  scoreProgrammeMatch,
  scoreLocationMatch,
  scoreCycleMatch,
  scoreSeniorityMatch,
  enrichDirectJob,
  matchOpportunityV3,
  matchTrackerToDirectJobsV3,
  batchMatchV3,
  MATCH_THRESHOLDS,
  AMBIGUITY_MARGIN,
  FUNCTION_COMPAT,
}
