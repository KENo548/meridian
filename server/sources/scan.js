import { getEnabledFirms } from './registry.js'
import { fetchAllEnabledFirms } from './ats.js'
import { normalize, normalizeBatch } from './normalize.js'
import { canonicalizeBatch } from './ats/canonicalize.js'
import { deduplicateJobs, mergeWithPersisted } from './ats/dedup.js'
import { runDiscovery, getDiscoveryStats } from './discovery/index.js'
import { resolveOpportunities, generateCoverageGapReport } from './discovery/resolve-ats.js'

let scanInterval = null
let lastScanResult = null
let scanning = false
let persistedJobs = []

async function scanAll() {
  if (scanning) {
    return { error: 'Scan already in progress', status: 'running' }
  }

  scanning = true
  const startTime = Date.now()

  try {
    let discoveryReport = null
    try {
      discoveryReport = await runDiscovery()
    } catch (err) {
      discoveryReport = { error: err.message }
    }

    let resolutionReport = null
    try {
      resolutionReport = await resolveOpportunities({ verify: true, limit: 100 })
    } catch (err) {
      resolutionReport = { error: err.message }
    }

    const firms = getEnabledFirms()
    if (firms.length === 0) {
      return { error: 'No enabled firms in registry', status: 'empty' }
    }

    const { jobs: rawJobs, firmResults } = await fetchAllEnabledFirms(firms)

    const normalizedJobs = rawJobs
      .map(job => normalize(job, job.source))
      .filter(Boolean)

    const canonicalJobs = canonicalizeBatch(normalizedJobs)

    const { jobs: dedupedJobs, report: dedupReport } = deduplicateJobs(canonicalJobs)

    const { jobs: mergedJobs, report: mergeReport } = mergeWithPersisted(dedupedJobs, persistedJobs)

    persistedJobs = mergedJobs

    const newJobs = mergedJobs.filter(j => {
      const firstSeen = new Date(j.firstSeenAt)
      return (Date.now() - firstSeen.getTime()) < 60000
    })

    const withDeadlines = mergedJobs.filter(j => j.deadline).map(j => ({
      title: j.title,
      company: j.company,
      deadline: j.deadline,
      url: j.url,
    }))

    const coverageGap = generateCoverageGapReport([])

    const result = {
      status: 'completed',
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      firmsScanned: firmResults.length,
      firmsSucceeded: firmResults.filter(f => !f.error).length,
      firmsFailed: firmResults.filter(f => f.error).length,
      totalJobs: mergedJobs.length,
      newJobs: newJobs.length,
      upcomingDeadlines: withDeadlines,
      firmResults,
      jobs: mergedJobs,
      dedupReport,
      mergeReport,
      discovery: discoveryReport,
      discoveryStats: getDiscoveryStats(),
      resolution: resolutionReport,
      coverageGap,
    }

    lastScanResult = result
    return result
  } catch (err) {
    return {
      status: 'error',
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      error: err.message,
    }
  } finally {
    scanning = false
  }
}

function scanSingleFirm(firmId) {
  const firms = getEnabledFirms()
  const firm = firms.find(f => f.id === firmId)
  if (!firm) return { error: `Firm not found or not enabled: ${firmId}` }

  return fetchAllEnabledFirms([firm])
}

function getLastScanResult() {
  return lastScanResult
}

function getScanStatus() {
  return {
    scanning,
    lastScan: lastScanResult ? {
      timestamp: lastScanResult.timestamp,
      totalJobs: lastScanResult.totalJobs,
      firmsScanned: lastScanResult.firmsScanned,
    } : null,
  }
}

function getPersistedJobs() {
  return persistedJobs
}

function clearPersistedJobs() {
  persistedJobs = []
}

function startCronScan(intervalMs = 6 * 60 * 60 * 1000) {
  stopCronScan()
  scanInterval = setInterval(async () => {
    console.log(`[Scan] Starting scheduled scan at ${new Date().toISOString()}`)
    const result = await scanAll()
    console.log(`[Scan] Completed: ${result.totalJobs || 0} jobs from ${result.firmsScanned || 0} firms`)
  }, intervalMs)
  console.log(`[Scan] Cron scan scheduled every ${intervalMs / 1000 / 60} minutes`)
}

function stopCronScan() {
  if (scanInterval) {
    clearInterval(scanInterval)
    scanInterval = null
  }
}

export {
  scanAll,
  scanSingleFirm,
  getLastScanResult,
  getScanStatus,
  getPersistedJobs,
  clearPersistedJobs,
  startCronScan,
  stopCronScan,
}
