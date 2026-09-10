import { fetchLandTheOffer } from './landtheoffer.js'
import { fetchFyntraq } from './fyntraq.js'
import { fetchTrackr } from './trackr.js'
import { normalizeTrackerEntry } from './normalize.js'
import { resolveFirm } from './resolve.js'
import * as store from './store.js'
import { classifyUrl } from '../ats/classifier.js'

const ADAPTERS = [
  { name: 'landtheoffer', fetch: fetchLandTheOffer },
  { name: 'fyntraq', fetch: fetchFyntraq },
  { name: 'trackr', fetch: fetchTrackr },
]

const TRACKER_STALENESS_MS = 24 * 60 * 60 * 1000 // 24 hours

let lastDiscoveryResult = null

async function runDiscovery(options = {}) {
  const { force = false } = options
  const startTime = Date.now()

  // Skip if data is fresh and not forced
  if (!force) {
    const lastRun = store.getLastDiscoveryTimestamp()
    const entryCount = store.getAll().length
    if (lastRun && entryCount > 0) {
      const age = Date.now() - new Date(lastRun).getTime()
      if (age < TRACKER_STALENESS_MS) {
        console.log(`[Discovery] Tracker data is fresh (${Math.round(age / 60000)}min old, ${entryCount} entries) — skipping`)
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
          reason: `Tracker data is ${Math.round(age / 60000)}min old (threshold: ${TRACKER_STALENESS_MS / 60000}min)`,
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

  for (const adapter of ADAPTERS) {
    try {
      const result = await adapter.fetch()
      const entries = (result.entries || []).map(e => ({
        ...e,
        source: adapter.name,
        sourceUrl: e.applyUrl || null,
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

  for (const [key, entries] of Object.entries(grouped)) {
    const first = entries[0]
    const firmMatch = resolveFirm(first.company, first.applyUrl)

    let classified = null
    if (first.applyUrl) {
      classified = classifyUrl(first.applyUrl)
    }

    const entry = store.findOrCreate({
      companyName: first.company,
      programme: first.programme,
      category: first.category,
      division: first.division,
      office: first.office,
      year: first.year,
      location: first.location,
      country: first.country,
      applyUrl: first.applyUrl,
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

    if (entry) {
      if (firmMatch.firmId && firmMatch.confidence !== 'none') {
        store.updateField(entry.id, 'resolvedFirmId', firmMatch.firmId)
        store.transition(entry.id, store.STATES.RESOLVED)
      }

      if (classified && classified.provider !== 'unknown') {
        report.knownAtsUrls++
        report.byAts[classified.provider] = (report.byAts[classified.provider] || 0) + 1

        if (firmMatch.firmId) {
          report.directSourceMatches++
        }
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

  report.durationMs = Date.now() - startTime
  lastDiscoveryResult = report
  return report

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

function getDiscoveryStats() {
  return {
    store: store.getStats(),
    lastScan: lastDiscoveryResult ? {
      timestamp: lastDiscoveryResult.timestamp,
      totalEntries: lastDiscoveryResult.totalEntries,
      uniqueOpportunities: lastDiscoveryResult.uniqueOpportunities,
    } : null,
  }
}

export { runDiscovery, getLastDiscoveryResult, getDiscoveryStats }
