/**
 * Phase 2.1 — Source Discovery Orchestrator
 *
 * Main discovery pipeline for resolving unknown ATS sources.
 * Steps: crawl → classify → verify → score → persist
 */

import { getAllFirms } from '../registry.js'
import { discoverCareersPages, fetchPage } from './crawler.js'
import { classify, classifyUrl } from './classifier.js'
import { verifySource, checkReachable } from './verifier.js'
import { calculateConfidence, buildEvidenceFromDiscovery, shouldAutoVerify } from './confidence.js'
import { createDiscoveryTarget, updateDiscoveryTarget, getDiscoveryTarget, getDiscoveryTargetsByStatus } from '../../db.js'

const DELAY_BETWEEN_COMPANIES_MS = 1500
const DELAY_BETWEEN_REQUESTS_MS = 300

/**
 * Extract registrable domain from a URL or company name.
 */
function extractDomain(urlOrName) {
  try {
    if (urlOrName.startsWith('http')) {
      const u = new URL(urlOrName)
      return u.hostname.replace(/^www\./, '')
    }
  } catch {}
  // Fallback: return as-is
  return urlOrName.toLowerCase().replace(/[^a-z0-9.-]/g, '')
}

/**
 * Run discovery for a single company.
 *
 * @param {Object} company - { id, name, domain, careersUrl, category }
 * @returns {Object} discovery result with status, sources, evidence
 */
export async function discoverCompany(company) {
  const { id, name, careersUrl } = company
  const domain = company.domain || extractDomain(careersUrl || name)

  const result = {
    companyId: id,
    companyName: name,
    domain,
    status: 'DISCOVERING',
    careersPages: [],
    atsSources: [],
    verifiedSources: [],
    unsupportedSources: [],
    evidence: [],
    studentPages: [],
    multiSource: [],
    error: null,
  }

  try {
    // Step 1: Crawl careers pages
    const crawlResult = await discoverCareersPages(domain, careersUrl)
    result.careersPages = crawlResult.careersPages
    result.studentPages = crawlResult.studentPages
    result.evidence.push(...crawlResult.errors.map(e => `Error: ${e.url} — ${e.error || e.status}`))

    // Track redirects as evidence
    for (const redirect of crawlResult.redirects) {
      result.evidence.push(`Redirect: ${redirect.from} -> ${redirect.to} (${redirect.status})`)
    }

    // Step 2: Collect all ATS sources found
    const allSources = [...crawlResult.atsSources]

    // Also check the known careers URL directly
    if (careersUrl) {
      const urlClassified = classifyUrl(careersUrl)
      for (const c of urlClassified) {
        if (!allSources.some(s => s.provider === c.provider && s.url === c.url)) {
          allSources.push(c)
        }
      }
    }

    result.atsSources = allSources

    // Step 3: Separate supported vs unsupported
    const supportedSources = allSources.filter(s => s.capability === 'supported')
    const unsupportedSources = allSources.filter(s => s.capability === 'unsupported')

    result.unsupportedSources = unsupportedSources

    // Step 4: Verify supported sources
    for (const source of supportedSources) {
      const verification = await verifySource({
        provider: source.provider,
        identifiers: source.identifiers,
        url: source.url,
        companyName: name,
      })

      result.verifiedSources.push({
        ...source,
        verification,
      })

      // Add verification evidence
      for (const e of verification.evidence) {
        result.evidence.push(`[${source.provider}] ${e}`)
      }

      // Delay between verification requests
      await sleep(DELAY_BETWEEN_REQUESTS_MS)
    }

    // Step 5: Calculate confidence for each source
    for (const source of result.verifiedSources) {
      const evidenceItems = buildEvidenceFromDiscovery({
        hasOfficialCareersUrl: source.url === careersUrl,
        domainMatch: source.url?.includes(domain),
        endpointResponds: source.verification?.verificationStatus !== 'FAILED',
        httpStatus: source.verification?.verificationStatus === 'VERIFIED' ? 200 : 0,
        jobCount: source.verification?.jobCount || 0,
        companyMatchRatio: source.verification?.companyMatchRatio || 0,
        htmlDetection: source.evidence?.[0],
        redirectFromOfficial: result.careersPages.some(p => p.redirected && p.isKnown),
        studentPageFound: result.studentPages.length > 0,
      })

      source.confidence = calculateConfidence(evidenceItems)
    }

    // Step 6: Determine final status
    const verifiedSupported = result.verifiedSources.filter(s =>
      s.verification?.verificationStatus === 'VERIFIED' ||
      s.verification?.verificationStatus === 'VERIFIED_ZERO'
    )

    const failedVerifications = result.verifiedSources.filter(s =>
      s.verification?.verificationStatus === 'FAILED'
    )

    if (verifiedSupported.length > 0 && unsupportedSources.length > 0) {
      result.status = 'MULTIPLE_SOURCES_FOUND'
      result.multiSource = [
        ...verifiedSupported.map(s => ({ provider: s.provider, status: 'verified', confidence: s.confidence?.score })),
        ...unsupportedSources.map(s => ({ provider: s.provider, status: 'unsupported' })),
      ]
    } else if (verifiedSupported.length > 0) {
      // Check if auto-verify threshold met
      const bestSource = verifiedSupported.reduce((best, s) =>
        (s.confidence?.score || 0) > (best.confidence?.score || 0) ? s : best
      )

      if (shouldAutoVerify(bestSource.confidence?.score || 0)) {
        result.status = 'SUPPORTED_SOURCE_FOUND'
      } else {
        result.status = 'AMBIGUOUS'
      }
    } else if (unsupportedSources.length > 0) {
      result.status = 'UNSUPPORTED_ATS_FOUND'
    } else if (result.careersPages.length === 0) {
      result.status = 'NO_CAREERS_SOURCE_FOUND'
    } else if (failedVerifications.length > 0 && verifiedSupported.length === 0) {
      result.status = 'FAILED'
      result.error = failedVerifications.map(s => s.verification?.error).join('; ')
    } else {
      result.status = 'AMBIGUOUS'
    }

  } catch (err) {
    result.status = 'FAILED'
    result.error = err.message
    result.evidence.push(`Discovery failed: ${err.message}`)
  }

  return result
}

