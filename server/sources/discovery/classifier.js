/**
 * Phase 2.1 Step 3 — ATS Fingerprinting
 *
 * Recognizes ATS providers from URLs, HTML content, and page metadata.
 * Returns provider identity with confidence and evidence.
 */

// ─── Supported ATS Fingerprints ────────────────────────────────

const SUPPORTED_FINGERPRINTS = [
  {
    provider: 'greenhouse',
    urlPatterns: [
      /boards\.greenhouse\.io/i,
      /job-boards\.greenhouse\.io/i,
      /boards-api\.greenhouse\.io/i,
    ],
    htmlPatterns: [
      /greenhouse\.io/i,
      /data-board-id/i,
      /gh-bin/i,
    ],
    slugPattern: /boards\.greenhouse\.io\/([a-z0-9_-]+)/i,
    extractSlug: (url, html) => {
      const m = url?.match(/boards\.greenhouse\.io\/([a-z0-9_-]+)/i)
      return m ? m[1] : null
    },
  },
  {
    provider: 'lever',
    urlPatterns: [
      /jobs\.lever\.co/i,
      /api\.lever\.co/i,
    ],
    htmlPatterns: [
      /lever\.co/i,
      /leverjob/i,
    ],
    slugPattern: /jobs\.lever\.co\/([a-z0-9_-]+)/i,
    extractSlug: (url) => {
      const m = url?.match(/jobs\.lever\.co\/([a-z0-9_-]+)/i)
      return m ? m[1] : null
    },
  },
  {
    provider: 'ashby',
    urlPatterns: [
      /jobs\.ashbyhq\.com/i,
      /api\.ashbyhq\.com/i,
    ],
    htmlPatterns: [
      /ashbyhq\.com/i,
      /ashby/i,
    ],
    slugPattern: /jobs\.ashbyhq\.com\/([a-z0-9_-]+)/i,
    extractSlug: (url) => {
      const m = url?.match(/jobs\.ashbyhq\.com\/([a-z0-9_-]+)/i)
      return m ? m[1] : null
    },
  },
  {
    provider: 'workday',
    urlPatterns: [
      /myworkdayjobs\.com/i,
      /wday\/cxs\//i,
    ],
    htmlPatterns: [
      /myworkdayjobs\.com/i,
      /workday/i,
      /wday\//i,
    ],
    extractTenant: (url) => {
      const m = url?.match(/([a-z0-9]+)\.wd\d+\.myworkdayjobs\.com/i)
      return m ? m[1] : null
    },
    extractSite: (url) => {
      const m = url?.match(/myworkdayjobs\.com\/([^/?#]+)/i)
      return m ? m[1] : null
    },
    extractHost: (url) => {
      const m = url?.match(/(https?:\/\/[a-z0-9]+\.wd\d+\.myworkdayjobs\.com)/i)
      return m ? m[1].replace('https://', '').replace('http://', '') : null
    },
  },
  {
    provider: 'smartrecruiters',
    urlPatterns: [
      /smartrecruiters\.com/i,
    ],
    htmlPatterns: [
      /smartrecruiters\.com/i,
      /SmartRecruiters/i,
    ],
    extractCompanyId: (url) => {
      const m = url?.match(/careers\.smartrecruiters\.com\/([a-z0-9_-]+)/i)
      return m ? m[1] : null
    },
  },
  {
    provider: 'oleeo_rss',
    urlPatterns: [
      /\.tal\.net\//i,
      /oleeo/i,
    ],
    htmlPatterns: [
      /tal\.net/i,
      /oleeo/i,
    ],
    extractBoardId: (url) => {
      const m = url?.match(/brand-(\d+)/i)
      return m ? m[1] : null
    },
  },
]

// ─── Unsupported ATS Fingerprints ──────────────────────────────

const UNSUPPORTED_FINGERPRINTS = [
  {
    provider: 'eightfold',
    urlPatterns: [/eightfold\.ai/i, /talent\.eightfold\.ai/i],
    htmlPatterns: [/eightfold/i, /talent\.eightfold/i],
  },
  {
    provider: 'oracle_hcm',
    urlPatterns: [
      /fa\.ocs\.oraclecloud\.com/i,
      /oraclecloud\.com.*hcm/i,
      /oraclehcm/i,
    ],
    htmlPatterns: [/oracle.*hcm/i, /oraclecloud/i],
  },
  {
    provider: 'successfactors',
    urlPatterns: [
      /successfactors\.com/i,
      /sf\.sap\.com/i,
      /careersection/i,
    ],
    htmlPatterns: [/successfactors/i, /SAP SuccessFactors/i],
  },
  {
    provider: 'icims',
    urlPatterns: [
      /icims\.com/i,
      /jobs\.icims\.com/i,
    ],
    htmlPatterns: [/icims/i],
  },
  {
    provider: 'avature',
    urlPatterns: [
      /avature\.net/i,
      /avature\.com/i,
    ],
    htmlPatterns: [/avature/i],
  },
  {
    provider: 'taleo',
    urlPatterns: [
      /taleo\.net/i,
      /oracle\.com\/taleo/i,
    ],
    htmlPatterns: [/taleo/i],
  },
  {
    provider: 'teamtailor',
    urlPatterns: [
      /teamtailor\.com/i,
    ],
    htmlPatterns: [/teamtailor/i],
  },
  {
    provider: 'recruitee',
    urlPatterns: [
      /recruitee\.com/i,
    ],
    htmlPatterns: [/recruitee/i],
  },
]

// ─── Classification Functions ───────────────────────────────────

/**
 * Classify a URL against known ATS fingerprints.
 * Returns array of { provider, capability, confidence, evidence, identifiers }
 */
export function classifyUrl(url) {
  const results = []

  // Check supported ATS
  for (const fp of SUPPORTED_FINGERPRINTS) {
    for (const pattern of fp.urlPatterns) {
      if (pattern.test(url)) {
        const identifiers = {}
        if (fp.extractSlug) identifiers.slug = fp.extractSlug(url)
        if (fp.extractTenant) identifiers.tenant = fp.extractTenant(url)
        if (fp.extractSite) identifiers.site = fp.extractSite(url)
        if (fp.extractHost) identifiers.host = fp.extractHost(url)
        if (fp.extractCompanyId) identifiers.companyId = fp.extractCompanyId(url)
        if (fp.extractBoardId) identifiers.boardId = fp.extractBoardId(url)

        results.push({
          provider: fp.provider,
          capability: 'supported',
          confidence: 0.95,
          evidence: [`URL matches ${fp.provider} pattern: ${pattern}`],
          identifiers,
          url,
        })
        break
      }
    }
  }

  // Check unsupported ATS
  for (const fp of UNSUPPORTED_FINGERPRINTS) {
    for (const pattern of fp.urlPatterns) {
      if (pattern.test(url)) {
        results.push({
          provider: fp.provider,
          capability: 'unsupported',
          confidence: 0.90,
          evidence: [`URL matches ${fp.provider} pattern: ${pattern}`],
          identifiers: {},
          url,
        })
        break
      }
    }
  }

  return results
}

/**
 * Classify HTML content for ATS fingerprints.
 * Used when the URL itself doesn't reveal the ATS.
 */
export function classifyHtml(html, baseUrl) {
  const results = []
  const lowerHtml = html?.toLowerCase() || ''

  // Check supported ATS HTML patterns
  for (const fp of SUPPORTED_FINGERPRINTS) {
    for (const pattern of fp.htmlPatterns) {
      if (pattern.test(lowerHtml)) {
        // Avoid duplicates if URL already matched
        const alreadyFound = results.some(r => r.provider === fp.provider)
        if (!alreadyFound) {
          const identifiers = {}
          if (fp.extractSlug) identifiers.slug = fp.extractSlug(baseUrl, html)
          if (fp.extractTenant) identifiers.tenant = fp.extractTenant(baseUrl)
          if (fp.extractSite) identifiers.site = fp.extractSite(baseUrl)

          results.push({
            provider: fp.provider,
            capability: 'supported',
            confidence: 0.75,
            evidence: [`HTML content matches ${fp.provider} pattern`],
            identifiers,
          })
        }
        break
      }
    }
  }

  // Check unsupported ATS HTML patterns
  for (const fp of UNSUPPORTED_FINGERPRINTS) {
    for (const pattern of fp.htmlPatterns) {
      if (pattern.test(lowerHtml)) {
        const alreadyFound = results.some(r => r.provider === fp.provider)
        if (!alreadyFound) {
          results.push({
            provider: fp.provider,
            capability: 'unsupported',
            confidence: 0.80,
            evidence: [`HTML content matches ${fp.provider} pattern`],
            identifiers: {},
          })
        }
        break
      }
    }
  }

  // Check for iframe/script/form ATS references
  const iframePattern = /<iframe[^>]+src=["']([^"']+)["']/gi
  let match
  while ((match = iframePattern.exec(html || '')) !== null) {
    const iframeUrl = match[1]
    const iframeResults = classifyUrl(iframeUrl)
    for (const r of iframeResults) {
      if (!results.some(x => x.provider === r.provider)) {
        r.confidence *= 0.9 // Slightly lower confidence for iframe sources
        r.evidence.push(`Found in iframe src: ${iframeUrl}`)
        results.push(r)
      }
    }
  }

  // Check script sources
  const scriptPattern = /<script[^>]+src=["']([^"']+)["']/gi
  while ((match = scriptPattern.exec(html || '')) !== null) {
    const scriptUrl = match[1]
    const scriptResults = classifyUrl(scriptUrl)
    for (const r of scriptResults) {
      if (!results.some(x => x.provider === r.provider)) {
        r.confidence *= 0.8
        r.evidence.push(`Found in script src: ${scriptUrl}`)
        results.push(r)
      }
    }
  }

  // Check form actions
  const formPattern = /<form[^>]+action=["']([^"']+)["']/gi
  while ((match = formPattern.exec(html || '')) !== null) {
    const formUrl = match[1]
    const formResults = classifyUrl(formUrl)
    for (const r of formResults) {
      if (!results.some(x => x.provider === r.provider)) {
        r.confidence *= 0.85
        r.evidence.push(`Found in form action: ${formUrl}`)
        results.push(r)
      }
    }
  }

  return results
}

/**
 * Combined classification: URL + HTML content.
 * Merges results, preferring URL-based matches (higher confidence).
 */
export function classify(url, html) {
  const urlResults = classifyUrl(url)
  const htmlResults = classifyHtml(html, url)

  // Merge: URL matches take priority
  const merged = [...urlResults]
  for (const hr of htmlResults) {
    const existing = merged.find(m => m.provider === hr.provider)
    if (!existing) {
      merged.push(hr)
    } else if (hr.confidence > existing.confidence) {
      // HTML found a stronger match (rare, but possible)
      existing.confidence = hr.confidence
      existing.evidence.push(...hr.evidence)
      Object.assign(existing.identifiers, hr.identifiers)
    }
  }

  return merged.sort((a, b) => b.confidence - a.confidence)
}

export { SUPPORTED_FINGERPRINTS, UNSUPPORTED_FINGERPRINTS }
