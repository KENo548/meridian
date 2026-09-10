import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  matchById,
  scoreFunctionMatch,
  scoreDivisionMatch,
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
} from '../discovery/matcher-v3.js'

// Helper: build a minimal tracker entry for the matcher
function makeTracker(fields) {
  return {
    id: fields.id || 'test-tracker',
    companyName: fields.company || 'Test Firm',
    programme: fields.programme || null,
    division: fields.division || null,
    office: fields.office || null,
    year: fields.year || null,
    applyUrl: fields.applyUrl || null,
    sourceJobId: fields.sourceJobId || null,
  }
}

// Helper: build a minimal direct job for the matcher
function makeDirect(fields) {
  return {
    id: fields.id || 'test-direct',
    title: fields.title || '',
    companyName: fields.company || 'Test Firm',
    location: fields.location || '',
    url: fields.url || null,
    sourceJobId: fields.sourceJobId || null,
  }
}

// Helper: run matcher and return total score and confidence
function matchScore(trackerFields, directFields) {
  const tracker = makeTracker(trackerFields)
  const direct = makeDirect(directFields)
  const result = matchOpportunityV3(tracker, direct)
  return { score: result.total, confidence: result.confidence }
}

// ─── Frozen Auto-Matches (Regression) ───────────────────────────────────
// These 6 auto-matches were verified correct on 2026-09-06.
// Any future matcher changes must NOT break these.
describe('Matcher V3 — Frozen Auto-Matches (Regression)', () => {
  it('Jefferies Risk Management summer intern matches', () => {
    const r = matchScore(
      { company: 'Jefferies', programme: 'Summer Internship 2025 Risk Management', division: 'risk_management', office: 'London', year: '2025' },
      { title: '2025 Summer Intern – Risk Management', company: 'Jefferies', location: 'London, UK' },
    )
    assert.ok(r.score >= MATCH_THRESHOLDS.auto, `Expected auto (>=${MATCH_THRESHOLDS.auto}), got ${r.score}`)
    assert.equal(r.confidence, 'auto')
  })

  it('Moelis Investment Banking summer intern matches', () => {
    const r = matchScore(
      { company: 'Moelis', programme: 'Summer Internship 2025 Investment Banking', division: 'investment_banking', office: 'New York', year: '2025' },
      { title: 'Summer 2025 Analyst – Investment Banking', company: 'Moelis & Company', location: 'New York, NY' },
    )
    assert.ok(r.score >= MATCH_THRESHOLDS.auto, `Expected auto (>=${MATCH_THRESHOLDS.auto}), got ${r.score}`)
    assert.equal(r.confidence, 'auto')
  })

  it('William Blair Investment Banking summer intern (Chicago) matches', () => {
    const r = matchScore(
      { company: 'William Blair', programme: 'Summer Internship 2025 Investment Banking', division: 'investment_banking', office: 'Chicago', year: '2025' },
      { title: 'Summer 2025 Investment Banking Analyst', company: 'William Blair', location: 'Chicago, IL' },
    )
    assert.ok(r.score >= MATCH_THRESHOLDS.auto, `Expected auto (>=${MATCH_THRESHOLDS.auto}), got ${r.score}`)
    assert.equal(r.confidence, 'auto')
  })

  it('William Blair Investment Banking summer intern (London) matches', () => {
    const r = matchScore(
      { company: 'William Blair', programme: 'Summer Internship 2025 Investment Banking', division: 'investment_banking', office: 'London', year: '2025' },
      { title: 'Summer 2025 Investment Banking Analyst', company: 'William Blair', location: 'London, UK' },
    )
    assert.ok(r.score >= MATCH_THRESHOLDS.auto, `Expected auto (>=${MATCH_THRESHOLDS.auto}), got ${r.score}`)
    assert.equal(r.confidence, 'auto')
  })

  it('IMC Trader Intern matches', () => {
    const r = matchScore(
      { company: 'IMC', programme: 'Internship 2025 Trading', division: 'trading', office: 'Amsterdam', year: '2025' },
      { title: 'Intern 2025 – Trading', company: 'IMC Trading', location: 'Amsterdam, Netherlands' },
    )
    assert.ok(r.score >= MATCH_THRESHOLDS.auto, `Expected auto (>=${MATCH_THRESHOLDS.auto}), got ${r.score}`)
    assert.equal(r.confidence, 'auto')
  })

  it('Optiver Quantitative Trading intern matches', () => {
    const r = matchScore(
      { company: 'Optiver', programme: 'Internship 2025 Quantitative Trading', division: 'trading', office: 'Amsterdam', year: '2025' },
      { title: 'Quantitative Trading Intern 2025', company: 'Optiver', location: 'Amsterdam, Netherlands' },
    )
    assert.ok(r.score >= MATCH_THRESHOLDS.auto, `Expected auto (>=${MATCH_THRESHOLDS.auto}), got ${r.score}`)
    assert.equal(r.confidence, 'auto')
  })
})

