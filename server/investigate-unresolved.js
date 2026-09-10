import https from 'https'
import http from 'http'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

const FIRMS = [
  { id: 'ubs', name: 'UBS', knownIssue: '24 student pages no ATS' },
  { id: 'deutsche-bank', name: 'Deutsche Bank', knownIssue: '17 student pages' },
  { id: 'interpath', name: 'Interpath Advisory', knownIssue: 'Workable redirects to /oops' },
  { id: 'rede-partners', name: 'Rede Partners', knownIssue: 'minimal web presence' },
  { id: 'kkr', name: 'KKR', knownIssue: 'Greenhouse detected but no board token' },
  { id: 'centerview', name: 'Centerview Partners', knownIssue: 'no careers source found' },
  { id: 'nomura', name: 'Nomura', knownIssue: 'no careers source found' },
  { id: 'macquarie', name: 'Macquarie Group', knownIssue: 'no careers source found' },
  { id: 'd-e-shaw', name: 'D. E. Shaw', knownIssue: 'no careers source found' },
  { id: 'millennium', name: 'Millennium Management', knownIssue: 'no careers source found (Eightfold detected)' },
  { id: 'squarepoint', name: 'Squarepoint Capital', knownIssue: 'no careers source found' },
  { id: 'balyasny', name: 'Balyasny Asset Management', knownIssue: 'no careers source found' },
  { id: 'man-group', name: 'Man Group', knownIssue: 'no careers source found' },
  { id: 'brevan-howard', name: 'Brevan Howard', knownIssue: 'no careers source found' },
]

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

function detectATS(body) {
  const detections = []
  const patterns = [
    { name: 'greenhouse', regex: /greenhouse|boards\.greenhouse\.io/i },
    { name: 'lever', regex: /lever\.co|jobs\.lever\.co/i },
    { name: 'workday', regex: /workday|myworkdayjobs/i },
    { name: 'smartrecruiters', regex: /smartrecruiters/i },
    { name: 'ashby', regex: /ashby|ashbyhq/i },
    { name: 'eightfold', regex: /eightfold/i },
    { name: 'oracle_hcm', regex: /oracle.*hcm|oraclecloud/i },
    { name: 'successfactors', regex: /successfactors|sapsf/i },
    { name: 'icims', regex: /icims/i },
    { name: 'avature', regex: /avature/i },
    { name: 'taleo', regex: /taleo/i },
    { name: 'workable', regex: /workable/i },
    { name: 'teamtailor', regex: /teamtailor/i },
  ]
  
  for (const p of patterns) {
    if (p.regex.test(body)) {
      detections.push(p.name)
    }
  }
  return detections
}

