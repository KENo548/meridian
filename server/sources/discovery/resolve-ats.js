import { classifyUrl } from '../ats/classifier.js'
import { getAll as getAllDiscoveries, updateField, transition, STATES, getById } from './store.js'
import { resolveFirm } from './resolve.js'
import { extractDomain, extractDomainGroup } from './domain.js'

const VERIFICATION_TIMEOUT = 10000
const SUPPORTED_DIRECT_PROVIDERS = ['greenhouse', 'workday', 'oleeo_rss', 'smartrecruiters', 'lever']

async function verifyUrl(url, provider, metadata) {
  if (!url) return { verified: false, reason: 'no_url' }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), VERIFICATION_TIMEOUT)

    const response = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      },
      redirect: 'follow',
    })

    clearTimeout(timeout)

    if (response.ok) {
      return { verified: true, status: response.status, provider }
    }

    if (response.status === 403 || response.status === 429) {
      return { verified: false, reason: 'blocked', status: response.status, provider }
    }

    if (response.status >= 400 && response.status < 500) {
      return { verified: false, reason: 'client_error', status: response.status, provider }
    }

    return { verified: false, reason: 'server_error', status: response.status, provider }
  } catch (err) {
    if (err.name === 'AbortError') {
      return { verified: false, reason: 'timeout' }
    }
    return { verified: false, reason: 'network_error', error: err.message }
  }
}

function buildResolutionResult(entry, classification, verification) {
  return {
    id: entry.id,
    companyName: entry.companyName,
    resolvedFirmId: entry.resolvedFirmId,
    programme: entry.programme,
    applyUrl: entry.applyUrl,
    classifiedProvider: classification?.provider || 'unknown',
    classificationMetadata: classification?.metadata || {},
    verificationStatus: verification.verified ? 'reachable' : 'unreachable',
    verificationReason: verification.reason || null,
    verificationProvider: verification.provider || classification?.provider || 'unknown',
    canAttemptDirect: classification?.provider && SUPPORTED_DIRECT_PROVIDERS.includes(classification.provider),
    currentStatus: entry.status,
  }
}

function generateCoverageGapReport(entries) {
  const report = {
    timestamp: new Date().toISOString(),
    totalEntries: entries.length,
    byProvider: {},
    byDomain: {},
    byResolutionStatus: {
      direct_resolved: 0,
      firm_resolved: 0,
      unreachable: 0,
      unresolved: 0,
    },
    recommendations: [],
  }

  for (const entry of entries) {
    const classification = entry.applyUrl ? classifyUrl(entry.applyUrl) : null
    const provider = classification?.provider || 'unknown'
    const domain = extractDomain(entry.applyUrl)
    const domainGroup = extractDomainGroup(domain)

    if (!report.byProvider[provider]) {
      report.byProvider[provider] = {
        count: 0,
        entries: [],
        resolvable: SUPPORTED_DIRECT_PROVIDERS.includes(provider),
      }
    }
    report.byProvider[provider].count++
    report.byProvider[provider].entries.push({
      id: entry.id,
      companyName: entry.companyName,
      applyUrl: entry.applyUrl,
    })

    if (!report.byDomain[domainGroup]) {
      report.byDomain[domainGroup] = {
        count: 0,
        provider,
        entries: [],
      }
    }
    report.byDomain[domainGroup].count++
    report.byDomain[domainGroup].entries.push(entry.id)

    if (SUPPORTED_DIRECT_PROVIDERS.includes(provider)) {
      report.byResolutionStatus.direct_resolved++
    } else if (entry.resolvedFirmId) {
      report.byResolutionStatus.firm_resolved++
    } else if (entry.status === 'reachable') {
      report.byResolutionStatus.reachable++
    } else {
      report.byResolutionStatus.unresolved++
    }
  }

  const unresolvedProviders = Object.entries(report.byProvider)
    .filter(([provider]) => !SUPPORTED_DIRECT_PROVIDERS.includes(provider) && provider !== 'unknown')
    .sort((a, b) => b[1].count - a[1].count)

  if (unresolvedProviders.length > 0) {
    report.recommendations.push({
      type: 'adapter_needed',
      message: `Consider building adapters for: ${unresolvedProviders.slice(0, 5).map(([p, d]) => `${p} (${d.count} entries)`).join(', ')}`,
      providers: unresolvedProviders.slice(0, 5).map(([p, d]) => ({ provider: p, count: d.count })),
    })
  }

  const unknownDomains = report.byProvider['unknown'] || { count: 0 }
  if (unknownDomains.count > 0) {
    const topDomains = Object.entries(report.byDomain)
      .filter(([d]) => d !== 'unknown')
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)

    report.recommendations.push({
      type: 'unknown_urls',
      message: `${unknownDomains.count} entries have unrecognized Apply URLs. Top domains: ${topDomains.map(([d, v]) => `${d} (${v.count})`).join(', ')}`,
      domains: topDomains.map(([d, v]) => ({ domain: d, count: v.count })),
    })
  }

  return report
}

async function resolveOpportunities(options = {}) {
  const { verify = false, limit = 50 } = options
  const startTime = Date.now()

  const entries = await getAllDiscoveries()
  const toResolve = entries
    .filter(e => e.status !== STATES.REJECTED)
    .slice(0, limit)

  const results = []
  const stats = {
    total: toResolve.length,
    classified: 0,
    reachable: 0,
    verified: 0,
    unverified: 0,
    firmResolved: 0,
    newlyReachable: 0,
    newlyVerified: 0,
    errors: 0,
  }

  for (const entry of toResolve) {
    try {
      const classification = entry.applyUrl ? classifyUrl(entry.applyUrl) : null

      if (classification && classification.provider !== 'unknown') {
        stats.classified++
        await updateField(entry.id, 'classifiedProvider', classification.provider)
      }

      let verification = { verified: false, reason: 'not_attempted' }
      if (verify && classification && SUPPORTED_DIRECT_PROVIDERS.includes(classification.provider)) {
        verification = await verifyUrl(entry.applyUrl, classification.provider, classification.metadata)

        if (verification.verified) {
          stats.reachable++
          if (entry.status === STATES.DISCOVERED || entry.status === STATES.RESOLVED) {
            await transition(entry.id, STATES.REACHABLE)
            stats.newlyReachable++
          }
        } else {
          stats.unverified++
        }
      }

      if (entry.resolvedFirmId) {
        stats.firmResolved++
      }

      results.push(buildResolutionResult(entry, classification, verification))
    } catch (err) {
      stats.errors++
      results.push({
        id: entry.id,
        companyName: entry.companyName,
        error: err.message,
      })
    }
  }

  const coverageGapReport = generateCoverageGapReport(entries)

  return {
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    stats,
    results,
    coverageGap: coverageGapReport,
  }
}

export {
  resolveOpportunities,
  generateCoverageGapReport,
  verifyUrl,
  extractDomain,
  extractDomainGroup,
  SUPPORTED_DIRECT_PROVIDERS,
}
