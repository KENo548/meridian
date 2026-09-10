#!/usr/bin/env node
/**
 * Meridian Phase 2.0 — Live Coverage Measurement Sweep
 *
 * Tests every firm in the registry against the 6 supported ATS adapters.
 * Produces 4 report sets (JSON + MD) for decision-making.
 *
 * Usage: node server/sweep.js
 */

import { getAllFirms, FIRMS } from './sources/registry.js'
import { fetchFirmJobs, CAPABILITY, getCapability } from './sources/ats.js'
import { normalize } from './sources/normalize.js'
import { runDiscovery } from './sources/discovery/index.js'
import { writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const REPORTS_DIR = join(__dirname, '..', 'reports')

const PRIORITY_WEIGHTS = {
  P0: 5,
  P1: 4,
  P2: 3,
  P3: 2,
  P4: 1,
}

const CATEGORY_WEIGHTS = {
  bulge_bracket: 5,
  elite_boutique: 5,
  private_equity: 4,
  hedge_fund: 4,
  prop_trading: 4,
  asset_management: 3,
  middle_market: 3,
  bank: 3,
  quant_hedge_fund: 4,
  consulting: 2,
  advisory: 2,
  exchanges: 2,
}

// ─── Sweep Individual Firm ────────────────────────────────────

async function sweepFirm(firm) {
  const startTime = Date.now()
  const result = {
    company: firm.name,
    companyId: firm.id,
    companyType: firm.category || 'unknown',
    companyTier: firm.priority || 'P2',
    configuredProvider: firm.careersProvider || 'unknown',
    enabled: firm.enabled,
    hasSources: (firm.sources || []).length > 0,
    configuredSource: null,
    discoveredProvider: null,
    discoveredSource: null,
    capability: getCapability(firm.careersProvider),
    requestSuccess: false,
    httpStatus: null,
    parseSuccess: false,
    jobsReturned: 0,
    pagesFetched: 0,
    recordsReportedBySource: null,
    recordsRetrieved: 0,
    sourceVerified: false,
    verificationConfidence: 0,
    verificationEvidence: [],
    healthStatus: 'unknown',
    coverageStatus: 'NOT_TESTED',
    failureReason: null,
    durationMs: 0,
    jobSamples: [],
    jobsByType: {},
  }

  try {
    // Determine which source to test
    const enabledSources = (firm.sources || []).filter(s => s.enabled !== false)
    const sourceToTest = enabledSources[0] || null

    if (sourceToTest) {
      result.configuredSource = {
        provider: sourceToTest.provider,
        careersUrl: sourceToTest.careersUrl,
        verified: sourceToTest.verified,
      }
    }

    // Check if provider is supported
    const cap = getCapability(firm.careersProvider)
    if (cap === 'unsupported' || cap === 'broken') {
      result.coverageStatus = 'SOURCE_FOUND_UNSUPPORTED'
      result.failureReason = `Provider ${firm.careersProvider} is ${cap}`
      result.durationMs = Date.now() - startTime
      return result
    }

    if (!firm.enabled && enabledSources.length === 0) {
      result.coverageStatus = 'SOURCE_FOUND_UNSUPPORTED'
      result.failureReason = 'Firm disabled with no enabled sources'
      result.durationMs = Date.now() - startTime
      return result
    }

    // Attempt to fetch jobs
    const fetchResult = await fetchFirmJobs(firm)

    result.requestSuccess = !fetchResult.error
    result.httpStatus = fetchResult.httpStatus || (fetchResult.error ? null : 200)
    result.parseSuccess = fetchResult.jobs !== undefined
    result.jobsReturned = (fetchResult.jobs || []).length
    result.durationMs = Date.now() - startTime

    // Pagination tracking
    if (fetchResult.total !== undefined) {
      result.recordsReportedBySource = fetchResult.total
    }
    result.recordsRetrieved = result.jobsReturned
    result.pagesFetched = result.jobsReturned > 0 ? Math.ceil(result.jobsReturned / 20) : 0

    // Verify returned jobs belong to the company
    if (result.jobsReturned > 0) {
      const verification = verifyJobs(firm, fetchResult.jobs)
      result.sourceVerified = verification.verified
      result.verificationConfidence = verification.confidence
      result.verificationEvidence = verification.evidence

      // Sample jobs for inspection
      result.jobSamples = (fetchResult.jobs || []).slice(0, 3).map(j => ({
        title: j.title,
        location: j.location,
        url: j.url,
      }))

      // Classify jobs by type
      for (const job of (fetchResult.jobs || [])) {
        const type = job.employmentType || 'unknown'
        result.jobsByType[type] = (result.jobsByType[type] || 0) + 1
      }
    }

    // Determine coverage status
    if (result.jobsReturned > 0 && result.sourceVerified) {
      result.coverageStatus = 'COVERED_ACTIVE'
      result.healthStatus = 'HEALTHY'
    } else if (result.requestSuccess && result.jobsReturned === 0) {
      // Check if this is a suspicious zero
      const isSuspicious = isSuspiciousZero(firm, result)
      result.coverageStatus = isSuspicious ? 'COVERED_ZERO_SUSPICIOUS' : 'COVERED_ZERO'
      result.healthStatus = isSuspicious ? 'DEGRADED' : 'HEALTHY'
    } else if (!result.requestSuccess) {
      const error = fetchResult.error || ''
      if (error.includes('422') || error.includes('Cloudflare') || error.includes('anti-bot')) {
        result.coverageStatus = 'ACCESS_RESTRICTED'
        result.healthStatus = 'FAILING'
      } else if (error.includes('404')) {
        result.coverageStatus = 'SOURCE_BROKEN'
        result.healthStatus = 'FAILING'
      } else if (error.includes('429')) {
        result.coverageStatus = 'SOURCE_BROKEN'
        result.healthStatus = 'DEGRADED'
      } else {
        result.coverageStatus = 'SOURCE_BROKEN'
        result.healthStatus = 'FAILING'
      }
      result.failureReason = error
    } else if (result.jobsReturned > 0 && !result.sourceVerified) {
      result.coverageStatus = 'NEEDS_MANUAL_REVIEW'
      result.healthStatus = 'UNKNOWN'
    }

    // Check source report for detailed errors
    if (fetchResult.sources) {
      for (const [provider, report] of Object.entries(fetchResult.sources)) {
        if (report.status === 'skipped') {
          result.coverageStatus = 'SOURCE_FOUND_UNSUPPORTED'
          result.failureReason = report.error
        }
      }
    }

  } catch (err) {
    result.durationMs = Date.now() - startTime
    result.failureReason = `Exception: ${err.message}`
    result.coverageStatus = 'SOURCE_BROKEN'
    result.healthStatus = 'BROKEN'
  }

  return result
}

// ─── Company Identity Normalization ─────────────────────────────

const LEGAL_SUFFIXES = /\b(inc|incorporated|corp|corporation|ltd|limited|llc|lp|llp|plc|ag|gmbh|sas|sarl|nv|bv|spa|srl|co|company|group|holdings|financial group|financial services)\b\.?\s*/gi
const PUNCTUATION_NORM = /[&+]/g
const MULTI_SPACE_NORM = /\s{2,}/g

function normalizeCompanyName(name) {
  if (!name) return ''
  return name
    .toLowerCase()
    .replace(LEGAL_SUFFIXES, '')
    .replace(PUNCTUATION_NORM, ' and ')
    .replace(MULTI_SPACE_NORM, ' ')
    .trim()
}

function buildAliasList(firm) {
  const aliases = new Set()
  const nameLower = (firm.name || '').toLowerCase()
  const idLower = (firm.id || '').toLowerCase()

  if (nameLower) aliases.add(nameLower)
  if (idLower) aliases.add(idLower)

  const normalized = normalizeCompanyName(nameLower)
  if (normalized) aliases.add(normalized)

  const idFlat = idLower.replace(/-/g, '')
  if (idFlat) aliases.add(idFlat)

  if (firm.aliases && Array.isArray(firm.aliases)) {
    for (const alias of firm.aliases) {
      const aliasLower = alias.toLowerCase()
      aliases.add(aliasLower)
      aliases.add(normalizeCompanyName(aliasLower))
    }
  }

  if (firm.atsSlug) aliases.add(firm.atsSlug.toLowerCase())

  return [...aliases].filter(a => a.length > 1)
}

// ─── Verification ─────────────────────────────────────────────

function verifyJobs(firm, jobs) {
  if (!jobs || jobs.length === 0) {
    return { verified: false, confidence: 0, evidence: [] }
  }

  const aliases = buildAliasList(firm)
  const firmIdLower = (firm.id || '').toLowerCase()
  const careersUrl = firm.careersUrl || ''
  const hasDomainMatch = careersUrl.includes(firmIdLower.replace(/-/g, ''))

  let matchCount = 0
  let totalChecked = 0

  for (const job of jobs.slice(0, 10)) {
    totalChecked++
    const companyLower = normalizeCompanyName(job.company || '')
    const companyRaw = (job.company || '').toLowerCase()
    const titleLower = (job.title || '').toLowerCase()

    if (aliases.some(a => companyLower.includes(a) || companyRaw.includes(a))) {
      matchCount++
      continue
    }

    if (job.url) {
      const urlLower = job.url.toLowerCase()
      if (aliases.some(a => urlLower.includes(a))) {
        matchCount++
        continue
      }
    }

    if (aliases.some(a => titleLower.includes(a))) {
      matchCount++
      continue
    }
  }

  const evidence = []
  let confidence = 0

  if (totalChecked > 0) {
    const matchRate = matchCount / totalChecked
    if (matchRate >= 0.8) {
      confidence = 0.95
      evidence.push(`${matchCount}/${totalChecked} jobs match company name/ID`)
    } else if (matchRate >= 0.5) {
      confidence = 0.7
      evidence.push(`${matchCount}/${totalChecked} jobs match (partial)`)
    } else if (matchCount > 0) {
      confidence = 0.4
      evidence.push(`${matchCount}/${totalChecked} jobs match (weak)`)
    } else {
      confidence = 0.1
      evidence.push('No jobs match company name/ID')
    }
  }

  if (hasDomainMatch) {
    confidence = Math.min(confidence + 0.1, 1)
    evidence.push('Careers URL domain matches firm')
  }

  return {
    verified: confidence >= 0.5,
    confidence,
    evidence,
  }
}

// ─── Suspicious Zero Detection ────────────────────────────────

function isSuspiciousZero(firm, result) {
  // Large banks with zero jobs are suspicious
  const largeFirmCategories = ['bulge_bracket', 'elite_boutique', 'private_equity', 'hedge_fund']
  if (largeFirmCategories.includes(firm.category) && result.jobsReturned === 0) {
    return true
  }

  // If the firm has a known large careers portal
  const largeFirmNames = ['Goldman Sachs', 'JPMorgan', 'Morgan Stanley', 'Bank of America',
    'Citi', 'Barclays', 'UBS', 'Deutsche Bank', 'HSBC', 'Blackstone', 'KKR', 'Apollo']
  if (largeFirmNames.some(n => firm.name.includes(n)) && result.jobsReturned === 0) {
    return true
  }

  return false
}

// ─── Report Generation ────────────────────────────────────────

function generateReports(results, trackerData) {
  const timestamp = new Date().toISOString()

  // ─── Executive Summary ─────────────────────────────────────

  const totalFirms = results.length
  const coveredActive = results.filter(r => r.coverageStatus === 'COVERED_ACTIVE')
  const coveredZero = results.filter(r => r.coverageStatus.startsWith('COVERED_ZERO'))
  const partial = results.filter(r => r.coverageStatus === 'PARTIAL')
  const unsupported = results.filter(r => r.coverageStatus === 'SOURCE_FOUND_UNSUPPORTED')
  const unknown = results.filter(r => r.coverageStatus === 'SOURCE_UNKNOWN')
  const broken = results.filter(r => r.coverageStatus === 'SOURCE_BROKEN' || r.coverageStatus === 'ACCESS_RESTRICTED')
  const needsReview = results.filter(r => r.coverageStatus === 'NEEDS_MANUAL_REVIEW')
  const notTested = results.filter(r => r.coverageStatus === 'NOT_TESTED')

  const totalJobs = results.reduce((sum, r) => sum + r.jobsReturned, 0)
  const directlyCovered = coveredActive.length + coveredZero.length
  const coveragePct = ((directlyCovered / totalFirms) * 100).toFixed(1)

  // Provider statistics
  const providerStats = {}
  for (const r of results) {
    const provider = r.configuredProvider
    if (!providerStats[provider]) {
      providerStats[provider] = { firms: 0, success: 0, fail: 0, jobs: 0, durations: [], zeroJobs: 0 }
    }
    providerStats[provider].firms++
    if (r.requestSuccess) providerStats[provider].success++
    else providerStats[provider].fail++
    providerStats[provider].jobs += r.jobsReturned
    providerStats[provider].durations.push(r.durationMs)
    if (r.jobsReturned === 0 && r.requestSuccess) providerStats[provider].zeroJobs++
  }

  // Calculate medians
  for (const [provider, stats] of Object.entries(providerStats)) {
    stats.durations.sort((a, b) => a - b)
    const mid = Math.floor(stats.durations.length / 2)
    stats.medianMs = stats.durations.length > 0 ? stats.durations[mid] : 0
    stats.p90Ms = stats.durations.length > 0 ? stats.durations[Math.floor(stats.durations.length * 0.9)] : 0
    stats.successRate = stats.firms > 0 ? ((stats.success / stats.firms) * 100).toFixed(1) : '0'
    delete stats.durations
  }

  // Unsupported provider breakdown
  const unsupportedBreakdown = {}
  for (const r of unsupported) {
    const provider = r.configuredProvider
    unsupportedBreakdown[provider] = (unsupportedBreakdown[provider] || 0) + 1
  }

  // Add custom to breakdown (firms with no known ATS)
  for (const r of results.filter(r => r.configuredProvider === 'custom' && r.coverageStatus === 'SOURCE_FOUND_UNSUPPORTED')) {
    unsupportedBreakdown['custom'] = (unsupportedBreakdown['custom'] || 0) + 1
  }

  // Adapter ROI
  const adapterROI = Object.entries(unsupportedBreakdown)
    .map(([provider, firms]) => {
      const effortMap = {
        successfactors: 3, oracle_hcm: 4, eightfold: 4, avature: 4,
        icims: 3, taleo: 3, custom: 2, workable: 2,
      }
      const effort = effortMap[provider] || 3
      return { provider, firms, effort, roi: (firms / effort).toFixed(2) }
    })
    .sort((a, b) => b.roi - a.roi)

  // Coverage by category
  const coverageByCategory = {}
  for (const r of results) {
    const cat = r.companyType
    if (!coverageByCategory[cat]) {
      coverageByCategory[cat] = { total: 0, covered: 0, jobs: 0 }
    }
    coverageByCategory[cat].total++
    if (r.coverageStatus === 'COVERED_ACTIVE' || r.coverageStatus.startsWith('COVERED_ZERO')) {
      coverageByCategory[cat].covered++
    }
    coverageByCategory[cat].jobs += r.jobsReturned
  }

  // Weighted coverage
  let weightedCovered = 0
  let weightedTotal = 0
  for (const r of results) {
    const weight = PRIORITY_WEIGHTS[r.companyTier] || 3
    weightedTotal += weight
    if (r.coverageStatus === 'COVERED_ACTIVE' || r.coverageStatus.startsWith('COVERED_ZERO')) {
      weightedCovered += weight
    }
  }
  const weightedCoveragePct = ((weightedCovered / weightedTotal) * 100).toFixed(1)

  // Tracker comparison
  const trackerStats = {
    totalTrackerJobs: trackerData?.total || 0,
    matchedOfficial: 0,
    notMatchedOfficial: 0,
    companyNotInRegistry: 0,
  }

  // Suspicious zeros
  const suspiciousZeros = results.filter(r => r.coverageStatus === 'COVERED_ZERO_SUSPICIOUS')

  // Jobs by programme type (from job samples)
  const jobsByProgramme = {}
  for (const r of results) {
    for (const [type, count] of Object.entries(r.jobsByType)) {
      jobsByProgramme[type] = (jobsByProgramme[type] || 0) + count
    }
  }

  // ─── Build summary report ─────────────────────────────────

  const summary = {
    metadata: {
      timestamp,
      gitCommit: 'fa857a1',
      registrySize: FIRMS.length,
      enabledFirms: results.filter(r => r.enabled).length,
      sweepDuration: results.reduce((sum, r) => sum + r.durationMs, 0),
    },
    coverage: {
      totalFirms,
      directlyCovered,
      coveragePercent: parseFloat(coveragePct),
      weightedCoveragePercent: parseFloat(weightedCoveragePct),
      byStatus: {
        COVERED_ACTIVE: coveredActive.length,
        COVERED_ZERO: coveredZero.length,
        PARTIAL: partial.length,
        SOURCE_FOUND_UNSUPPORTED: unsupported.length,
        SOURCE_UNKNOWN: unknown.length,
        SOURCE_BROKEN: broken.length,
        NEEDS_MANUAL_REVIEW: needsReview.length,
        NOT_TESTED: notTested.length,
      },
    },
    jobs: {
      totalOfficialJobs: totalJobs,
      jobsByProvider: Object.fromEntries(
        Object.entries(providerStats).map(([k, v]) => [k, v.jobs])
      ),
      jobsByProgramme,
    },
    providerPerformance: providerStats,
    unsupportedBreakdown,
    adapterROI,
    coverageByCategory,
    suspiciousZeros: suspiciousZeros.map(r => ({
      company: r.company,
      provider: r.configuredProvider,
      jobsReturned: r.jobsReturned,
    })),
    uncoveredFirms: results
      .filter(r => !['COVERED_ACTIVE', 'COVERED_ZERO', 'COVERED_ZERO_SUSPICIOUS'].includes(r.coverageStatus))
      .map(r => ({
        company: r.company,
        provider: r.configuredProvider,
        status: r.coverageStatus,
        reason: r.failureReason,
      })),
    trackerComparison: trackerStats,
  }

  return summary
}

function generateCompanyResults(results) {
  return results.map(r => ({
    company: r.company,
    companyId: r.companyId,
    companyType: r.companyType,
    companyTier: r.companyTier,
    configuredProvider: r.configuredProvider,
    enabled: r.enabled,
    hasSources: r.hasSources,
    capability: r.capability,
    requestSuccess: r.requestSuccess,
    httpStatus: r.httpStatus,
    parseSuccess: r.parseSuccess,
    jobsReturned: r.jobsReturned,
    pagesFetched: r.pagesFetched,
    recordsReportedBySource: r.recordsReportedBySource,
    recordsRetrieved: r.recordsRetrieved,
    sourceVerified: r.sourceVerified,
    verificationConfidence: r.verificationConfidence,
    verificationEvidence: r.verificationEvidence,
    healthStatus: r.healthStatus,
    coverageStatus: r.coverageStatus,
    failureReason: r.failureReason,
    durationMs: r.durationMs,
    jobSamples: r.jobSamples,
    jobsByType: r.jobsByType,
  }))
}

function generateCoverageGaps(results) {
  return results
    .filter(r => !['COVERED_ACTIVE', 'COVERED_ZERO', 'COVERED_ZERO_SUSPICIOUS'].includes(r.coverageStatus))
    .map(r => ({
      company: r.company,
      companyType: r.companyType,
      companyTier: r.companyTier,
      provider: r.configuredProvider,
      capability: r.capability,
      coverageStatus: r.coverageStatus,
      failureReason: r.failureReason,
      recommendation: getRecommendation(r),
    }))
}

function getRecommendation(result) {
  switch (result.coverageStatus) {
    case 'SOURCE_FOUND_UNSUPPORTED':
      return `Implement ${result.configuredProvider} adapter or find alternative source`
    case 'SOURCE_UNKNOWN':
      return 'Run source discovery to identify ATS'
    case 'SOURCE_BROKEN':
      return `Investigate failure: ${result.failureReason}`
    case 'ACCESS_RESTRICTED':
      return 'Access restricted — cannot bypass anti-bot protection'
    case 'NEEDS_MANUAL_REVIEW':
      return 'Manual verification needed'
    default:
      return 'Investigate'
  }
}

function generateAdapterPriority(results, unsupportedBreakdown) {
  const priorities = Object.entries(unsupportedBreakdown)
    .map(([provider, count]) => {
      const effortMap = {
        successfactors: { effort: 3, strategic: 4, note: 'SAP SuccessFactors — common in European finance' },
        oracle_hcm: { effort: 4, strategic: 3, note: 'Oracle HCM — used by JPMorgan, Schroders' },
        eightfold: { effort: 4, strategic: 4, note: 'Eightfold AI — used by Morgan Stanley, Millennium' },
        avature: { effort: 4, strategic: 2, note: 'Avature — used by Carlyle' },
        custom: { effort: 2, strategic: 2, note: 'Various custom career sites' },
        workable: { effort: 2, strategic: 1, note: 'Workable — Interpath only' },
      }
      const info = effortMap[provider] || { effort: 3, strategic: 2, note: '' }
      const weightedScore = (count * info.strategic) / info.effort

      return {
        provider,
        firmsBlocked: count,
        estimatedEffort: info.effort,
        strategicImportance: info.strategic,
        weightedScore: weightedScore.toFixed(2),
        note: info.note,
      }
    })
    .sort((a, b) => b.weightedScore - a.weightedScore)

  return priorities
}

// ─── Markdown Report Generators ───────────────────────────────

function summaryToMarkdown(summary) {
  const s = summary.coverage
  const j = summary.jobs
  const p = summary.providerPerformance

  let md = `# Phase 2.0 — Coverage Measurement Report\n\n`
  md += `**Generated:** ${summary.metadata.timestamp}\n`
  md += `**Baseline commit:** ${summary.metadata.gitCommit}\n`
  md += `**Registry firms:** ${summary.metadata.registrySize}\n`
  md += `**Enabled firms:** ${summary.metadata.enabledFirms}\n`
  md += `**Sweep duration:** ${(summary.metadata.sweepDuration / 1000).toFixed(1)}s\n\n`

  md += `---\n\n`
  md += `## Executive Summary\n\n`
  md += `Registry firms: ${summary.metadata.registrySize}\n\n`
  md += `| Metric | Value |\n|---|---|\n`
  md += `| Directly covered | ${s.directlyCovered} / ${s.totalFirms} |\n`
  md += `| Coverage % | ${s.coveragePercent}% |\n`
  md += `| Weighted coverage | ${s.weightedCoveragePercent}% |\n`
  md += `| Covered active | ${s.byStatus.COVERED_ACTIVE} |\n`
  md += `| Covered zero | ${s.byStatus.COVERED_ZERO} |\n`
  md += `| Partial | ${s.byStatus.PARTIAL} |\n`
  md += `| Unsupported ATS | ${s.byStatus.SOURCE_FOUND_UNSUPPORTED} |\n`
  md += `| Unknown source | ${s.byStatus.SOURCE_UNKNOWN} |\n`
  md += `| Broken/config | ${s.byStatus.SOURCE_BROKEN} |\n`
  md += `| Needs review | ${s.byStatus.NEEDS_MANUAL_REVIEW} |\n`
  md += `| **Total official jobs** | **${j.totalOfficialJobs}** |\n\n`

  md += `### Provider Performance\n\n`
  md += `| Provider | Firms | Success | Fail | Jobs | Success Rate | Median Latency |\n`
  md += `|---|---|---|---|---|---|---|\n`
  for (const [provider, stats] of Object.entries(p)) {
    if (stats.firms === 0) continue
    md += `| ${provider} | ${stats.firms} | ${stats.success} | ${stats.fail} | ${stats.jobs} | ${stats.successRate}% | ${stats.medianMs}ms |\n`
  }

  md += `\n### Top Coverage Blockers\n\n`
  md += `| # | Provider | Firms Blocked |\n|---|---|---|\n`
  const blockers = Object.entries(summary.unsupportedBreakdown)
    .sort((a, b) => b[1] - a[1])
  blockers.forEach(([provider, count], i) => {
    md += `| ${i + 1} | ${provider} | ${count} |\n`
  })

  md += `\n### Adapter ROI\n\n`
  md += `| Provider | Firms | Effort | Strategic | Score |\n`
  md += `|---|---|---|---|---|\n`
  for (const item of summary.adapterROI) {
    md += `| ${item.provider} | ${item.firms} | ${item.effort} | ${item.strategicImportance} | ${item.roi} |\n`
  }

  md += `\n### Coverage by Category\n\n`
  md += `| Category | Covered | Total | Jobs |\n`
  md += `|---|---|---|---|\n`
  for (const [cat, stats] of Object.entries(summary.coverageByCategory)) {
    md += `| ${cat} | ${stats.covered} | ${stats.total} | ${stats.jobs} |\n`
  }

  if (summary.suspiciousZeros.length > 0) {
    md += `\n### Suspicious Zeros\n\n`
    md += `| Company | Provider | Jobs |\n`
    md += `|---|---|---|\n`
    for (const sz of summary.suspiciousZeros) {
      md += `| ${sz.company} | ${sz.provider} | ${sz.jobsReturned} |\n`
    }
  }

  md += `\n### Uncovered Firms\n\n`
  md += `| Company | Provider | Status | Reason |\n`
  md += `|---|---|---|---|\n`
  for (const u of summary.uncoveredFirms) {
    md += `| ${u.company} | ${u.provider} | ${u.status} | ${(u.reason || '').substring(0, 60)} |\n`
  }

  md += `\n---\n\n`
  md += `## Recommended Next Action\n\n`

  if (summary.adapterROI.length > 0) {
    const top = summary.adapterROI[0]
    md += `**PATH A — NEW ATS ADAPTER: ${top.provider}**\n\n`
    md += `- Expected companies unlocked: ${top.firms}\n`
    md += `- Estimated effort: ${top.effort}/5\n`
    md += `- Weighted coverage improvement: +${((top.firms / s.totalFirms) * 100).toFixed(1)}%\n\n`
  }

  md += `**Also consider:**\n\n`
  md += `- PATH D — COMPANY UNIVERSE EXPANSION: If existing 6 adapters cover many unlisted firms\n`
  md += `- PATH C — SOURCE DISCOVERY: If many firms have unknown/missed ATS configurations\n`

  return md
}

function companyResultsToMarkdown(results) {
  let md = `# Phase 2.0 — Company-Level Results\n\n`
  md += `**Generated:** ${new Date().toISOString()}\n\n`
  md += `| Company | Provider | Capability | Status | Jobs | Verified | Duration |\n`
  md += `|---|---|---|---|---|---|---|\n`

  for (const r of results) {
    const verified = r.sourceVerified ? '✓' : (r.jobsReturned > 0 ? '?' : '—')
    md += `| ${r.company} | ${r.configuredProvider} | ${r.capability} | ${r.coverageStatus} | ${r.jobsReturned} | ${verified} | ${r.durationMs}ms |\n`
  }

  return md
}

function coverageGapsToMarkdown(gaps) {
  let md = `# Phase 2.0 — Coverage Gaps\n\n`
  md += `**Generated:** ${new Date().toISOString()}\n\n`

  for (const gap of gaps) {
    md += `### ${gap.company}\n\n`
    md += `- **Provider:** ${gap.provider}\n`
    md += `- **Capability:** ${gap.capability}\n`
    md += `- **Status:** ${gap.coverageStatus}\n`
    md += `- **Reason:** ${gap.failureReason || 'N/A'}\n`
    md += `- **Recommendation:** ${gap.recommendation}\n\n`
  }

  return md
}

function adapterPriorityToMarkdown(priorities) {
  let md = `# Phase 2.0 — Adapter Implementation Priority\n\n`
  md += `**Generated:** ${new Date().toISOString()}\n\n`
  md += `| Rank | Provider | Firms | Effort | Strategic | Score | Note |\n`
  md += `|---|---|---|---|---|---|---|\n`

  priorities.forEach((p, i) => {
    md += `| ${i + 1} | ${p.provider} | ${p.firmsBlocked} | ${p.estimatedEffort} | ${p.strategicImportance} | ${p.weightedScore} | ${p.note} |\n`
  })

  return md
}

// ─── Main ─────────────────────────────────────────────────────

async function main() {
  console.log('=== Meridian Phase 2.0 — Live Coverage Sweep ===')
  console.log(`Registry: ${FIRMS.length} firms\n`)

  const allFirms = getAllFirms()
  const results = []

  // Sweep each firm
  for (let i = 0; i < allFirms.length; i++) {
    const firm = allFirms[i]
    const progress = `[${i + 1}/${allFirms.length}]`
    process.stdout.write(`${progress} ${firm.name}...`)

    const result = await sweepFirm(firm)
    results.push(result)

    const status = result.coverageStatus.padEnd(25)
    const jobs = String(result.jobsReturned).padStart(4)
    const duration = `${result.durationMs}ms`.padStart(8)
    console.log(` ${status} ${jobs} jobs ${duration}`)
  }

  // Run tracker discovery
  console.log('\n--- Running tracker discovery ---')
  let trackerData = null
  try {
    const trackrResult = await runDiscovery()
    trackerData = { total: trackrResult?.entries?.length || 0 }
    console.log(`Tracker entries: ${trackerData.total}`)
  } catch (err) {
    console.log(`Tracker discovery failed: ${err.message}`)
    trackerData = { total: 0, error: err.message }
  }

  // Generate reports
  console.log('\n--- Generating reports ---')
  await mkdir(REPORTS_DIR, { recursive: true })

  const summary = generateReports(results, trackerData)
  const companyResults = generateCompanyResults(results)
  const gaps = generateCoverageGaps(results)
  const priorities = generateAdapterPriority(results, summary.unsupportedBreakdown)

  // Write JSON reports
  await writeFile(join(REPORTS_DIR, 'phase2_coverage_summary.json'), JSON.stringify(summary, null, 2))
  await writeFile(join(REPORTS_DIR, 'phase2_company_results.json'), JSON.stringify(companyResults, null, 2))
  await writeFile(join(REPORTS_DIR, 'phase2_coverage_gaps.json'), JSON.stringify(gaps, null, 2))
  await writeFile(join(REPORTS_DIR, 'phase2_adapter_priority.json'), JSON.stringify(priorities, null, 2))

  // Write MD reports
  await writeFile(join(REPORTS_DIR, 'phase2_coverage_summary.md'), summaryToMarkdown(summary))
  await writeFile(join(REPORTS_DIR, 'phase2_company_results.md'), companyResultsToMarkdown(results))
  await writeFile(join(REPORTS_DIR, 'phase2_coverage_gaps.md'), coverageGapsToMarkdown(gaps))
  await writeFile(join(REPORTS_DIR, 'phase2_adapter_priority.md'), adapterPriorityToMarkdown(priorities))

  // Print executive summary
  console.log('\n' + '='.repeat(60))
  console.log('EXECUTIVE SUMMARY')
  console.log('='.repeat(60))
  console.log(`Registry firms:     ${summary.metadata.registrySize}`)
  console.log(`Directly covered:   ${summary.coverage.directlyCovered} / ${summary.coverage.totalFirms} (${summary.coverage.coveragePercent}%)`)
  console.log(`Weighted coverage:  ${summary.coverage.weightedCoveragePercent}%`)
  console.log(`Covered active:     ${summary.coverage.byStatus.COVERED_ACTIVE}`)
  console.log(`Covered zero:       ${summary.coverage.byStatus.COVERED_ZERO}`)
  console.log(`Unsupported ATS:    ${summary.coverage.byStatus.SOURCE_FOUND_UNSUPPORTED}`)
  console.log(`Unknown source:     ${summary.coverage.byStatus.SOURCE_UNKNOWN}`)
  console.log(`Broken/config:      ${summary.coverage.byStatus.SOURCE_BROKEN}`)
  console.log(`Total official jobs: ${summary.jobs.totalOfficialJobs}`)
  console.log('')
  console.log('TOP COVERAGE BLOCKERS:')
  for (const [provider, count] of Object.entries(summary.unsupportedBreakdown).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${provider}: ${count} firms`)
  }
  console.log('')
  if (priorities.length > 0) {
    console.log('RECOMMENDED NEXT ACTION:')
    console.log(`  PATH A: New ${priorities[0].provider} adapter`)
    console.log(`  Expected: +${priorities[0].firmsBlocked} firms, score ${priorities[0].weightedScore}`)
  }
  console.log('='.repeat(60))
  console.log('\nReports saved to: reports/')
}

main().catch(err => {
  console.error('Sweep failed:', err)
  process.exit(1)
})
