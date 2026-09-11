/**
 * Adapter Health System
 *
 * Every adapter execution is wrapped with timing and result counting.
 * Zero-result detection triggers warnings/failures based on historical baseline.
 *
 * Metrics tracked per adapter:
 *   - jobs_found: current scan result count
 *   - previous_jobs_found: last scan result count
 *   - baseline_avg_jobs: rolling average (excluding zero-result scans)
 *   - consecutive_zero_scans: how many scans in a row returned 0
 *   - duration_ms: how long the scan took
 *   - http_status: last HTTP status code
 *   - parser_version: which parser was used
 *   - last_non_zero_at: when did we last see non-zero results
 */

import {
  upsertAdapterHealth,
  getAdapterHealth,
  getAllAdapterHealth,
} from '../db.js'

// ─── Health Status Thresholds ───────────────────────────────────

const STATUS = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNHEALTHY: 'unhealthy',
}

// How many consecutive zero-result scans before status changes
const ZERO_RESULT_THRESHOLDS = {
  healthy: 0,   // 0 zero scans = healthy
  degraded: 2,  // 2+ zero scans = degraded
  unhealthy: 5, // 5+ zero scans = unhealthy
}

// If we had a baseline > 0 and now see 0, that's a concern
const BASELINE_SIGNIFICANCE = 5 // Only care about zero results if baseline > 5

// ─── Scan Wrapper ───────────────────────────────────────────────

/**
 * Wrap an adapter scan with health tracking.
 *
 * Usage:
 *   const result = await trackedScan('greenhouse', () => greenhouseAdapter.execute(source))
 *   // result = { jobs, health }
 */
export async function trackedScan(source, scanFn, options = {}) {
  const { parserVersion = 'v1', httpStatus } = options
  const startTime = Date.now()
  let jobs = []
  let error = null

  try {
    jobs = await scanFn()
  } catch (err) {
    error = err
    jobs = []
  }

  const durationMs = Date.now() - startTime
  const previousHealth = getAdapterHealth(source)
  const jobsFound = jobs.length
  const previousJobsFound = previousHealth?.jobs_found ?? jobsFound
  const baselineAvgJobs = previousHealth?.baseline_avg_jobs ?? jobsFound
  const consecutiveZeroScans = jobsFound === 0
    ? (previousHealth?.consecutive_zero_scans ?? 0) + 1
    : 0

  // Update rolling average (only when non-zero)
  let newBaselineAvg = baselineAvgJobs
  if (jobsFound > 0) {
    // Exponential moving average: 80% old + 20% new
    newBaselineAvg = Math.round(baselineAvgJobs * 0.8 + jobsFound * 0.2)
  }

  // Determine health status
  const status = determineStatus(consecutiveZeroScans, newBaselineAvg, error)
  const lastNonZeroAt = jobsFound > 0 ? new Date().toISOString() : (previousHealth?.last_non_zero_at || null)

  // Persist health record
  upsertAdapterHealth({
    source,
    status,
    last_scan_at: new Date().toISOString(),
    last_success_at: error ? null : new Date().toISOString(),
    http_status: httpStatus || (error ? null : 200),
    jobs_found: jobsFound,
    previous_jobs_found: previousJobsFound,
    baseline_avg_jobs: newBaselineAvg,
    duration_ms: durationMs,
    parser_version: parserVersion,
    error_message: error?.message || null,
    consecutive_zero_scans: consecutiveZeroScans,
    last_non_zero_at: lastNonZeroAt,
  })

  return {
    jobs,
    health: {
      source,
      status,
      jobsFound,
      previousJobsFound,
      baselineAvgJobs: newBaselineAvg,
      consecutiveZeroScans,
      durationMs,
      error: error?.message || null,
    },
  }
}

// ─── Status Determination ───────────────────────────────────────

function determineStatus(consecutiveZeroScans, baselineAvg, error) {
  if (error) return STATUS.UNHEALTHY

  if (consecutiveZeroScans >= ZERO_RESULT_THRESHOLDS.unhealthy) {
    if (baselineAvg > BASELINE_SIGNIFICANCE) {
      return STATUS.UNHEALTHY
    }
    return STATUS.DEGRADED
  }

  if (consecutiveZeroScans >= ZERO_RESULT_THRESHOLDS.degraded) {
    if (baselineAvg > BASELINE_SIGNIFICANCE) {
      return STATUS.DEGRADED
    }
    return STATUS.HEALTHY // Small baseline, probably just no data
  }

  return STATUS.HEALTHY
}

// ─── Health Queries ─────────────────────────────────────────────

/**
 * Get health summary for all adapters.
 * Returns array sorted by status (unhealthy first).
 */
export function getHealthSummary() {
  const adapters = getAllAdapterHealth()
  const statusOrder = { unhealthy: 0, degraded: 1, healthy: 2 }
  return adapters
    .map(a => ({
      ...a,
      displayStatus: formatStatus(a.status),
      zeroWarning: a.consecutive_zero_scans > 0 && a.baseline_avg_jobs > BASELINE_SIGNIFICANCE,
      zeroCritical: a.consecutive_zero_scans >= ZERO_RESULT_THRESHOLDS.unhealthy && a.baseline_avg_jobs > BASELINE_SIGNIFICANCE,
    }))
    .sort((a, b) => (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3))
}

/**
 * Get unhealthy adapters that need attention.
 */
export function getUnhealthyAdapters() {
  return getAllAdapterHealth()
    .filter(a => a.status === STATUS.UNHEALTHY)
}

/**
 * Get adapters with zero-result warnings.
 */
export function getZeroResultWarnings() {
  return getAllAdapterHealth()
    .filter(a => a.consecutive_zero_scans > 0 && a.baseline_avg_jobs > BASELINE_SIGNIFICANCE)
}

// ─── Helpers ────────────────────────────────────────────────────

function formatStatus(status) {
  switch (status) {
    case STATUS.HEALTHY: return 'Healthy'
    case STATUS.DEGRADED: return 'Degraded'
    case STATUS.UNHEALTHY: return 'Unhealthy'
    default: return 'Unknown'
  }
}

export { STATUS, ZERO_RESULT_THRESHOLDS, BASELINE_SIGNIFICANCE }
