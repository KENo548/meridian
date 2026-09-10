#!/usr/bin/env node

/**
 * Oracle HCM Candidate Experience API Test Script
 * 
 * Tests the public REST API used by Oracle HCM Cloud job boards
 * (Goldman Sachs, JPMorgan Chase, Lazard, etc.)
 * 
 * API Pattern:
 *   GET https://{hostname}/hcmRestApi/resources/latest/recruitingCEJobRequisitions
 *     ?onlyData=true
 *     &expand=requisitionList
 *     &finder=findReqs;siteNumber={siteNumber},limit={limit},offset={offset}
 * 
 * Key discovery: expand=requisitionList is REQUIRED to get actual job data.
 * Without it, you only get search metadata and facets.
 */

import https from 'node:https';

// Known Oracle HCM Job Board Configs
const JOB_BOARDS = {
  goldmanSachs: {
    name: 'Goldman Sachs',
    hostname: 'hdpc.fa.us2.oraclecloud.com',
    siteNumber: 'LateralHiring',
    careersUrl: 'https://hdpc.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/LateralHiring/jobs',
  },
  jpmorgan: {
    name: 'JPMorgan Chase',
    hostname: 'jpmc.fa.oraclecloud.com',
    siteNumber: 'CX_1001',
    careersUrl: 'https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/jobs',
  },
  lazard: {
    name: 'Lazard',
    hostname: 'icbpjb.fa.ocs.oraclecloud.com',
    siteNumber: 'CX_3',
    careersUrl: 'https://icbpjb.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/jobs',
  },
};

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`JSON parse error: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function buildApiUrl(config, { keyword, limit = 5, offset = 0 } = {}) {
  let finder = `findReqs;siteNumber=${config.siteNumber},limit=${limit},offset=${offset}`;
  if (keyword) finder += `,keyword=${encodeURIComponent(keyword)}`;
  return `https://${config.hostname}/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList&finder=${finder}`;
}

