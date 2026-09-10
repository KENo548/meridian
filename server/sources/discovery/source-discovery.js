import { extractDomain } from './domain.js'

const DISCOVERY_TIMEOUT = 15000

const ATS_SIGNATURES = {
  greenhouse: {
    hostPatterns: ['boards.greenhouse.io', 'jobs.greenhouse.io', 'job-boards.greenhouse.io', 'job-boards.eu.greenhouse.io'],
    linkPatterns: [/greenhouse\.io/i],
    scriptPatterns: [/greenhouse\.io/i],
    formPatterns: [/greenhouse/i],
    metaPatterns: [/greenhouse/i],
  },
  workday: {
    hostPatterns: ['myworkdayjobs.com', 'wday.com'],
    linkPatterns: [/myworkdayjobs\.com/i, /wday\.com/i, /workday\.com/i],
    scriptPatterns: [/workday\.com/i, /wday\.com/i],
    formPatterns: [/workday/i],
    metaPatterns: [/workday/i],
  },
  oleeo: {
    hostPatterns: ['tal.net'],
    linkPatterns: [/\.tal\.net/i],
    scriptPatterns: [/oleeo/i, /tal\.net/i],
    formPatterns: [/oleeo/i],
    metaPatterns: [/oleeo/i],
  },
  smartrecruiters: {
    hostPatterns: ['smartrecruiters.com'],
    linkPatterns: [/smartrecruiters\.com/i],
    scriptPatterns: [/smartrecruiters\.com/i],
    formPatterns: [/smartrecruiters/i],
    metaPatterns: [/smartrecruiters/i],
  },
  lever: {
    hostPatterns: ['jobs.lever.co'],
    linkPatterns: [/jobs\.lever\.co/i],
    scriptPatterns: [/jobs\.lever\.co/i, /lever\.co\/.*posting/i],
    formPatterns: [/jobs\.lever\.co/i],
    metaPatterns: [/jobs\.lever\.co/i],
  },
  icims: {
    hostPatterns: ['icims.com'],
    linkPatterns: [/icims\.com/i],
    scriptPatterns: [/icims\.com/i],
    formPatterns: [/icims/i],
    metaPatterns: [/icims/i],
  },
  taleo: {
    hostPatterns: ['taleo.net', 'oracle.com/taleo'],
    linkPatterns: [/taleo\.net/i, /oracle\.com.*taleo/i],
    scriptPatterns: [/taleo/i],
    formPatterns: [/taleo/i],
    metaPatterns: [/taleo/i],
  },
  successfactors: {
    hostPatterns: ['successfactors.com', 'sap.com'],
    linkPatterns: [/successfactors\.com/i, /sap\.com.*successfactors/i],
    scriptPatterns: [/successfactors/i],
    formPatterns: [/successfactors/i],
    metaPatterns: [/successfactors/i],
  },
  pageup: {
    hostPatterns: ['pageuppeople.com'],
    linkPatterns: [/pageuppeople\.com/i],
    scriptPatterns: [/pageuppeople\.com/i],
    formPatterns: [/pageup/i],
    metaPatterns: [/pageup/i],
  },
  jobvite: {
    hostPatterns: ['jobvite.com'],
    linkPatterns: [/jobvite\.com/i],
    scriptPatterns: [/jobvite\.com/i],
    formPatterns: [/jobvite/i],
    metaPatterns: [/jobvite/i],
  },
  smashfly: {
    hostPatterns: ['smashfly.com'],
    linkPatterns: [/smashfly\.com/i],
    scriptPatterns: [/smashfly\.com/i],
    formPatterns: [/smashfly/i],
    metaPatterns: [/smashfly/i],
  },
  phenom: {
    hostPatterns: ['phenom.com'],
    linkPatterns: [/phenom\.com/i],
    scriptPatterns: [/phenom\.com/i],
    formPatterns: [/phenom/i],
    metaPatterns: [/phenom/i],
  },
  eightfold: {
    hostPatterns: ['eightfold.ai'],
    linkPatterns: [/eightfold\.ai/i],
    scriptPatterns: [/eightfold\.ai/i],
    formPatterns: [/eightfold/i],
    metaPatterns: [/eightfold/i],
  },
 Ashby: {
    hostPatterns: ['ashbyhq.com'],
    linkPatterns: [/ashbyhq\.com/i],
    scriptPatterns: [/ashbyhq\.com/i],
    formPatterns: [/ashby/i],
    metaPatterns: [/ashby/i],
  },
  bamboohr: {
    hostPatterns: ['bamboohr.com'],
    linkPatterns: [/bamboohr\.com/i],
    scriptPatterns: [/bamboohr\.com/i],
    formPatterns: [/bamboohr/i],
    metaPatterns: [/bamboohr/i],
  },
  recruitee: {
    hostPatterns: ['recruitee.com'],
    linkPatterns: [/recruitee\.com/i],
    scriptPatterns: [/recruitee\.com/i],
    formPatterns: [/recruitee/i],
    metaPatterns: [/recruitee/i],
  },
  workable: {
    hostPatterns: ['workable.com'],
    linkPatterns: [/workable\.com/i],
    scriptPatterns: [/workable\.com/i],
    formPatterns: [/workable/i],
    metaPatterns: [/workable/i],
  },
  jazzhr: {
    hostPatterns: ['jazz.co'],
    linkPatterns: [/jazz\.co/i],
    scriptPatterns: [/jazz\.co/i],
    formPatterns: [/jazz/i],
    metaPatterns: [/jazz/i],
  },
  greenhouse_api: {
    hostPatterns: ['boards-api.greenhouse.io'],
    linkPatterns: [/boards-api\.greenhouse\.io/i],
    scriptPatterns: [],
    formPatterns: [],
    metaPatterns: [],
  },
}

