// Matcher V2: Structured finance recruiting semantics
// Reweighted scoring within resolved firm context + hard incompatibility rules

import {
  normalizeEntry,
  areCompatible,
  normalizeProgramme,
  normalizeDivision,
  normalizeLocation,
  normalizeSeniority,
  extractYear,
} from './normalizer-v2.js'

const MATCH_THRESHOLDS = {
  auto: 0.90,
  review: 0.70,
}

// ─── Direct ID Match (trumps everything) ────────────────────────────────
function matchById(tracker, direct) {
  if (tracker.applyUrl && direct.url && tracker.applyUrl === direct.url) {
    return { matched: true, confidence: 1.0, method: 'url_exact' }
  }
  if (tracker.sourceJobId && direct.sourceJobId && tracker.sourceJobId === direct.sourceJobId) {
    return { matched: true, confidence: 1.0, method: 'source_job_id' }
  }
  return { matched: false }
}

// ─── Programme Match ────────────────────────────────────────────────────
function scoreProgrammeMatch(normTracker, normDirect) {
  const t = normTracker.programme
  const d = normDirect.programme

  if (!t && !d) return { score: 0.5, reason: 'both_unknown' }
  if (!t || !d) return { score: 0.3, reason: 'one_unknown' }

  if (t === d) return { score: 1.0, reason: 'exact' }

  // Spring week ↔ insight is handled by normalization synonyms
  // If both normalized to same canonical, they match
  return { score: 0.1, reason: 'different_type' }
}

// ─── Division Match ─────────────────────────────────────────────────────
function scoreDivisionMatch(normTracker, normDirect) {
  const t = normTracker.division
  const d = normDirect.division

  if (!t && !d) return { score: 0.5, reason: 'both_unknown' }
  if (!t || !d) return { score: 0.3, reason: 'one_unknown' }

  if (t === d) return { score: 1.0, reason: 'exact' }

  // Related divisions (within same umbrella)
  const related = {
    'IB': ['Advisory', 'Consulting'],
    'Advisory': ['IB', 'Consulting'],
    'PE': ['HF', 'AM'],
    'HF': ['PE', 'AM', 'Quant'],
    'AM': ['PE', 'HF'],
    'Quant': ['HF', 'S&T'],
    'S&T': ['Quant'],
    'Consulting': ['IB', 'Advisory'],
  }

  if (related[t]?.includes(d) || related[d]?.includes(t)) {
    return { score: 0.6, reason: 'related' }
  }

  // Incompatible divisions get 0
  const incompatible = {
    'IB': ['AM', 'S&T', 'Quant', 'Tech'],
    'PE': ['S&T', 'Tech'],
    'HF': ['S&T', 'Tech'],
    'AM': ['IB', 'S&T', 'Quant', 'Tech'],
    'S&T': ['IB', 'PE', 'Tech'],
    'Quant': ['IB', 'Tech'],
    'Tech': ['IB', 'PE', 'HF', 'AM', 'S&T', 'Quant'],
  }

  if (incompatible[t]?.includes(d) || incompatible[d]?.includes(t)) {
    return { score: 0.0, reason: 'incompatible' }
  }

  return { score: 0.1, reason: 'unrelated' }
}

// ─── Location Match ─────────────────────────────────────────────────────
function scoreLocationMatch(normTracker, normDirect) {
  const tCity = normTracker.location.city
  const tCountry = normTracker.location.country
  const dCity = normDirect.location.city
  const dCountry = normDirect.location.country

  if (!tCity && !tCountry && !dCity && !dCountry) {
    return { score: 0.5, reason: 'both_unknown' }
  }
  if (!tCity && !tCountry) return { score: 0.3, reason: 'tracker_unknown' }
  if (!dCity && !dCountry) return { score: 0.3, reason: 'direct_unknown' }

  // City match
  if (tCity && dCity && tCity === dCity) {
    return { score: 1.0, reason: 'city_exact' }
  }

  // Country match
  if (tCountry && dCountry && tCountry === dCountry) {
    return { score: 0.8, reason: 'country_exact' }
  }

  // City in same country (e.g., London tracker vs UK direct)
  if (tCity && dCountry) {
    // Map city to country for comparison
    const cityCountryMap = {
      'London': 'UK', 'Edinburgh': 'UK', 'Manchester': 'UK',
      'New York': 'US', 'San Francisco': 'US', 'Chicago': 'US', 'Boston': 'US',
      'Frankfurt': 'Germany', 'Munich': 'Germany', 'Berlin': 'Germany',
      'Paris': 'France',
      'Hong Kong': 'Hong Kong',
      'Singapore': 'Singapore',
      'Tokyo': 'Japan',
      'Sydney': 'Australia', 'Melbourne': 'Australia',
      'Toronto': 'Canada', 'Vancouver': 'Canada',
      'Dublin': 'Ireland',
      'Zurich': 'Switzerland',
      'Amsterdam': 'Netherlands',
      'Stockholm': 'Sweden',
      'Dubai': 'UAE',
      'Tel Aviv': 'Israel',
    }
    if (cityCountryMap[tCity] === dCountry) {
      return { score: 0.7, reason: 'city_in_country' }
    }
  }

  // Different cities in same country → partial match
  if (tCountry && dCountry && tCountry === dCountry) {
    return { score: 0.6, reason: 'same_country_different_city' }
  }

  return { score: 0.1, reason: 'different_country' }
}