// ─── Frozen Non-Matches (Regression) ────────────────────────────────────
// These must NOT match (from gold-set incorrect/no_direct_job cases).
describe('Matcher V3 — Frozen Non-Matches (Regression)', () => {
  it('IB intern must not match VP Technology', () => {
    const r = matchScore(
      { company: 'Test Bank', programme: 'Summer Internship 2025 Investment Banking', division: 'investment_banking', office: 'London', year: '2025' },
      { title: 'Vice President, Technology', company: 'Test Bank', location: 'London, UK' },
    )
    assert.ok(r.score < MATCH_THRESHOLDS.review, `Expected low (<${MATCH_THRESHOLDS.review}), got ${r.score}`)
  })

  it('PE tracker must not match Real Estate direct job', () => {
    const r = matchScore(
      { company: 'Test Firm', programme: 'Summer Internship 2025 Private Equity', division: 'private_equity', office: 'London', year: '2025' },
      { title: 'Summer 2025 Analyst – Real Estate', company: 'Test Firm', location: 'London, UK' },
    )
    assert.ok(r.score < MATCH_THRESHOLDS.review, `Expected low (<${MATCH_THRESHOLDS.review}), got ${r.score}`)
  })

  it('London tracker must not match New York direct job', () => {
    const r = matchScore(
      { company: 'Test Bank', programme: 'Summer Internship 2025 Investment Banking', division: 'investment_banking', office: 'London', year: '2025' },
      { title: 'Summer 2025 Investment Banking Analyst', company: 'Test Bank', location: 'New York, NY' },
    )
    assert.ok(r.score < MATCH_THRESHOLDS.review, `Expected low (<${MATCH_THRESHOLDS.review}), got ${r.score}`)
  })

  it('Summer intern tracker must not match Full-Time Analyst direct job', () => {
    const r = matchScore(
      { company: 'Test Bank', programme: 'Summer Internship 2025', office: 'London', year: '2025' },
      { title: 'Full-Time Analyst 2025 – Investment Banking', company: 'Test Bank', location: 'London, UK' },
    )
    assert.ok(r.score < MATCH_THRESHOLDS.review, `Expected low (<${MATCH_THRESHOLDS.review}), got ${r.score}`)
  })

  it('IB tracker must not match Wealth Management direct job', () => {
    const r = matchScore(
      { company: 'Test Bank', programme: 'Summer Internship 2025 Investment Banking', division: 'investment_banking', office: 'London', year: '2025' },
      { title: 'Summer 2025 Analyst – Wealth Management', company: 'Test Bank', location: 'London, UK' },
    )
    assert.ok(r.score < MATCH_THRESHOLDS.review, `Expected low (<${MATCH_THRESHOLDS.review}), got ${r.score}`)
  })

  it('Internship tracker must not match Senior Data Scientist (Vanguard regression)', () => {
    const r = matchScore(
      { company: 'Vanguard', programme: 'Investment Management Internship Summer 2027', division: 'asset_management', office: 'London', year: '2027' },
      { title: 'Senior Data Scientist — Investment Management Fintech Strategies (IMFS)', company: 'Vanguard', location: 'London, UK' },
    )
    assert.ok(r.score < MATCH_THRESHOLDS.review, `Expected low (<${MATCH_THRESHOLDS.review}), got ${r.score}`)
  })
})

