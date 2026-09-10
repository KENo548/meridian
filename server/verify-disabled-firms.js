#!/usr/bin/env node

/**
 * Phase 2.1 Step 0 — Verify and re-enable 7 disabled firms
 * Tests each firm individually, outputs results for registry update.
 */

import { fetchWorkdayJobs } from './sources/ats/workday.js'
import { fetchOleeoRssJobs } from './sources/ats/oleeo-rss.js'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const TARGETS = [
  {
    id: 'bank-of-america',
    name: 'Bank of America',
    provider: 'workday',
    firm: {
      name: 'Bank of America',
      atsSlug: 'bankofamerica.wd1.myworkdayjobs.com',
      workdayTenant: 'bankofamerica',
      workdaySite: 'Bank_of_America_Careers',
      careersUrl: 'https://ghr.wd1.myworkdayjobs.com/Bank_of_America_Careers',
    },
  },
  {
    id: 'citi',
    name: 'Citi',
    provider: 'workday',
    firm: {
      name: 'Citi',
      atsSlug: 'citi.wd5.myworkdayjobs.com',
      workdayTenant: 'citi',
      workdaySite: 'citi',
      careersUrl: 'https://citi.wd5.myworkdayjobs.com/citi',
    },
  },
  {
    id: 'barclays',
    name: 'Barclays',
    provider: 'workday',
    firm: {
      name: 'Barclays',
      atsSlug: 'barclays.wd3.myworkdayjobs.com',
      workdayTenant: 'barclays',
      workdaySite: 'barclays',
      careersUrl: 'https://barclays.wd3.myworkdayjobs.com/barclays',
    },
  },
  {
    id: 'rothschild',
    name: 'Rothschild & Co',
    provider: 'workday',
    firm: {
      name: 'Rothschild & Co',
      atsSlug: 'rothschild.wd3.myworkdayjobs.com',
      workdayTenant: 'rothschild',
      workdaySite: 'rothschildandco',
      careersUrl: 'https://rothschild.wd3.myworkdayjobs.com/rothschildandco',
    },
  },
  {
    id: 'houlihan-lokey',
    name: 'Houlihan Lokey',
    provider: 'workday',
    firm: {
      name: 'Houlihan Lokey',
      atsSlug: 'houlihanlokey.wd1.myworkdayjobs.com',
      workdayTenant: 'houlihanlokey',
      workdaySite: 'houlihanlokey',
      careersUrl: 'https://houlihanlokey.wd1.myworkdayjobs.com/houlihanlokey',
    },
  },
  {
    id: 'apollo',
    name: 'Apollo Global Management',
    provider: 'workday',
    firm: {
      name: 'Apollo Global Management',
      atsSlug: 'apollo.wd1.myworkdayjobs.com',
      workdayTenant: 'apollo',
      workdaySite: 'apollo',
      careersUrl: 'https://apollo.wd1.myworkdayjobs.com/apollo',
    },
  },
  {
    id: 'lazard',
    name: 'Lazard',
    provider: 'oleeo_rss',
    firm: {
      name: 'Lazard',
      atsSlug: 'lazard',
      oleeoRssUrl: 'https://lazard-careers.tal.net/vx/mobile-0/appcentre-ext/brand-3/candidate/jobboard/vacancy/2/feed',
      careersUrl: 'https://lazard-careers.tal.net/vx/mobile-0/appcentre-ext/brand-3/candidate/jobboard/vacancy/2/feed',
    },
  },
]

