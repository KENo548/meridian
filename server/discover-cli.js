#!/usr/bin/env node

/**
 * Phase 2.1 Step 14 — Source Discovery CLI
 *
 * Usage:
 *   node server/discover-cli.js [options]
 *
 * Options:
 *   --company=<id>       Discover a specific company by ID
 *   --unknown-only       Only discover firms with unknown/custom providers (default)
 *   --all                Discover all disabled firms
 *   --dry-run            Show what would be discovered without making requests
 *   --verify             Re-verify previously discovered sources
 *   --limit=<n>          Maximum number of firms to process
 *   --help               Show this help message
 */

import { runDiscovery, discoverCompany } from './sources/discovery/discover.js'
import { getAllFirms } from './sources/registry.js'
import { getAllDiscoveryTargets, getDiscoveryStats } from './db-adapter.js'

function parseArgs() {
  const args = process.argv.slice(2)
  const opts = {
    company: null,
    unknownOnly: true,
    all: false,
    dryRun: false,
    verify: false,
    limit: 50,
    help: false,
  }

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') opts.help = true
    else if (arg === '--unknown-only') opts.unknownOnly = true
    else if (arg === '--all') { opts.all = true; opts.unknownOnly = false }
    else if (arg === '--dry-run') opts.dryRun = true
    else if (arg === '--verify') opts.verify = true
    else if (arg.startsWith('--company=')) opts.company = arg.split('=')[1]
    else if (arg.startsWith('--limit=')) opts.limit = parseInt(arg.split('=')[1])
  }

  return opts
}

function showHelp() {
  console.log(`
Phase 2.1 — Source Discovery CLI

Usage:
  node server/discover-cli.js [options]

Options:
  --company=<id>       Discover a specific company by ID
  --unknown-only       Only discover firms with unknown/custom providers (default)
  --all                Discover all disabled firms
  --dry-run            Show what would be discovered without making requests
  --verify             Re-verify previously discovered sources
  --limit=<n>          Maximum firms to process (default: 50)
  --help               Show this help

Examples:
  node server/discover-cli.js --unknown-only
  node server/discover-cli.js --company=goldman-sachs --verify
  node server/discover-cli.js --all --limit=10
  `)
}

async function main() {
  const opts = parseArgs()

  if (opts.help) {
    showHelp()
    process.exit(0)
  }

  console.log('=== Phase 2.1 — Source Discovery ===\n')

  // Show current queue stats
  // True-async: db-adapter resolves only after the durable read completes.
  const stats = await getDiscoveryStats()
  console.log('Discovery Queue:')
  console.log(`  Pending:     ${stats.pending}`)
  console.log(`  Discovered:  ${stats.supported_source_found}`)
  console.log(`  Unsupported: ${stats.unsupported_ats_found}`)
  console.log(`  Failed:      ${stats.failed}`)
  console.log(`  Review:      ${stats.manual_review}`)
  console.log(`  Total:       ${stats.total}`)

  if (opts.verify) {
    console.log('\nRe-verifying previously discovered sources...')
    // TODO: implement re-verification
    console.log('Not yet implemented')
    return
  }

  // Run discovery
  console.log(`\nRunning discovery: ${opts.unknownOnly ? 'unknown-only' : 'all'}${opts.dryRun ? ' (DRY RUN)' : ''}\n`)

  const results = await runDiscovery({
    unknownOnly: opts.unknownOnly,
    limit: opts.limit,
    dryRun: opts.dryRun,
    companyId: opts.company,
  })

  // Summary
  console.log('\n\n=== DISCOVERY RESULTS ===\n')

  const byStatus = {}
  for (const r of results) {
    const status = r.status || 'UNKNOWN'
    byStatus[status] = (byStatus[status] || 0) + 1
  }

  for (const [status, count] of Object.entries(byStatus).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${status}: ${count}`)
  }

  console.log(`\n  Total processed: ${results.length}`)

  // Provider breakdown
  const supportedProviders = {}
  const unsupportedProviders = {}
  for (const r of results) {
    if (r.verifiedSources) {
      for (const s of r.verifiedSources) {
        if (s.verification?.verificationStatus === 'VERIFIED') {
          supportedProviders[s.provider] = (supportedProviders[s.provider] || 0) + 1
        }
      }
    }
    if (r.unsupportedSources) {
      for (const s of r.unsupportedSources) {
        unsupportedProviders[s.provider] = (unsupportedProviders[s.provider] || 0) + 1
      }
    }
  }

  if (Object.keys(supportedProviders).length > 0) {
    console.log('\n  SUPPORTED ATS DISCOVERED:')
    for (const [p, c] of Object.entries(supportedProviders).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${p}: ${c}`)
    }
  }

  if (Object.keys(unsupportedProviders).length > 0) {
    console.log('\n  UNSUPPORTED ATS DISCOVERED:')
    for (const [p, c] of Object.entries(unsupportedProviders).sort((a, b) => b[1] - a[1])) {
      console.log(`    ${p}: ${c}`)
    }
  }

  // Save results
  const reportPath = new URL('../reports/phase2_1_discovery_results.json', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
  const { writeFileSync } = await import('fs')
  writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    options: { unknownOnly: opts.unknownOnly, limit: opts.limit, dryRun: opts.dryRun },
    results: results.map(r => ({
      companyId: r.companyId,
      companyName: r.companyName,
      status: r.status,
      verifiedSources: r.verifiedSources?.map(s => ({
        provider: s.provider,
        confidence: s.confidence?.score,
        jobCount: s.verification?.jobCount,
      })),
      unsupportedSources: r.unsupportedSources?.map(s => s.provider),
      studentPages: r.studentPages?.length || 0,
      evidence: r.evidence,
    })),
    summary: byStatus,
    supportedProviders,
    unsupportedProviders,
  }, null, 2))

  console.log(`\nReport saved to: ${reportPath}`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
