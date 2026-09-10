#!/usr/bin/env node
/**
 * Deep investigation: verify GH tokens, fix errors, inspect HTML structure.
 */

const FIRMS_TO_DEEP = [
  {
    id: 'kkr',
    name: 'KKR',
    urls: [
      'https://www.kkr.com/careers/career-opportunities',
      'https://boards.greenhouse.io/kkr',
      'https://boards.greenhouse.io/kkrgroup',
      'https://boards.greenhouse.io/kkrinc',
      'https://boards.greenhouse.io/kkrholdings',
      'https://boards.greenhouse.io/kkrllc',
    ],
  },
  {
    id: 'squarepoint',
    name: 'Squarepoint Capital',
    urls: [
      'https://www.squarepoint.com/careers',
      'https://boards.greenhouse.io/squarepoint',
      'https://boards.greenhouse.io/squarepointcapital',
    ],
  },
  {
    id: 'brevan-howard',
    name: 'Brevan Howard',
    urls: [
      'https://careers.brevanhoward.com/gb/en/home',
      'https://boards.greenhouse.io/brevanhoward',
      'https://boards.greenhouse.io/brevanhowardam',
    ],
  },
  {
    id: 'man-group',
    name: 'Man Group',
    urls: [
      'https://www.man.com/careers',
      'https://boards.greenhouse.io/mangroup',
      'https://boards.greenhouse.io/man',
    ],
  },
  {
    id: 'ubs',
    name: 'UBS',
    urls: [
      'https://www.ubs.com/global/en/careers.html',
      'https://www.ubs.com/global/en/careers/search.html',
    ],
  },
  {
    id: 'deutsche-bank',
    name: 'Deutsche Bank',
    urls: [
      'https://careers.db.com',
      'https://jobs.db.com/',
      'https://db.recruitee.com/',
      'https://deutschebank.wd1.myworkdayjobs.com/Deutsche_Bank_Career',
    ],
  },
  {
    id: 'balyasny',
    name: 'Balyasny Asset Management',
    urls: [
      'https://www.balyasny.com/careers',
      'https://boards.greenhouse.io/balyasny',
      'https://boards.greenhouse.io/balyasnyasset',
    ],
  },
  {
    id: 'centerview',
    name: 'Centerview Partners',
    urls: [
      'https://centerviewpartners.com/careers',
      'https://www.centerview.com/careers',
    ],
  },
  {
    id: 'macquarie',
    name: 'Macquarie Group',
    urls: [
      'https://recruitment.macquarie.com/en_US/careers',
    ],
  },
  {
    id: 'nomura',
    name: 'Nomura',
    urls: [
      'https://nomura.wd3.myworkdayjobs.com/nomura',
    ],
  },
  {
    id: 'd-e-shaw',
    name: 'D. E. Shaw',
    urls: [
      'https://www.deshaw.com/careers',
    ],
  },
];

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
    return { status: res.status, url: res.url, html: text, ok: res.ok, size: text.length };
  } catch (err) {
    clearTimeout(timer);
    return { status: 0, url, html: '', ok: false, error: err.message, size: 0 };
  }
}

function extractAllGHRefs(html) {
  const refs = new Set();
  // greenhouse.io/{slug} patterns
  const p1 = html.matchAll(/greenhouse\.io\/([a-zA-Z0-9._-]+)/gi);
  for (const m of p1) refs.add(m[1]);
  // embed references
  const p2 = html.matchAll(/greenhouse-embed/gi);
  for (const m of p2) refs.add('[embed-reference]');
  // window references
  const p3 = html.matchAll(/GreenhouseBoard\s*\(\s*["']([^"']+)["']/gi);
  for (const m of p3) refs.add(`board:${m[1]}`);
  return [...refs];
}

function findIframeSrcs(html) {
  const srcs = [];
  const pattern = /<iframe[^>]*src="([^"]+)"[^>]*>/gi;
  let m;
  while ((m = pattern.exec(html)) !== null) srcs.push(m[1]);
  return srcs;
}