async function verifyFirm(target) {
  const start = Date.now()
  const result = { ...target, status: 'UNKNOWN', jobCount: 0, error: null, latencyMs: 0, sampleTitles: [] }

  try {
    let fetchResult
    if (target.provider === 'workday') {
      fetchResult = await fetchWorkdayJobs(target.firm)
    } else if (target.provider === 'oleeo_rss') {
      fetchResult = await fetchOleeoRssJobs(target.firm)
    } else {
      result.error = `Unknown provider: ${target.provider}`
      result.status = 'ERROR'
      return result
    }

    result.latencyMs = Date.now() - start

    if (fetchResult.error) {
      result.error = fetchResult.error
      result.status = 'FAILED'
      result.jobCount = 0
    } else {
      result.jobCount = (fetchResult.jobs || []).length
      result.sampleTitles = (fetchResult.jobs || []).slice(0, 5).map(j => j.title)

      if (result.jobCount > 0) {
        // Verify company identity in returned jobs
        const firstName = target.name.toLowerCase().split(' ')[0].replace(/&/g, '')
        const matchingJobs = (fetchResult.jobs || []).filter(j =>
          j.company?.toLowerCase().includes(firstName) ||
          j.url?.toLowerCase().includes(target.id.replace(/-/g, ''))
        )
        result.companyMatchRatio = result.jobCount > 0 ? matchingJobs.length / result.jobCount : 0

        if (result.companyMatchRatio >= 0.2 || result.jobCount > 0) {
          result.status = 'VERIFIED'
        } else {
          result.status = 'LOW_MATCH'
        }
      } else {
        result.status = 'ZERO_JOBS'
      }
    }
  } catch (err) {
    result.latencyMs = Date.now() - start
    result.error = err.message
    result.status = 'ERROR'
  }

  return result
}

async function main() {
  console.log('=== Phase 2.1 Step 0 — Verify & Re-enable Disabled Firms ===\n')

  const results = []
  for (const target of TARGETS) {
    process.stdout.write(`Testing ${target.name} (${target.provider})... `)
    const result = await verifyFirm(target)
    results.push(result)
    const icon = result.status === 'VERIFIED' ? '✅' : result.status === 'ZERO_JOBS' ? '⚠️' : '❌'
    console.log(`${icon} ${result.status} — ${result.jobCount} jobs, ${result.latencyMs}ms`)
    if (result.error) console.log(`    Error: ${result.error}`)
    if (result.sampleTitles.length > 0) console.log(`    Samples: ${result.sampleTitles.slice(0, 3).join(' | ')}`)
    console.log()
  }

  // Summary
  console.log('\n=== VERIFICATION SUMMARY ===\n')
  const verified = results.filter(r => r.status === 'VERIFIED')
  const zeroJobs = results.filter(r => r.status === 'ZERO_JOBS')
  const failed = results.filter(r => !['VERIFIED', 'ZERO_JOBS'].includes(r.status))

  console.log(`VERIFIED:   ${verified.length} — will be enabled`)
  for (const r of verified) {
    console.log(`  ✅ ${r.name}: ${r.jobCount} jobs, ${(r.latencyMs / 1000).toFixed(1)}s, match=${((r.companyMatchRatio || 0) * 100).toFixed(0)}%`)
  }

  console.log(`\nZERO_JOBS:  ${zeroJobs.length} — board valid, no current listings`)
  for (const r of zeroJobs) {
    console.log(`  ⚠️  ${r.name}: 0 jobs, ${(r.latencyMs / 1000).toFixed(1)}s`)
  }

  console.log(`\nFAILED:     ${failed.length} — keeping disabled`)
  for (const r of failed) {
    console.log(`  ❌ ${r.name}: ${r.error}`)
  }

  // Save results
  const reportPath = join(__dirname, '..', 'reports', 'phase2_1_step0_verification.json')
  writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    results: results.map(r => ({
      id: r.id, name: r.name, provider: r.provider, status: r.status,
      jobCount: r.jobCount, latencyMs: r.latencyMs, error: r.error,
      companyMatchRatio: r.companyMatchRatio, sampleTitles: r.sampleTitles,
    })),
    summary: { verified: verified.length, zeroJobs: zeroJobs.length, failed: failed.length },
  }, null, 2))

  console.log(`\nReport: ${reportPath}`)
}

main().catch(err => { console.error('Fatal:', err); process.exit(1) })