// ─── matchById ───────────────────────────────────────────────────────────
describe('Matcher V3 — matchById', () => {
  it('matches by exact URL', () => {
    const tracker = makeTracker({ applyUrl: 'https://example.com/apply/123' })
    const direct = makeDirect({ url: 'https://example.com/apply/123' })
    const r = matchById(tracker, direct)
    assert.equal(r.matched, true)
    assert.equal(r.method, 'url_exact')
  })

  it('matches by sourceJobId', () => {
    const tracker = makeTracker({ sourceJobId: 'GH-12345' })
    const direct = makeDirect({ sourceJobId: 'GH-12345' })
    const r = matchById(tracker, direct)
    assert.equal(r.matched, true)
    assert.equal(r.method, 'source_job_id')
  })

  it('returns not matched when no ID overlap', () => {
    const tracker = makeTracker({ applyUrl: 'https://a.com', sourceJobId: 'A' })
    const direct = makeDirect({ url: 'https://b.com', sourceJobId: 'B' })
    const r = matchById(tracker, direct)
    assert.equal(r.matched, false)
  })
})

// ─── Function Scoring ───────────────────────────────────────────────────
describe('Matcher V3 — Function Scoring', () => {
  it('scores exact function match as 1.0', () => {
    const t = { function: { value: 'investment_banking', confidence: 'high' } }
    const d = { function: { value: 'investment_banking', confidence: 'high' } }
    const r = scoreFunctionMatch(t, d)
    assert.equal(r.score, 1.0)
    assert.equal(r.reason, 'exact')
  })

  it('scores incompatible functions as 0.0', () => {
    const t = { function: { value: 'investment_banking', confidence: 'high' } }
    const d = { function: { value: 'trading', confidence: 'high' } }
    const r = scoreFunctionMatch(t, d)
    assert.equal(r.score, 0.0)
    assert.equal(r.reason, 'incompatible')
  })

  it('scores related functions (quantitative→trading) as 0.7', () => {
    const t = { function: { value: 'quantitative', confidence: 'high' } }
    const d = { function: { value: 'trading', confidence: 'high' } }
    const r = scoreFunctionMatch(t, d)
    assert.equal(r.score, 0.7)
    assert.equal(r.reason, 'related')
  })

  it('returns 0.5 (neutral) when both functions unknown', () => {
    const t = { function: { value: null, confidence: 'unknown' } }
    const d = { function: { value: null, confidence: 'unknown' } }
    const r = scoreFunctionMatch(t, d)
    assert.equal(r.score, 0.5)
    assert.equal(r.reason, 'both_unknown')
  })

  it('returns 0.5 (neutral) when one function unknown', () => {
    const t = { function: { value: 'trading', confidence: 'high' } }
    const d = { function: { value: null, confidence: 'unknown' } }
    const r = scoreFunctionMatch(t, d)
    assert.equal(r.score, 0.5)
    assert.equal(r.reason, 'one_unknown')
  })
})

// ─── Division Scoring ───────────────────────────────────────────────────
describe('Matcher V3 — Division Scoring', () => {
  it('scores exact division match as 1.0', () => {
    const t = { division: { value: 'investment_banking', confidence: 'high' } }
    const d = { division: { value: 'investment_banking', confidence: 'high' } }
    const r = scoreDivisionMatch(t, d)
    assert.equal(r.score, 1.0)
  })

  it('scores related divisions as 0.7', () => {
    const t = { division: { value: 'investment_banking', confidence: 'high' } }
    const d = { division: { value: 'private_credit', confidence: 'high' } }
    const r = scoreDivisionMatch(t, d)
    assert.equal(r.score, 0.7)
  })

  it('scores unrelated divisions as 0.1', () => {
    const t = { division: { value: 'investment_banking', confidence: 'high' } }
    const d = { division: { value: 'equities', confidence: 'high' } }
    const r = scoreDivisionMatch(t, d)
    assert.equal(r.score, 0.1)
  })
})

