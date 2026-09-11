import crypto from 'node:crypto'
import { findCanonicalByFingerprint, findCanonicalByExternalKey } from '../../db.js'

// ─── Source Classification ──────────────────────────────────────

const EMPLOYER_ATS_SOURCES = new Set([
  'greenhouse', 'workday', 'oleeo_rss', 'smartrecruiters', 'lever',
  'ashby', 'oracle_hcm', 'avature', 'eightfold', 'successfactors',
])

const TRACKER_SOURCES = new Set([
  'analystclass', 'fyntraq', 'trackr', 'landtheoffer',
])

const DIRECT_SOURCES = new Set([...EMPLOYER_ATS_SOURCES])

// ─── Source Tier Classification ─────────────────────────────────

export function classifySourceTier(source) {
  if (EMPLOYER_ATS_SOURCES.has(source)) return 'employer_ats'
  if (TRACKER_SOURCES.has(source)) return 'tracker'
  return 'aggregator'
}

// ─── Title / Location Normalization (for fingerprinting) ────────

const YEAR_PATTERN = /\b(20[12]\d)\b/
const ROLE_SUFFIXES = /\b(intern(?:ship)?|analyst|associate|spring\s+week|werkstudent|praktikant(?:in)?|co-?op)\b/gi
const NOISE_WORDS = /\b(f\/m\/d|m\/f\/d|\(all\s+genders?\)|all\s+genders?|-|\s{2,})\b/gi

