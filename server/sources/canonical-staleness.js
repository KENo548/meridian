/**
 * Canonical Job Staleness — Sighting-Level Lifecycle
 *
 * Each sighting is evaluated independently. The canonical lifecycle
 * is derived from the collection of active sightings.
 *
 * One broken ATS scan should NOT close a perfectly live opportunity
 * that's still reported by other sources.
 */

import {
  getOpenCanonicalJobs,
  getActiveSightingsForJob,
  deactivateSighting,
  updateCanonicalLifecycle,
  incrementAbsences,
  resetAbsences,
} from '../db.js'
import { classifySourceTier } from './ats/dedup.js'

// ─── Source-Specific Disappearance Thresholds ───────────────────
// How many consecutive scan absences before a sighting becomes inactive

const SIGHTING_THRESHOLDS = {
  employer_ats: { stale: 2, closed: 3 },
  employer_url: { stale: 2, closed: 3 },
  tracker: { stale: 3, closed: 5 },
  aggregator: { stale: 3, closed: 5 },
}

// Canonical lifecycle derivation from active sightings
const LIFECYCLE_STATES = {
  DISCOVERED: 'discovered',
  OPEN: 'open',
  CLOSING_SOON: 'closing_soon',
  CLOSED: 'closed',
  EXPIRED: 'expired',
}

const EXPIRED_AFTER_DAYS = 30
const CLOSING_SOON_DAYS = 7

// ─── Main Evaluation Function ───────────────────────────────────

/**
 * Evaluate staleness for ALL open canonical jobs.
 * Called after each scan cycle.
 *
 * Returns a report of what changed.
 */
export function evaluateAllStaleness() {
  const openJobs = getOpenCanonicalJobs()
  const report = {
    evaluated: 0,
    closed: 0,
    closingSoon: 0,
    stale: 0,
    healthy: 0,
    details: [],
  }

  for (const job of openJobs) {
    const result = evaluateJob(job)
    report.evaluated++
    report.details.push(result)

    if (result.action === 'closed') report.closed++
    else if (result.action === 'closing_soon') report.closingSoon++
    else if (result.action === 'stale') report.stale++
    else report.healthy++
  }

  return report
}

/**
 * Evaluate staleness for a SINGLE canonical job.
 * Examines each sighting independently.
 */
export function evaluateJob(job) {
  const sightings = getActiveSightingsForJob(job.id)
  const now = new Date()

  if (sightings.length === 0) {
    // No active sightings at all — close immediately
    updateCanonicalLifecycle(job.id, LIFECYCLE_STATES.CLOSED, 'no_active_sightings')
    return { jobId: job.id, action: 'closed', reason: 'no_active_sightings', sightings: 0 }
  }

  // Evaluate each sighting independently
  const sightingResults = []
  let hasActiveEmployerSighting = false
  let hasAnyActiveSighting = false

  for (const sighting of sightings) {
    const result = evaluateSighting(sighting)
    sightingResults.push(result)

    if (result.status === 'active') {
      hasAnyActiveSighting = true
      if (sighting.source_tier === 'employer_ats' || sighting.source_tier === 'employer_url') {
        hasActiveEmployerSighting = true
      }
    }
  }

  // Derive canonical lifecycle from sighting collection
  const derivedLifecycle = deriveLifecycle(job, sightingResults, hasActiveEmployerSighting)

  if (derivedLifecycle !== job.lifecycle) {
    updateCanonicalLifecycle(job.id, derivedLifecycle.lifecycle, derivedLifecycle.reason)
    if (derivedLifecycle.lifecycle === LIFECYCLE_STATES.OPEN) {
      resetAbsences(job.id)
    }
  } else if (hasAnyActiveSighting) {
    // Still open — reset absences
    resetAbsences(job.id)
  }

  return {
    jobId: job.id,
    action: derivedLifecycle.lifecycle === LIFECYCLE_STATES.CLOSED ? 'closed'
      : derivedLifecycle.lifecycle === LIFECYCLE_STATES.CLOSING_SOON ? 'closing_soon'
      : derivedLifecycle.lifecycle === LIFECYCLE_STATES.OPEN ? 'healthy'
      : 'stale',
    reason: derivedLifecycle.reason || 'derived_from_sightings',
    sightings: sightings.length,
    activeSightings: sightingResults.filter(r => r.status === 'active').length,
    details: sightingResults,
  }
}