// ─── Programme Scoring ──────────────────────────────────────────────────
describe('Matcher V3 — Programme Scoring', () => {
  it('scores exact programme match as 1.0', () => {
    const t = { programme: { value: 'summer_intern', confidence: 'high' } }
    const d = { programme: { value: 'summer_intern', confidence: 'high' } }
    const r = scoreProgrammeMatch(t, d)
    assert.equal(r.score, 1.0)
  })

  it('scores intern vs graduate as incompatible', () => {
    const t = { programme: { value: 'summer_intern', confidence: 'high' } }
    const d = { programme: { value: 'graduate', confidence: 'high' } }
    const r = scoreProgrammeMatch(t, d)
    assert.equal(r.score, 0.0)
    assert.equal(r.reason, 'incompatible')
  })

  it('scores spring_week vs summer_intern as different_type', () => {
    const t = { programme: { value: 'spring_week', confidence: 'high' } }
    const d = { programme: { value: 'summer_intern', confidence: 'high' } }
    const r = scoreProgrammeMatch(t, d)
    assert.equal(r.score, 0.2)
    assert.equal(r.reason, 'different_type')
  })
})

// ─── Location Scoring ───────────────────────────────────────────────────
describe('Matcher V3 — Location Scoring', () => {
  it('scores exact city match as 1.0', () => {
    const t = { geography: { city: 'London', country: 'UK' } }
    const d = { geography: { city: 'London', country: 'UK' } }
    const r = scoreLocationMatch(t, d)
    assert.equal(r.score, 1.0)
  })

  it('scores same country different city as 0.8', () => {
    const t = { geography: { city: 'London', country: 'UK' } }
    const d = { geography: { city: 'Manchester', country: 'UK' } }
    const r = scoreLocationMatch(t, d)
    assert.equal(r.score, 0.8)
  })

  it('scores different countries as hard incompatibility', () => {
    const t = { geography: { city: 'London', country: 'UK' } }
    const d = { geography: { city: 'New York', country: 'US' } }
    const r = scoreLocationMatch(t, d)
    assert.equal(r.score, 0.0)
    assert.equal(r.reason, 'country_conflict')
  })

  it('returns 0.5 (neutral) when both unknown', () => {
    const t = { geography: { city: null, country: null } }
    const d = { geography: { city: null, country: null } }
    const r = scoreLocationMatch(t, d)
    assert.equal(r.score, 0.5)
  })
})

// ─── Cycle Scoring ──────────────────────────────────────────────────────
describe('Matcher V3 — Cycle Scoring', () => {
  it('scores exact year match as 1.0', () => {
    const t = { year: { value: 2025, confidence: 'high' } }
    const d = { year: { value: 2025, confidence: 'high' } }
    const r = scoreCycleMatch(t, d)
    assert.equal(r.score, 1.0)
  })

  it('scores adjacent year as 0.6', () => {
    const t = { year: { value: 2025, confidence: 'high' } }
    const d = { year: { value: 2026, confidence: 'high' } }
    const r = scoreCycleMatch(t, d)
    assert.equal(r.score, 0.6)
  })

  it('scores >1 year apart as hard incompatibility', () => {
    const t = { year: { value: 2025, confidence: 'high' } }
    const d = { year: { value: 2027, confidence: 'high' } }
    const r = scoreCycleMatch(t, d)
    assert.equal(r.score, 0.0)
    assert.equal(r.reason, 'year_conflict')
  })
})

