#!/usr/bin/env node
/**
 * Final investigation pass: Squarepoint redirect, Brevan Howard Radancy, 
 * D.E. Shaw JS-rendered, Deutsche Bank SuccessFactors.
 */

async function fetchUrl(url, timeout = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });
    const text = await res.text();
    clearTimeout(timer);
    return { status: res.status, url: res.url, html: text, ok: res.ok, size: text.length, headers: res.headers };
  } catch (err) {
    clearTimeout(timer);
    return { status: 0, url, html: '', ok: false, error: err.message, size: 0 };
  }
}

async function main() {
  // 1. Squarepoint: check the redirect destination
  console.log('=== SQUAREPOINT CAPITAL ===');
  const sq = await fetchUrl('https://boards.greenhouse.io/squarepointcapital');
  console.log(`Status: ${sq.status} | Redirected to: ${sq.url}`);
  console.log(`Title: ${(sq.html.match(/<title[^>]*>([^<]+)<\/title>/i) || [])[1] || '(none)'}`);
  const sqIframes = [...sq.html.matchAll(/<iframe[^>]*src="([^"]+)"[^>]*>/gi)];
  console.log(`Iframes: ${sqIframes.map(m => m[1]).join(', ') || '(none)'}`);
  const sqATS = [];
  if (/greenhouse/i.test(sq.html)) sqATS.push('greenhouse');
  if (/lever/i.test(sq.html)) sqATS.push('lever');
  if (/workday/i.test(sq.html)) sqATS.push('workday');
  if (/eightfold/i.test(sq.html)) sqATS.push('eightfold');
  if (/avature/i.test(sq.html)) sqATS.push('avature');
  if (/smartrecruiters/i.test(sq.html)) sqATS.push('smartrecruiters');
  console.log(`ATS: ${sqATS.join(', ') || '(none)'}`);
  
  // Check squarepoint.com/careers directly
  const sq2 = await fetchUrl('https://www.squarepoint.com/careers');
  console.log(`\nsquarepoint.com/careers: Status ${sq2.status} | Size ${sq2.size} | URL: ${sq2.url}`);
  
  // 2. Brevan Howard: check Radancy portal
  console.log('\n=== BREVAN HOWARD ===');
  const bh = await fetchUrl('https://careers.brevanhoward.com/gb/en/home');
  console.log(`Status: ${bh.status} | Size: ${bh.size}`);
  const bhIframes = [...bh.html.matchAll(/<iframe[^>]*src="([^"]+)"[^>]*>/gi)];
  console.log(`Iframes: ${bhIframes.map(m => m[1]).join('\n  ') || '(none)'}`);
  // Look for Radancy / Jobvite / TMP markers
  const radancy = bh.html.match(/radancy|jobvite|tmpglob|cornerstone|successfactors|smartrecruiters/gi);
  console.log(`Portal markers: ${radancy ? [...new Set(radancy)].join(', ') : '(none)'}`);
  // Look for job listing APIs
  const apiMatches = [...bh.html.matchAll(/["'](https?:\/\/[^"']*api[^"']*|https?:\/\/[^"']*jobs[^"']*|https?:\/\/[^"']*search[^"']*)/gi)];
  if (apiMatches.length > 0) {
    console.log(`API/Job URLs found: ${apiMatches.slice(0, 10).map(m => m[1]).join('\n  ')}`);
  }
  
  // 3. D.E. Shaw: check if jobs are rendered via JS
  console.log('\n=== D. E. SHAW ===');
  const deshaw = await fetchUrl('https://www.deshaw.com/careers');
  console.log(`Status: ${deshaw.status} | Size: ${deshaw.size}`);
  // Look for job listing markers
  const jobMarkers = deshaw.html.match(/job[-_]list|position[-_]list|opening[-_]list|career[-_]list/gi);
  console.log(`Job markers: ${jobMarkers ? [...new Set(jobMarkers)].join(', ') : '(none)'}`);
  // Look for API endpoints
  const apiEndpoints = [...deshaw.html.matchAll(/["'](https?:\/\/[^"']*(?:api|json|jobs|positions|careers)[^"']*)/gi)];
  if (apiEndpoints.length > 0) {
    console.log(`API endpoints: ${apiEndpoints.slice(0, 10).map(m => m[1]).join('\n  ')}`);
  }
  // Check for React/Next.js data
  const reactData = deshaw.html.match(/__NEXT_DATA__|__NUXT__|window\.__DATA__/gi);
  console.log(`Framework data: ${reactData ? reactData.join(', ') : '(none)'}`);
  
  // 4. Deutsche Bank: SuccessFactors check
  console.log('\n=== DEUTSCHE BANK ===');
  const db = await fetchUrl('https://careers.db.com');
  console.log(`Status: ${db.status} | Size: ${db.size}`);
  const dbMarkers = db.html.match(/successfactors|sap|myworkdayjobs|workday|greenhouse|lever|smartrecruiters/gi);
  console.log(`ATS markers: ${dbMarkers ? [...new Set(dbMarkers)].join(', ') : '(none)'}`);
  // Check for SuccessFactors login URL patterns
  const sfUrls = [...db.html.matchAll(/((?:[a-z0-9-]+\.)?successfactors\.[a-z]+\/[^"'\s<>]+)/gi)];
  if (sfUrls.length > 0) console.log(`SuccessFactors URLs: ${sfUrls.map(m => m[1]).join(', ')}`);
  // Check for job search links
  const jobLinks = [...db.html.matchAll(/["'](https?:\/\/[^"']*(?:search|jobs|positions|apply)[^"']*)/gi)];
  if (jobLinks.length > 0) {
    console.log(`Job search links: ${jobLinks.slice(0, 10).map(m => m[1]).join('\n  ')}`);
  }
  
  // 5. Nomura: try alternate Workday tenants
  console.log('\n=== NOMURA ===');
  const nomuraTenants = [
    'https://nomura.wd1.myworkdayjobs.com/nomura',
    'https://nomura.wd3.myworkdayjobs.com/nomura',
    'https://nomuraholdings.wd1.myworkdayjobs.com/nomura',
    'https://nomura.wd1.myworkdayjobs.com/Nomura',
    'https://nomura.wd3.myworkdayjobs.com/Nomura',
  ];
  for (const url of nomuraTenants) {
    const r = await fetchUrl(url);
    console.log(`  ${url}: ${r.status} (${r.size} bytes)`);
  }
  
  // 6. Macquarie: Avature details
  console.log('\n=== MACQUARIE GROUP ===');
  const mac = await fetchUrl('https://recruitment.macquarie.com/en_US/careers');
  console.log(`Status: ${mac.status} | Size: ${mac.size}`);
  // Look for Avature API endpoints
  const avatureApis = [...mac.html.matchAll(/["'](https?:\/\/[^"']*avature[^"']*)/gi)];
  if (avatureApis.length > 0) console.log(`Avature URLs: ${avatureApis.map(m => m[1]).join(', ')}`);
  // Look for job search API
  const searchApis = [...mac.html.matchAll(/["'](https?:\/\/[^"']*(?:api|search|jobs)[^"']*)/gi)];
  if (searchApis.length > 0) {
    console.log(`Search/API URLs: ${searchApis.slice(0, 10).map(m => m[1]).join('\n  ')}`);
  }
  
  // 7. Centerview: try without Cloudflare
  console.log('\n=== CENTerview PARTNERS ===');
  const cv = await fetchUrl('https://centerviewpartners.com/careers');
  console.log(`Status: ${cv.status} | Headers: ${JSON.stringify(Object.fromEntries(cv.headers || []))}`);
  
  // 8. Balyasny: try alternate
  console.log('\n=== BALYASNY ===');
  const bam = await fetchUrl('https://bam.wd1.myworkdayjobs.com/bam');
  console.log(`Workday attempt: ${bam.status} (${bam.size} bytes)`);
}

main().catch(console.error);
