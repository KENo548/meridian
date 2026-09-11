import { getEnabledFirms } from './registry.js'
import { fetchAllEnabledFirms } from './ats.js'
import { normalize } from './normalize.js'
import { canonicalizeBatch } from './ats/canonicalize.js'
import { deduplicateJobs, computeFingerprint, computeContentHash, buildExternalKey } from './ats/dedup.js'
import { runDiscovery, getDiscoveryStats } from './discovery/index.js'
import { resolveOpportunities } from './discovery/resolve-ats.js'
import { evaluateAllStaleness } from './canonical-staleness.js'
import { trackedScan, getHealthSummary, getZeroResultWarnings } from './adapter-health.js'
import {
  saveCanonicalJob,
  getCanonicalJobs,
  countCanonicalJobs,
  saveRawObservation,
  saveJobSourceObservation,
  saveJobVersion,
  getCanonicalJobById,
  upsertCompanyByName,
  getAllEnabledSources,
  saveCompanySource,
  updateSourceHealth,
  getObservationsForJob,
  upsertSighting,
  upsertAdapterHealth,
} from '../db.js'
import crypto from 'node:crypto'

// ─── State ──────────────────────────────────────────────────────

let scanInterval = null
let lastScanResult = null
let scanning = false

// ─── Canonical Job Persistence (v2 — identity resolution) ──────

function upsertCanonicalJob(job, source) {
  const now = new Date().toISOString()
  const companyId = job.company ? upsertCompanyByName(job.company) : null

  // Compute fingerprint for this job
  const fingerprint = computeFingerprint(job)
  const contentHash = computeContentHash(job)
  const externalKey = buildExternalKey(source, job)
  const tier = classifySourceTier(source)

  // Check if canonical job already exists
  const existing = getCanonicalJobById(job.id)

  if (!existing) {
    // NEW canonical job
    const newJob = {
      id: job.id,
      companyId,
      companyName: job.company || '',
      title: job.title || '',
      normalizedTitle: job.title || '',
      location: job.location || '',
      country: job.country || '',
      city: job.city || '',
      applicationUrl: job.applyUrl || job.url || '',
      description: job.description || '',
      programmeType: job.programme || 'unknown',
      employmentType: job.type || 'unknown',
      financeCategory: 'unknown',
      financeSubcategory: null,
      seniority: null,
      graduationYear: null,
      deadline: job.deadline || null,
      openingDate: job.openingDate || null,
      postedAt: job.posted || null,
      firstSeenAt: now,
      lastSeenAt: now,
      closedAt: null,
      status: 'active',
      confidence: 0.5,
      specialties: job.specialties || [],
      sourceUrl: job.sourceUrl || job.employerUrl || null,
      identityTier: tier,
      fingerprint,
      lifecycle: 'open',
      closureReason: null,
      consecutiveAbsences: 0,
      lastVerifiedOpenAt: now,
    }
    saveCanonicalJob(newJob)

    // Record sighting
    upsertSighting({
      canonicalJobId: job.id,
      source,
      sourceTier: tier,
      sourceExternalKey: externalKey || `${source}:${job.id}`,
      sourceJobId: job.sourceJobId || job.id,
      sourceUrl: job.url || null,
      employerUrl: job.employerUrl || null,
      rawTitle: job.rawTitle || job.title || '',
      rawCompany: job.rawCompany || job.company || '',
      rawLocation: job.rawLocation || job.location || '',
      rawPayload: JSON.stringify(job).substring(0, 10000),
      contentHash,
      isActive: true,
    })

    return { isNew: true, job: newJob }
  }

  // EXISTING canonical job — update timestamps and detect changes
  const changedFields = []
  const previousValues = {}
  const newValues = {}

  if (job.title && job.title !== existing.title) {
    changedFields.push('title')
    previousValues.title = existing.title
    newValues.title = job.title
  }
  if (job.url && job.url !== existing.application_url) {
    changedFields.push('application_url')
    previousValues.application_url = existing.application_url
    newValues.application_url = job.url
  }
  if (job.deadline && job.deadline !== existing.deadline) {
    changedFields.push('deadline')
    previousValues.deadline = existing.deadline
    newValues.deadline = job.deadline
  }
  if (job.location && job.location !== existing.location) {
    changedFields.push('location')
    previousValues.location = existing.location
    newValues.location = job.location
  }

  const updatedJob = {
    id: existing.id,
    companyId: existing.company_id || companyId,
    companyName: existing.company_name,
    title: changedFields.includes('title') ? newValues.title : existing.title,
    normalizedTitle: existing.normalized_title,
    location: changedFields.includes('location') ? newValues.location : existing.location,
    country: existing.country || job.country || '',
    city: existing.city || job.city || '',
    applicationUrl: changedFields.includes('application_url') ? newValues.application_url : existing.application_url,
    description: existing.description || job.description || '',
    programmeType: existing.programme_type || 'unknown',
    employmentType: existing.employment_type || 'unknown',
    financeCategory: existing.finance_category || 'unknown',
    financeSubcategory: existing.finance_subcategory,
    seniority: existing.seniority,
    graduationYear: existing.graduation_year,
    deadline: changedFields.includes('deadline') ? newValues.deadline : existing.deadline,
    openingDate: existing.opening_date || job.openingDate || null,
    postedAt: existing.posted_at || job.posted || null,
    firstSeenAt: existing.first_seen_at,
    lastSeenAt: now,
    closedAt: existing.closed_at, // Never hardcode null — preserve existing
    status: 'active',
    confidence: existing.confidence || 0.5,
    specialties: job.specialties || JSON.parse(existing.specialties || '[]'),
    sourceUrl: existing.source_url || job.sourceUrl || job.employerUrl || null,
    identityTier: existing.identity_tier || tier,
    fingerprint: existing.fingerprint || fingerprint,
    lifecycle: existing.lifecycle || 'open',
    closureReason: existing.closure_reason,
    consecutiveAbsences: existing.consecutive_absences || 0,
    lastVerifiedOpenAt: now,
  }
  saveCanonicalJob(updatedJob)

  // Record sighting (always — proves the job was still live when this source saw it)
  upsertSighting({
    canonicalJobId: existing.id,
    source,
    sourceTier: tier,
    sourceExternalKey: externalKey || `${source}:${existing.id}`,
    sourceJobId: job.sourceJobId || existing.id,
    sourceUrl: job.url || null,
    employerUrl: job.employerUrl || null,
    rawTitle: job.rawTitle || job.title || '',
    rawCompany: job.rawCompany || job.company || '',
    rawLocation: job.rawLocation || job.location || '',
    rawPayload: JSON.stringify(job).substring(0, 10000),
    contentHash,
    isActive: true,
  })

  // Record version if fields changed
  if (changedFields.length > 0) {
    saveJobVersion({
      id: `ver:${existing.id}:${Date.now()}`,
      canonicalJobId: existing.id,
      versionNumber: 1,
      changedFields,
      previousValues,
      newValues,
      sourceId: `source:${source}`,
    })
  }

  return { isNew: false, job: updatedJob, changedFields }
}

