import { getEnabledFirms, getAllFirms, addCareerSourceToFirm, FIRMS } from '../registry.js'
import { discoverFirmSource, buildCareerSource } from './source-discovery.js'
import { batchMatchV3, MATCH_THRESHOLDS } from './matcher-v3.js'
import { enrichTrackerEntry } from './enrich.js'
import { getAll as getAllDiscoveries, updateField, updateSourceDiscovery, updateMatchResult, transition, STATES, getUnmatchedEntries, getEntriesByFirm, getLastDiscoveryTimestamp } from './store.js'
import { classifyUrl } from '../ats/classifier.js'
import { fetchAllEnabledFirms } from '../ats.js'
import { normalize } from '../normalize.js'
import { canonicalizeBatch } from '../ats/canonicalize.js'
import {
  saveDirectJobs, getAllDirectJobs, clearDirectJobs,
  saveSourceDiscovery, getAllSourceDiscoveries, clearSourceDiscoveries
} from '../../db.js'

const STALENESS_THRESHOLDS = {
  trackerDiscovery: 24 * 60 * 60 * 1000,  // 24 hours
  firmSourceDiscovery: 7 * 24 * 60 * 60 * 1000,  // 7 days (ATS backends rarely change)
  directJobs: 2 * 60 * 60 * 1000,  // 2 hours (ATS data changes more often)
}

let sourceDiscoveryResults = new Map()
let directJobsByFirm = new Map()

// Load persisted pipeline state on module import
function loadPipelineState() {
  sourceDiscoveryResults = getAllSourceDiscoveries()
  directJobsByFirm = getAllDirectJobs()
  console.log(`[Pipeline] Loaded ${sourceDiscoveryResults.size} source discoveries, ${directJobsByFirm.size} firm job caches from SQLite`)
}

loadPipelineState()

async function discoverFirmSources(options = {}) {
  const { maxDepth = 2, concurrency = 3, force = false } = options
  const firms = getEnabledFirms()
  const startTime = Date.now()

  // Skip if data is fresh and not forced
  if (!force) {
    const existingDiscoveries = getAllSourceDiscoveries()
    const firmsWithDiscoveries = new Set(existingDiscoveries.keys())
    const firmsNeedingDiscovery = firms.filter(f => !firmsWithDiscoveries.has(f.id))

    if (firmsNeedingDiscovery.length === 0) {
      console.log(`[Pipeline] All ${firms.length} firms already have source discoveries — skipping Phase 2`)
      return {
        timestamp: new Date().toISOString(),
        totalFirms: firms.length,
        discovered: 0,
        failed: 0,
        results: [],
        durationMs: 0,
        skipped: true,
        reason: 'All firms already have discoveries',
      }
    }

    console.log(`[Pipeline] ${firmsNeedingDiscovery.length}/${firms.length} firms need source discovery`)
  }

  const firmsToDiscover = force ? firms : firms.filter(f => !new Set(getAllSourceDiscoveries().keys()).has(f.id))
  const results = []
  for (let i = 0; i < firmsToDiscover.length; i += concurrency) {
    const batch = firmsToDiscover.slice(i, i + concurrency)
    const batchResults = await Promise.all(
      batch.map(async (firm) => {
        const firmForDiscovery = {
          ...firm,
          careersPage: firm.careersPage || firm.careersUrl || null,
        }
        const discovery = await discoverFirmSource(firmForDiscovery, { maxDepth })
        sourceDiscoveryResults.set(firm.id, discovery)
        saveSourceDiscovery(firm.id, discovery)

        if (discovery.discovered.length > 0) {
          for (const d of discovery.discovered) {
            const careerSource = buildCareerSource(d, firm)
            updateRegistryCareerSource(firm.id, careerSource)
          }
        }

        return {
          firmId: firm.id,
          firmName: firm.name,
          discovered: discovery.discovered.length,
          providers: discovery.discovered.map(d => d.provider),
          durationMs: discovery.durationMs,
          error: discovery.error,
        }
      })
    )
    results.push(...batchResults)
  }

  return {
    timestamp: new Date().toISOString(),
    totalFirms: firms.length,
    discovered: results.filter(r => r.discovered > 0).length,
    failed: results.filter(r => r.error).length,
    results,
    durationMs: Date.now() - startTime,
  }
}

