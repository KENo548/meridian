#!/usr/bin/env node
/**
 * Eightfold AI Career Site API Investigation
 * 
 * Tests multiple approaches to fetch jobs from Eightfold-powered career sites:
 * 1. Embedded JSON in HTML (SSR data in script tags)
 * 2. Client-side API patterns (SmartApply, PCSX)
 * 3. Sitemap.xml
 * 4. Official Eightfold API (requires auth)
 * 5. Common REST patterns
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// ─── Configuration ───────────────────────────────────────────────────────────

const TARGETS = [
  {
    name: 'Morgan Stanley',
    careerUrl: 'https://careers.morganstanley.com/careers',
    domain: 'careers.morganstanley.com',
  },
  {
    name: 'Millennium Management',
    careerUrl: 'https://www.millennium.com/careers',
    domain: 'www.millennium.com',
  },
];

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// ─── HTTP Helper ─────────────────────────────────────────────────────────────

function fetch(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    const reqOpts = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': options.accept || '*/*',
        ...options.headers,
      },
      timeout: options.timeout || 15000,
    };

    const req = mod.request(reqOpts, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body,
          url: url,
        });
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    req.end();
  });
}

// ─── Test Results Collector ──────────────────────────────────────────────────

const results = [];

function logResult(category, status, detail, data = null) {
  const icon = status === 'SUCCESS' ? '✅' : status === 'PARTIAL' ? '⚠️' : status === 'BLOCKED' ? '🚫' : '❌';
  results.push({ category, status, detail, data });
  console.log(`${icon} [${category}] ${detail}`);
  if (data && typeof data === 'object') {
    const preview = JSON.stringify(data, null, 2).substring(0, 500);
    console.log(`   ${preview}${JSON.stringify(data).length > 500 ? '...' : ''}`);
  }
}

// ─── Test 1: Fetch career page HTML and extract embedded JSON ────────────────

async function testEmbeddedJson(target) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`TEST 1: Embedded JSON in HTML - ${target.name}`);
  console.log(`${'='.repeat(70)}`);

  try {
    const res = await fetch(target.careerUrl, {
      accept: 'text/html',
      timeout: 20000,
    });

    if (res.status !== 200) {
      logResult('Embedded JSON', 'FAILED', `HTTP ${res.status} from ${target.careerUrl}`);
      return;
    }

    // Look for script tags with JSON data (Next.js __NEXT_DATA__, or inline config)
    const scriptPatterns = [
      /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/gi,
      /<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi,
      /window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/gi,
      /window\.__CONFIG__\s*=\s*({[\s\S]*?});/gi,
      /"positions"\s*:\s*\[/gi,
      /"jobs"\s*:\s*\[/gi,
      /data-positions/gi,
      /data-jobs/gi,
    ];

    let foundData = false;
    for (const pattern of scriptPatterns) {
      const matches = res.body.match(pattern);
      if (matches) {
        foundData = true;
        logResult('Embedded JSON', 'SUCCESS', `Found pattern: ${pattern.source.substring(0, 50)}`, {
          matchCount: matches.length,
          sample: matches[0].substring(0, 300),
        });
      }
    }

    // Look for JSON-LD structured data
    const jsonLdMatch = res.body.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
    if (jsonLdMatch) {
      logResult('Embedded JSON', 'SUCCESS', 'Found JSON-LD structured data', {
        count: jsonLdMatch.length,
        sample: jsonLdMatch[0].substring(0, 500),
      });
      foundData = true;
    }

    // Look for Eightfold-specific patterns
    const eightfoldPatterns = [
      /eightfold\.ai/gi,
      /app\.eightfold\.ai/gi,
      /api\/apply/gi,
      /smartapply/gi,
      /pcsx/gi,
      /"domain"\s*:\s*"[^"]+"/gi,
    ];

    for (const pattern of eightfoldPatterns) {
      const matches = res.body.match(pattern);
      if (matches) {
        logResult('Embedded JSON', 'PARTIAL', `Found Eightfold reference: ${pattern.source}`, {
          samples: [...new Set(matches)].slice(0, 5),
        });
      }
    }

    // Extract any data-attributes
    const dataAttrMatch = res.body.match(/data-[a-z-]+="[^"]*"/gi);
    if (dataAttrMatch) {
      const unique = [...new Set(dataAttrMatch)].slice(0, 20);
      logResult('Embedded JSON', 'PARTIAL', `Found ${dataAttrMatch.length} data attributes`, {
        unique: unique.length,
        samples: unique.slice(0, 10),
      });
    }

    if (!foundData) {
      logResult('Embedded JSON', 'FAILED', 'No embedded job data found in HTML');
    }

    // Print HTML snippet for analysis
    console.log('\n--- HTML Analysis ---');
    const titleMatch = res.body.match(/<title>([\s\S]*?)<\/title>/i);
    if (titleMatch) console.log(`Title: ${titleMatch[1].trim()}`);

    // Check for React root
    if (res.body.includes('id="root"') || res.body.includes('id="__next"') || res.body.includes('id="app"')) {
      console.log('Framework: Client-side rendered (React/SPA detected)');
    }

    // Count script tags
    const scriptCount = (res.body.match(/<script/gi) || []).length;
    console.log(`Script tags: ${scriptCount}`);

    // Check for inline job data
    const jobKeywords = ['position', 'jobId', 'job_id', 'posting', 'applyUrl', 'apply_url'];
    for (const kw of jobKeywords) {
      if (res.body.includes(kw)) {
        console.log(`  Found keyword: "${kw}"`);
      }
    }

  } catch (err) {
    logResult('Embedded JSON', 'FAILED', `Error: ${err.message}`);
  }
}

