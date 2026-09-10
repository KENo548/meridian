/**
 * Phase 2.1 Step 9 — Confidence Scoring
 *
 * Evidence-based confidence scoring for discovered ATS sources.
 * Each piece of evidence contributes a weight; final score capped at 1.0.
 */

// Evidence weights
const EVIDENCE_WEIGHTS = {
  OFFICIAL_CAREERS_LINK: 0.50,
  DOMAIN_MATCH: 0.20,
  ATS_ENDPOINT_RESPONDS: 0.15,
  JOBS_MATCH_COMPANY: 0.15,
  HTML_ATS_DETECTED: 0.10,
  REDIRECT_CHAIN: 0.05,
  STUDENT_PAGE_FOUND: 0.10,
  TRACKER_EVIDENCE: 0.08,
  CACHED_JOB_COUNT: 0.05,
}

// Confidence thresholds
const THRESHOLDS = {
  AUTO_VERIFY: 0.90,
  LIKELY: 0.70,
  UNCERTAIN: 0.50,
  LOW: 0.30,
}

/**
 * Calculate confidence score from evidence array.
 *
 * @param {Array} evidenceItems - Array of { type, value, data }
 * @returns {Object} { score, classification, breakdown }
 */
export function calculateConfidence(evidenceItems) {
  let score = 0
  const breakdown = []

  for (const item of evidenceItems) {
    const weight = EVIDENCE_WEIGHTS[item.type] || 0
    const contribution = weight * (item.multiplier || 1)
    score += contribution
    breakdown.push({
      type: item.type,
      weight,
      multiplier: item.multiplier || 1,
      contribution,
      description: item.description,
    })
  }

  // Cap at 1.0
  score = Math.min(score, 1.0)

  // Classify
  let classification
  if (score >= THRESHOLDS.AUTO_VERIFY) {
    classification = 'AUTO_VERIFY'
  } else if (score >= THRESHOLDS.LIKELY) {
    classification = 'LIKELY'
  } else if (score >= THRESHOLDS.UNCERTAIN) {
    classification = 'UNCERTAIN'
  } else {
    classification = 'LOW'
  }

  return { score, classification, breakdown }
}

/**
 * Build evidence items from discovery results.
 */
export function buildEvidenceFromDiscovery(discoveryResult) {
  const evidence = []

  // Official careers link found
  if (discoveryResult.hasOfficialCareersUrl) {
    evidence.push({
      type: 'OFFICIAL_CAREERS_LINK',
      description: 'Official company careers URL links to this ATS',
    })
  }

  // Domain match
  if (discoveryResult.domainMatch) {
    evidence.push({
      type: 'DOMAIN_MATCH',
      description: `ATS domain matches company domain: ${discoveryResult.domain}`,
    })
  }

  // ATS endpoint responds
  if (discoveryResult.endpointResponds) {
    evidence.push({
      type: 'ATS_ENDPOINT_RESPONDS',
      description: `ATS endpoint returns ${discoveryResult.httpStatus}`,
    })
  }

  // Jobs match company
  if (discoveryResult.jobCount > 0 && discoveryResult.companyMatchRatio >= 0.3) {
    evidence.push({
      type: 'JOBS_MATCH_COMPANY',
      multiplier: Math.min(discoveryResult.companyMatchRatio, 1.5),
      description: `${discoveryResult.jobCount} jobs returned, ${Math.round(discoveryResult.companyMatchRatio * 100)}% match company name`,
    })
  }

  // HTML-based ATS detection
  if (discoveryResult.htmlDetection) {
    evidence.push({
      type: 'HTML_ATS_DETECTED',
      description: `ATS detected in page HTML: ${discoveryResult.htmlDetection}`,
    })
  }

  // Redirect chain evidence
  if (discoveryResult.redirectFromOfficial) {
    evidence.push({
      type: 'REDIRECT_CHAIN',
      description: `Official careers page redirects to ATS: ${discoveryResult.redirectChain}`,
    })
  }

  // Student page found
  if (discoveryResult.studentPageFound) {
    evidence.push({
      type: 'STUDENT_PAGE_FOUND',
      description: `Student/early-careers page found on this ATS`,
    })
  }

  // Tracker evidence
  if (discoveryResult.trackerEvidence) {
    evidence.push({
      type: 'TRACKER_EVIDENCE',
      description: `Tracker data shows applications to this ATS`,
    })
  }

  return evidence
}

/**
 * Check if confidence score is sufficient for auto-verification.
 */
export function shouldAutoVerify(score) {
  return score >= THRESHOLDS.AUTO_VERIFY
}

/**
 * Check if source needs manual review.
 */
export function needsReview(score) {
  return score >= THRESHOLDS.UNCERTAIN && score < THRESHOLDS.LIKELY
}

/**
 * Check if source should be rejected (too low confidence).
 */
export function shouldReject(score) {
  return score < THRESHOLDS.UNCERTAIN
}

export { EVIDENCE_WEIGHTS, THRESHOLDS }