// ─── Source Classification ─────────────────────────────────────

function classifySourceTier(source) {
  const ATS_SOURCES = ['greenhouse', 'workday', 'oleeo_rss', 'smartrecruiters', 'lever', 'ashby', 'oracle_hcm', 'avature', 'eightfold', 'successfactors']
  const TRACKER_SOURCES = ['analystclass', 'fyntraq', 'trackr', 'landtheoffer']
  if (ATS_SOURCES.includes(source)) return 'employer_ats'
  if (TRACKER_SOURCES.includes(source)) return 'tracker'
  return 'aggregator'
}

// ─── Job Ingestion Loop (v2 — identity resolution) ──────────────

async function ingestFromSources() {
  if (scanning) {
    return { error: 'Scan already in progress', status: 'running' }
  }

  scanning = true
  const startTime = Date.now()
  const newJobIds = []
  const healthReports = []

  try {
    const firms = getEnabledFirms()
    if (firms.length === 0) {
      return { error: 'No enabled firms in registry', status: 'empty' }
    }

    // Fetch with adapter health tracking
    const { jobs: rawJobs, firmResults } = await fetchAllEnabledFirms(firms)

    const normalizedJobs = rawJobs
      .map(job => normalize(job, job.source))
      .filter(Boolean)

    const canonicalJobs = canonicalizeBatch(normalizedJobs)
    const { jobs: dedupedJobs } = deduplicateJobs(canonicalJobs)

    // Persist each job with identity resolution + sighting
    const sourceCounters = {}
    for (const job of dedupedJobs) {
      const source = job.source || 'unknown'
      sourceCounters[source] = (sourceCounters[source] || 0) + 1

      const result = upsertCanonicalJob(job, source)
      if (result.isNew) {
        newJobIds.push(job.id)
      }
    }

    // Run staleness evaluation
    const stalenessReport = evaluateAllStaleness()

    const totalJobs = countCanonicalJobs({ status: 'active' })

    const result = {
      status: 'completed',
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      firmsScanned: firmResults.length,
      firmsSucceeded: firmResults.filter(f => !f.error).length,
      firmsFailed: firmResults.filter(f => f.error).length,
      totalJobs,
      newJobs: newJobIds.length,
      newJobIds,
      jobsBySource: sourceCounters,
      staleness: {
        evaluated: stalenessReport.evaluated,
        closed: stalenessReport.closed,
        healthy: stalenessReport.healthy,
      },
      firmResults,
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

// ─── Source Discovery Loop ─────────────────────────────────────

async function discoverSources() {
  try {
    return await runDiscovery()
  } catch (err) {
    return { error: err.message }
  }
}

// ─── Combined Scan (for backward compat) ───────────────────────

async function scanAll() {
  if (scanning) {
    return { error: 'Scan already in progress', status: 'running' }
  }

  scanning = true
  const startTime = Date.now()

  try {
    let discoveryReport = null
    try {
      discoveryReport = await discoverSources()
    } catch (err) {
      discoveryReport = { error: err.message }
    }

    let resolutionReport = null
    try {
      resolutionReport = await resolveOpportunities({ verify: true, limit: 100 })
    } catch (err) {
      resolutionReport = { error: err.message }
    }

    const ingestionResult = await ingestFromSources()

    // Get adapter health summary
    const adapterHealth = getHealthSummary()
    const zeroWarnings = getZeroResultWarnings()

    const withDeadlines = getCanonicalJobs({ status: 'active', sort: 'deadline', order: 'asc', limit: 20 })
      .filter(j => j.deadline)
      .map(j => ({
        title: j.title,
        company: j.company_name,
        deadline: j.deadline,
        url: j.application_url,
      }))

    const result = {
      ...ingestionResult,
      upcomingDeadlines: withDeadlines,
      discovery: discoveryReport,
      discoveryStats: getDiscoveryStats(),
      resolution: resolutionReport,
      adapterHealth: adapterHealth.map(a => ({
        source: a.source,
        status: a.status,
        jobsFound: a.jobs_found,
        consecutiveZeroScans: a.consecutive_zero_scans,
        zeroWarning: a.zeroWarning,
      })),
      zeroWarnings: zeroWarnings.map(w => w.source),
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

// ─── Adaptive Scheduler ────────────────────────────────────────

const PRIORITY_INTERVALS = {
  hot: 3 * 60 * 1000,
  warm: 12 * 60 * 1000,
  normal: 45 * 60 * 1000,
  cold: 4 * 60 * 60 * 1000,
}

function startCronScan(intervalMs) {
  stopCronScan()

  if (!intervalMs) {
    console.log(`[Scan] Starting adaptive scheduler`)
    runAdaptiveLoop()
    return
  }

  scanInterval = setInterval(async () => {
    console.log(`[Scan] Starting scheduled scan at ${new Date().toISOString()}`)
    const result = await scanAll()
    console.log(`[Scan] Completed: ${result.totalJobs || 0} jobs from ${result.firmsScanned || 0} firms`)
  }, intervalMs)
  console.log(`[Scan] Cron scan scheduled every ${intervalMs / 1000 / 60} minutes`)
}

async function runAdaptiveLoop() {
  while (true) {
    try {
      const result = await ingestFromSources()
      console.log(`[Scan] Ingestion completed: ${result.totalJobs || 0} jobs, ${result.newJobs || 0} new`)
    } catch (err) {
      console.error(`[Scan] Ingestion error:`, err.message)
    }

    await new Promise(resolve => setTimeout(resolve, PRIORITY_INTERVALS.normal))
  }
}

function stopCronScan() {
  if (scanInterval) {
    clearInterval(scanInterval)
    scanInterval = null
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
  return getCanonicalJobs({ status: 'active', limit: 10000 })
}

function clearPersistedJobs() {
  // No-op — jobs are now in SQLite
}

// ─── Coverage & Health ─────────────────────────────────────────

function getCoverageReport() {
  const totalJobs = countCanonicalJobs({ status: 'active' })
  const byProgramme = {}
  const byFinance = {}
  const byCountry = {}

  const jobs = getCanonicalJobs({ status: 'active', limit: 100000 })
  for (const job of jobs) {
    byProgramme[job.programme_type] = (byProgramme[job.programme_type] || 0) + 1
    byFinance[job.finance_category] = (byFinance[job.finance_category] || 0) + 1
    if (job.country) byCountry[job.country] = (byCountry[job.country] || 0) + 1
  }

  return {
    totalJobs,
    byProgramme,
    byFinance,
    byCountry,
    generatedAt: new Date().toISOString(),
  }
}

export {
  scanAll,
  ingestFromSources,
  discoverSources,
  scanSingleFirm,
  getLastScanResult,
  getScanStatus,
  getPersistedJobs,
  clearPersistedJobs,
  startCronScan,
  stopCronScan,
  getCoverageReport,
}