function classifyLink(url) {
  if (!url) return null
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`)
    const host = parsed.hostname.toLowerCase()

    for (const [provider, sigs] of Object.entries(ATS_SIGNATURES)) {
      if (sigs.hostPatterns.some(p => host.includes(p))) {
        return { provider, method: 'host_match', url }
      }
    }

    for (const [provider, sigs] of Object.entries(ATS_SIGNATURES)) {
      if (sigs.linkPatterns.some(p => p.test(url))) {
        return { provider, method: 'link_pattern', url }
      }
    }
  } catch {}

  return null
}

function detectInHtml(html, pageUrl) {
  if (!html || typeof html !== 'string') return []

  const detections = []
  const domain = extractDomain(pageUrl)

  for (const [provider, sigs] of Object.entries(ATS_SIGNATURES)) {
    for (const pattern of sigs.scriptPatterns) {
      if (pattern.test(html)) {
        detections.push({ provider, method: 'script_pattern', confidence: 'high' })
        break
      }
    }

    for (const pattern of sigs.formPatterns) {
      if (pattern.test(html)) {
        detections.push({ provider, method: 'form_pattern', confidence: 'medium' })
        break
      }
    }

    for (const pattern of sigs.metaPatterns) {
      if (pattern.test(html)) {
        detections.push({ provider, method: 'meta_pattern', confidence: 'medium' })
        break
      }
    }
  }

  const linkRegex = /href=["']([^"']+)["']/gi
  let match
  while ((match = linkRegex.exec(html)) !== null) {
    const url = match[1]
    const detected = classifyLink(url)
    if (detected) {
      detections.push({ ...detected, confidence: 'high' })
    }
  }

  const scriptRegex = /src=["']([^"']+)["']/gi
  while ((match = scriptRegex.exec(html)) !== null) {
    const url = match[1]
    const detected = classifyLink(url)
    if (detected) {
      detections.push({ ...detected, confidence: 'high' })
    }
  }

  return detections
}

async function fetchPage(url, timeout = DISCOVERY_TIMEOUT) {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    })

    clearTimeout(timer)

    if (!response.ok) return { ok: false, status: response.status, html: null }

    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) {
      return { ok: true, status: response.status, html: null, contentType }
    }

    const html = await response.text()
    return { ok: true, status: response.status, html, finalUrl: response.url }
  } catch (err) {
    return { ok: false, status: 0, html: null, error: err.message }
  }
}

function findCareerLinks(html, baseUrl) {
  if (!html) return []

  const links = []
  const linkRegex = /href=["']([^"']+)["']/gi
  let match

  while ((match = linkRegex.exec(html)) !== null) {
    const href = match[1]
    const lower = href.toLowerCase()

    if (lower.includes('career') || lower.includes('job') || lower.includes('recruit') ||
        lower.includes('apply') || lower.includes('position') || lower.includes('opening') ||
        lower.includes('talent') || lower.includes('hiring')) {
      try {
        const absolute = new URL(href, baseUrl).href
        links.push(absolute)
      } catch {}
    }
  }

  return [...new Set(links)]
}

function findGreenhouseBoardLinks(html, baseUrl) {
  if (!html) return []
  const links = []
  const pattern = /https?:\/\/(?:boards|job-boards(?:\.[a-z]+)?)\.greenhouse\.io\/([a-zA-Z0-9_-]+)/gi
  let match
  while ((match = pattern.exec(html)) !== null) {
    try {
      const url = new URL(match[0]).href
      links.push({ url, slug: match[1] })
    } catch {}
  }
  return [...new Map(links.map(l => [l.slug, l])).values()]
}

function extractJobSearchUrls(html, baseUrl) {
  if (!html) return []

  const urls = []
  const patterns = [
    /https?:\/\/[^\s"']+job[^\s"']*/gi,
    /https?:\/\/[^\s"']+career[^\s"']*/gi,
    /https?:\/\/[^\s"']+recruit[^\s"']*/gi,
    /https?:\/\/[^\s"']+apply[^\s"']*/gi,
  ]

  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(html)) !== null) {
      try {
        const url = new URL(match[0]).href
        urls.push(url)
      } catch {}
    }
  }

  return [...new Set(urls)]
}

function dedupeDetections(detections) {
  const byProvider = new Map()

  for (const d of detections) {
    const existing = byProvider.get(d.provider)
    if (!existing) {
      byProvider.set(d.provider, d)
    } else {
      if (d.confidence === 'high' && existing.confidence !== 'high') {
        byProvider.set(d.provider, d)
      }
      if (d.method === 'host_match' && existing.method !== 'host_match') {
        byProvider.set(d.provider, d)
      }
    }
  }

  return [...byProvider.values()]
}

async function discoverFirmSource(firm, options = {}) {
  const { maxDepth = 2, timeout = DISCOVERY_TIMEOUT } = options
  const startTime = Date.now()

  const result = {
    firmId: firm.id,
    firmName: firm.name,
    careerUrl: firm.careersPage || null,
    discovered: [],
    detectionLog: [],
    durationMs: 0,
    error: null,
  }

  if (!result.careerUrl) {
    result.error = 'no_careers_page'
    result.durationMs = Date.now() - startTime
    return result
  }

  const visited = new Set()
  const queue = [{ url: result.careerUrl, depth: 0 }]

  while (queue.length > 0) {
    const { url, depth } = queue.shift()

    if (visited.has(url) || depth > maxDepth) continue
    visited.add(url)

    const page = await fetchPage(url, timeout)
    result.detectionLog.push({ url, status: page.status, ok: page.ok, depth })

    if (!page.ok || !page.html) continue

    const htmlDetections = detectInHtml(page.html, url)
    if (htmlDetections.length > 0) {
      const ghBoardLinks = findGreenhouseBoardLinks(page.html, url)
      for (const d of htmlDetections) {
        let sourceUrl = url
        if (d.provider === 'greenhouse' && ghBoardLinks.length > 0) {
          sourceUrl = ghBoardLinks[0].url
        }
        result.discovered.push({
          provider: d.provider,
          method: d.method,
          confidence: d.confidence,
          sourceUrl,
          detectedFromUrl: url,
          detectedAt: new Date().toISOString(),
        })
      }
    }

    if (depth < maxDepth) {
      const careerLinks = findCareerLinks(page.html, url)
      for (const link of careerLinks.slice(0, 10)) {
        if (!visited.has(link)) {
          queue.push({ url: link, depth: depth + 1 })
        }
      }

      const ghLinks = findGreenhouseBoardLinks(page.html, url)
      for (const ghLink of ghLinks) {
        if (!visited.has(ghLink.url)) {
          const existing = result.discovered.find(d => d.provider === 'greenhouse' && d.sourceUrl === ghLink.url)
          if (!existing) {
            result.discovered.push({
              provider: 'greenhouse',
              method: 'host_match',
              confidence: 'high',
              sourceUrl: ghLink.url,
              detectedFromUrl: ghLink.url,
              detectedAt: new Date().toISOString(),
            })
          }
        }
      }
    }
  }

  result.discovered = dedupeDetections(result.discovered)
  result.durationMs = Date.now() - startTime

  return result
}

function buildCareerSource(detection, firm) {
  const source = {
    provider: detection.provider,
    verified: detection.confidence === 'high',
    enabled: true,
    discoveredAt: detection.detectedAt || new Date().toISOString(),
    discoveryMethod: detection.method,
    sourceUrl: detection.sourceUrl || null,
    scope: 'unknown',
    companyId: null,
    tenant: null,
    boardSlug: null,
  }

  if (detection.provider === 'greenhouse' && detection.sourceUrl) {
    const match = detection.sourceUrl.match(/(?:boards|job-boards(?:\.[a-z]+)?)\.greenhouse\.io\/([^/?]+)/)
    if (match) {
      source.boardSlug = match[1]
      source.sourceUrl = detection.sourceUrl
    } else if (detection.detectedFromUrl) {
      const linkMatch = detection.detectedFromUrl.match(/(?:boards|job-boards(?:\.[a-z]+)?)\.greenhouse\.io\/([^/?]+)/)
      if (linkMatch) {
        source.boardSlug = linkMatch[1]
        source.sourceUrl = detection.detectedFromUrl
      }
    }
  }

  if (detection.provider === 'workday' && detection.sourceUrl) {
    const match = detection.sourceUrl.match(/wday\/cxs\/([^/]+)\/([^/]+)/)
    if (match) {
      source.tenant = match[1]
      source.companyId = match[2]
    }
  }

  if (detection.provider === 'smartrecruiters' && detection.sourceUrl) {
    const match = detection.sourceUrl.match(/companies\/([^/]+)/)
    if (match) source.companyId = match[1]
  }

  return source
}

async function discoverAllFirms(firms, options = {}) {
  const { concurrency = 3, maxDepth = 2 } = options
  const results = []
  const startTime = Date.now()

  for (let i = 0; i < firms.length; i += concurrency) {
    const batch = firms.slice(i, i + concurrency)
    const batchResults = await Promise.all(
      batch.map(firm => discoverFirmSource(firm, { maxDepth }))
    )
    results.push(...batchResults)
  }

  return {
    timestamp: new Date().toISOString(),
    totalFirms: firms.length,
    discovered: results.filter(r => r.discovered.length > 0).length,
    failed: results.filter(r => r.error).length,
    results,
    durationMs: Date.now() - startTime,
  }
}

export {
  discoverFirmSource,
  discoverAllFirms,
  buildCareerSource,
  classifyLink,
  detectInHtml,
  findCareerLinks,
  findGreenhouseBoardLinks,
  extractJobSearchUrls,
  fetchPage,
  ATS_SIGNATURES,
  DISCOVERY_TIMEOUT,
}