// ─── Test 2: Client-side API patterns ────────────────────────────────────────

async function testClientApiPatterns(target) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`TEST 2: Client-side API Patterns - ${target.name}`);
  console.log(`${'='.repeat(70)}`);

  // Common Eightfold client-side API patterns
  const patterns = [
    // SmartApply pattern
    { path: '/api/apply/v2/jobs', params: '?limit=20&offset=0', label: 'SmartApply v2' },
    { path: '/api/apply/v2/jobs', params: '?limit=10', label: 'SmartApply v2 (small)' },
    { path: '/api/apply/v3/jobs', params: '?limit=20&offset=0', label: 'SmartApply v3' },
    // PCSX pattern
    { path: '/api/pcsx/positions', params: '?limit=20', label: 'PCSX positions' },
    { path: '/api/pcsx/jobs', params: '?limit=20', label: 'PCSX jobs' },
    // Generic patterns
    { path: '/api/jobs', params: '?limit=20', label: 'Generic /api/jobs' },
    { path: '/api/positions', params: '?limit=20', label: 'Generic /api/positions' },
    { path: '/careers/api/jobs', params: '?limit=20', label: '/careers/api/jobs' },
    { path: '/careers/api/positions', params: '?limit=20', label: '/careers/api/positions' },
    // Eightfold-specific paths
    { path: '/api/v1/positions', params: '?limit=20', label: 'v1 positions' },
    { path: '/api/v2/positions', params: '?limit=20', label: 'v2 positions' },
    // Search endpoints
    { path: '/api/apply/v2/jobs/search', params: '?limit=20', label: 'SmartApply search' },
    { path: '/api/search', params: '?limit=20', label: '/api/search' },
    // Job listing with query
    { path: '/api/apply/v2/jobs', params: '?limit=20&offset=0&query=engineering', label: 'SmartApply with query' },
  ];

  for (const pattern of patterns) {
    try {
      const url = `https://${target.domain}${pattern.path}${pattern.params}`;
      const res = await fetch(url, {
        accept: 'application/json',
        timeout: 10000,
      });

      if (res.status === 200) {
        try {
          const json = JSON.parse(res.body);
          const hasJobs = json.positions || json.jobs || json.results || json.data;
          if (hasJobs) {
            logResult('Client API', 'SUCCESS', `${pattern.label}: ${url}`, {
              status: res.status,
              keys: Object.keys(json),
              jobCount: Array.isArray(hasJobs) ? hasJobs.length : 'not array',
              sample: Array.isArray(hasJobs) && hasJobs.length > 0 ? hasJobs[0] : json,
            });
          } else {
            logResult('Client API', 'PARTIAL', `${pattern.label}: ${url}`, {
              status: res.status,
              keys: Object.keys(json),
            });
          }
        } catch (e) {
          logResult('Client API', 'PARTIAL', `${pattern.label}: ${url}`, {
            status: res.status,
            contentType: res.headers['content-type'],
            bodyPreview: res.body.substring(0, 200),
          });
        }
      } else if (res.status === 403 || res.status === 401) {
        logResult('Client API', 'BLOCKED', `${pattern.label}: ${url} → ${res.status}`);
      } else if (res.status === 404) {
        // Don't log 404s - too noisy
      } else if (res.status === 301 || res.status === 302) {
        logResult('Client API', 'PARTIAL', `${pattern.label}: ${url} → Redirect ${res.status}`, {
          location: res.headers.location,
        });
      }
    } catch (err) {
      // Skip timeout/connection errors silently
    }
  }
}

// ─── Test 3: Sitemap.xml ─────────────────────────────────────────────────────

