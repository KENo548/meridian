/**
 * Phase 2.1 Step 2+4 — Careers Page Crawler
 *
 * Discovers official careers entry points and extracts ATS-related links.
 * Follows redirects, inspects HTML for ATS fingerprints.
 */

import { classify, classifyUrl } from './classifier.js'

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
const TIMEOUT_MS = 12000
const MAX_REDIRECTS = 5
const CONCURRENT_LIMIT = 3

// Known careers path patterns to try
const CAREERS_PATHS = [
  '/careers',
  '/career',
  '/jobs',
  '/join-us',
  '/opportunities',
  '/students',
  '/graduates',
  '/early-careers',
  '/working-students',
  '/werkstudenten',
  '/praktikum',
  '/internships',
]

// Student/early-career signal keywords
const STUDENT_KEYWORDS = [
  'student', 'graduate', 'intern', 'internship', 'spring week', 'insight',
  'university', 'campus', 'early career', 'working student', 'werkstudent',
  'praktikant', 'analyst program', 'analyst scheme', 'apprentice',
  'entry level', 'junior', 'new grad', 'recent graduate',
]

/**
 * Fetch a URL with redirect following and timeout.
 * Returns { finalUrl, status, headers, html, redirected, redirectChain }
 */
export async function fetchPage(url, options = {}) {
  const { maxRedirects = MAX_REDIRECTS, timeout = TIMEOUT_MS } = options
  const redirectChain = []
  let currentUrl = url
  let lastResponse = null

  for (let i = 0; i <= maxRedirects; i++) {
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeout)

      const response = await fetch(currentUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        signal: controller.signal,
        redirect: 'manual', // Handle redirects manually to track chain
      })

      clearTimeout(timer)
      lastResponse = response

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        if (!location) break

        const nextUrl = new URL(location, currentUrl).href
        redirectChain.push({ from: currentUrl, to: nextUrl, status: response.status })
        currentUrl = nextUrl
        continue
      }

      // Got a non-redirect response
      let html = ''
      if (response.ok) {
        const contentType = response.headers.get('content-type') || ''
        if (contentType.includes('text/html') || contentType.includes('xhtml')) {
          html = await response.text().catch(() => '')
        }
      }

      return {
        finalUrl: currentUrl,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        html,
        redirected: redirectChain.length > 0,
        redirectChain,
        ok: response.ok,
      }
    } catch (err) {
      if (err.name === 'AbortError' || err.name === 'TimeoutError') {
        return {
          finalUrl: currentUrl,
          status: 0,
          headers: {},
          html: '',
          redirected: redirectChain.length > 0,
          redirectChain,
          ok: false,
          error: `Timeout after ${timeout}ms`,
        }
      }
      return {
        finalUrl: currentUrl,
        status: 0,
        headers: {},
        html: '',
        redirected: redirectChain.length > 0,
        redirectChain,
        ok: false,
        error: err.message,
      }
    }
  }

  return {
    finalUrl: currentUrl,
    status: lastResponse?.status || 0,
    headers: lastResponse ? Object.fromEntries(lastResponse.headers.entries()) : {},
    html: '',
    redirected: redirectChain.length > 0,
    redirectChain,
    ok: false,
    error: 'Too many redirects',
  }
}

/**
 * Extract all links from HTML content.
 * Returns array of { url, text, isCareersRelated, isStudentRelated }
 */
export function extractLinks(html, baseUrl) {
  const links = []
  const seen = new Set()

  // Extract anchor hrefs
  const anchorPattern = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match
  while ((match = anchorPattern.exec(html)) !== null) {
    const href = match[1]
    const text = match[2].replace(/<[^>]+>/g, '').trim()

    try {
      const absoluteUrl = new URL(href, baseUrl).href
      if (seen.has(absoluteUrl)) continue
      seen.add(absoluteUrl)

      const lowerUrl = absoluteUrl.toLowerCase()
      const lowerText = text.toLowerCase()

      links.push({
        url: absoluteUrl,
        text,
        isCareersRelated: CAREERS_PATHS.some(p => lowerUrl.includes(p)) ||
          /career|job|position|opportunity|vacancy|opening|recruit/i.test(text),
        isStudentRelated: STUDENT_KEYWORDS.some(k => lowerUrl.includes(k) || lowerText.includes(k)),
      })
    } catch {
      // Invalid URL, skip
    }
  }

  return links
}