// ─── Cycle Match ────────────────────────────────────────────────────────
function scoreCycleMatch(normTracker, normDirect) {
  const tYear = normTracker.year
  const dYear = normDirect.year

  if (!tYear && !dYear) return { score: 0.5, reason: 'both_unknown' }
  if (!tYear || !dYear) return { score: 0.3, reason: 'one_unknown' }

  if (tYear === dYear) return { score: 1.0, reason: 'exact' }
  if (Math.abs(tYear - dYear) <= 1) return { score: 0.6, reason: 'adjacent' }

  return { score: 0.1, reason: 'different_year' }
}

// ─── Seniority Match ────────────────────────────────────────────────────
function scoreSeniorityMatch(normTracker, normDirect) {
  const t = normTracker.seniority
  const d = normDirect.seniority

  if (!t && !d) return { score: 0.5, reason: 'both_unknown' }
  if (!t || !d) return { score: 0.3, reason: 'one_unknown' }

  if (t === d) return { score: 1.0, reason: 'exact' }

  // Intern vs full-time is a hard mismatch (handled by incompatibility)
  return { score: 0.1, reason: 'different_level' }
}

// ─── Hard Incompatibility Rules ─────────────────────────────────────────
function checkIncompatibilities(normTracker, normDirect) {
  const issues = []

  // 1. Programme type incompatibility
  if (normTracker.programme && normDirect.programme) {
    const internTypes = ['spring_week', 'summer_intern']
    const fullTimeTypes = ['graduate', 'experienced']

    if (internTypes.includes(normTracker.programme) && fullTimeTypes.includes(normDirect.programme)) {
      issues.push({
        type: 'programme_incompatible',
        severity: 'hard',
        detail: `${normTracker.programme} ≠ ${normDirect.programme}`,
      })
    }
    if (fullTimeTypes.includes(normTracker.programme) && internTypes.includes(normDirect.programme)) {
      issues.push({
        type: 'programme_incompatible',
        severity: 'hard',
        detail: `${normTracker.programme} ≠ ${normDirect.programme}`,
      })
    }
  }

  // 2. Country incompatibility (different countries = hard mismatch)
  if (normTracker.location.country && normDirect.location.country) {
    if (normTracker.location.country !== normDirect.location.country) {
      issues.push({
        type: 'country_incompatible',
        severity: 'hard',
        detail: `${normTracker.location.country} ≠ ${normDirect.location.country}`,
      })
    }
  }

  // 3. Year incompatibility (>1 year apart)
  if (normTracker.year && normDirect.year) {
    if (Math.abs(normTracker.year - normDirect.year) > 1) {
      issues.push({
        type: 'year_incompatible',
        severity: 'hard',
        detail: `${normTracker.year} ≠ ${normDirect.year}`,
      })
    }
  }

  // 4. Seniority incompatibility (intern vs director+)
  if (normTracker.seniority && normDirect.seniority) {
    const internLevels = ['intern']
    const seniorLevels = ['vp', 'director']
    if (internLevels.includes(normTracker.seniority) && seniorLevels.includes(normDirect.seniority)) {
      issues.push({
        type: 'seniority_incompatible',
        severity: 'hard',
        detail: `${normTracker.seniority} ≠ ${normDirect.seniority}`,
      })
    }
    if (seniorLevels.includes(normTracker.seniority) && internLevels.includes(normDirect.seniority)) {
      issues.push({
        type: 'seniority_incompatible',
        severity: 'hard',
        detail: `${normTracker.seniority} ≠ ${normDirect.seniority}`,
      })
    }
  }

  // 5. Division incompatibility (IB vs AM/S&T/Quant/Consulting/Tech)
  if (normTracker.division && normDirect.division) {
    const incompatibleDivisions = {
      'IB': ['AM', 'S&T', 'Quant', 'Consulting', 'Tech'],
      'PE': ['S&T', 'Consulting', 'Tech'],
      'HF': ['S&T', 'Consulting', 'Tech'],
      'AM': ['IB', 'S&T', 'Consulting', 'Tech'],
      'S&T': ['IB', 'PE', 'Consulting', 'Tech'],
      'Quant': ['IB', 'Consulting', 'Tech'],
      'Consulting': ['IB', 'PE', 'HF', 'AM', 'S&T', 'Quant'],
      'Tech': ['IB', 'PE', 'HF', 'AM', 'S&T', 'Quant', 'Consulting'],
    }
    if (incompatibleDivisions[normTracker.division]?.includes(normDirect.division)) {
      issues.push({
        type: 'division_incompatible',
        severity: 'hard',
        detail: `${normTracker.division} ≠ ${normDirect.division}`,
      })
    }
  }

  return issues
}

