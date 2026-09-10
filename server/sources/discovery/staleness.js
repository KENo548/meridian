import { getAll, updateField, transition, STATES } from './store.js'

const STALENESS_THRESHOLDS = {
  STALE_AFTER_DAYS: 14,
  MISSING_AFTER_DAYS: 30,
  CLOSED_AFTER_DAYS: 60,
  MAX_CONSECUTIVE_MISSES: 3,
}

function calculateStaleness(entry, now = Date.now()) {
  if (!entry || !entry.lastObservationAt) {
    return { status: 'unknown', reason: 'no_observations', daysSinceLastObservation: null }
  }

  const lastObs = new Date(entry.lastObservationAt).getTime()
  const daysSinceLastObservation = Math.floor((now - lastObs) / (1000 * 60 * 60 * 24))

  if (entry.lastVerifiedAt) {
    const lastVerified = new Date(entry.lastVerifiedAt).getTime()
    const daysSinceVerified = Math.floor((now - lastVerified) / (1000 * 60 * 60 * 24))
    if (daysSinceVerified <= STALENESS_THRESHOLDS.STALE_AFTER_DAYS) {
      return { status: 'fresh', reason: 'recently_verified', daysSinceLastObservation, daysSinceVerified }
    }
  }

  if (entry.observations && entry.observations.length > 1) {
    const uniqueSources = [...new Set(entry.observations.map(o => o.source))]
    if (uniqueSources.length >= 2) {
      const latestObs = entry.observations.reduce((latest, o) => {
        const t = new Date(o.lastSeenAt || 0).getTime()
        return t > new Date(latest.lastSeenAt || 0).getTime() ? o : latest
      }, entry.observations[0])
      const latestTime = new Date(latestObs.lastSeenAt || 0).getTime()
      const daysSinceLatest = Math.floor((now - latestTime) / (1000 * 60 * 60 * 24))
      if (daysSinceLatest <= STALENESS_THRESHOLDS.STALE_AFTER_DAYS) {
        return { status: 'fresh', reason: 'multi_source_recent', daysSinceLastObservation: daysSinceLatest }
      }
    }
  }

  if (daysSinceLastObservation <= STALENESS_THRESHOLDS.STALE_AFTER_DAYS) {
    return { status: 'fresh', reason: 'recent_observation', daysSinceLastObservation }
  }

  if (daysSinceLastObservation <= STALENESS_THRESHOLDS.MISSING_AFTER_DAYS) {
    return { status: 'stale', reason: 'aging', daysSinceLastObservation }
  }

  if (daysSinceLastObservation <= STALENESS_THRESHOLDS.CLOSED_AFTER_DAYS) {
    return { status: 'missing', reason: 'disappeared', daysSinceLastObservation }
  }

  return { status: 'expired', reason: 'too_old', daysSinceLastObservation }
}

function applyStalenessTransitions(entries) {
  const results = []

  for (const entry of entries) {
    const staleness = calculateStaleness(entry)
    let transitioned = false

    if (entry.status === STATES.REJECTED) {
      results.push({ id: entry.id, companyName: entry.companyName, staleness, transitioned: false, reason: 'already_rejected' })
      continue
    }

    if (staleness.status === 'expired' && entry.status !== STATES.REJECTED) {
      transition(entry.id, STATES.REJECTED, `Expired: ${staleness.reason}`)
      transitioned = true
    } else if (staleness.status === 'missing' && entry.status === STATES.VERIFIED) {
      updateField(entry.id, 'consecutiveMisses', (entry.consecutiveMisses || 0) + 1)
      if ((entry.consecutiveMisses || 0) + 1 >= STALENESS_THRESHOLDS.MAX_CONSECUTIVE_MISSES) {
        transition(entry.id, STATES.NEEDS_REVIEW, `Missing for ${staleness.daysSinceLastObservation} days`)
        transitioned = true
      }
    } else if (staleness.status === 'stale' && entry.status === STATES.VERIFIED) {
      updateField(entry.id, 'consecutiveMisses', (entry.consecutiveMisses || 0) + 1)
    } else if (staleness.status === 'fresh' && entry.consecutiveMisses > 0) {
      updateField(entry.id, 'consecutiveMisses', 0)
    }

    if (entry.observations) {
      const latestObs = entry.observations.reduce((latest, o) => {
        const t = new Date(o.lastSeenAt || 0).getTime()
        return t > new Date(latest.lastSeenAt || 0).getTime() ? o : latest
      }, entry.observations[0])
      if (latestObs && latestObs.lastSeenAt) {
        updateField(entry.id, 'lastObservationAt', latestObs.lastSeenAt)
      }
    }

    results.push({
      id: entry.id,
      companyName: entry.companyName,
      status: entry.status,
      staleness,
      transitioned,
      consecutiveMisses: entry.consecutiveMisses || 0,
    })
  }

  return results
}

function getStalenessReport() {
  const entries = getAll()
  const results = applyStalenessTransitions(entries)

  const report = {
    timestamp: new Date().toISOString(),
    total: results.length,
    fresh: results.filter(r => r.staleness.status === 'fresh').length,
    stale: results.filter(r => r.staleness.status === 'stale').length,
    missing: results.filter(r => r.staleness.status === 'missing').length,
    expired: results.filter(r => r.staleness.status === 'expired').length,
    unknown: results.filter(r => r.staleness.status === 'unknown').length,
    transitions: results.filter(r => r.transitioned).length,
    byReason: {},
  }

  for (const r of results) {
    const reason = r.staleness.reason
    report.byReason[reason] = (report.byReason[reason] || 0) + 1
  }

  return report
}

export {
  calculateStaleness,
  applyStalenessTransitions,
  getStalenessReport,
  STALENESS_THRESHOLDS,
}
