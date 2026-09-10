import { CATALOGUE, lookupByAlias, lookupByDomain, lookupPartial, normalizeName } from './companyCatalogue.js'

function extractDomain(url) {
  if (!url || typeof url !== 'string') return null
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
    return parsed.hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

function levenshtein(a, b) {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const matrix = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }

  return matrix[a.length][b.length]
}

function matchByAlias(companyName) {
  // Exact alias match
  const exactId = lookupByAlias(companyName)
  if (exactId) return { firmId: exactId, confidence: 'high', method: 'alias' }

  // Partial alias match
  const partialId = lookupPartial(companyName)
  if (partialId) return { firmId: partialId, confidence: 'medium', method: 'partial_alias' }

  return null
}

function matchByDomain(url) {
  const domain = extractDomain(url)
  if (!domain) return null

  const firmId = lookupByDomain(domain)
  if (firmId) return { firmId, confidence: 'high', method: 'domain' }

  // Try registrable domain suffixes
  for (const entry of CATALOGUE) {
    for (const d of entry.domains) {
      if (domain.endsWith(`.${d}`) || d.endsWith(`.${domain}`)) {
        return { firmId: entry.id, confidence: 'high', method: 'domain' }
      }
    }
  }

  return null
}

function matchByFuzzy(companyName) {
  const norm = normalizeName(companyName)
  let bestMatch = null
  let bestDistance = Infinity

  for (const firm of CATALOGUE) {
    const allNames = [firm.canonicalName, ...firm.aliases]
    for (const alias of allNames) {
      const dist = levenshtein(norm, normalizeName(alias))
      const maxLen = Math.max(norm.length, normalizeName(alias).length)
      const similarity = 1 - dist / maxLen

      if (similarity > 0.8 && dist < bestDistance) {
        bestDistance = dist
        bestMatch = { firmId: firm.id, confidence: 'low', method: 'fuzzy', similarity }
      }
    }
  }

  return bestMatch
}

function resolveFirm(companyName, applyUrl) {
  const aliasMatch = matchByAlias(companyName)
  if (aliasMatch && aliasMatch.confidence === 'high') {
    return aliasMatch
  }

  const domainMatch = matchByDomain(applyUrl)
  if (domainMatch) {
    return domainMatch
  }

  if (aliasMatch && aliasMatch.confidence === 'medium') {
    return aliasMatch
  }

  const fuzzyMatch = matchByFuzzy(companyName)
  if (fuzzyMatch) {
    return fuzzyMatch
  }

  return { firmId: null, confidence: 'none', method: 'unresolved' }
}

function getCatalogueEntry(firmId) {
  const entry = CATALOGUE.find(f => f.id === firmId)
  return entry || null
}

export {
  resolveFirm,
  matchByAlias,
  matchByDomain,
  matchByFuzzy,
  extractDomain,
  levenshtein,
  getCatalogueEntry,
  CATALOGUE,
}