/**
 * Check if a URL is a student/early-career relevant careers page.
 */
export function isStudentRelevant(url, text = '') {
  const combined = `${url} ${text}`.toLowerCase()
  return STUDENT_KEYWORDS.some(k => combined.includes(k))
}

/**
 * Discover careers pages for a company.
 *
 * Strategy:
 * 1. Try known careersUrl from registry
 * 2. Try common careers paths on the domain
 * 3. Extract links from each page
 * 4. Classify found URLs for ATS fingerprints
 *
 * Returns { careersPages, atsSources, redirects, errors }
 */
export async function discoverCareersPages(domain, knownCareersUrl) {
  const result = {
    careersPages: [],
    atsSources: [],
    redirects: [],
    errors: [],
    studentPages: [],
  }

  // Step 1: Try known careers URL
  if (knownCareersUrl) {
    const page = await fetchPage(knownCareersUrl)
    result.redirects.push(...page.redirectChain)

    if (page.ok) {
      const classified = classify(knownCareersUrl, page.html)
      result.careersPages.push({
        url: page.finalUrl,
        originalUrl: knownCareersUrl,
        status: page.status,
        isKnown: true,
        redirected: page.redirected,
      })

      for (const c of classified) {
        result.atsSources.push(c)
      }

      // Extract links from the page
      const links = extractLinks(page.html, page.finalUrl)
      for (const link of links) {
        if (link.isCareersRelated || link.isStudentRelated) {
          const linkClassified = classifyUrl(link.url)
          if (linkClassified.length > 0) {
            for (const c of linkClassified) {
              c.evidence.push(`Found link on careers page: "${link.text}" -> ${link.url}`)
              result.atsSources.push(c)
            }
          }

          if (link.isStudentRelated) {
            result.studentPages.push({
              url: link.url,
              text: link.text,
              atsDetected: linkClassified.length > 0 ? linkClassified[0].provider : null,
            })
          }
        }
      }
    } else {
      result.errors.push({ url: knownCareersUrl, status: page.status, error: page.error })
    }
  }

  // Step 2: Try common careers paths (only if known URL failed or to discover additional pages)
  const baseUrl = knownCareersUrl ? new URL(knownCareersUrl).origin : `https://${domain}`

  for (const path of CAREERS_PATHS) {
    const testUrl = `${baseUrl}${path}`

    // Skip if we already have this URL
    if (result.careersPages.some(p => p.url === testUrl || p.originalUrl === testUrl)) continue

    const page = await fetchPage(testUrl)
    result.redirects.push(...page.redirectChain)

    if (page.ok && page.status === 200) {
      const classified = classify(page.finalUrl, page.html)
      result.careersPages.push({
        url: page.finalUrl,
        originalUrl: testUrl,
        status: page.status,
        isKnown: false,
        redirected: page.redirected,
      })

      for (const c of classified) {
        result.atsSources.push(c)
      }

      // Extract links
      const links = extractLinks(page.html, page.finalUrl)
      for (const link of links) {
        if (link.isCareersRelated || link.isStudentRelated) {
          const linkClassified = classifyUrl(link.url)
          if (linkClassified.length > 0) {
            for (const c of linkClassified) {
              c.evidence.push(`Found link on ${path}: "${link.text}" -> ${link.url}`)
              result.atsSources.push(c)
            }
          }

          if (link.isStudentRelated) {
            result.studentPages.push({
              url: link.url,
              text: link.text,
              atsDetected: linkClassified.length > 0 ? linkClassified[0].provider : null,
            })
          }
        }
      }
    } else if (page.status === 0 && page.error) {
      result.errors.push({ url: testUrl, status: 0, error: page.error })
    }
    // Don't log 404s — they're expected for most paths
  }

  // Deduplicate ATS sources by provider + url
  const seenSources = new Set()
  result.atsSources = result.atsSources.filter(s => {
    const key = `${s.provider}:${s.url || 'html'}`
    if (seenSources.has(key)) return false
    seenSources.add(key)
    return true
  })

  return result
}
