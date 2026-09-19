import { fetchLandTheOffer } from './landtheoffer.js'
import { fetchFyntraq } from './fyntraq.js'
import { fetchTrackrProgrammes } from './trackr.js'
import { fetchAnalystClass } from './analystclass.js'
import { normalizeTrackerEntry } from './normalize.js'
import { resolveFirm } from './resolve.js'
import * as store from './store.js'
import { classifyUrl } from '../ats/classifier.js'
import { computeFingerprint, computeContentHash, buildExternalKey } from '../ats/dedup.js'
import {
  saveCanonicalJob,
  getCanonicalJobById,
  upsertCompanyByName,
  upsertSighting,
  findCanonicalByFingerprint,
} from '../../db-adapter.js'

// NOTE: db-adapter exports ONLY async functions — every DB call below is awaited.
// store.* helpers are owned by Cluster A/B (converting to async); await them here
// for forward-compatibility (await on a sync return value is a harmless no-op).

// Scheduling: AnalystClass = daily, Fyntraq = 6hr, Trackr = daily, LTO = daily
const ADAPTERS = [
  { name: 'analystclass', fetch: fetchAnalystClass },
  { name: 'fyntraq', fetch: fetchFyntraq },
  { name: 'trackr', fetch: fetchTrackrProgrammes },
  { name: 'landtheoffer', fetch: fetchLandTheOffer },
]

// Per-adapter staleness thresholds
const STALENESS = {
  analystclass: 24 * 60 * 60 * 1000,  // 24 hours
  fyntraq: 6 * 60 * 60 * 1000,         // 6 hours
  trackr: 24 * 60 * 60 * 1000,         // 24 hours
  landtheoffer: 24 * 60 * 60 * 1000,   // 24 hours
}

let lastDiscoveryResult = null