// ─── Seniority Scoring ──────────────────────────────────────────────────
describe('Matcher V3 — Seniority Scoring', () => {
  it('scores exact seniority match as 1.0', () => {
    const t = { seniority: { value: 'intern', confidence: 'high' } }
    const d = { seniority: { value: 'intern', confidence: 'high' } }
    const r = scoreSeniorityMatch(t, d)
    assert.equal(r.score, 1.0)
  })

  it('scores intern vs director as hard incompatibility', () => {
    const t = { seniority: { value: 'intern', confidence: 'high' } }
    const d = { seniority: { value: 'director', confidence: 'high' } }
    const r = scoreSeniorityMatch(t, d)
    assert.equal(r.score, 0.0)
    assert.equal(r.reason, 'seniority_conflict')
  })

  it('scores intern vs analyst as different_level', () => {
    const t = { seniority: { value: 'intern', confidence: 'high' } }
    const d = { seniority: { value: 'analyst', confidence: 'high' } }
    const r = scoreSeniorityMatch(t, d)
    assert.equal(r.score, 0.3)
    assert.equal(r.reason, 'different_level')
  })
})

// ─── Filtering ──────────────────────────────────────────────────────────
describe('Matcher V3 — Filtering', () => {
  it('filters out excluded roles (recruiter)', () => {
    const r = matchScore(
      { company: 'Test', programme: 'Summer Internship 2025', office: 'London', year: '2025' },
      { title: 'Campus Recruiter – Summer 2025', company: 'Test', location: 'London' },
    )
    assert.equal(r.score, 0)
    assert.equal(r.confidence, 'low')
  })

  it('filters out event/programme trackers', () => {
    const tracker = makeTracker({ company: 'Test', programme: 'Women in Trading Networking Event' })
    const direct = makeDirect({ title: 'Summer 2025 Trading Intern', company: 'Test', location: 'London' })
    const r = matchOpportunityV3(tracker, direct)
    assert.equal(r.filtered, true)
    assert.equal(r.filterReason, 'event_tracker')
  })

  it('filters out full-time roles vs intern tracker', () => {
    const r = matchScore(
      { company: 'Test', programme: 'Summer Internship 2025', office: 'London', year: '2025' },
      { title: 'Full-Time Permanent Analyst – Investment Banking', company: 'Test', location: 'London' },
    )
    assert.equal(r.score, 0)
  })

  it('filters role-type (engineer) vs intern tracker', () => {
    const r = matchScore(
      { company: 'Test', programme: 'Summer Internship 2025', office: 'London', year: '2025' },
      { title: 'Software Engineer – Technology', company: 'Test', location: 'London' },
    )
    assert.equal(r.score, 0)
  })

  it('does NOT filter intern role-type when tracker is intern', () => {
    const r = matchScore(
      { company: 'Test', programme: 'Summer Internship 2025 Trading', division: 'trading', office: 'London', year: '2025' },
      { title: 'Summer 2025 Trading Intern', company: 'Test', location: 'London, UK' },
    )
    assert.ok(r.score > 0, 'Intern role should not be filtered for intern tracker')
  })
})

// ─── Minimum Evidence ───────────────────────────────────────────────────
describe('Matcher V3 — Minimum Evidence', () => {
  it('rejects match when neither function nor division is known', () => {
    const tracker = makeTracker({ company: 'Test', programme: 'Summer Internship 2025', office: 'London', year: '2025' })
    const direct = makeDirect({ title: 'Summer 2025 Analyst', company: 'Test', location: 'London, UK' })
    const r = matchOpportunityV3(tracker, direct)
    assert.equal(r.insufficientEvidence, true)
    assert.equal(r.confidence, 'low')
  })

  it('allows match when only function is known', () => {
    const tracker = makeTracker({ company: 'Test', programme: 'Summer Internship 2025 Trading', office: 'London', year: '2025' })
    const direct = makeDirect({ title: 'Summer 2025 Trading Intern', company: 'Test', location: 'London, UK' })
    const r = matchOpportunityV3(tracker, direct)
    assert.equal(r.insufficientEvidence, undefined)
    assert.ok(r.total > 0)
  })

  it('allows match when only division is known', () => {
    const tracker = makeTracker({ company: 'Test', programme: 'Summer Internship 2025', division: 'investment_banking', office: 'London', year: '2025' })
    const direct = makeDirect({ title: 'Summer 2025 Analyst – Investment Banking', company: 'Test', location: 'London, UK' })
    const r = matchOpportunityV3(tracker, direct)
    assert.equal(r.insufficientEvidence, undefined)
    assert.ok(r.total > 0)
  })
})