function findGHEmbedCode(html) {
  // Look for greenhouse embed scripts
  const embedPatterns = [
    /greenhouse-embed\.js/gi,
    /boards\.greenhouse\.io\/([a-zA-Z0-9_-]+)/gi,
    /greenhouse_box/gi,
    /data-greenhouse-board/gi,
    /GreenhouseBoard\(/gi,
  ];
  const results = [];
  for (const p of embedPatterns) {
    const matches = [...html.matchAll(p)];
    if (matches.length > 0) {
      results.push({ pattern: p.source, count: matches.length, samples: matches.slice(0, 3).map(m => m[0]) });
    }
  }
  return results;
}

function findWorkdayRefs(html) {
  const refs = [];
  const p = html.matchAll(/([a-z0-9-]+)\.wd([0-9])\.myworkdayjobs\.com\/([a-zA-Z0-9_-]+)/gi);
  for (const m of p) refs.push({ tenant: m[1], site: m[3], full: m[0] });
  return refs;
}

function findEightfoldRefs(html) {
  const refs = [];
  const p = html.matchAll(/([a-z0-9]+)\.eightfold\.ai/gi);
  for (const m of p) refs.push(m[1]);
  return [...new Set(refs)];
}

function findSmartRecruiters(html) {
  const refs = [];
  const p = html.matchAll(/smartrecruiters\.com\/[^"'\s<>]+/gi);
  for (const m of p) refs.push(m[0]);
  return [...new Set(refs)];
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Deep Investigation: GH Token Verification & Error Fix     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  for (const firm of FIRMS_TO_DEEP) {
    console.log(`\n${'━'.repeat(60)}`);
    console.log(`  ${firm.name}`);
    console.log(`${'━'.repeat(60)}`);
    
    for (const url of firm.urls) {
      console.log(`\n  URL: ${url}`);
      const result = await fetchUrl(url);
      
      if (result.error) {
        console.log(`    ERROR: ${result.error}`);
        continue;
      }
      
      console.log(`    Status: ${result.status} | Final: ${result.url}`);
      console.log(`    Size: ${result.size} bytes`);
      
      const title = result.html.match(/<title[^>]*>([^<]+)<\/title>/i);
      console.log(`    Title: ${title ? title[1].trim() : '(none)'}`);
      
      const ghRefs = extractAllGHRefs(result.html);
      if (ghRefs.length > 0) console.log(`    GH Refs: ${ghRefs.join(', ')}`);
      
      const ghEmbed = findGHEmbedCode(result.html);
      if (ghEmbed.length > 0) {
        for (const e of ghEmbed) {
          console.log(`    GH Embed: ${e.pattern} (x${e.count})`);
          for (const s of e.samples) console.log(`      -> ${s}`);
        }
      }
      
      const iframes = findIframeSrcs(result.html);
      if (iframes.length > 0) console.log(`    Iframes: ${iframes.join('\n              ')}`);
      
      const workday = findWorkdayRefs(result.html);
      if (workday.length > 0) console.log(`    Workday: ${workday.map(w => w.full).join(', ')}`);
      
      const eightfold = findEightfoldRefs(result.html);
      if (eightfold.length > 0) console.log(`    Eightfold: ${eightfold.join(', ')}`);
      
      const sr = findSmartRecruiters(result.html);
      if (sr.length > 0) console.log(`    SmartRecruiters: ${sr.join(', ')}`);
      
      // Check for specific ATS markers in body
      const bodySnippet = result.html.substring(0, 50000);
      const atsChecks = [
        { name: 'Greenhouse Embed', pattern: /greenhouse-embed|GreenhouseBoard|greenhouse_box/gi },
        { name: 'Lever', pattern: /lever\.co/gi },
        { name: 'Workday', pattern: /myworkdayjobs|wday\.com/gi },
        { name: 'Eightfold', pattern: /eightfold\.ai/gi },
        { name: 'Workable', pattern: /workable\.com|workable\.io/gi },
        { name: 'SmartRecruiters', pattern: /smartrecruiters/gi },
        { name: 'iCIMS', pattern: /icims\.com/gi },
        { name: 'Avature', pattern: /avature/gi },
        { name: 'Taleo', pattern: /taleo/gi },
        { name: 'SuccessFactors', pattern: /successfactors/gi },
        { name: 'Greenhouse Board ID', pattern: /greenhouse_board_id|board_token/gi },
      ];
      
      const detected = [];
      for (const check of atsChecks) {
        if (check.pattern.test(bodySnippet)) detected.push(check.name);
      }
      if (detected.length > 0) console.log(`    ATS Detected: ${detected.join(', ')}`);
    }
  }
  
  // KKR specific: try to extract actual GH board token from the page
  console.log(`\n${'━'.repeat(60)}`);
  console.log('  KKR: Extracting Greenhouse Board Token from Page Source');
  console.log(`${'━'.repeat(60)}`);
  
  const kkr = await fetchUrl('https://www.kkr.com/careers/career-opportunities');
  if (kkr.ok) {
    // Search for GH board embed patterns
    const boardMatches = [...kkr.html.matchAll(/board_token[=:]["']?([a-zA-Z0-9_-]+)/gi)];
    console.log(`  board_token matches: ${boardMatches.map(m => m[1]).join(', ') || '(none)'}`);
    
    const embedMatches = [...kkr.html.matchAll(/greenhouse-embed[^"']*"|src="[^"]*greenhouse[^"]*"/gi)];
    console.log(`  GH embed tags: ${embedMatches.map(m => m[0]).join('\n              ')}`);
    
    // Look for the actual embed script
    const scriptMatch = kkr.html.match(/<script[^>]*greenhouse[^>]*>([\s\S]*?)<\/script>/gi);
    if (scriptMatch) {
      console.log(`  GH script tags found: ${scriptMatch.length}`);
      for (const s of scriptMatch.slice(0, 3)) {
        const snippet = s.substring(0, 300);
        console.log(`    -> ${snippet}`);
      }
    }
    
    // Check for JS that initializes GH board
    const jsMatch = kkr.html.match(/GreenhouseBoard\s*\(\s*\{[^}]+\}/gi);
    if (jsMatch) {
      console.log(`  GH JS init calls: ${jsMatch.join('\n              ')}`);
    }
    
    // Check for window.__greenhouse or similar
    const windowMatch = kkr.html.match(/window\.__[a-zA-Z]*[Gg]reenhouse[^;]+/gi);
    if (windowMatch) {
      console.log(`  Window GH vars: ${windowMatch.join('\n              ')}`);
    }
  }
}

main().catch(console.error);