// ─── Main Match Function ────────────────────────────────────────────────
function matchOpportunityV2(trackerEntry, directJob) {
  // Step 1: Direct ID match (trumps scoring)
  const idMatch = matchById(trackerEntry, directJob)
  if (idMatch.matched) {
    return {
      total: idMatch.confidence,
      confidence: 'auto',
      scores: { id: idMatch.confidence },
      weights: { id: 1.0 },
      method: idMatch.method,
      incompatibilities: [],
      trackerId: trackerEntry.id,
      directJobId: directJob.id || null,
      trackerCompany: trackerEntry.companyName,
      directCompany: directJob.companyName || directJob.company,
      trackerProgramme: trackerEntry.programme,
      directTitle: directJob.title || directJob.jobTitle,
    }
  }

  // Step 2: Normalize both entries
  const normTracker = normalizeEntry(trackerEntry)
  const normDirect = normalizeEntry(directJob)

  // Step 3: Check hard incompatibilities (zero out score if any)
  const incompatibilities = checkIncompatibilities(normTracker, normDirect)
  const hasHardIncompatibility = incompatibilities.some(i => i.severity === 'hard')

  // Step 4: Score each dimension
  const scores = {
    programme: scoreProgrammeMatch(normTracker, normDirect),
    division: scoreDivisionMatch(normTracker, normDirect),
    location: scoreLocationMatch(normTracker, normDirect),
    cycle: scoreCycleMatch(normTracker, normDirect),
    seniority: scoreSeniorityMatch(normTracker, normDirect),
  }

  // Step 5: Weighted combination (within resolved firm, company is always 1.0)
  const weights = {
    programme: 0.35,
    division: 0.25,
    location: 0.20,
    cycle: 0.15,
    seniority: 0.05,
  }

  let total = Object.entries(weights).reduce((sum, [key, weight]) => {
    return sum + scores[key].score * weight
  }, 0)

  // Step 6: Apply hard incompatibility penalty
  if (hasHardIncompatibility) {
    total *= 0.1  // 90% penalty for incompatible entries
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
    weights,
    method: 'semantic',
    incompatibilities,
    hasHardIncompatibility,
    trackerId: trackerEntry.id,
    directJobId: directJob.id || null,
    trackerCompany: trackerEntry.companyName,
    directCompany: directJob.companyName || directJob.company,
    trackerProgramme: trackerEntry.programme,
    directTitle: directJob.title || directJob.jobTitle,
  }
}

// ─── Match Tracker Against All Direct Jobs for a Firm ───────────────────
function matchTrackerToDirectJobsV2(trackerEntry, directJobs) {
  const matches = directJobs
    .map(direct => matchOpportunityV2(trackerEntry, direct))
    .sort((a, b) => b.total - a.total)

  return {
    trackerEntry,
    bestMatch: matches[0] || null,
    allMatches: matches.slice(0, 5),
    hasAutoMatch: matches.some(m => m.confidence === 'auto'),
    hasReviewMatch: matches.some(m => m.confidence === 'review'),
  }
}

// ─── Batch Match ────────────────────────────────────────────────────────
function batchMatchV2(trackerEntries, directJobsByFirm) {
  const results = []
  const stats = {
    total: trackerEntries.length,
    autoMatched: 0,
    reviewNeeded: 0,
    unmatched: 0,
    hardIncompatible: 0,
  }

  for (const tracker of trackerEntries) {
    const firmId = tracker.resolvedFirmId || tracker.companyName?.toLowerCase().replace(/\s+/g, '-')
    const directJobs = directJobsByFirm[firmId] || []

    const matchResult = matchTrackerToDirectJobsV2(tracker, directJobs)
    results.push(matchResult)

    if (matchResult.hasAutoMatch) {
      stats.autoMatched++
    } else if (matchResult.hasReviewMatch) {
      stats.reviewNeeded++
    } else {
      stats.unmatched++
    }

    if (matchResult.bestMatch?.hasHardIncompatibility) {
      stats.hardIncompatible++
    }
  }

  return { results, stats }
}

export {
  matchById,
  scoreProgrammeMatch,
  scoreDivisionMatch,
  scoreLocationMatch,
  scoreCycleMatch,
  scoreSeniorityMatch,
  checkIncompatibilities,
  matchOpportunityV2,
  matchTrackerToDirectJobsV2,
  batchMatchV2,
  MATCH_THRESHOLDS,
}
