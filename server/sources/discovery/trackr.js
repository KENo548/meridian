const API_BASE = 'https://api.the-trackr.com'
const TIMEOUT_MS = 20000
const SOURCE = 'trackr'

const PROGRAMME_TYPES = [
  'summer-internships',
  'spring-weeks',
  'off-cycle-internships',
  'industrial-placements',
  'graduate-programmes',
]

const REGIONS = ['UK', 'US', 'France', 'Germany', 'Italy', 'Hong Kong']

async function fetchTrackrProgrammes(options = {}) {
  const {
    regions = REGIONS,
    types = PROGRAMME_TYPES,
    season = new Date().getFullYear() + 1,
  } = options

  const allEntries = []
  const errors = []

  for (const region of regions) {
    for (const type of types) {
      try {
        const url = `${API_BASE}/programmes?region=${region}&industry=Finance&season=${season}&type=${type}`
        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
          signal: AbortSignal.timeout(TIMEOUT_MS),
        })

        if (!response.ok) {
          errors.push({ region, type, status: response.status })
          continue
        }

        const data = await response.json()
        const programmes = data.programmes || []

        for (const prog of programmes) {
          allEntries.push(normalizeTrackrEntry(prog, region, type))
        }
      } catch (err) {
        errors.push({ region, type, error: err.message })
      }
    }
  }

  if (allEntries.length === 0) {
    return {
      entries: [],
      source: SOURCE,
      total: 0,
      error: 'No Trackr programmes fetched',
      errors,
    }
  }

  return {
    entries: allEntries,
    source: SOURCE,
    total: allEntries.length,
    regions: regions.length,
    types: types.length,
    errors: errors.length > 0 ? errors : undefined,
  }
}

function normalizeTrackrEntry(prog, region, type) {
  const company = prog.company?.name || ''
  const companyId = prog.companyId || ''
  const programmeName = prog.name || ''
  const location = (prog.locations || []).join(', ')
  const openingDate = prog.openingDate || null
  const closingDate = prog.closingDate || null
  const lastYearOpening = prog.lastYearOpening || null
  const process = prog.process || null
  const rolling = prog.rolling === true
  const cv = prog.cv === true
  const coverLetter = prog.coverLetter || 'Unknown'
  const writtenAnswers = prog.writtenAnswers || 'No'
  const notes = prog.notes || ''
  const sponsorsVisa = prog.company?.sponsorsVisa || ''
  const categories = prog.categories || []
  const divisions = prog.divisions || []
  const url = prog.url || ''
  const careersSite = prog.company?.careersSite || ''

  const isOpen = isProgrammeOpen(openingDate, closingDate)

  return {
    id: `trackr:${prog.id}`,
    source: SOURCE,
    sourceJobId: prog.id,
    company,
    companyId,
    programmeName,
    region,
    type,
    categories,
    divisions,
    location,
    openingDate,
    closingDate,
    lastYearOpening,
    process,
    rolling,
    cv,
    coverLetter,
    writtenAnswers,
    notes,
    sponsorsVisa,
    url,
    careersSite,
    isOpen,
  }
}

function isProgrammeOpen(openingDate, closingDate) {
  const now = new Date()
  const opened = openingDate ? new Date(openingDate) : null
  const closed = closingDate ? new Date(closingDate) : null

  if (opened && opened > now) return false
  if (closed && closed < now) return false
  if (opened) return true
  return false
}

function matchTrackerToFirm(entry, registryFirms) {
  const companyId = entry.companyId?.toLowerCase() || ''
  const companyName = entry.company?.toLowerCase() || ''

  for (const firm of registryFirms) {
    if (firm.id === companyId) return firm
    if (firm.name?.toLowerCase() === companyName) return firm
    if (firm.aliases?.some(a => a.toLowerCase() === companyName)) return firm
  }

  return null
}

export {
  fetchTrackrProgrammes,
  normalizeTrackrEntry,
  matchTrackerToFirm,
  isProgrammeOpen,
  API_BASE,
  PROGRAMME_TYPES,
  REGIONS,
}
