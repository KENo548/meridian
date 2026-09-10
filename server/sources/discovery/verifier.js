/**
 * Phase 2.1 Step 7+8 — ATS Source Verifier
 *
 * Verifies discovered ATS sources by running adapters in test mode.
 * Handles zero-job verification and company identity matching.
 */

import { fetchWorkdayJobs } from '../ats/workday.js'
import { fetchGreenhouseJobs } from '../ats/greenhouse.js'
import { fetchLeverJobs } from '../ats/lever.js'
import { fetchAshbyJobs } from '../ats/ashby.js'
import { fetchSmartRecruitersJobs } from '../ats/smartrecruiters.js'
import { fetchOleeoRssJobs } from '../ats/oleeo-rss.js'

const VERIFICATION_TIMEOUT = 20000

/**
 * Verify a discovered ATS source by attempting to fetch jobs.
 *
 * @param {Object} source - { provider, identifiers, url, companyName }
 * @returns {Object} verification result
 */
export async function verifySource(source) {
  const { provider, identifiers = {}, url, companyName } = source
  const start = Date.now()

  const result = {
    provider,
    verificationStatus: 'FAILED',
    jobCount: 0,
    sampleTitles: [],
    companyMatchRatio: 0,
    latencyMs: 0,
    error: null,
    evidence: [],
  }

  try {
    const adapter = getAdapter(provider)
    if (!adapter) {
      result.error = `No adapter available for ${provider}`
      result.evidence.push(`Provider ${provider} has no adapter — cannot verify programmatically`)
      return result
    }

    const firm = buildFirmObject(provider, identifiers, url, companyName)
    const fetchResult = await Promise.race([
      adapter(firm),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Verification timeout')), VERIFICATION_TIMEOUT)),
    ])

    result.latencyMs = Date.now() - start

    if (fetchResult.error) {
      result.error = fetchResult.error
      result.evidence.push(`Adapter returned error: ${fetchResult.error}`)
      return result
    }

    result.jobCount = (fetchResult.jobs || []).length
    result.sampleTitles = (fetchResult.jobs || []).slice(0, 5).map(j => j.title)

    // Company identity matching
    if (result.jobCount > 0) {
      const nameLower = companyName.toLowerCase()
      const firstName = nameLower.split(/[&\s]/)[0]
      const matchingJobs = fetchResult.jobs.filter(j => {
        const company = (j.company || '').toLowerCase()
        const title = (j.title || '').toLowerCase()
        return company.includes(firstName) ||
          company.includes(nameLower) ||
          title.includes(nameLower)
      })

      result.companyMatchRatio = matchingJobs.length / result.jobCount

      if (result.companyMatchRatio >= 0.3) {
        result.verificationStatus = 'VERIFIED'
        result.evidence.push(`${result.jobCount} jobs returned, ${Math.round(result.companyMatchRatio * 100)}% match company "${companyName}"`)
      } else if (result.jobCount > 0) {
        result.verificationStatus = 'LOW_MATCH'
        result.evidence.push(`${result.jobCount} jobs returned but only ${Math.round(result.companyMatchRatio * 100)}% match company "${companyName}"`)
      }
    } else {
      // Zero jobs — determine if this is valid or suspicious
      result.verificationStatus = 'VERIFIED_ZERO'
      result.evidence.push('Board responded correctly but returned 0 jobs — board may be empty or seasonal')
    }
  } catch (err) {
    result.latencyMs = Date.now() - start
    result.error = err.message
    result.evidence.push(`Verification threw: ${err.message}`)
  }

  return result
}

function getAdapter(provider) {
  const adapters = {
    greenhouse: fetchGreenhouseJobs,
    lever: fetchLeverJobs,
    ashby: fetchAshbyJobs,
    workday: fetchWorkdayJobs,
    smartrecruiters: fetchSmartRecruitersJobs,
    oleeo_rss: fetchOleeoRssJobs,
  }
  return adapters[provider] || null
}

function buildFirmObject(provider, identifiers, url, companyName) {
  const base = { name: companyName, careersUrl: url }

  switch (provider) {
    case 'workday':
      return {
        ...base,
        atsSlug: identifiers.host,
        workdayTenant: identifiers.tenant,
        workdaySite: identifiers.site,
      }
    case 'greenhouse':
      return {
        ...base,
        atsSlug: identifiers.slug,
      }
    case 'lever':
      return {
        ...base,
        atsSlug: identifiers.slug,
      }
    case 'ashby':
      return {
        ...base,
        ashbyOrgId: identifiers.slug,
      }
    case 'smartrecruiters':
      return {
        ...base,
        smartRecruitersCompanyId: identifiers.companyId,
      }
    case 'oleeo_rss':
      return {
        ...base,
        atsSlug: identifiers.boardId || companyName.toLowerCase().replace(/\s+/g, ''),
        oleeoRssUrl: url,
      }
    default:
      return base
  }
}

/**
 * Quick check if a URL responds (without full job fetch).
 * Used for reachability checks.
 */
export async function checkReachable(url) {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const response = await fetch(url, {
      method: 'HEAD',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: controller.signal,
      redirect: 'follow',
    })
    clearTimeout(timer)
    return {
      reachable: response.ok || response.status < 500,
      status: response.status,
      finalUrl: url,
    }
  } catch (err) {
    return { reachable: false, status: 0, finalUrl: url, error: err.message }
  }
}
