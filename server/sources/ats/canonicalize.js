function canonicalizeUrl(url) {
  if (!url || typeof url !== 'string') return null

  try {
    const parsed = new URL(url)

    parsed.search = ''
    parsed.hash = ''

    if (parsed.hostname === 'boards.greenhouse.io' || parsed.hostname === 'job-boards.greenhouse.io') {
      const pathParts = parsed.pathname.split('/').filter(Boolean)
      if (pathParts.length >= 2) {
        parsed.pathname = `/${pathParts[0]}/jobs/${pathParts[1]}`
      }
    }

    if (parsed.hostname.includes('myworkdayjobs.com')) {
      parsed.pathname = parsed.pathname.replace(/\/+$/, '')
    }

    if (parsed.hostname.includes('smartrecruiters.com')) {
      const pathParts = parsed.pathname.split('/').filter(Boolean)
      if (pathParts.length >= 2) {
        parsed.pathname = `/${pathParts[0]}/${pathParts[1]}`
      }
    }

    if (parsed.hostname.includes('lever.co')) {
      parsed.pathname = parsed.pathname.replace(/\/+$/, '')
    }

    let normalized = parsed.toString()
    normalized = normalized.replace(/\/+$/, '')

    return normalized
  } catch {
    return url
  }
}

function extractCanonicalId(job) {
  const urlKey = canonicalizeUrl(job.url || job.canonicalUrl || job.applyUrl)
  if (urlKey) return `url:${urlKey}`

  const textKey = [
    (job.company || '').toLowerCase().trim(),
    (job.title || '').toLowerCase().trim(),
    (job.location || '').toLowerCase().trim(),
  ].join(':')

  if (textKey !== '::') return `text:${textKey}`

  return null
}

function canonicalize(job, sourceConfig = {}) {
  if (!job || typeof job !== 'object') return null

  const canonicalUrl = canonicalizeUrl(job.url || job.canonicalUrl || job.applyUrl)
  const applicationUrl = job.applyUrl || job.url || canonicalUrl
  const canonicalId = extractCanonicalId(job)

  const trackerIntel = {
    deadline: { value: job.deadline || null, source: job.source || 'direct', confidence: 'certain' },
    programme: { value: job.programme || null, source: job.source || 'direct', confidence: 'certain' },
    location: { value: job.location || null, source: job.source || 'direct', confidence: 'certain' },
    country: { value: job.country || null, source: job.source || 'direct', confidence: 'certain' },
    eligibility: { value: job.eligibility || null, source: job.source || 'direct', confidence: 'certain' },
    category: { value: job.category || null, source: job.source || 'direct', confidence: 'certain' },
    status: { value: job.status || null, source: job.source || 'direct', confidence: 'certain' },
    process: { value: job.process || null, source: job.source || 'direct', confidence: 'certain' },
  }

  return {
    ...job,
    canonicalId,
    canonicalUrl: canonicalUrl || job.canonicalUrl || null,
    applicationUrl: applicationUrl || null,
    provider: job.source || sourceConfig.provider || 'unknown',
    providerUrl: job.url || null,
    discoveredVia: sourceConfig.discoveredVia || null,
    discoveryUrl: sourceConfig.discoveryUrl || null,
    firstSeenAt: job.firstSeenAt || new Date().toISOString(),
    lastSeenAt: job.lastSeenAt || new Date().toISOString(),
    trackerIntel,
  }
}

function mergeTrackerIntel(existing, incoming) {
  if (!existing || !incoming) return existing || incoming

  const merged = { ...existing }

  for (const field of Object.keys(incoming)) {
    const incomingValue = incoming[field]
    if (!incomingValue || !incomingValue.value) continue

    if (!merged[field] || !merged[field].value) {
      merged[field] = incomingValue
    } else {
      const existingConfidence = merged[field].confidence
      const incomingConfidence = incomingValue.confidence

      if (incomingConfidence === 'uncertain') continue

      if (existingConfidence === 'uncertain') {
        merged[field] = incomingValue
      } else if (incomingValue.source === 'direct' && merged[field].source !== 'direct') {
        merged[field] = incomingValue
      }
    }
  }

  return merged
}

function canonicalizeBatch(jobs, sourceConfig = {}) {
  if (!Array.isArray(jobs)) return []
  return jobs.map((job) => canonicalize(job, sourceConfig)).filter(Boolean)
}

export { canonicalizeUrl, extractCanonicalId, canonicalize, canonicalizeBatch, mergeTrackerIntel }