function updateRegistryCareerSource(firmId, careerSource) {
  addCareerSourceToFirm(firmId, careerSource)
}

async function enumerateDirectJobs(firmIds = null, options = {}) {
  const { force = false } = options
  const firms = firmIds
    ? FIRMS.filter(f => f.enabled && firmIds.includes(f.id))
    : FIRMS.filter(f => f.enabled)

  const startTime = Date.now()

  if (force) {
    // Clear existing data when forced
    clearDirectJobs()
    directJobsByFirm.clear()
  }

  const existingJobs = getAllDirectJobs()
  const firmsWithJobs = new Set(existingJobs.keys())
  const firmsToFetch = force ? firms : firms.filter(f => !firmsWithJobs.has(f.id))

  if (firmsToFetch.length === 0) {
    const totalExisting = [...Object.values(existingJobs)].reduce((sum, jobs) => sum + jobs.length, 0)
    console.log(`[Pipeline] All ${firms.length} firms already have direct jobs (${totalExisting} total) — skipping Phase 3`)
    return {
      timestamp: new Date().toISOString(),
      totalFirms: firms.length,
      firmsWithJobs: firmsWithJobs.size,
      totalJobs: totalExisting,
      results: [],
      durationMs: 0,
      skipped: true,
      reason: 'All firms already have direct jobs',
    }
  }

  if (!force) {
    console.log(`[Pipeline] ${firmsToFetch.length}/${firms.length} firms need job enumeration`)
  }

  const results = []

  for (const firm of firmsToFetch) {
    const firmJobs = []

    if (firm.sources && firm.sources.length > 0) {
      for (const source of firm.sources) {
        if (!source.enabled) continue

        try {
          const rawJobs = await fetchFirmJobs(firm, source)
          const normalized = rawJobs
            .map(job => normalize(job, source.provider))
            .filter(Boolean)
          const canonical = canonicalizeBatch(normalized)

          for (const job of canonical) {
            job._firmId = firm.id
            job._sourceProvider = source.provider
          }

          firmJobs.push(...canonical)
        } catch (err) {
          console.error(`[Pipeline] Failed to enumerate ${firm.name} via ${source.provider}:`, err.message)
        }
      }
    }

    if (firm.careerSources && firm.careerSources.length > 0) {
      for (const cs of firm.careerSources) {
        if (!cs.enabled) continue

        try {
          const rawJobs = await fetchFirmJobsFromCareerSource(firm, cs)
          const normalized = rawJobs
            .map(job => normalize(job, cs.provider))
            .filter(Boolean)
          const canonical = canonicalizeBatch(normalized)

          for (const job of canonical) {
            job._firmId = firm.id
            job._sourceProvider = cs.provider
          }

          firmJobs.push(...canonical)
        } catch (err) {
          console.error(`[Pipeline] Failed to enumerate ${firm.name} via careerSource ${cs.provider}:`, err.message)
        }
      }
    }

    directJobsByFirm.set(firm.id, firmJobs)
    saveDirectJobs(firm.id, firmJobs)
    results.push({
      firmId: firm.id,
      firmName: firm.name,
      jobsEnumerated: firmJobs.length,
      sourcesUsed: [...new Set(firmJobs.map(j => j._sourceProvider))],
    })
  }

  return {
    timestamp: new Date().toISOString(),
    totalFirms: firms.length,
    firmsWithJobs: results.filter(r => r.jobsEnumerated > 0).length,
    totalJobs: results.reduce((sum, r) => sum + r.jobsEnumerated, 0),
    results,
    durationMs: Date.now() - startTime,
  }
}

