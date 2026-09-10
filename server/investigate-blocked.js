import https from 'https'
import http from 'http'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

// ── Firm configurations from registry ────────────────────────────────────────
const FIRMS = [
  {
    id: 'bank-of-america',
    name: 'Bank of America',
    provider: 'workday',
    careersUrl: 'https://ghr.wd1.myworkdayjobs.com/Bank_of_America_Careers',
    atsSlug: 'bankofamerica.wd1.myworkdayjobs.com',
    tenant: 'bankofamerica',
    site: 'Bank_of_America_Careers',
    wdVersion: 'wd1',
    knownIssue: '422 Cloudflare',
  },
  {
    id: 'citi',
    name: 'Citi',
    provider: 'workday',
    careersUrl: 'https://citi.wd5.myworkdayjobs.com/citi',
    atsSlug: 'citi.wd5.myworkdayjobs.com',
    tenant: 'citi',
    site: 'citi',
    wdVersion: 'wd5',
    knownIssue: '404 site changed',
  },
  {
    id: 'barclays',
    name: 'Barclays',
    provider: 'workday',
    careersUrl: 'https://barclays.wd3.myworkdayjobs.com/barclays',
    atsSlug: 'barclays.wd3.myworkdayjobs.com',
    tenant: 'barclays',
    site: 'barclays',
    wdVersion: 'wd3',
    knownIssue: '404 site changed',
  },
  {
    id: 'lazard',
    name: 'Lazard',
    provider: 'oleeo_rss',
    careersUrl: 'https://lazard-careers.tal.net/vx/lang-en-GB/mobile-0/appcentre1/brand-3/emp-1/Home',
    oleeoRssUrl: 'https://lazard-careers.tal.net/vx/mobile-0/appcentre-ext/brand-3/candidate/jobboard/vacancy/2/feed',
    knownIssue: 'RSS 0 jobs',
  },
  {
    id: 'rothschild',
    name: 'Rothschild & Co',
    provider: 'workday',
    careersUrl: 'https://rothschild.wd3.myworkdayjobs.com/rothschildandco',
    atsSlug: 'rothschild.wd3.myworkdayjobs.com',
    tenant: 'rothschild',
    site: 'rothschildandco',
    wdVersion: 'wd3',
    knownIssue: '422 Cloudflare',
  },
  {
    id: 'houlihan-lokey',
    name: 'Houlihan Lokey',
    provider: 'workday',
    careersUrl: 'https://houlihanlokey.wd1.myworkdayjobs.com/houlihanlokey',
    atsSlug: 'houlihanlokey.wd1.myworkdayjobs.com',
    tenant: 'houlihanlokey',
    site: 'houlihanlokey',
    wdVersion: 'wd1',
    knownIssue: '422 Cloudflare',
  },
  {
    id: 'apollo',
    name: 'Apollo Global Management',
    provider: 'workday',
    careersUrl: 'https://apollo.wd1.myworkdayjobs.com/apollo',
    atsSlug: 'apollo.wd1.myworkdayjobs.com',
    tenant: 'apollo',
    site: 'apollo',
    wdVersion: 'wd1',
    knownIssue: '422 Cloudflare',
  },
]

// ── HTTP helpers ─────────────────────────────────────────────────────────────
function fetchUrl(url, opts = {}) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http
    const req = mod.request(url, {
      method: opts.method || 'GET',
      headers: {
        'User-Agent': UA,
        'Accept': opts.accept || '*/*',
        ...(opts.headers || {}),
      },
      timeout: 12000,
    }, (res) => {
      // Follow redirects manually (up to 5)
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const redirectUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : new URL(res.headers.location, url).href
        resolve(fetchUrl(redirectUrl, opts))
        return
      }
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8'),
          finalUrl: url,
        })
      })
    })
    req.on('error', (e) => resolve({ status: 0, error: e.message, body: '', finalUrl: url }))
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, error: 'TIMEOUT', body: '', finalUrl: url }) })
    req.end()
  })
}