// ─── Sighting-Level Evaluation ──────────────────────────────────

function evaluateSighting(sighting) {
  const now = new Date()
  const lastSeen = new Date(sighting.last_seen_at)
  const daysSinceLastSeen = (now - lastSeen) / (1000 * 60 * 60 * 24)
  const tier = sighting.source_tier || classifySourceTier(sighting.source)
  const thresholds = SIGHTING_THRESHOLDS[tier] || SIGHTING_THRESHOLDS.aggregator

  if (daysSinceLastSeen <= thresholds.stale) {
    return { sightingId: sighting.id, status: 'active', daysSinceLastSeen: Math.floor(daysSinceLastSeen) }
  }

  if (daysSinceLastSeen <= thresholds.closed) {
    return { sightingId: sighting.id, status: 'stale', daysSinceLastSeen: Math.floor(daysSinceLastSeen) }
  }

  // Exceeded close threshold — deactivate this sighting
  deactivateSighting(sighting.canonical_job_id, sighting.source)
  return { sightingId: sighting.id, status: 'inactive', daysSinceLastSeen: Math.floor(daysSinceLastSeen) }
}

// ─── Lifecycle Derivation ───────────────────────────────────────

function deriveLifecycle(job, sightingResults, hasActiveEmployerSighting) {
  const activeCount = sightingResults.filter(r => r.status === 'active').length
  const inactiveCount = sightingResults.filter(r => r.status === 'inactive').length
  const staleCount = sightingResults.filter(r => r.status === 'stale').length

  // Check deadline first — if deadline is within CLOSING_SOON_DAYS, mark closing_soon
  if (job.deadline) {
    const deadline = new Date(job.deadline)
    const daysUntilDeadline = (deadline - new Date()) / (1000 * 60 * 60 * 24)
    if (daysUntilDeadline <= 0) {
      return { lifecycle: LIFECYCLE_STATES.CLOSED, reason: 'deadline_passed' }
    }
    if (daysUntilDeadline <= CLOSING_SOON_DAYS) {
      return { lifecycle: LIFECYCLE_STATES.CLOSING_SOON, reason: 'deadline_approaching' }
    }
  }

  // If any sighting went inactive, increment absences
  if (inactiveCount > 0) {
    incrementAbsences(job.id)
  }

  // All sightings inactive → close
  if (activeCount === 0 && inactiveCount > 0) {
    return { lifecycle: LIFECYCLE_STATES.CLOSED, reason: 'all_sightings_inactive' }
  }

  // Employer sighting still active → definitely open
  if (hasActiveEmployerSighting) {
    return { lifecycle: LIFECYCLE_STATES.OPEN, reason: 'employer_source_active' }
  }

  // Some tracker sightings still active → open (but lower confidence)
  if (activeCount > 0) {
    return { lifecycle: LIFECYCLE_STATES.OPEN, reason: 'tracker_source_active' }
  }

  // Stale sightings but not yet inactive
  if (staleCount > 0) {
    return { lifecycle: LIFECYCLE_STATES.OPEN, reason: 'stale_but_not_closed' }
  }

  // Fallback: keep open with unknown reason
  return { lifecycle: LIFECYCLE_STATES.OPEN, reason: 'fallback' }
}

// ─── Export Constants ───────────────────────────────────────────

export {
  SIGHTING_THRESHOLDS,
  LIFECYCLE_STATES,
  CLOSING_SOON_DAYS,
  EXPIRED_AFTER_DAYS,
}