async function runDiscovery(options = {}) {
  const { force = false, adapter: onlyAdapter } = options
  const startTime = Date.now()

  // Per-adapter freshness check
  if (!force) {
    const lastRun = await store.getLastDiscoveryTimestamp()
    const entryCount = (await store.getAll()).length
    if (lastRun && entryCount > 0) {
      const age = Date.now() - new Date(lastRun).getTime()
      const maxStaleness = Math.max(...Object.values(STALENESS))
      if (age < maxStaleness) {
        console.log(`[Discovery] Tracker data is fresh (${Math.round(age / 60000)}min old, ${entryCount} entries) — skipping all`)
        return {
          timestamp: new Date().toISOString(),
          sources: {},
          totalEntries: 0,
          uniqueOpportunities: 0,
          firmsResolved: 0,
          knownAtsUrls: 0,
          unknownUrls: 0,
          directSourceMatches: 0,
          trackerOnlyOpportunities: 0,
          crossSourceDuplicates: 0,
          errors: 0,
          byAts: {},
          byCategory: {},
          byGeography: {},
          skipped: true,
          reason: `Tracker data is ${Math.round(age / 60000)}min old (threshold: ${maxStaleness / 60000}min)`,
        }
      }
      console.log(`[Discovery] Tracker data is stale (${Math.round(age / 3600000)}h old) — re-fetching`)
    }
  }

  const report = {
    timestamp: new Date().toISOString(),
    sources: {},
    totalEntries: 0,
    uniqueOpportunities: 0,
    firmsResolved: 0,
    knownAtsUrls: 0,
    unknownUrls: 0,
    directSourceMatches: 0,
    trackerOnlyOpportunities: 0,
    crossSourceDuplicates: 0,
    errors: 0,
    byAts: {},
    byCategory: {},
    byGeography: {},
  }

  const allEntries = []
  const adapters = onlyAdapter ? ADAPTERS.filter(a => a.name === onlyAdapter) : ADAPTERS

  for (const adapter of adapters) {
    try {
      const result = await adapter.fetch()
      const entries = (result.entries || []).map(e => ({
        ...e,
        source: adapter.name,
        // Prefer employerUrl (direct posting), then sourceUrl, then applyUrl
        applyUrl: e.employerUrl || e.sourceUrl || e.applyUrl || null,
        sourceUrl: e.sourceUrl || e.employerUrl || e.applyUrl || null,
      }))
      allEntries.push(...entries)
      report.sources[adapter.name] = {
        status: result.error ? 'error' : 'success',
        count: entries.length,
        error: result.error || null,
      }
      if (result.error) report.errors++
    } catch (err) {
      report.sources[adapter.name] = {
        status: 'error',
        count: 0,
        error: err.message,
      }
      report.errors++
    }
  }

  report.totalEntries = allEntries.length

  const grouped = groupByCompanyAndProgramme(allEntries)
  report.uniqueOpportunities = Object.keys(grouped).length
  report.crossSourceDuplicates = allEntries.length - report.uniqueOpportunities

  let sightingsWritten = 0

  for (const [key, entries] of Object.entries(grouped)) {
    const first = entries[0]
    const firmMatch = resolveFirm(first.company, first.applyUrl)

    let classified = null
    if (first.applyUrl) {
      classified = classifyUrl(first.applyUrl)
    }

    // Write sighting for each tracker entry (linked to canonical job)
    // Sequential await preserves write ordering per opportunity group.
    for (const entry of entries) {
      try {
        await writeTrackerSighting(entry, firmMatch.firmId)
        sightingsWritten++
      } catch (err) {
        console.error(`[Discovery] Failed to write sighting for ${entry.company}: ${err.message}`)
      }
    }

    // Also write to legacy discovery store
    const legacyEntry = await store.findOrCreate({
      companyName: first.company,
      programme: first.programme,
      category: first.category,
      division: first.division,
      office: first.office,
      year: first.year,
      location: first.location,
      country: first.country,
      applyUrl: first.applyUrl,
      employerUrl: first.employerUrl,
      sourceUrl: first.sourceUrl,
      specialties: first.specialties,
      classifiedProvider: classified?.provider || null,
      observations: entries.map(e => ({
        source: e.source,
        sourceUrl: e.sourceUrl,
        programme: e.programme,
        openingDate: e.openingDate,
        closingDate: e.closingDate,
        rolling: e.rolling,
        status: e.status,
        eligibility: e.eligibility,
        process: e.process,
      })),
    })

    if (legacyEntry) {
      if (firmMatch.firmId && firmMatch.confidence !== 'none') {
        await store.updateField(legacyEntry.id, 'resolvedFirmId', firmMatch.firmId)
        await store.transition(legacyEntry.id, store.STATES.RESOLVED)
      }

      if (classified && classified.provider !== 'unknown') {
        report.knownAtsUrls++
        report.byAts[classified.provider] = (report.byAts[classified.provider] || 0) + 1
        if (firmMatch.firmId) report.directSourceMatches++
      } else {
        report.unknownUrls++
      }

      if (firmMatch.firmId) {
        report.firmsResolved++
      } else {
        report.trackerOnlyOpportunities++
      }

      if (first.category) {
        report.byCategory[first.category] = (report.byCategory[first.category] || 0) + 1
      }

      if (first.country) {
        report.byGeography[first.country] = (report.byGeography[first.country] || 0) + 1
      }
    }
  }

  report.sightingsWritten = sightingsWritten
  report.durationMs = Date.now() - startTime
  lastDiscoveryResult = report
  return report
}

// ─── Write Tracker Sighting to Canonical + Sightings ──────────

