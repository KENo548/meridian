// test-custom-firms.js — Investigate 5 enabled "custom" firms returning 0 jobs
// Usage: node test-custom-firms.js

const TARGETS = [
  {
    id: 'da-vinci-trading',
    name: 'Da Vinci Trading',
    careersUrl: null,
    provider: 'custom',
  },
  {
    id: 'maven-securities',
    name: 'Maven Securities',
    careersUrl: 'https://www.mavensecurities.com/careers',
    provider: 'custom',
  },
  {
    id: 'bain',
    name: 'Bain & Company',
    careersUrl: 'https://www.bain.com/careers',
    provider: 'custom',
  },
  {
    id: 'kpmg',
    name: 'KPMG',
    careersUrl: 'https://jobs.kpmg.com',
    provider: 'custom',
  },
  {
    id: 'cd-r',
    name: 'Clayton, Dubilier & Rice',
    careersUrl: 'https://www.cdr.com/careers',
    provider: 'custom',
  },
]

const ATS_FINGERPRINTS = {
  greenhouse: [
    /boards\.greenhouse\.io/i,
    /greenhouse\.io/i,
    /greenhouse-client/i,
    /data-greenhouse/i,
  ],
  lever: [
    /jobs\.lever\.co/i,
    /lever\.co/i,
    /leverjobs/i,
  ],
  workday: [
    /myworkdayjobs\.com/i,
    /workday/i,
    /wday\.com/i,
  ],
  icims: [
    /icims\.com/i,
    /icims/i,
  ],
  taleo: [
    /taleo\.net/i,
    /oracle\.com\/taleo/i,
  ],
  smartrecruiters: [
    /smartrecruiters\.com/i,
  ],
  successfactors: [
    /successfactors/i,
    /sap\.com.*recruiting/i,
  ],
  ashby: [
    /ashbyhq\.com/i,
    /jobs\.ashbyhq\.com/i,
  ],
  beamer: [
    /career.*portal.*custom/i,
  ],
  eightfold: [
    /eightfold\.ai/i,
  ],
  avature: [
    /avature\.net/i,
    /avature\.com/i,
  ],
  oleeo: [
    /oleeo\.com/i,
    /tal\.net/i,
  ],
}

function detectAts(html) {
  const detected = []
  for (const [name, patterns] of Object.entries(ATS_FINGERPRINTS)) {
    for (const pat of patterns) {
      if (pat.test(html)) {
        detected.push(name)
        break
      }
    }
  }
  return detected
}

