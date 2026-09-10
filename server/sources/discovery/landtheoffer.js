const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQeAQaoEcYGl7DRCGz6_PqniMQP1Tsq9VKxJ53yrH_NKLBu60UoW3N8ood5tH_u5q430sh9YfyRBG1k/pub?gid=0&single=true&output=csv'
const TIMEOUT_MS = 15000
const SOURCE = 'landtheoffer'

function parseCsvLine(line) {
  const result = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

function parseCsv(text) {
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) return []

  const headers = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'))
  const rows = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i])
    if (values.length < headers.length) continue
    const row = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j]
    }
    rows.push(row)
  }

  return rows
}

function mapRow(row) {
  const company = row['company'] || row['firm'] || ''
  const programme = row['programme_name'] || row['programme'] || row['role'] || ''
  const openingDate = row['opening_date'] || row['opening'] || ''
  const closingDate = row['closing_date'] || row['closing'] || ''
  const status = row['status'] || ''
  const process = row['process'] || ''
  const applyUrl = row['apply_url'] || row['apply'] || row['link'] || ''
  const category = row['category'] || ''

  return {
    company,
    programme,
    programmeName: programme,
    location: row['location'] || '',
    openingDate,
    closingDate,
    status,
    process,
    applyUrl,
    category,
    rolling: status.toLowerCase().includes('rolling'),
  }
}

async function fetchLandTheOffer() {
  try {
    const response = await fetch(CSV_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!response.ok) {
      return {
        entries: [],
        source: SOURCE,
        total: 0,
        error: `Land the Offer HTTP ${response.status}`,
      }
    }

    const text = await response.text()

    if (!text || text.trim().length < 10) {
      return {
        entries: [],
        source: SOURCE,
        total: 0,
        error: 'Land the Offer returned empty content',
      }
    }

    const rows = parseCsv(text)
    const entries = rows
      .map(mapRow)
      .filter(r => r.company)

    return {
      entries,
      source: SOURCE,
      total: entries.length,
    }
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return {
        entries: [],
        source: SOURCE,
        total: 0,
        error: 'Land the Offer request timed out',
      }
    }
    return {
      entries: [],
      source: SOURCE,
      total: 0,
      error: `Land the Offer error: ${err.message}`,
    }
  }
}

export { fetchLandTheOffer, parseCsv, CSV_URL }
