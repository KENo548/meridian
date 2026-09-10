/**
 * Ashby ATS adapter
 * Fetches jobs from Ashby's public job-board API.
 * Ashby boards are typically at: https://jobs.ashbyhq.com/{organizationId}
 * The API endpoint is: https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiJobBoardWithTeams
 */

async function fetchAshbyJobs(firm, source) {
  const orgId = source?.boardSlug || firm?.ashbyOrgId || firm?.atsSlug

  if (!orgId) {
    return { jobs: [], error: `No Ashby organization ID for ${firm?.name}`, source: 'ashby' }
  }

  const api_url = 'https://jobs.ashbyhq.com/api/non-user-graphql?op=ApiJobBoardWithTeams'

  try {
    const response = await fetch(api_url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Meridian-Job-Tracker/1.0',
      },
      body: JSON.stringify({
        operationName: 'ApiJobBoardWithTeams',
        variables: { organizationHostedJobsPageName: orgId },
        query: `query ApiJobBoardWithTeams($organizationHostedJobsPageName: String!) {
          jobBoard: jobBoardWithTeams(organizationHostedJobsPageName: $organizationHostedJobsPageName) {
            teams {
              id
              name
              parentId
              jobs {
                id
                title
                locationName
                employmentType
                isRemote
                departmentName
                createdAt
                updatedAt
              }
            }
          }
        }`,
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      return { jobs: [], error: `Ashby API ${response.status} for ${orgId}: ${text.substring(0, 200)}`, source: 'ashby' }
    }

    const data = await response.json()
    const board = data?.data?.jobBoard

    if (!board) {
      return { jobs: [], error: `No job board data for ${orgId}`, source: 'ashby' }
    }

    const allJobs = []
    const teams = board.teams || []

    for (const team of teams) {
      const jobs = team.jobs || []
      for (const job of jobs) {
        const jobUrl = `https://jobs.ashbyhq.com/${orgId}/${job.id}`

        allJobs.push({
          id: `ashby:${orgId}:${job.id}`,
          source: 'ashby',
          sourceJobId: String(job.id),
          company: firm?.name || orgId,
          title: job.title || '',
          location: job.locationName || '',
          country: extractCountry(job.locationName || ''),
          url: jobUrl,
          applyUrl: jobUrl,
          description: [team.name, job.departmentName].filter(Boolean).join(' — '),
          posted: job.createdAt || null,
          employmentType: mapEmploymentType(job.employmentType || job.title || ''),
          departments: team.name ? [team.name] : [],
          offices: job.locationName ? [job.locationName] : [],
        })
      }
    }

    return { jobs: allJobs, source: 'ashby', total: allJobs.length, firm: firm?.name || orgId }
  } catch (err) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      return { jobs: [], error: `Ashby timeout for ${orgId}`, source: 'ashby' }
    }
    return { jobs: [], error: `Ashby error for ${orgId}: ${err.message}`, source: 'ashby' }
  }
}

function extractCountry(location) {
  if (!location) return ''
  const lower = location.toLowerCase()
  const map = {
    'london': 'gb', 'united kingdom': 'gb', 'uk': 'gb',
    'new york': 'us', 'san francisco': 'us', 'chicago': 'us', 'boston': 'us',
    'frankfurt': 'de', 'germany': 'de', 'berlin': 'de',
    'paris': 'fr', 'france': 'fr',
    'hong kong': 'hk', 'singapore': 'sg',
    'tokyo': 'jp', 'japan': 'jp',
    'zurich': 'ch', 'switzerland': 'ch',
    'dubai': 'ae', 'uae': 'ae',
    'dublin': 'ie', 'ireland': 'ie',
    'sydney': 'au', 'australia': 'au',
    'toronto': 'ca', 'canada': 'ca',
    'amsterdam': 'nl', 'netherlands': 'nl',
    'madrid': 'es', 'spain': 'es',
    'milan': 'it', 'italy': 'it',
    'stockholm': 'se', 'sweden': 'se',
    'helsinki': 'fi', 'finland': 'fi',
    'lisbon': 'pt', 'portugal': 'pt',
    'warsaw': 'pl', 'poland': 'pl',
    'prague': 'cz', 'czech': 'cz',
    'luxembourg': 'lu', 'monaco': 'mc',
  }
  for (const [key, code] of Object.entries(map)) {
    if (lower.includes(key)) return code
  }
  return ''
}

function mapEmploymentType(text) {
  const lower = (text || '').toLowerCase()
  if (lower.includes('intern')) return 'internship'
  if (lower.includes('summer analyst') || lower.includes('spring week') || lower.includes('insight')) return 'internship'
  if (lower.includes('off-cycle') || lower.includes('off cycle')) return 'internship'
  if (lower.includes('part time') || lower.includes('part-time')) return 'part_time'
  if (lower.includes('contract') || lower.includes('temporary')) return 'contract'
  return 'unknown'
}

export { fetchAshbyJobs }