export function normalizeTitle(title) {
  if (!title) return ''
  return title
    .toLowerCase()
    .replace(NOISE_WORDS, ' ')
    .replace(ROLE_SUFFIXES, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeCompany(company) {
  if (!company) return ''
  return company
    .toLowerCase()
    .replace(/\b(ag|gmbh|co\.?|ltd\.?|plc|inc\.?|llc|s\.?a\.?|sas?|se|group)\b/gi, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeLocation(location) {
  if (!location) return ''
  const loc = location.toLowerCase()
    .replace(/\b(germany|deutschland|de)\b/gi, 'de')
    .replace(/\b(austria|österreich|at)\b/gi, 'at')
    .replace(/\b(switzerland|schweiz|ch)\b/gi, 'ch')
    .replace(/\b(united kingdom|uk|gb)\b/gi, 'gb')
    .replace(/\b(frankfurt am main)\b/gi, 'frankfurt')
    .replace(/\s+/g, ' ')
    .trim()
  return loc
}

export function extractYear(title, deadline) {
  const titleYear = (title || '').match(YEAR_PATTERN)
  if (titleYear) return titleYear[1]
  const deadlineYear = (deadline || '').match(YEAR_PATTERN)
  if (deadlineYear) return deadlineYear[1]
  return null
}

// ─── Fingerprint Generation ─────────────────────────────────────

export function computeFingerprint(job) {
  const parts = [
    normalizeCompany(job.company),
    normalizeTitle(job.title),
    normalizeLocation(job.location),
    (job.programmeType || '').toLowerCase(),
    extractYear(job.title, job.deadline) || '',
  ].filter(Boolean)

  if (parts.length < 2) return null

  const raw = parts.join('|')
  return crypto.createHash('sha256').update(raw).digest('hex').substring(0, 16)
}

// ─── Content Hash (for change detection) ────────────────────────

export function computeContentHash(job) {
  const normalized = JSON.stringify({
    title: (job.title || '').toLowerCase().trim(),
    location: (job.location || '').toLowerCase().trim(),
    company: (job.company || '').toLowerCase().trim(),
    url: job.url || job.applyUrl || '',
    description: (job.description || '').substring(0, 500),
  })
  return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16)
}

// ─── External Key Construction ──────────────────────────────────

export function buildExternalKey(source, job) {
  if (job.atsReqId && EMPLOYER_ATS_SOURCES.has(source)) {
    return `${source}:${job.atsReqId}`
  }
  if (job.sourceJobId) {
    return `${source}:${job.sourceJobId}`
  }
  if (job.url || job.applyUrl) {
    const url = job.url || job.applyUrl
    const urlHash = crypto.createHash('sha256').update(url).digest('hex').substring(0, 12)
    return `${source}:url:${urlHash}`
  }
  return null
}

// ─── 4-Tier Identity Resolution ─────────────────────────────────

/**
 * Resolve the identity of a job against existing canonical jobs.
 *
 * Returns: { key, tier, existingJobId, confidence, needsReview }
 *
 * Tiers (highest to lowest):
 *   1. ats_reqid  — ATS + requisition ID (definitive)
 *   2. employer_url — Employer posting URL (very strong)
 *   3. fingerprint — Deterministic hash of normalized fields (strong)
 *   4. fuzzy — Similarity scoring (weaker, requires confidence gate)
 */
export function resolveIdentity(job, source) {
  const tier = classifySourceTier(source)

  // Tier 1: ATS requisition ID
  if (job.atsReqId && EMPLOYER_ATS_SOURCES.has(source)) {
    const externalKey = `${source}:${job.atsReqId}`
    const existing = findCanonicalByExternalKey(externalKey)
    if (existing) {
      return {
        key: `ats:${externalKey}`,
        tier: 'ats_reqid',
        existingJobId: existing.id,
        confidence: 1.0,
        needsReview: false,
      }
    }
  }

  // Tier 2: Employer posting URL
  const employerUrl = job.employerUrl || job.applyUrl
  if (employerUrl && isEmployerHost(employerUrl)) {
    const urlKey = canonicalizeUrl(employerUrl)
    if (urlKey) {
      const externalKey = `url:${urlKey}`
      const existing = findCanonicalByExternalKey(externalKey)
      if (existing) {
        return {
          key: externalKey,
          tier: 'employer_url',
          existingJobId: existing.id,
          confidence: 0.95,
          needsReview: false,
        }
      }
    }
  }

  // Tier 3: Deterministic fingerprint
  const fingerprint = computeFingerprint(job)
  if (fingerprint) {
    const existing = findCanonicalByFingerprint(fingerprint)
    if (existing) {
      return {
        key: `fp:${fingerprint}`,
        tier: 'fingerprint',
        existingJobId: existing.id,
        confidence: 0.85,
        needsReview: false,
      }
    }
  }

  // Tier 4: Fuzzy matching (only against a limited candidate set)
  const fuzzyMatch = findFuzzyMatchSync(job)
  if (fuzzyMatch) {
    return {
      key: `fuzzy:${fuzzyMatch.id}`,
      tier: 'fuzzy',
      existingJobId: fuzzyMatch.id,
      confidence: fuzzyMatch.score,
      needsReview: fuzzyMatch.score < 0.85,
    }
  }

  // No match found — this is a new canonical job
  return {
    key: null,
    tier: 'new',
    existingJobId: null,
    confidence: 0,
    needsReview: false,
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function isEmployerHost(url) {
  try {
    const host = new URL(url).hostname
    // Exclude known tracker/aggregator domains
    const excludeDomains = [
      'fyntraq.io', 'the-trackr.com', 'analystclass.com',
      'linkedin.com', 'indeed.com', 'glassdoor.com',
      'efinancialcareers.com', 'adzuna.com',
    ]
    return !excludeDomains.some(d => host.includes(d))
  } catch {
    return false
  }
}

function canonicalizeUrl(url) {
  try {
    const u = new URL(url)
    // Strip tracking params, fragments, trailing slashes
    u.search = ''
    u.hash = ''
    let path = u.pathname.replace(/\/+$/, '')
    if (path === '/') path = ''
    return `${u.hostname}${path}`.toLowerCase()
  } catch {
    return null
  }
}

let _getOpenCanonicalJobs = null

async function loadGetOpenCanonicalJobs() {
  if (!_getOpenCanonicalJobs) {
    const db = await import('../../db.js')
    _getOpenCanonicalJobs = db.getOpenCanonicalJobs
  }
  return _getOpenCanonicalJobs
}

function findFuzzyMatchSync(job) {
  // Synchronous fallback — use empty candidates if DB not loaded
  if (!_getOpenCanonicalJobs) return null
  const candidates = _getOpenCanonicalJobs()

  const jobCompany = normalizeCompany(job.company)
  const jobTitle = normalizeTitle(job.title)
  const jobLocation = normalizeLocation(job.location)
  const jobYear = extractYear(job.title, job.deadline)

  let bestMatch = null
  let bestScore = 0

  for (const candidate of candidates) {
    const candCompany = normalizeCompany(candidate.company_name)
    const candTitle = normalizeTitle(candidate.title)
    const candLocation = normalizeLocation(candidate.location)
    const candYear = extractYear(candidate.title, candidate.deadline)

    // Company must match reasonably
    const companySim = similarity(jobCompany, candCompany)
    if (companySim < 0.6) continue

    const titleSim = similarity(jobTitle, candTitle)
    const locationSim = jobLocation && candLocation
      ? (jobLocation.includes(candLocation) || candLocation.includes(jobLocation) ? 1.0 : similarity(jobLocation, candLocation))
      : 0.5
    const yearMatch = jobYear && candYear ? (jobYear === candYear ? 1.0 : 0.3) : 0.5

    const score = (companySim * 0.35) + (titleSim * 0.30) + (locationSim * 0.20) + (yearMatch * 0.15)

    if (score > bestScore && score >= 0.70) {
      bestScore = score
      bestMatch = { id: candidate.id, score }
    }
  }

  return bestMatch
}

function similarity(a, b) {
  if (!a || !b) return 0
  if (a === b) return 1.0
  const aWords = new Set(a.split(/\s+/))
  const bWords = new Set(b.split(/\s+/))
  const intersection = new Set([...aWords].filter(w => bWords.has(w)))
  const union = new Set([...aWords, ...bWords])
  return union.size > 0 ? intersection.size / union.size : 0
}

// ─── Legacy Compatibility ───────────────────────────────────────

export function getDedupKey(job) {
  if (job.canonicalId) return job.canonicalId
  return `text:${[
    (job.company || '').toLowerCase().trim(),
    (job.title || '').toLowerCase().trim(),
    (job.location || '').toLowerCase().trim(),
  ].join(':')}`
}

export function sourcePriority(source) {
  if (EMPLOYER_ATS_SOURCES.has(source)) return 3
  if (TRACKER_SOURCES.has(source)) return 1
  return 0
}

export function pickWinner(existing, incoming) {
  const existingPriority = sourcePriority(existing.source)
  const incomingPriority = sourcePriority(incoming.source)
  if (incomingPriority > existingPriority) return 'incoming'
  if (incomingPriority < existingPriority) return 'existing'
  const existingTime = new Date(existing.lastSeenAt || existing.firstSeenAt || 0).getTime()
  const incomingTime = new Date(incoming.lastSeenAt || incoming.firstSeenAt || 0).getTime()
  if (incomingTime > existingTime) return 'incoming'
  return 'existing'
}

export function deduplicateJobs(jobs) {
  const seen = new Map()
  const deduped = []
  const report = { total: jobs.length, deduplicated: 0, bySource: {} }

  for (const job of jobs) {
    if (!job || typeof job !== 'object') continue
    const key = getDedupKey(job)
    if (!key) continue
    const existingFirstSeen = job.firstSeenAt || new Date().toISOString()
    const existingLastSeen = job.lastSeenAt || existingFirstSeen

    if (!seen.has(key)) {
      const entry = { ...job, firstSeenAt: existingFirstSeen, lastSeenAt: existingLastSeen }
      seen.set(key, entry)
      deduped.push(entry)
    } else {
      const existing = seen.get(key)
      report.deduplicated++
      const winner = pickWinner(existing, job)
      if (winner === 'incoming') {
        const idx = deduped.indexOf(existing)
        if (idx !== -1) {
          deduped[idx] = {
            ...job,
            firstSeenAt: earlierTimestamp(existing.firstSeenAt, job.firstSeenAt),
            lastSeenAt: laterTimestamp(existing.lastSeenAt, job.lastSeenAt),
          }
          seen.set(key, deduped[idx])
        }
      } else {
        existing.firstSeenAt = earlierTimestamp(existing.firstSeenAt, job.firstSeenAt)
        existing.lastSeenAt = laterTimestamp(existing.lastSeenAt, job.lastSeenAt)
      }
    }
    const src = job.source || 'unknown'
    report.bySource[src] = (report.bySource[src] || 0) + 1
  }

  report.output = deduped.length
  return { jobs: deduped, report }
}

function earlierTimestamp(a, b) {
  if (!a) return b
  if (!b) return a
  const tA = new Date(a).getTime()
  const tB = new Date(b).getTime()
  if (isNaN(tA)) return b
  if (isNaN(tB)) return a
  return tA <= tB ? a : b
}

function laterTimestamp(a, b) {
  if (!a) return b
  if (!b) return a
  const tA = new Date(a).getTime()
  const tB = new Date(b).getTime()
  if (isNaN(tA)) return b
  if (isNaN(tB)) return a
  return tA >= tB ? a : b
}

function mergeWithPersisted(newJobs, persistedJobs) {
  const persistedMap = new Map()
  for (const job of persistedJobs) {
    const key = getDedupKey(job)
    if (key) persistedMap.set(key, job)
  }

  const merged = []
  const report = { newJobs: 0, updatedJobs: 0, persistedUnchanged: 0 }

  for (const job of newJobs) {
    const key = getDedupKey(job)
    const existing = key ? persistedMap.get(key) : null

    if (!existing) {
      merged.push({
        ...job,
        firstSeenAt: job.firstSeenAt || new Date().toISOString(),
        lastSeenAt: job.lastSeenAt || job.firstSeenAt || new Date().toISOString(),
      })
      report.newJobs++
    } else {
      merged.push({
        ...job,
        firstSeenAt: earlierTimestamp(existing.firstSeenAt, job.firstSeenAt),
        lastSeenAt: laterTimestamp(existing.lastSeenAt, job.lastSeenAt),
      })
      report.updatedJobs++
      persistedMap.delete(key)
    }
  }

  for (const remaining of persistedMap.values()) {
    merged.push(remaining)
    report.persistedUnchanged++
  }

  return { jobs: merged, report }
}

export {
  EMPLOYER_ATS_SOURCES,
  TRACKER_SOURCES,
  mergeWithPersisted,
}
