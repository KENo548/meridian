import { fetchGreenhouseJobs } from './ats/greenhouse.js'
import { fetchOleeoRssJobs } from './ats/oleeo-rss.js'
import { fetchWorkdayJobs } from './ats/workday.js'
import { fetchSmartRecruitersJobs } from './ats/smartrecruiters.js'
import { fetchLeverJobs } from './ats/lever.js'
import { fetchCustomJobs } from './ats/custom.js'

const ADAPTERS = {
  greenhouse: fetchGreenhouseJobs,
  oleeo_rss: fetchOleeoRssJobs,
  workday: fetchWorkdayJobs,
  smartrecruiters: fetchSmartRecruitersJobs,
  lever: fetchLeverJobs,
  custom: fetchCustomJobs,
  oracle_hcm: fetchCustomJobs,
  eightfold: fetchCustomJobs,
  successfactors: fetchCustomJobs,
  avature: fetchCustomJobs,
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
      if (result.status === 'fulfilled') {
        const { jobs, error } = result.value
        allJobs.push(...(jobs || []))
        sourceReport[source.provider] = {
          status: error ? 'error' : 'success',
          count: (jobs || []).length,
          error: error || null,
          careersUrl: source.careersUrl,
          verified: source.verified || false,
        }
      } else {
        sourceReport[source.provider] = {
          status: 'error',
          count: 0,
          error: result.reason?.message || 'Unknown error',
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
    const adapter = ADAPTERS[provider]
    if (!adapter) {
      return {
        jobs: [],
        source: provider,
        total: 0,
        firm: firm.name,
        error: `No adapter for provider: ${provider}`,
        sources: {
          [provider]: { status: 'error', count: 0, error: `No adapter for provider: ${provider}` },
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

export { fetchFirmJobs, fetchAllEnabledFirms, fetchSourceJobs, ADAPTERS }
