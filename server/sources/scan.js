import { getEnabledFirms } from './registry.js'
import { fetchAllEnabledFirms } from './ats.js'
import { normalize } from './normalize.js'
import { canonicalizeBatch } from './ats/canonicalize.js'
import { deduplicateJobs } from './ats/dedup.js'
import { runDiscovery, getDiscoveryStats } from './discovery/index.js'
import { resolveOpportunities, generateCoverageGapReport } from './discovery/resolve-ats.js'
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
} from '../db.js'
import crypto from 'node:crypto'

// ─── State ──────────────────────────────────────────────────────

let scanInterval = null
let lastScanResult = null
let scanning = false

// ─── Content Hashing (§29) ─────────────────────────────────────

function contentHash(job) {
  const normalized = JSON.stringify({
    title: (job.title || '').toLowerCase().trim(),
    location: (job.location || '').toLowerCase().trim(),
    company: (job.company || '').toLowerCase().trim(),
    url: job.url || '',
    applyUrl: job.applyUrl || '',
    description: (job.description || '').substring(0, 500),
  })
  return crypto.createHash('sha256').update(normalized).digest('hex').substring(0, 16)
}

// ─── Canonical Job Persistence (§6, §7) ────────────────────────

function upsertCanonicalJob(job, sourceId) {
  const now = new Date().toISOString()
  const companyId = job.company ? upsertCompanyByName(job.company) : null

  // Check if canonical job already exists
  const existing = getCanonicalJobById(job.id)

  if (!existing) {
    // NEW canonical job — first seen ever
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
    }
    saveCanonicalJob(newJob)

    // Record source observation
    if (sourceId) {
      saveJobSourceObservation(job.id, sourceId, job.sourceJobId || job.id, job.url || null)
    }

    // Record raw observation
    if (sourceId) {
      saveRawObservation({
        id: `obs:${job.id}:${sourceId}:${Date.now()}`,
        sourceId,
        companyId,
        sourceJobId: job.sourceJobId || job.id,
        sourceUrl: job.url || null,
        fetchedAt: now,
        payload: job,
        payloadHash: contentHash(job),
        httpStatus: 200,
      })
    }

    return { isNew: true, job: newJob }
  }

  // EXISTING canonical job — update timestamps and detect changes
  const changedFields = []
  const previousValues = {}
  const newValues = {}

  // Detect meaningful changes (§29)
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

  // Update the canonical job
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
    closedAt: null,
    status: 'active',
    confidence: existing.confidence || 0.5,
    specialties: job.specialties || JSON.parse(existing.specialties || '[]'),
    sourceUrl: existing.source_url || job.sourceUrl || job.employerUrl || null,
  }
  saveCanonicalJob(updatedJob)

  // Record source observation
  if (sourceId) {
    saveJobSourceObservation(job.id, sourceId, job.sourceJobId || job.id, job.url || null)
  }

  // Record raw observation
  if (sourceId) {
    saveRawObservation({
      id: `obs:${job.id}:${sourceId}:${Date.now()}`,
      sourceId,
      companyId,
      sourceJobId: job.sourceJobId || job.id,
      sourceUrl: job.url || null,
      fetchedAt: now,
      payload: job,
      payloadHash: contentHash(job),
      httpStatus: 200,
    })
  }

  // Record version if fields changed (§28)
  if (changedFields.length > 0) {
    const versionCount = existing.id ? 1 : 0 // simplified
    saveJobVersion({
      id: `ver:${existing.id}:${Date.now()}`,
      canonicalJobId: existing.id,
      versionNumber: versionCount + 1,
      changedFields,
      previousValues,
      newValues,
      sourceId,
    })
  }

  return { isNew: false, job: updatedJob, changedFields }
}

// ─── Job Ingestion Loop (§9A) ─────────────────────────────────

async function ingestFromSources() {
  if (scanning) {
    return { error: 'Scan already in progress', status: 'running' }
  }

  scanning = true
  const startTime = Date.now()
  const newJobIds = []

  try {
    const firms = getEnabledFirms()
    if (firms.length === 0) {
      return { error: 'No enabled firms in registry', status: 'empty' }
    }

    const { jobs: rawJobs, firmResults } = await fetchAllEnabledFirms(firms)

    const normalizedJobs = rawJobs
      .map(job => normalize(job, job.source))
      .filter(Boolean)

    const canonicalJobs = canonicalizeBatch(normalizedJobs)
    const { jobs: dedupedJobs } = deduplicateJobs(canonicalJobs)

    // Persist each job to SQLite and track new insertions
    const sourceIds = new Map()
    for (const job of dedupedJobs) {
      // Resolve source ID from provider name
      const sourceKey = job.source || 'unknown'
      if (!sourceIds.has(sourceKey)) {
        const sourceId = `source:${sourceKey}`
        sourceIds.set(sourceKey, sourceId)
      }
      const result = upsertCanonicalJob(job, sourceIds.get(sourceKey))
      if (result.isNew) {
        newJobIds.push(job.id)
      }
    }

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

// ─── Source Discovery Loop (§9B) ──────────────────────────────

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
    // Phase 1: Source discovery (infrequent, can be slow)
    let discoveryReport = null
    try {
      discoveryReport = await discoverSources()
    } catch (err) {
      discoveryReport = { error: err.message }
    }

    // Phase 2: Resolution (moderate frequency)
    let resolutionReport = null
    try {
      resolutionReport = await resolveOpportunities({ verify: true, limit: 100 })
    } catch (err) {
      resolutionReport = { error: err.message }
    }

    // Phase 3: Job ingestion (frequent, must be fast)
    const ingestionResult = await ingestFromSources()

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

// ─── Adaptive Scheduler (§8) ──────────────────────────────────

const PRIORITY_INTERVALS = {
  hot: 3 * 60 * 1000,      // 3 minutes
  warm: 12 * 60 * 1000,    // 12 minutes
  normal: 45 * 60 * 1000,  // 45 minutes
  cold: 4 * 60 * 60 * 1000, // 4 hours
}

function startCronScan(intervalMs) {
  stopCronScan()

  // Use adaptive scheduling if no explicit interval
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

    // Wait for next interval (default: normal priority)
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