async function fetchFirmJobs(firm, source) {
  const { fetchAllEnabledFirms: fetchBatch } = await import('../ats.js')
  const { jobs } = await fetchBatch([{ ...firm, sources: [source] }])
  return jobs || []
}

async function fetchFirmJobsFromCareerSource(firm, careerSource) {
  const source = {
    provider: careerSource.provider,
    enabled: true,
    verified: careerSource.verified,
    ...careerSource,
  }

  return fetchFirmJobs(firm, source)
}

function matchTrackerToDirect() {
  const trackerEntries = getUnmatchedEntries()
  const startTime = Date.now()

  // Pre-enrich tracker entries for Matcher V3
  const enrichedTrackers = trackerEntries.map(entry => {
    const enriched = enrichTrackerEntry(entry)
    return { ...entry, _enriched: enriched.enriched }
  })

  const directJobsArray = []
  for (const [firmId, jobs] of directJobsByFirm) {
    for (const job of jobs) {
      directJobsArray.push({
        ...job,
        companyName: job.company || job.companyName,
      })
    }
  }

  const directJobsByFirmObj = {}
  for (const [firmId, jobs] of directJobsByFirm) {
    directJobsByFirmObj[firmId] = jobs.map(j => ({
      ...j,
      companyName: j.company || j.companyName,
    }))
  }

  const { results, stats } = batchMatchV3(enrichedTrackers, directJobsByFirmObj)

  for (const result of results) {
    updateMatchResult(result.trackerEntry.id, result)

    if (result.hasAutoMatch && result.bestMatch) {
      const entry = getAllDiscoveries().find(e => e.id === result.trackerEntry.id)
      if (entry && (entry.status === STATES.DISCOVERED || entry.status === STATES.RESOLVED || entry.status === STATES.REACHABLE)) {

        // Determine target status: verified_open if all conditions met
        const isAuto = result.bestMatch.confidence === 'auto'
        const hasResolvedFirm = !!entry.resolvedFirmId
        const hasDirectSource = !!result.bestMatch.directJobId
        const noHardIncompatibility = !result.bestMatch.hasHardIncompatibility

        if (isAuto && hasResolvedFirm && hasDirectSource && noHardIncompatibility) {
          transition(entry.id, STATES.VERIFIED_OPEN)
        } else {
          transition(entry.id, STATES.REACHABLE)
        }

        updateField(entry.id, 'matchedDirectJob', result.bestMatch)
        updateField(entry.id, 'matchConfidence', result.bestMatch.confidence)
      }
    }
  }

  return {
    timestamp: new Date().toISOString(),
    trackerEntriesEvaluated: trackerEntries.length,
    directJobsAvailable: directJobsArray.length,
    stats,
    durationMs: Date.now() - startTime,
  }
}

function getPipelineStatus() {
  const entries = getAllDiscoveries()
  const byStatus = {}
  const byMatchConfidence = { auto: 0, review: 0, unmatched: 0 }

  for (const entry of entries) {
    byStatus[entry.status] = (byStatus[entry.status] || 0) + 1
    if (entry.matchConfidence === 'auto') byMatchConfidence.auto++
    else if (entry.matchConfidence === 'review') byMatchConfidence.review++
    else byMatchConfidence.unmatched++
  }

  return {
    totalEntries: entries.length,
    byStatus,
    byMatchConfidence,
    sourceDiscoveryResults: sourceDiscoveryResults.size,
    directJobsEnumerated: [...directJobsByFirm.values()].reduce((sum, jobs) => sum + jobs.length, 0),
    firmsWithDirectJobs: [...directJobsByFirm.values()].filter(j => j.length > 0).length,
  }
}

function clearPipelineState() {
  sourceDiscoveryResults.clear()
  directJobsByFirm.clear()
  clearDirectJobs()
  clearSourceDiscoveries()
}

export {
  discoverFirmSources,
  enumerateDirectJobs,
  matchTrackerToDirect,
  getPipelineStatus,
  clearPipelineState,
  sourceDiscoveryResults,
  directJobsByFirm,
}