async function writeTrackerSighting(entry, resolvedFirmId) {
  const now = new Date().toISOString()

  // Resolve company name
  const companyName = entry.company || ''
  if (!companyName) return

  const companyId = await upsertCompanyByName(companyName)

  // Determine if we have a canonical job to link to
  let canonicalJobId = null

  if (resolvedFirmId) {
    // Try to find an existing canonical job for this firm
    const fingerprint = computeFingerprint({
      company: companyName,
      title: entry.programme || '',
      location: entry.location || '',
      programmeType: entry.category || '',
      deadline: entry.closingDate,
    })

    if (fingerprint) {
      // Look for canonical jobs with matching fingerprint
      const existing = await findCanonicalByFingerprint(fingerprint)
      if (existing) {
        canonicalJobId = existing.id
      }
    }
  }

  // If no canonical job exists, create one from tracker data
  if (!canonicalJobId) {
    const jobId = `meridian:${entry.source}:${Date.now()}:${Math.random().toString(36).substring(2, 8)}`
    const fingerprint = computeFingerprint({
      company: companyName,
      title: entry.programme || '',
      location: entry.location || '',
      programmeType: entry.category || '',
      deadline: entry.closingDate,
    })

    const newJob = {
      id: jobId,
      companyId,
      companyName,
      title: entry.programme || '',
      normalizedTitle: entry.programme || '',
      location: entry.location || '',
      country: entry.country || '',
      city: '',
      applicationUrl: entry.applyUrl || '',
      description: '',
      programmeType: entry.category || 'unknown',
      employmentType: 'unknown',
      financeCategory: 'unknown',
      financeSubcategory: null,
      seniority: null,
      graduationYear: null,
      deadline: entry.closingDate || null,
      openingDate: entry.openingDate || null,
      postedAt: null,
      firstSeenAt: now,
      lastSeenAt: now,
      closedAt: null,
      status: 'active',
      confidence: 0.6,
      specialties: entry.specialties || [],
      sourceUrl: entry.sourceUrl || null,
      identityTier: 'tracker',
      fingerprint,
      lifecycle: 'open',
      closureReason: null,
      consecutiveAbsences: 0,
      lastVerifiedOpenAt: now,
    }
    await saveCanonicalJob(newJob)
    canonicalJobId = jobId
  }

  // Write the sighting
  const externalKey = buildExternalKey(entry.source, {
    sourceJobId: `${entry.source}:${companyName}:${entry.programme || ''}`,
    url: entry.applyUrl || entry.sourceUrl,
  })

  await upsertSighting({
    canonicalJobId,
    source: entry.source,
    sourceTier: 'tracker',
    sourceExternalKey: externalKey || `${entry.source}:${canonicalJobId}`,
    sourceJobId: `${entry.source}:${companyName}:${entry.programme || ''}`,
    sourceUrl: entry.sourceUrl || null,
    employerUrl: entry.employerUrl || null,
    rawTitle: entry.programme || '',
    rawCompany: companyName,
    rawLocation: entry.location || '',
    rawPayload: JSON.stringify(entry).substring(0, 10000),
    contentHash: computeContentHash({
      company: companyName,
      title: entry.programme || '',
      location: entry.location || '',
      url: entry.applyUrl || '',
      description: '',
    }),
    isActive: true,
  })
}

function groupByCompanyAndProgramme(entries) {
  const groups = {}
  for (const entry of entries) {
    const normCompany = (entry.company || '').toLowerCase().trim()
    const normProgramme = (entry.programme || '').toLowerCase().trim()
    const key = `${normCompany}::${normProgramme}`
    if (!groups[key]) groups[key] = []
    groups[key].push(entry)
  }
  return groups
}

function getLastDiscoveryResult() {
  return lastDiscoveryResult
}

async function getDiscoveryStats() {
  return {
    store: await store.getStats(),
    lastScan: lastDiscoveryResult ? {
      timestamp: lastDiscoveryResult.timestamp,
      totalEntries: lastDiscoveryResult.totalEntries,
      uniqueOpportunities: lastDiscoveryResult.uniqueOpportunities,
    } : null,
  }
}

export { runDiscovery, getLastDiscoveryResult, getDiscoveryStats }