async function testBoard(key) {
  const config = JOB_BOARDS[key];
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${config.name}`);
  console.log(`API URL: ${buildApiUrl(config, { limit: 2 })}`);
  console.log(`${'='.repeat(60)}`);

  // Test 1: Basic listing
  console.log('\n--- Test 1: Basic job listing ---');
  try {
    const url = buildApiUrl(config, { limit: 2 });
    const data = await fetchJSON(url);
    const search = data.items?.[0];
    const jobs = search?.requisitionList || [];

    console.log(`Total jobs available: ${search?.TotalJobsCount ?? 'N/A'}`);
    console.log(`Jobs returned: ${jobs.length}`);

    for (const job of jobs) {
      console.log(`\n  [${job.Id}] ${job.Title}`);
      console.log(`  Location: ${job.PrimaryLocation || 'N/A'}`);
      console.log(`  Country: ${job.PrimaryLocationCountry || 'N/A'}`);
      console.log(`  Posted: ${job.PostedDate || 'N/A'}`);
      console.log(`  Hot Job: ${job.HotJobFlag}`);
      console.log(`  Description: ${(job.ShortDescriptionStr || '').slice(0, 100)}...`);
    }

    // Show facets
    console.log('\nFacets available:');
    console.log(`  Categories: ${search?.categoriesFacet?.map(f => `${f.Name}(${f.TotalCount})`).join(', ') || 'none'}`);
    console.log(`  Locations: ${search?.locationsFacet?.slice(0, 5).map(f => `${f.Name}(${f.TotalCount})`).join(', ') || 'none'}...`);

    console.log('\n[PASS] Basic listing works');
  } catch (err) {
    console.log(`[FAIL] Basic listing: ${err.message}`);
  }

  // Test 2: Keyword search
  console.log('\n--- Test 2: Keyword search ---');
  try {
    const url = buildApiUrl(config, { keyword: 'engineer', limit: 2 });
    const data = await fetchJSON(url);
    const search = data.items?.[0];
    const jobs = search?.requisitionList || [];

    console.log(`Search keyword: "engineer"`);
    console.log(`Total matches: ${search?.TotalJobsCount ?? 'N/A'}`);
    console.log(`Jobs returned: ${jobs.length}`);

    for (const job of jobs) {
      console.log(`\n  [${job.Id}] ${job.Title}`);
      console.log(`  Location: ${job.PrimaryLocation || 'N/A'}`);
      console.log(`  Family: ${job.JobFamily || 'N/A'}`);
      console.log(`  Function: ${job.JobFunction || 'N/A'}`);
    }

    console.log('\n[PASS] Keyword search works');
  } catch (err) {
    console.log(`[FAIL] Keyword search: ${err.message}`);
  }

  // Test 3: Pagination
  console.log('\n--- Test 3: Pagination ---');
  try {
    const url = buildApiUrl(config, { limit: 2, offset: 2 });
    const data = await fetchJSON(url);
    const search = data.items?.[0];
    const jobs = search?.requisitionList || [];

    console.log(`Offset: 2, Limit: 2`);
    console.log(`Jobs returned: ${jobs.length}`);
    console.log(`First job ID: ${jobs[0]?.Id || 'N/A'}`);

    console.log('\n[PASS] Pagination works');
  } catch (err) {
    console.log(`[FAIL] Pagination: ${err.message}`);
  }
}

async function main() {
  console.log('Oracle HCM Candidate Experience API Test');
  console.log('========================================');
  console.log('Date:', new Date().toISOString());

  // Test all known boards
  for (const key of Object.keys(JOB_BOARDS)) {
    await testBoard(key);
  }

  // Summary
  console.log('\n\n========================================');
  console.log('API REFERENCE SUMMARY');
  console.log('========================================');
  console.log(`
Endpoint Pattern:
  GET https://{hostname}/hcmRestApi/resources/latest/recruitingCEJobRequisitions

Required Parameters:
  onlyData=true          - Returns data only (no HATEOAS links)
  expand=requisitionList - REQUIRED: includes actual job listings
  finder=findReqs        - Predefined finder for job search
    ;siteNumber={site}   - Site number (e.g., LateralHiring, CX_1001)
    ,limit={n}           - Max results per page (default: 200)
    ,offset={n}          - Pagination offset
    ,keyword={text}      - Optional search keyword

Known Hostnames & Site Numbers:
  Goldman Sachs:  hdpc.fa.us2.oraclecloud.com  / LateralHiring
  JPMorgan Chase: jpmc.fa.oraclecloud.com       / CX_1001
  Lazard:         icbpjb.fa.ocs.oraclecloud.com / CX_3

Authentication: NONE required (public Candidate Experience API)

Response Structure:
  items[0].SearchId         - Search session ID
  items[0].TotalJobsCount   - Total matching jobs
  items[0].requisitionList  - Array of job objects
  items[0].categoriesFacet  - Category facets with counts
  items[0].locationsFacet   - Location facets with counts

Job Fields (from requisitionList):
  Id                      - Requisition ID (string)
  Title                   - Job title
  PostedDate              - Posting date (YYYY-MM-DD)
  PostingEndDate          - Expiry date (nullable)
  PrimaryLocation         - City, State, Country
  PrimaryLocationCountry  - 2-letter country code
  ShortDescriptionStr     - Job description snippet
  JobFamily               - Job family/category
  JobFunction             - Job function area
  HotJobFlag              - Trending/hot job indicator
  TrendingFlag            - High application volume indicator
  BeFirstToApplyFlag      - Low competition indicator
  Organization            - Organization name
  BusinessUnit            - Business unit name
  Department              - Department name
  ExternalQualificationsStr  - Qualifications
  ExternalResponsibilitiesStr - Responsibilities

Additional Finder Parameters:
  location={text}           - Filter by location
  selectedCategoriesFacet   - Filter by category ID
  selectedLocationsFacet    - Filter by location ID
  selectedOrganizationsFacet - Filter by org ID
  sortBy={field}            - Sort results
  hotJobFlag=true           - Only hot jobs
  postingStartDate={date}   - Filter by start date
  postingEndDate={date}     - Filter by end date
  workLocationCountryCode   - Filter by country
`);
}

main().catch(console.error);
