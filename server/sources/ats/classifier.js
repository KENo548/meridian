const PATTERNS = [
  {
    provider: 'greenhouse',
    test: (url) => {
      const m = url.match(/(?:boards|job-boards)\.greenhouse\.io\/([^/?#]+)/)
      return m ? { boardSlug: m[1] } : null
    },
  },
  {
    provider: 'workday',
    test: (url) => {
      const m = url.match(/https?:\/\/([^/]*?)(?:\.wd\d)?\.myworkdayjobs\.com(?:\/([^/?#]*))?/)
      if (!m) return null
      const host = m[1]
      const tenantMatch = host.match(/^([^.]+)/)
      return {
        host: m[0].replace(/\/$/, ''),
        tenant: tenantMatch ? tenantMatch[1] : host,
        site: m[2] || null,
      }
    },
  },
  {
    provider: 'oleeo_rss',
    test: (url) => {
      const m = url.match(/https?:\/\/([^.]+)\.tal\.net/)
      return m ? { company: m[1] } : null
    },
  },
  {
    provider: 'smartrecruiters',
    test: (url) => {
      const m = url.match(/(?:jobs|careers)\.smartrecruiters\.com\/([^/?#]+)/)
      return m ? { companyId: m[1] } : null
    },
  },
  {
    provider: 'lever',
    test: (url) => {
      const m2 = url.match(/jobs\.lever\.co\/([^/?#]+)/)
      if (m2) return { companyId: m2[1] }
      const m = url.match(/https?:\/\/([^.]+)\.lever\.co/)
      return m ? { companyId: m[1] } : null
    },
  },
  {
    provider: 'icims',
    test: (url) => {
      const m = url.match(/https?:\/\/(?:careers-[^.]+\.)?icims\.com/)
      return m ? {} : null
    },
  },
  {
    provider: 'efc',
    test: (url) => {
      return url.includes('efinancialcareers.com') ? {} : null
    },
  },
]

function classifyUrl(url) {
  if (!url || typeof url !== 'string') return null

  let normalized
  try {
    normalized = url.startsWith('http') ? url : `https://${url}`
  } catch {
    return null
  }

  for (const pattern of PATTERNS) {
    const metadata = pattern.test(normalized)
    if (metadata) {
      return { provider: pattern.provider, metadata, url: normalized }
    }
  }

  return { provider: 'unknown', metadata: {}, url: normalized }
}

function classifyFirm(firm) {
  if (!firm || !firm.careersUrl) return null
  return classifyUrl(firm.careersUrl)
}

function classifyJobUrl(url) {
  return classifyUrl(url)
}

function classifyAllFirms(firms) {
  if (!Array.isArray(firms) || firms.length === 0) return []

  return firms.map((firm) => {
    const classification = classifyFirm(firm)
    return {
      firmId: firm.id,
      firmName: firm.name,
      classification,
    }
  })
}

function getProviderCounts(classifications) {
  const counts = {}
  for (const item of classifications) {
    if (!item.classification) continue
    const p = item.classification.provider
    counts[p] = (counts[p] || 0) + 1
  }
  return counts
}

export { classifyUrl, classifyFirm, classifyJobUrl, classifyAllFirms, getProviderCounts, PATTERNS }