async function probeFirm(target) {
  console.log(`\n${'='.repeat(70)}`)
  console.log(`PROBING: ${target.name}`)
  console.log(`${'='.repeat(70)}`)

  if (!target.careersUrl) {
    console.log('  careersUrl: null (NO URL CONFIGURED)')
    return {
      name: target.name,
      provider: target.provider,
      careersUrl: null,
      httpStatus: null,
      redirectChain: [],
      htmlLength: 0,
      atsDetected: [],
      verdict: 'BAD_CONFIGURATION',
      reason: 'careersUrl is null — firm is enabled but has no URL to scrape',
      action: 'Either set a valid careersUrl or disable this firm',
    }
  }

  console.log(`  careersUrl: ${target.careersUrl}`)

  const redirectChain = []
  let finalUrl = target.careersUrl
  let html = ''
  let httpStatus = null

  try {
    // First request — follow redirects manually to build the chain
    let currentUrl = target.careersUrl
    const maxRedirects = 10
    let hops = 0

    while (hops < maxRedirects) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)

      const resp = await fetch(currentUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        redirect: 'manual',
      })

      clearTimeout(timeout)
      httpStatus = resp.status

      if ([301, 302, 303, 307, 308].includes(resp.status)) {
        const location = resp.headers.get('location')
        if (location) {
          const resolvedUrl = new URL(location, currentUrl).href
          redirectChain.push({ from: currentUrl, status: resp.status, to: resolvedUrl })
          console.log(`  REDIRECT ${resp.status} -> ${resolvedUrl}`)
          currentUrl = resolvedUrl
          finalUrl = resolvedUrl
          hops++
          continue
        }
      }

      // Final response — read body
      html = await resp.text()
      finalUrl = currentUrl
      break
    }

    console.log(`  HTTP Status: ${httpStatus}`)
    console.log(`  Final URL: ${finalUrl}`)
    console.log(`  HTML length: ${html.length} chars`)

    if (redirectChain.length > 0) {
      console.log(`  Redirect chain: ${redirectChain.length} hops`)
    }

    // Detect ATS fingerprints in HTML
    const ats = detectAts(html)
    if (ats.length > 0) {
      console.log(`  ATS DETECTED: ${ats.join(', ')}`)
    } else {
      console.log('  ATS DETECTED: none found')
    }

    // Check for job listings indicators
    const hasJobs = /job|opening|position|vacancy|opportunity|requisition/i.test(html)
    const noResults = /no results|no jobs found|no matching|0 results/i.test(html)

    console.log(`  Contains job-related keywords: ${hasJobs}`)
    console.log(`  Contains "no results" indicator: ${noResults}`)

    // Determine verdict
    let verdict = 'REAL_CUSTOM'
    let reason = ''
    let action = ''

    if (ats.length > 0) {
      verdict = 'KNOWN_ATS'
      reason = `HTML contains ${ats.join('/')} fingerprints but configured as 'custom' provider`
      action = `Add a proper adapter for ${ats[0]} or update careersProvider to '${ats[0]}'`
    } else if (httpStatus === 403) {
      verdict = 'ACCESS_RESTRICTED'
      reason = 'HTTP 403 — access forbidden (likely anti-bot protection)'
      action = 'Check if the site requires cookies, auth, or anti-bot bypass'
    } else if (httpStatus === 401 || httpStatus === 407) {
      verdict = 'ACCESS_RESTRICTED'
      reason = `HTTP ${httpStatus} — authentication required`
      action = 'This careers portal requires login — cannot scrape publicly'
    } else if (httpStatus === 429) {
      verdict = 'ACCESS_RESTRICTED'
      reason = 'HTTP 429 — rate limited'
      action = 'Retry with backoff or different IP'
    } else if (httpStatus && httpStatus >= 400) {
      verdict = 'BAD_CONFIGURATION'
      reason = `HTTP ${httpStatus} error`
      action = 'Verify the URL is correct and the site is live'
    } else if (!hasJobs) {
      verdict = 'NO_PUBLIC_JOBS'
      reason = 'Page loads but contains no job-related content'
      action = 'The site may use JS-heavy rendering — try headless browser or check if jobs are behind auth'
    } else if (ats.length === 0 && hasJobs) {
      verdict = 'REAL_CUSTOM'
      reason = 'Custom careers page with jobs but no known ATS detected'
      action = 'Write a custom scraper for this site'
    }

    return {
      name: target.name,
      provider: target.provider,
      careersUrl: target.careersUrl,
      httpStatus,
      redirectChain,
      finalUrl,
      htmlLength: html.length,
      atsDetected: ats,
      hasJobKeywords: hasJobs,
      noResultsIndicator: noResults,
      verdict,
      reason,
      action,
    }
  } catch (err) {
    const isAbort = err.name === 'AbortError'
    console.log(`  ERROR: ${isAbort ? 'TIMEOUT (15s)' : err.message}`)

    return {
      name: target.name,
      provider: target.provider,
      careersUrl: target.careersUrl,
      httpStatus: null,
      redirectChain,
      finalUrl,
      htmlLength: 0,
      atsDetected: [],
      verdict: 'BAD_CONFIGURATION',
      reason: isAbort ? 'Request timed out after 15s' : `Fetch failed: ${err.message}`,
      action: isAbort ? 'Site may be slow or blocking — test manually' : 'Verify URL is correct',
      error: err.message,
    }
  }
}

async function main() {
  console.log('Meridian Custom Firm Investigator')
  console.log(`Probing ${TARGETS.length} enabled firms with careersProvider = 'custom' and 0 jobs\n`)

  const results = []
  for (const target of TARGETS) {
    const result = await probeFirm(target)
    results.push(result)
  }

  // Print summary table
  console.log(`\n\n${'='.repeat(70)}`)
  console.log('SUMMARY')
  console.log(`${'='.repeat(70)}`)
  console.table(results.map(r => ({
    Firm: r.name,
    Provider: r.provider,
    'URL Set?': r.careersUrl ? 'Yes' : 'NO',
    'HTTP Status': r.httpStatus || 'N/A',
    'ATS Detected': r.atsDetected.length > 0 ? r.atsDetected.join(', ') : 'none',
    Verdict: r.verdict,
  })))

  console.log('\nDETAILED RESULTS:')
  for (const r of results) {
    console.log(`\n--- ${r.name} ---`)
    console.log(`  Provider:     ${r.provider}`)
    console.log(`  Careers URL:  ${r.careersUrl || 'null'}`)
    console.log(`  HTTP Status:  ${r.httpStatus || 'N/A'}`)
    if (r.redirectChain.length > 0) {
      console.log(`  Redirects:`)
      for (const red of r.redirectChain) {
        console.log(`    ${red.status} ${red.from} -> ${red.to}`)
      }
    }
    console.log(`  Final URL:    ${r.finalUrl || r.careersUrl || 'null'}`)
    console.log(`  HTML length:  ${r.htmlLength}`)
    console.log(`  ATS:          ${r.atsDetected.length > 0 ? r.atsDetected.join(', ') : 'none'}`)
    console.log(`  Verdict:      ${r.verdict}`)
    console.log(`  Reason:       ${r.reason}`)
    console.log(`  Action:       ${r.action}`)
  }
}

main().catch(console.error)