function postWorkdayApi(host, tenant, site, body = {}) {
  const url = `https://${host}/wday/cxs/${tenant}/${site}/jobs`
  return fetchUrl(url, {
    method: 'POST',
    accept: 'application/json',
    headers: {
      'Content-Type': 'application/json',
      'Referer': `https://${host}/`,
      'Origin': `https://${host}`,
    },
    body: JSON.stringify({
      appliedFacets: {},
      limit: 5,
      offset: 0,
      searchText: '',
      ...body,
    }),
  })
}

// ── Investigation functions ──────────────────────────────────────────────────

async function investigateWorkdayFirm(firm) {
  const results = {
    firm: firm.name,
    provider: firm.provider,
    config: {
      careersUrl: firm.careersUrl,
      atsSlug: firm.atsSlug,
      tenant: firm.tenant,
      site: firm.site,
      wdVersion: firm.wdVersion,
    },
    tests: [],
    verdict: null,
    action: null,
    findings: [],
  }

  // Test 1: Current configured API endpoint
  const currentApi = await postWorkdayApi(firm.atsSlug, firm.tenant, firm.site)
  results.tests.push({
    label: `Current API: ${firm.atsSlug} /wday/cxs/${firm.tenant}/${firm.site}/jobs`,
    status: currentApi.status,
    error: currentApi.error || null,
    bodySnippet: currentApi.body.substring(0, 300),
  })

  // Test 2: Careers page (browser fetch)
  const careersPage = await fetchUrl(firm.careersUrl, { accept: 'text/html' })
  results.tests.push({
    label: `Careers page: ${firm.careersUrl}`,
    status: careersPage.status,
    error: careersPage.error || null,
    bodySnippet: careersPage.body.substring(0, 500),
    hasWorkdayInBody: /workday|myworkdayjobs|wday/i.test(careersPage.body),
    hasCloudflare: /cloudflare|cf-ray|__cf_bm/i.test(careersPage.body),
    hasIframe: /<iframe[^>]+src=["']([^"']+)["']/i.exec(careersPage.body)?.[1] || null,
  })

  // Test 3: Alternative tenant names on different wd versions
  const altTenants = [
    firm.tenant.replace(/[^a-z0-9]/gi, ''),
    firm.tenant.replace(/[^a-z0-9]/gi, '') + 'careers',
    firm.tenant + '_careers',
    firm.tenant.replace(/\s+/g, ''),
  ]

  for (const altTenant of altTenants) {
    for (const wd of ['wd1', 'wd3', 'wd5']) {
      if (wd === firm.wdVersion && altTenant === firm.tenant) continue // skip current
      const altHost = `${altTenant}.${wd}.myworkdayjobs.com`
      const altApi = await postWorkdayApi(altHost, altTenant, firm.site)
      results.tests.push({
        label: `Alt tenant: ${altHost} / ${firm.site}`,
        status: altApi.status,
        error: altApi.error || null,
        bodySnippet: altApi.body.substring(0, 200),
      })
      if (altApi.status === 200) {
        results.findings.push(`FOUND WORKING: ${altHost} with site "${firm.site}"`)
      }
    }
  }

  // Test 4: Try common site name variants
  const siteVariants = [
    firm.site,
    firm.site.toLowerCase(),
    firm.site.toUpperCase(),
    firm.site.replace(/_/g, '-'),
    firm.site.replace(/_/g, ''),
    firm.site.replace(/[^a-zA-Z0-9]/g, '_'),
    'External',
    'All_Locations',
    'Search_Opportunities',
    'Careers',
    firm.tenant + '_careers',
    firm.tenant + '_external',
    firm.tenant + '_professional',
  ]

  const uniqueSites = [...new Set(siteVariants)]
  for (const siteName of uniqueSites) {
    if (siteName === firm.site) continue
    const siteApi = await postWorkdayApi(firm.atsSlug, firm.tenant, siteName)
    results.tests.push({
      label: `Alt site: ${firm.atsSlug} / ${siteName}`,
      status: siteApi.status,
      error: siteApi.error || null,
      bodySnippet: siteApi.body.substring(0, 200),
    })
    if (siteApi.status === 200) {
      const data = JSON.parse(siteApi.body)
      if (data.total > 0) {
        results.findings.push(`FOUND WORKING site: "${siteName}" with ${data.total} jobs`)
      }
    }
  }

  // Test 5: Try different wd versions for current tenant+site
  for (const wd of ['wd1', 'wd3', 'wd5', 'wd11', 'wd12', 'wd14', 'wd16', 'wd17', 'wd19', 'wd21', 'wd24', 'wd25']) {
    if (wd === firm.wdVersion) continue
    const altHost = `${firm.tenant}.${wd}.myworkdayjobs.com`
    const altApi = await postWorkdayApi(altHost, firm.tenant, firm.site)
    results.tests.push({
      label: `Alt wd version: ${altHost} / ${firm.site}`,
      status: altApi.status,
      error: altApi.error || null,
      bodySnippet: altApi.body.substring(0, 200),
    })
    if (altApi.status === 200) {
      const data = JSON.parse(altApi.body)
      if (data.total > 0) {
        results.findings.push(`FOUND WORKING: ${altHost} with ${data.total} jobs`)
      }
    }
  }

  // Analyze results
  const hasWorking = results.tests.some(t => t.status === 200 && !t.error)
  const allBlocked = results.tests.every(t => t.status === 422 || t.status === 404 || t.status === 0 || t.error)
  const hasCloudflare = results.tests.some(t => t.bodySnippet?.includes('cloudflare') || t.bodySnippet?.includes('cf-ray'))

  if (results.findings.length > 0) {
    results.verdict = 'ALTERNATIVE_FOUND'
    results.action = 'RECOVER'
  } else if (hasCloudflare && allBlocked) {
    results.verdict = 'BLOCKED_PERMANENT'
    results.action = 'DISABLE'
  } else if (allBlocked) {
    results.verdict = 'BLOCKED_PERMANENT'
    results.action = 'DISABLE'
  } else {
    results.verdict = 'BLOCKED_TEMPORARY'
    results.action = 'LEAVE_AS_IS'
  }

  return results
}