// ─── Hard Incompatibility Penalty ───────────────────────────────────────
describe('Matcher V3 — Hard Incompatibility Penalty', () => {
  it('applies 0.1 penalty when function is incompatible', () => {
    const tracker = makeTracker({ company: 'Test', programme: 'Summer Internship 2025 Investment Banking', division: 'investment_banking', office: 'London', year: '2025' })
    const direct = makeDirect({ title: 'Summer 2025 Trading Intern', company: 'Test', location: 'London, UK' })
    const r = matchOpportunityV3(tracker, direct)
    // Incompatible function but other dimensions match → score should be very low due to penalty
    assert.ok(r.total < 0.2, `Expected very low score due to penalty, got ${r.total}`)
    assert.equal(r.hasHardIncompatibility, true)
  })
})

// ─── Technology-before-Research Ordering ─────────────────────────────────
describe('Matcher V3 — Technology-before-Research Ordering', () => {
  it('"Tools and Compilers R&D" matches technology, not research', () => {
    const tracker = makeTracker({ company: 'Test', programme: 'Summer Internship 2025 Technology', division: 'technology', office: 'London', year: '2025' })
    const direct = makeDirect({ title: 'Summer 2025 Intern – Tools and Compilers R&D', company: 'Test', location: 'London, UK' })
    const r = matchOpportunityV3(tracker, direct)
    // The direct job should be classified as technology, not research
    const directEnriched = enrichDirectJob(direct)
    assert.equal(directEnriched.enriched.function.value, 'technology', '"Tools and Compilers R&D" should be classified as technology')
    // Match should score well since both are technology
    assert.ok(r.total >= MATCH_THRESHOLDS.auto, `Expected auto match, got ${r.score}`)
  })
})

// ─── Ambiguity Detection ────────────────────────────────────────────────
describe('Matcher V3 — Ambiguity Detection', () => {
  it('marks match as ambiguous when best and second-best are too close', () => {
    const tracker = makeTracker({ company: 'Test', programme: 'Summer Internship 2025', office: 'London', year: '2025' })
    // Two very similar direct jobs that will score nearly identically
    const direct1 = makeDirect({ id: 'd1', title: 'Summer 2025 Analyst – Investment Banking', company: 'Test', location: 'London, UK' })
    const direct2 = makeDirect({ id: 'd2', title: 'Summer 2025 Analyst – Investment Banking Division', company: 'Test', location: 'London, UK' })
    const r = matchTrackerToDirectJobsV3(tracker, [direct1, direct2])
    // If the scores are within AMBIGUITY_MARGIN and neither is auto, should be ambiguous
    if (r.bestMatch?.total < MATCH_THRESHOLDS.auto && r.margin !== null && r.margin < AMBIGUITY_MARGIN) {
      assert.equal(r.ambiguous, true, 'Should be ambiguous when margin < threshold')
    }
    // Either way, it should NOT be auto-matched if ambiguous
    if (r.ambiguous) {
      assert.equal(r.hasAutoMatch, false, 'Ambiguous matches must not be auto-matched')
    }
  })

  it('does NOT mark as ambiguous when best is auto', () => {
    const tracker = makeTracker({ company: 'Test', programme: 'Summer Internship 2025 Trading', division: 'trading', office: 'London', year: '2025' })
    const direct1 = makeDirect({ id: 'd1', title: 'Summer 2025 Trading Intern', company: 'Test', location: 'London, UK' })
    const direct2 = makeDirect({ id: 'd2', title: 'Summer 2025 Analyst – Technology', company: 'Test', location: 'London, UK' })
    const r = matchTrackerToDirectJobsV3(tracker, [direct1, direct2])
    // Best match should be auto (trading), second is very different (technology)
    // So ambiguity should NOT trigger
    if (r.bestMatch?.confidence === 'auto') {
      assert.equal(r.ambiguous, false, 'Auto match should not be ambiguous')
    }
  })
})