async function testSitemap(target) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`TEST 3: Sitemap.xml - ${target.name}`);
  console.log(`${'='.repeat(70)}`);

  const sitemapUrls = [
    `https://${target.domain}/sitemap.xml`,
    `https://${target.domain}/sitemap_index.xml`,
    `https://${target.domain}/careers/sitemap.xml`,
    `https://${target.domain}/robots.txt`,
  ];

  for (const url of sitemapUrls) {
    try {
      const res = await fetch(url, {
        accept: 'text/xml,text/plain,*/*',
        timeout: 10000,
      });

      if (res.status === 200) {
        const hasJobUrls = res.body.includes('/job/') || res.body.includes('/position/') ||
                          res.body.includes('/careers/');
        if (hasJobUrls) {
          logResult('Sitemap', 'SUCCESS', `${url}`, {
            contentType: res.headers['content-type'],
            hasJobUrls,
            size: res.body.length,
            preview: res.body.substring(0, 500),
          });
        } else if (url.includes('robots.txt')) {
          logResult('Sitemap', 'PARTIAL', `${url} (robots.txt found)`, {
            preview: res.body.substring(0, 300),
          });
        } else {
          logResult('Sitemap', 'PARTIAL', `${url}`, {
            size: res.body.length,
            preview: res.body.substring(0, 200),
          });
        }
      } else if (res.status !== 404) {
        logResult('Sitemap', 'FAILED', `${url} → HTTP ${res.status}`);
      }
    } catch (err) {
      // Skip errors
    }
  }
}

// ─── Test 4: RSS Feed ───────────────────────────────────────────────────────

async function testRSS(target) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`TEST 4: RSS Feed - ${target.name}`);
  console.log(`${'='.repeat(70)}`);

  const rssUrls = [
    `https://${target.domain}/feed`,
    `https://${target.domain}/rss`,
    `https://${target.domain}/careers/feed`,
    `https://${target.domain}/careers/rss`,
    `https://${target.domain}/feed.xml`,
    `https://${target.domain}/atom.xml`,
  ];

  for (const url of rssUrls) {
    try {
      const res = await fetch(url, {
        accept: 'application/rss+xml,application/xml,text/xml,*/*',
        timeout: 10000,
      });

      if (res.status === 200 && (
        res.body.includes('<rss') || res.body.includes('<feed') || res.body.includes('<channel')
      )) {
        logResult('RSS', 'SUCCESS', `${url}`, {
          preview: res.body.substring(0, 500),
        });
      }
    } catch (err) {
      // Skip errors
    }
  }
}

// ─── Test 5: Official Eightfold API (unauthenticated) ────────────────────────

async function testOfficialApi() {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`TEST 5: Official Eightfold API (unauthenticated)`);
  console.log(`${'='.repeat(70)}`);

  const endpoints = [
    'https://apiv2.eightfold.ai/api/v2/core/positions?limit=5',
    'https://api.eightfold.ai/v1/candidate/search?limit=5',
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        accept: 'application/json',
        timeout: 10000,
      });

      if (res.status === 200) {
        logResult('Official API', 'SUCCESS', `${url}`, {
          status: res.status,
          bodyPreview: res.body.substring(0, 300),
        });
      } else if (res.status === 401 || res.status === 403) {
        logResult('Official API', 'BLOCKED', `${url} → ${res.status} (auth required)`);
      } else {
        logResult('Official API', 'FAILED', `${url} → ${res.status}`, {
          bodyPreview: res.body.substring(0, 200),
        });
      }
    } catch (err) {
      logResult('Official API', 'FAILED', `${url} → ${err.message}`);
    }
  }
}

// ─── Test 6: Try Eightfold app.eightfold.ai career endpoints ─────────────────

async function testEightfoldApp() {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`TEST 6: Eightfold App Endpoints (app.eightfold.ai)`);
  console.log(`${'='.repeat(70)}`);

  const endpoints = [
    'https://app.eightfold.ai/careers/api/positions?limit=5',
    'https://app.eightfold.ai/api/apply/v2/jobs?limit=5',
    'https://app.eightfold.ai/careers?limit=5',
  ];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        accept: 'application/json',
        timeout: 10000,
      });

      if (res.status === 200) {
        logResult('Eightfold App', 'SUCCESS', `${url}`, {
          status: res.status,
          contentType: res.headers['content-type'],
          bodyPreview: res.body.substring(0, 300),
        });
      } else {
        logResult('Eightfold App', 'FAILED', `${url} → ${res.status}`);
      }
    } catch (err) {
      logResult('Eightfold App', 'FAILED', `${url} → ${err.message}`);
    }
  }
}

// ─── Test 7: HTML scraping approach ──────────────────────────────────────────