async function investigateLazard(firm) {
  const results = {
    firm: firm.name,
    provider: firm.provider,
    config: {
      careersUrl: firm.careersUrl,
      oleeoRssUrl: firm.oleeoRssUrl,
    },
    tests: [],
    verdict: null,
    action: null,
    findings: [],
  }

  // Test 1: Current RSS feed
  const rssFeed = await fetchUrl(firm.oleeoRssUrl, { accept: 'application/rss+xml, application/xml, text/xml' })
  results.tests.push({
    label: `Current RSS: ${firm.oleeoRssUrl}`,
    status: rssFeed.status,
    error: rssFeed.error || null,
    bodySnippet: rssFeed.body.substring(0, 500),
    hasItems: /<item>/i.test(rssFeed.body),
    itemCount: (rssFeed.body.match(/<item>/gi) || []).length,
  })

  // Test 2: Oleeo career page
  const oleeoPage = await fetchUrl(firm.careersUrl, { accept: 'text/html' })
  results.tests.push({
    label: `Oleeo page: ${firm.careersUrl}`,
    status: oleeoPage.status,
    error: oleeoPage.error || null,
    bodySnippet: oleeoPage.body.substring(0, 500),
    hasWorkday: /workday|myworkdayjobs/i.test(oleeoPage.body),
    hasOracle: /oracle|oraclecloud/i.test(oleeoPage.body),
    hasGreenhouse: /greenhouse/i.test(oleeoPage.body),
    hasLever: /lever/i.test(oleeoPage.body),
  })

  // Test 3: Check if Lazard has an Oracle HCM board (noted in registry)
  const oracleUrls = [
    'https://icbpjb.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/jobs',
    'https://icbpjb.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_2/jobs',
    'https://icbpjb.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience',
  ]
  for (const url of oracleUrls) {
    const resp = await fetchUrl(url, { accept: 'text/html' })
    results.tests.push({
      label: `Oracle HCM: ${url}`,
      status: resp.status,
      error: resp.error || null,
      bodySnippet: resp.body.substring(0, 300),
    })
  }

  // Test 4: Check main lazard.com careers page
  const mainCareers = await fetchUrl('https://www.lazard.com/careers/', { accept: 'text/html' })
  results.tests.push({
    label: 'Main careers: https://www.lazard.com/careers/',
    status: mainCareers.status,
    error: mainCareers.error || null,
    bodySnippet: mainCareers.body.substring(0, 500),
    links: [...new Set([...mainCareers.body.matchAll(/href=["']([^"']*career[^"']*)/gi)].map(m => m[1]))].slice(0, 10),
  })

  // Test 5: Try alternate Oleeo brand IDs
  for (const brand of [2, 3, 4, 5, 1]) {
    const altRss = `https://lazard-careers.tal.net/vx/mobile-0/appcentre-ext/brand-${brand}/candidate/jobboard/vacancy/2/feed`
    const resp = await fetchUrl(altRss, { accept: 'application/rss+xml, text/xml, */*' })
    results.tests.push({
      label: `Oleeo brand-${brand} RSS`,
      status: resp.status,
      error: resp.error || null,
      bodySnippet: resp.body.substring(0, 200),
      itemCount: (resp.body.match(/<item>/gi) || []).length,
    })
    if ((resp.body.match(/<item>/gi) || []).length > 0) {
      results.findings.push(`FOUND WORKING: brand-${brand} RSS with ${(resp.body.match(/<item>/gi) || []).length} items`)
    }
  }

  // Analyze
  const hasWorking = results.findings.length > 0
  if (hasWorking) {
    results.verdict = 'ALTERNATIVE_FOUND'
    results.action = 'RECOVER'
  } else {
    results.verdict = 'BLOCKED_PERMANENT'
    results.action = 'DISABLE'
  }

  return results
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════════════════════')
  console.log('  MERIDIAN BLOCKED FIRMS INVESTIGATION')
  console.log('  ' + new Date().toISOString())
  console.log('═══════════════════════════════════════════════════════════════════\n')

  const allResults = []

  for (const firm of FIRMS) {
    console.log(`\n▶ Investigating: ${firm.name} (${firm.knownIssue})`)
    console.log('─'.repeat(60))

    let result
    if (firm.id === 'lazard') {
      result = await investigateLazard(firm)
    } else {
      result = await investigateWorkdayFirm(firm)
    }

    allResults.push(result)

    // Print summary
    console.log(`  Verdict: ${result.verdict}`)
    console.log(`  Action:  ${result.action}`)
    if (result.findings.length > 0) {
      console.log(`  Findings:`)
      result.findings.forEach(f => console.log(`    ✓ ${f}`))
    }

    const passed = result.tests.filter(t => t.status === 200).length
    const failed = result.tests.filter(t => t.status !== 200).length
    console.log(`  Tests: ${passed} passed, ${failed} failed`)
  }

  // Final report
  console.log('\n\n═══════════════════════════════════════════════════════════════════')
  console.log('  FINAL REPORT')
  console.log('═══════════════════════════════════════════════════════════════════\n')

  for (const r of allResults) {
    const icon = r.verdict === 'ALTERNATIVE_FOUND' ? '🟢' : r.verdict === 'BLOCKED_TEMPORARY' ? '🟡' : '🔴'
    console.log(`${icon} ${r.firm}`)
    console.log(`   Verdict: ${r.verdict}`)
    console.log(`   Action:  ${r.action}`)
    if (r.findings.length > 0) {
      r.findings.forEach(f => console.log(`   → ${f}`))
    }
    console.log('')
  }

  // Write JSON results
  const fs = await import('fs')
  fs.writeFileSync(
    new URL('./investigate-blocked-results.json', import.meta.url),
    JSON.stringify(allResults, null, 2)
  )
  console.log('Results written to investigate-blocked-results.json')
}

main().catch(e => { console.error(e); process.exit(1) })