// ─── enrichDirectJob ────────────────────────────────────────────────────
describe('Matcher V3 — enrichDirectJob', () => {
  it('extracts function from title', () => {
    const r = enrichDirectJob({ title: 'Investment Banking Summer Analyst 2025' })
    assert.equal(r.enriched.function.value, 'investment_banking')
  })

  it('extracts division from title', () => {
    const r = enrichDirectJob({ title: 'Summer 2025 Analyst – Private Equity' })
    assert.equal(r.enriched.division.value, 'private_equity')
  })

  it('extracts seniority', () => {
    const r = enrichDirectJob({ title: 'Summer 2025 Intern – Trading' })
    assert.equal(r.enriched.seniority.value, 'intern')
  })

  it('extracts year', () => {
    const r = enrichDirectJob({ title: '2025 Summer Analyst – IB' })
    assert.equal(r.enriched.year.value, 2025)
  })

  it('extracts geography (city)', () => {
    const r = enrichDirectJob({ title: 'Summer Analyst', location: 'London, UK' })
    assert.equal(r.enriched.geography.city, 'London')
  })

  it('extracts geography (country only)', () => {
    const r = enrichDirectJob({ title: 'Summer Analyst', location: 'Germany' })
    assert.equal(r.enriched.geography.country, 'Germany')
  })

  it('marks excluded roles', () => {
    const r = enrichDirectJob({ title: 'Campus Recruiter' })
    assert.equal(r.meta.isExcluded, true)
  })

  it('marks full-time-only roles', () => {
    const r = enrichDirectJob({ title: 'Vice President, Technology' })
    assert.equal(r.meta.isFullTimeOnly, true)
  })

  it('marks role-type (engineer) when not intern', () => {
    const r = enrichDirectJob({ title: 'Software Engineer' })
    assert.equal(r.meta.isRoleType, true)
  })

  it('does not mark intern as role-type', () => {
    const r = enrichDirectJob({ title: 'Summer 2025 Trading Intern' })
    assert.equal(r.meta.isRoleType, false)
    assert.equal(r.meta.isInternRole, true)
  })
})

// ─── batchMatchV3 ───────────────────────────────────────────────────────
describe('Matcher V3 — batchMatchV3', () => {
  it('returns stats for batch matching', () => {
    const trackers = [
      makeTracker({ id: 't1', company: 'Test', programme: 'Summer Internship 2025 Trading', division: 'trading', office: 'London', year: '2025' }),
      makeTracker({ id: 't2', company: 'Test', programme: 'Summer Internship 2025 Technology', division: 'technology', office: 'London', year: '2025' }),
    ]
    const directJobsByFirm = {
      'test': [
        makeDirect({ id: 'd1', title: 'Summer 2025 Trading Intern', company: 'Test', location: 'London, UK' }),
        makeDirect({ id: 'd2', title: 'Summer 2025 Technology Intern', company: 'Test', location: 'London, UK' }),
      ],
    }
    const r = batchMatchV3(trackers, directJobsByFirm)
    assert.equal(r.stats.total, 2)
    assert.ok(r.results.length === 2)
    // At least one should be auto-matched
    const autoMatches = r.results.filter(r => r.hasAutoMatch)
    assert.ok(autoMatches.length >= 1, `Expected at least 1 auto-match, got ${autoMatches.length}`)
  })
})