async function testHtmlScraping(target) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`TEST 7: HTML Scraping Feasibility - ${target.name}`);
  console.log(`${'='.repeat(70)}`);

  try {
    const res = await fetch(target.careerUrl, {
      accept: 'text/html',
      timeout: 20000,
    });

    if (res.status !== 200) {
      logResult('HTML Scraping', 'FAILED', `HTTP ${res.status}`);
      return;
    }

    // Check if page is client-side rendered (empty shell)
    const hasJobContent = res.body.includes('position') || res.body.includes('job-') ||
                         res.body.includes('career-') || res.body.includes('opening');

    const hasReactRoot = res.body.includes('id="root"') || res.body.includes('id="__next"');
    const hasVueApp = res.body.includes('id="app"') || res.body.includes('data-v-');
    const hasAngularApp = res.body.includes('ng-version') || res.body.includes('ng-app');

    console.log('\n--- Rendering Analysis ---');
    console.log(`React root: ${hasReactRoot}`);
    console.log(`Vue app: ${hasVueApp}`);
    console.log(`Angular app: ${hasAngularApp}`);
    console.log(`Job keywords in HTML: ${hasJobContent}`);

    if (hasReactRoot || hasVueApp || hasAngularApp) {
      logResult('HTML Scraping', 'PARTIAL', 'SPA detected - HTML scraping alone won\'t work', {
        framework: hasReactRoot ? 'React' : hasVueApp ? 'Vue' : 'Angular',
        recommendation: 'Use browser automation (Puppeteer/Playwright) or intercept API calls',
      });
    } else if (hasJobContent) {
      logResult('HTML Scraping', 'SUCCESS', 'Job content found in HTML - scraping is feasible');
    } else {
      logResult('HTML Scraping', 'PARTIAL', 'Unclear - may need browser rendering');
    }

    // Check for job listing HTML patterns
    const htmlPatterns = [
      { pattern: /class="[^"]*job[^"]*"/gi, label: 'job class' },
      { pattern: /class="[^"]*position[^"]*"/gi, label: 'position class' },
      { pattern: /class="[^"]*opening[^"]*"/gi, label: 'opening class' },
      { pattern: /href="[^"]*\/job\/[^"]*"/gi, label: 'job links' },
      { pattern: /href="[^"]*\/position\/[^"]*"/gi, label: 'position links' },
      { pattern: /data-job-id/gi, label: 'data-job-id attr' },
      { pattern: /data-position-id/gi, label: 'data-position-id attr' },
    ];

    console.log('\n--- HTML Patterns ---');
    for (const { pattern, label } of htmlPatterns) {
      const matches = res.body.match(pattern);
      if (matches) {
        console.log(`  ${label}: ${matches.length} matches`);
      }
    }

  } catch (err) {
    logResult('HTML Scraping', 'FAILED', `Error: ${err.message}`);
  }
}

// ─── Summary ─────────────────────────────────────────────────────────────────

function printSummary() {
  console.log(`\n${'='.repeat(70)}`);
  console.log('SUMMARY');
  console.log(`${'='.repeat(70)}`);

  const success = results.filter(r => r.status === 'SUCCESS');
  const partial = results.filter(r => r.status === 'PARTIAL');
  const blocked = results.filter(r => r.status === 'BLOCKED');
  const failed = results.filter(r => r.status === 'FAILED');

  console.log(`\n✅ SUCCESS: ${success.length}`);
  console.log(`⚠️  PARTIAL: ${partial.length}`);
  console.log(`🚫 BLOCKED: ${blocked.length}`);
  console.log(`❌ FAILED:  ${failed.length}`);

  if (success.length > 0) {
    console.log('\n--- Working Approaches ---');
    for (const r of success) {
      console.log(`  ${r.category}: ${r.detail}`);
    }
  }

  if (blocked.length > 0) {
    console.log('\n--- Blocked (Auth Required) ---');
    for (const r of blocked) {
      console.log(`  ${r.category}: ${r.detail}`);
    }
  }

  console.log('\n--- Recommendations ---');
  console.log('1. The official Eightfold API (apiv2.eightfold.ai) requires OAuth - enterprise customers only');
  console.log('2. Career sites are SPAs - you need either:');
  console.log('   a. Intercept the client-side API calls the SPA makes (check Network tab)');
  console.log('   b. Use Puppeteer/Playwright to render the page and extract data');
  console.log('   c. Parse embedded JSON from the initial HTML response');
  console.log('3. Third-party aggregators (Jobo, Fantastic.jobs) offer normalized APIs');
  console.log('4. Check each career site individually for embedded job data in script tags');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Eightfold AI Career Site API Investigation');
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Targets: ${TARGETS.map(t => t.name).join(', ')}`);

  // Test official Eightfold API first (no target-specific)
  await testOfficialApi();
  await testEightfoldApp();

  // Test each target
  for (const target of TARGETS) {
    await testEmbeddedJson(target);
    await testClientApiPatterns(target);
    await testSitemap(target);
    await testRSS(target);
    await testHtmlScraping(target);
  }

  printSummary();
}

main().catch(console.error);