async function investigate(firm) {
  console.log(`\n▶ ${firm.name} — ${firm.knownIssue}`)
  console.log('─'.repeat(50))
  
  const result = {
    firm: firm.name,
    knownIssue: firm.knownIssue,
    tests: [],
    atsDetected: [],
    verdict: null,
    action: null,
    findings: [],
  }
  
  // Test 1: Try common careers URLs
  const careersUrls = [
    `https://www.${firm.id.replace(/-/g, '')}.com/careers`,
    `https://www.${firm.id.replace(/-/g, '')}.com/careers/`,
    `https://careers.${firm.id.replace(/-/g, '')}.com`,
    `https://${firm.id.replace(/-/g, '')}.com/careers`,
  ]
  
  for (const url of careersUrls) {
    const resp = await fetchUrl(url, { accept: 'text/html' })
    if (resp.status === 200) {
      result.tests.push({ url, status: resp.status, finalUrl: resp.finalUrl })
      const ats = detectATS(resp.body)
      if (ats.length > 0) {
        result.atsDetected.push(...ats)
        result.findings.push(`ATS detected: ${ats.join(', ')} at ${url}`)
      }
      
      // Check for Greenhouse board in page source
      const ghMatch = resp.body.match(/boards\.greenhouse\.io\/([a-zA-Z0-9_-]+)/)
      if (ghMatch) {
        result.findings.push(`Greenhouse board: ${ghMatch[1]}`)
      }
      
      // Check for job listings
      const jobCount = (resp.body.match(/job|position|opening|vacancy/gi) || []).length
      if (jobCount > 5) {
        result.findings.push(`Job-related keywords found: ${jobCount}`)
      }
    }
  }
  
  // Test 2: Try Greenhouse boards
  const ghBoards = [
    `https://boards.greenhouse.io/${firm.id.replace(/-/g, '')}`,
    `https://boards.greenhouse.io/${firm.id.replace(/-/g, '')}group`,
    `https://boards.greenhouse.io/${firm.id.replace(/-/g, '')}inc`,
    `https://boards.greenhouse.io/${firm.id.replace(/-/g, '')}llc`,
  ]
  
  for (const url of ghBoards) {
    const resp = await fetchUrl(url, { accept: 'text/html' })
    if (resp.status === 200 && resp.body.includes('greenhouse')) {
      result.tests.push({ url, status: resp.status })
      const boardMatch = resp.body.match(/boards\.greenhouse\.io\/([a-zA-Z0-9_-]+)/)
      if (boardMatch) {
        result.findings.push(`Greenhouse board found: ${boardMatch[1]}`)
      }
    }
  }
  
  // Test 3: Try Lever boards
  const leverBoards = [
    `https://jobs.lever.co/${firm.id.replace(/-/g, '')}`,
    `https://jobs.lever.co/${firm.id.replace(/-/g, '').replace('management', '')}`,
  ]
  
  for (const url of leverBoards) {
    const resp = await fetchUrl(url, { accept: 'text/html' })
    if (resp.status === 200 && resp.body.includes('lever')) {
      result.tests.push({ url, status: resp.status })
      result.findings.push(`Lever board found: ${url}`)
    }
  }
  
  // Determine verdict
  if (result.findings.length > 0) {
    result.verdict = 'RESOLVED'
    result.action = 'ADD_SOURCE'
  } else if (result.tests.some(t => t.status === 200)) {
    result.verdict = 'UNRESOLVED'
    result.action = 'MANUAL_REVIEW'
  } else {
    result.verdict = 'BLOCKED'
    result.action = 'DISABLE_OR_LEAVE'
  }
  
  console.log(`  Verdict: ${result.verdict}`)
  console.log(`  Action: ${result.action}`)
  if (result.atsDetected.length > 0) {
    console.log(`  ATS: ${result.atsDetected.join(', ')}`)
  }
  if (result.findings.length > 0) {
    result.findings.forEach(f => console.log(`  → ${f}`))
  }
  
  return result
}

async function main() {
  console.log('═'.repeat(70))
  console.log('  UNRESOLVED FIRMS INVESTIGATION')
  console.log('  ' + new Date().toISOString())
  console.log('═'.repeat(70))
  
  const results = []
  
  for (const firm of FIRMS) {
    const result = await investigate(firm)
    results.push(result)
  }
  
  // Summary
  console.log('\n\n' + '═'.repeat(70))
  console.log('  SUMMARY')
  console.log('═'.repeat(70))
  
  const resolved = results.filter(r => r.verdict === 'RESOLVED')
  const unresolved = results.filter(r => r.verdict === 'UNRESOLVED')
  const blocked = results.filter(r => r.verdict === 'BLOCKED')
  
  console.log(`\nResolved: ${resolved.length}`)
  resolved.forEach(r => console.log(`  ✓ ${r.firm}: ${r.findings[0]}`))
  
  console.log(`\nUnresolved: ${unresolved.length}`)
  unresolved.forEach(r => console.log(`  ? ${r.firm}: ${r.knownIssue}`))
  
  console.log(`\nBlocked: ${blocked.length}`)
  blocked.forEach(r => console.log(`  ✗ ${r.firm}: ${r.knownIssue}`))
  
  // Write results
  const fs = await import('fs')
  fs.writeFileSync(
    new URL('./unresolved-investigation-results.json', import.meta.url),
    JSON.stringify(results, null, 2)
  )
  console.log('\nResults written to unresolved-investigation-results.json')
}

main().catch(e => { console.error(e); process.exit(1) })
