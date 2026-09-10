import { fetchGreenhouseJobs } from './ats/greenhouse.js'
import { fetchOleeoRssJobs } from './ats/oleeo-rss.js'
import { fetchWorkdayJobs } from './ats/workday.js'
import { fetchSmartRecruitersJobs } from './ats/smartrecruiters.js'
import { fetchLeverJobs } from './ats/lever.js'
import { fetchAshbyJobs } from './ats/ashby.js'
import { fetchOracleHcmJobs } from './ats/oracle-hcm.js'

// ─── Source Capability States ──────────────────────────────────
// SUPPORTED: Full adapter, reliably fetches jobs
// PARTIAL:   Adapter exists but may miss some job types or regions
// DISCOVERY_ONLY: Can detect the ATS but not reliably fetch jobs yet
// UNSUPPORTED: Known provider but no adapter implemented
// BROKEN:    Adapter exists but currently non-functional

const CAPABILITY = {
  greenhouse: 'supported',
  lever: 'supported',
  ashby: 'supported',
  workday: 'supported',
  smartrecruiters: 'supported',
  oleeo_rss: 'supported',
  oracle_hcm: 'supported',
  successfactors: 'unsupported',
  eightfold: 'unsupported',
  avature: 'unsupported',
  icims: 'unsupported',
  taleo: 'unsupported',
  teamtailor: 'unsupported',
  recruitee: 'unsupported',
  custom: 'unsupported',
}

// Adapters that actually fetch jobs
const ADAPTERS = {
  greenhouse: fetchGreenhouseJobs,
  lever: fetchLeverJobs,
  ashby: fetchAshbyJobs,
  workday: fetchWorkdayJobs,
  smartrecruiters: fetchSmartRecruitersJobs,
  oleeo_rss: fetchOleeoRssJobs,
  oracle_hcm: fetchOracleHcmJobs,
}

function getCapability(provider) {
  return CAPABILITY[provider] || 'unsupported'
}

function isSupported(provider) {
  return getCapability(provider) === 'supported'
}

function getSupportedProviders() {
  return Object.entries(CAPABILITY)
    .filter(([, cap]) => cap === 'supported' || cap === 'partial')
    .map(([name]) => name)
}

async function fetchFirmJobs(firm) {
  const sources = firm.sources || []
  const enabledSources = sources.filter(s => s.enabled !== false)

  if (enabledSources.length > 0) {
    const sourceResults = await Promise.allSettled(
      enabledSources.map(source => fetchSourceJobs(firm, source))
    )

    const allJobs = []
    const sourceReport = {}

    sourceResults.forEach((result, i) => {
      const source = enabledSources[i]
      const capability = getCapability(source.provider)

      if (capability === 'unsupported' || capability === 'broken') {
        sourceReport[source.provider] = {
          status: 'skipped',
          count: 0,
          error: `Provider ${source.provider} is ${capability}`,
          capability,
          careersUrl: source.careersUrl,
          verified: false,
        }
        return
      }

      if (result.status === 'fulfilled') {
        const { jobs, error } = result.value
        allJobs.push(...(jobs || []))
        sourceReport[source.provider] = {
          status: error ? 'error' : 'success',
          count: (jobs || []).length,
          error: error || null,
          capability,
          careersUrl: source.careersUrl,
          verified: source.verified || false,
        }
      } else {
        sourceReport[source.provider] = {
          status: 'error',
          count: 0,
          error: result.reason?.message || 'Unknown error',
          capability,
          careersUrl: source.careersUrl,
          verified: source.verified || false,
        }
      }
    })

    return {
      jobs: allJobs,
      total: allJobs.length,
      firm: firm.name,
      sources: sourceReport,
    }
  }

  if (firm.careersProvider) {
    const provider = firm.careersProvider
    const capability = getCapability(provider)

    if (capability === 'unsupported' || capability === 'broken') {
      return {
        jobs: [],
        source: provider,
        total: 0,
        firm: firm.name,
        error: `Provider ${provider} is ${capability} — no jobs will be retrieved`,
        sources: {
          [provider]: {
            status: 'skipped',
            count: 0,
            error: `Provider ${provider} is ${capability}`,
            capability,
            careersUrl: firm.careersUrl,
            verified: false,
          },
        },
      }
    }

    const adapter = ADAPTERS[provider]
    if (!adapter) {
      return {
        jobs: [],
        source: provider,
        total: 0,
        firm: firm.name,
        error: `No adapter for provider: ${provider}`,
        sources: {
          [provider]: { status: 'error', count: 0, error: `No adapter for provider: ${provider}`, capability },
        },
      }
    }

    const result = await adapter(firm)
    return {
      ...result,
      sources: {
        [provider]: {
          status: result.error ? 'error' : 'success',
          count: result.total || 0,
          error: result.error || null,
          capability,
          careersUrl: firm.careersUrl,
          verified: false,
        },
      },
    }
  }

  return {
    jobs: [],
    total: 0,
    firm: firm.name,
    error: 'No sources configured',
    sources: {},
  }
}

async function fetchSourceJobs(firm, source) {
  const capability = getCapability(source.provider)

  if (capability === 'unsupported' || capability === 'broken') {
    return {
      jobs: [],
      source: source.provider,
      total: 0,
      firm: firm.name,
      error: `Provider ${source.provider} is ${capability}`,
    }
  }

  const adapter = ADAPTERS[source.provider]
  if (!adapter) {
    return {
      jobs: [],
      source: source.provider,
      total: 0,
      firm: firm.name,
      error: `No adapter for provider: ${source.provider}`,
    }
  }

  const enrichedFirm = {
    ...firm,
    smartRecruitersCompanyId: source.companyId || source.boardSlug,
    leverCompanyId: source.companyId || source.boardSlug,
    ashbyOrgId: source.boardSlug || source.companyIdentifier,
    atsSlug: source.boardSlug || source.atsSlug || firm.atsSlug,
    workdayTenant: source.workdayTenant || source.tenant || firm.workdayTenant,
    workdaySite: source.workdaySite || firm.workdaySite,
    oleeoRssUrl: source.careersUrl || source.sourceUrl || firm.oleeoRssUrl,
  }

  return adapter(enrichedFirm, source)
}

async function fetchAllEnabledFirms(firms) {
  const results = await Promise.allSettled(
    firms.filter(f => f.enabled).map(f => fetchFirmJobs(f))
  )

  const allJobs = []
  const firmResults = []

  results.forEach((result, i) => {
    const firm = firms[i]
    if (result.status === 'fulfilled') {
      const { jobs, sources, error } = result.value
      allJobs.push(...(jobs || []))
      firmResults.push({
        firmId: firm.id,
        firmName: firm.name,
        provider: firm.careersProvider,
        count: (jobs || []).length,
        error: error || null,
        sources: sources || {},
      })
    } else {
      firmResults.push({
        firmId: firm.id,
        firmName: firm.name,
        provider: firm.careersProvider,
        count: 0,
        error: result.reason?.message || 'Unknown error',
        sources: {},
      })
    }
  })

  return { jobs: allJobs, firmResults }
}

export {
  fetchFirmJobs,
  fetchAllEnabledFirms,
  fetchSourceJobs,
  ADAPTERS,
  CAPABILITY,
  getCapability,
  isSupported,
  getSupportedProviders,
}