/**
 * Run discovery for multiple companies from the registry.
 *
 * @param {Object} options - { unknownOnly, limit, dryRun, verifyOnly, companyId }
 */
export async function runDiscovery(options = {}) {
  const { unknownOnly = true, limit = 50, dryRun = false, companyId } = options

  const registry = getAllFirms()
  let targets = registry.filter(f => {
    // Only discover disabled firms
    if (f.enabled) return false
    // Filter by company ID if specified
    if (companyId && f.id !== companyId) return false
    // unknownOnly: firms with custom/unsupported provider OR disabled with supported provider
    if (unknownOnly) {
      return f.careersProvider === 'custom' ||
        ['successfactors', 'oracle_hcm', 'eightfold', 'avature', 'icims', 'taleo', 'teamtailor', 'recruitee', 'workable'].includes(f.careersProvider) ||
        (f.enabled === false && f.sources?.some(s => s.enabled === false))
    }
    return true
  })

  if (limit) targets = targets.slice(0, limit)

  const results = []

  for (const target of targets) {
    console.log(`\nDiscovering: ${target.name} (${target.id})...`)

    if (dryRun) {
      console.log(`  [DRY RUN] Would discover: ${target.name}`)
      results.push({ companyId: target.id, status: 'DRY_RUN' })
      continue
    }

    // Create queue entry
    createDiscoveryTarget(target.id, target.name, target.domain, target.careersUrl)

    const result = await discoverCompany(target)

    // Persist result
    updateDiscoveryTarget(target.id, {
      status: result.status,
      attemptCount: 1,
      lastAttemptAt: new Date().toISOString(),
      discoveredProvider: result.verifiedSources[0]?.provider || result.unsupportedSources[0]?.provider || null,
      discoveredSourceUrl: result.verifiedSources[0]?.url || null,
      confidence: result.verifiedSources[0]?.confidence?.score || 0,
      evidence: result.evidence,
      careersPagesFound: result.careersPages,
      multiSource: result.multiSource,
      failureReason: result.error,
      manualReviewRequired: result.status === 'AMBIGUOUS' ? 1 : 0,
    })

    console.log(`  Status: ${result.status}`)
    if (result.verifiedSources.length > 0) {
      for (const s of result.verifiedSources) {
        console.log(`  Verified: ${s.provider} (${s.verification?.jobCount || 0} jobs, confidence: ${s.confidence?.score?.toFixed(2) || '?'})`)
      }
    }
    if (result.unsupportedSources.length > 0) {
      for (const s of result.unsupportedSources) {
        console.log(`  Unsupported: ${s.provider}`)
      }
    }
    if (result.studentPages.length > 0) {
      console.log(`  Student pages: ${result.studentPages.length}`)
    }

    results.push({
      companyId: target.id,
      companyName: target.name,
      ...result,
    })

    // Delay between companies
    await sleep(DELAY_BETWEEN_COMPANIES_MS)
  }

  return results
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export { extractDomain }
