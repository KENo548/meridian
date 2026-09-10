import { setKV, getKV } from '../db.js'

function makeSource(provider, config) {
  return {
    provider,
    careersUrl: config.careersUrl || null,
    verified: config.verified !== undefined ? config.verified : false,
    enabled: config.enabled !== undefined ? config.enabled : true,
    sourceOrigin: config.sourceOrigin || 'curated', // 'curated' | 'discovered' | 'historical'
    scope: config.scope || 'global',
    ...config,
  }
}

function makeCareerSource(provider, config) {
  return {
    provider,
    verified: config.verified !== undefined ? config.verified : false,
    discoveredAt: config.discoveredAt || new Date().toISOString(),
    discoveryMethod: config.discoveryMethod || 'curated',
    sourceOrigin: config.sourceOrigin || 'discovered', // 'curated' | 'discovered' | 'historical'
    sourceUrl: config.sourceUrl || null,
    scope: config.scope || 'unknown',
    companyId: config.companyId || null,
    tenant: config.tenant || null,
    boardSlug: config.boardSlug || null,
    enabled: config.enabled !== undefined ? config.enabled : true,
    lastEnumeratedAt: null,
    totalJobsEnumerated: 0,
  }
}

const FIRMS = [
  // P0: Bulge Bracket
  {
    id: 'goldman-sachs',
    name: 'Goldman Sachs',
    category: 'bulge_bracket',
    careersUrl: 'https://hdpc.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/LateralHiring/jobs',
    enabled: true,
    priority: 'P0',
    careersProvider: 'oracle_hcm',
    atsSlug: null,
    sources: [
      { provider: 'oracle_hcm', careersUrl: 'https://hdpc.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/LateralHiring/jobs', enabled: true, sourceOrigin: 'curated', atsHostname: 'hdpc.fa.us2.oraclecloud.com', atsSiteNumber: 'LateralHiring' },
    ],
    careerSources: [],
  },
  {
    id: 'jpmorgan',
    name: 'JPMorgan',
    category: 'bulge_bracket',
    careersUrl: 'https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience',
    enabled: false,
    priority: 'P0',
    careersProvider: 'oracle_hcm',
    atsSlug: null,
    notes: 'Oracle HCM — needs custom adapter',
    sources: [
      { provider: 'oracle_hcm', careersUrl: 'https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/jobs', enabled: true, sourceOrigin: 'curated', atsHostname: 'jpmc.fa.oraclecloud.com', atsSiteNumber: 'CX_1001' },
    ],
  },
  {
    id: 'morgan-stanley',
    name: 'Morgan Stanley',
    category: 'bulge_bracket',
    careersUrl: 'https://morganstanley.eightfold.ai/careers',
    enabled: true,
    priority: 'P0',
    careersProvider: 'eightfold',
    atsSlug: null,
    eightfold: { domain: 'morganstanley.com', slug: 'morganstanley' },
    notes: 'Eightfold AI — sitemap fallback',
    sources: [
      { provider: 'eightfold', careersUrl: 'https://morganstanley.eightfold.ai/careers', enabled: true, sourceOrigin: 'discovered', eightfold: { domain: 'morganstanley.com', slug: 'morganstanley' } },
    ],
  },
  {
    id: 'bank-of-america',
    name: 'Bank of America',
    aliases: ['BofA', 'BAC', 'Bank of America Merrill Lynch', 'BAML'],
    category: 'bulge_bracket',
    careersUrl: 'https://ghr.wd1.myworkdayjobs.com/Bank_of_America_Careers',
    enabled: false,
    priority: 'P0',
    careersProvider: 'workday',
    atsSlug: 'bankofamerica.wd1.myworkdayjobs.com',
    workdayTenant: 'bankofamerica',
    workdaySite: 'Bank_of_America_Careers',
    notes: 'Phase 2.1 verified: Workday API returns 422 (Cloudflare anti-bot). Needs source discovery to find current careers infrastructure.',
    sources: [
      makeSource('workday', {
        careersUrl: 'https://ghr.wd1.myworkdayjobs.com/Bank_of_America_Careers',
        enabled: false,
        verified: false,
        atsSlug: 'bankofamerica.wd1.myworkdayjobs.com',
        workdayTenant: 'bankofamerica',
        workdaySite: 'Bank_of_America_Careers',
        sourceNote: 'Workday 422 Cloudflare blocked',
      }),
    ],
  },
  {
    id: 'citi',
    name: 'Citi',
    aliases: ['Citigroup', 'Citigroup Inc', 'Citi Group'],
    category: 'bulge_bracket',
    careersUrl: 'https://citi.wd5.myworkdayjobs.com/citi',
    enabled: false,
    priority: 'P0',
    careersProvider: 'workday',
    atsSlug: 'citi.wd5.myworkdayjobs.com',
    workdayTenant: 'citi',
    workdaySite: 'citi',
    notes: 'Phase 2.1 verified: Workday API returns 404 — site name changed. Tested 6 alternate site names, all 404. Needs source discovery.',
    sources: [
      makeSource('workday', {
        careersUrl: 'https://citi.wd5.myworkdayjobs.com/citi',
        enabled: false,
        verified: false,
        atsSlug: 'citi.wd5.myworkdayjobs.com',
        workdayTenant: 'citi',
        workdaySite: 'citi',
        sourceNote: 'Workday 404 site changed',
      }),
    ],
  },
  {
    id: 'barclays',
    name: 'Barclays',
    aliases: ['Barclays PLC', 'Barclays Bank'],
    category: 'bulge_bracket',
    careersUrl: 'https://barclays.wd3.myworkdayjobs.com/barclays',
    enabled: false,
    priority: 'P0',
    careersProvider: 'workday',
    atsSlug: 'barclays.wd3.myworkdayjobs.com',
    workdayTenant: 'barclays',
    workdaySite: 'barclays',
    notes: 'Phase 2.1 verified: Workday API returns 404 — site name changed. Tested 6 alternate site names, all 404. Needs source discovery.',
    sources: [
      makeSource('workday', {
        careersUrl: 'https://barclays.wd3.myworkdayjobs.com/barclays',
        enabled: false,
        verified: false,
        atsSlug: 'barclays.wd3.myworkdayjobs.com',
        workdayTenant: 'barclays',
        workdaySite: 'barclays',
        sourceNote: 'Workday 404 site changed',
      }),
    ],
  },
  {
    id: 'ubs',
    name: 'UBS',
    category: 'bulge_bracket',
    careersUrl: 'https://www.ubs.com/global/en/careers.html',
    enabled: false,
    priority: 'P0',
    careersProvider: 'custom',
    atsSlug: null,
    notes: 'Custom careers site — jobs.ubs.com returns 500',
    sources: [],
  },
  {
    id: 'deutsche-bank',
    name: 'Deutsche Bank',
    category: 'bulge_bracket',
    careersUrl: 'https://careers.db.com',
    enabled: false,
    priority: 'P0',
    careersProvider: 'successfactors',
    atsSlug: null,
    notes: 'SAP SuccessFactors — URLs blocked/changed',
    sources: [],
  },
  {
    id: 'hsbc',
    name: 'HSBC',
    category: 'bulge_bracket',
    careersUrl: 'https://mycareer.hsbc.com',
    enabled: false,
    priority: 'P0',
    careersProvider: 'custom',
    atsSlug: null,
    notes: 'Custom + Eightfold AI',
    sources: [],
  },
  // P0: Elite Boutiques
  {
    id: 'evercore',
    name: 'Evercore',
    category: 'elite_boutique',
    careersUrl: 'https://evercore.tal.net/vx/mobile-0/appcentre-ext/brand-4/candidate/jobboard/vacancy/2/adv',
    enabled: true,
    priority: 'P0',
    careersProvider: 'oleeo_rss',
    atsSlug: 'evercore',
    oleeoRssUrl: 'https://evercore.tal.net/vx/mobile-0/appcentre-ext/brand-4/candidate/jobboard/vacancy/2/feed',
    sources: [
      makeSource('oleeo_rss', {
        careersUrl: 'https://evercore.tal.net/vx/mobile-0/appcentre-ext/brand-4/candidate/jobboard/vacancy/2/feed',
        verified: true,
        atsSlug: 'evercore',
      }),
    ],
  },
  {
    id: 'lazard',
    name: 'Lazard',
    aliases: ['Lazard Ltd', 'Lazard Frères'],
    category: 'elite_boutique',
    careersUrl: 'https://lazard-careers.tal.net/vx/lang-en-GB/mobile-0/appcentre1/brand-3/emp-1/Home',
    enabled: false,
    priority: 'P0',
    careersProvider: 'oleeo_rss',
    atsSlug: 'lazard',
    oleeoRssUrl: 'https://lazard-careers.tal.net/vx/mobile-0/appcentre-ext/brand-3/candidate/jobboard/vacancy/2/feed',
    notes: 'Phase 2.1 verified: Oleeo RSS returns 0 entries (board valid but empty). Professional careers on Oracle HCM (icbpjb.fa.ocs.oraclecloud.com). Needs source discovery.',
    sources: [
      makeSource('oleeo_rss', {
        careersUrl: 'https://lazard-careers.tal.net/vx/mobile-0/appcentre-ext/brand-3/candidate/jobboard/vacancy/2/feed',
        enabled: false,
        verified: false,
        atsSlug: 'lazard',
        sourceNote: 'Oleeo RSS valid but empty board',
      }),
    ],
  },
  {
    id: 'moelis',
    name: 'Moelis & Company',
    aliases: ['Moelis & Company LLC', 'Moelis'],
    category: 'elite_boutique',
    careersUrl: 'https://moelis-careers.tal.net/vx/mobile-0/appcentre-1/brand-4/candidate/jobboard/vacancy/2',
    enabled: true,
    priority: 'P0',
    careersProvider: 'oleeo_rss',
    atsSlug: 'moelis',
    oleeoRssUrl: 'https://moelis-careers.tal.net/vx/mobile-0/appcentre-ext/brand-4/candidate/jobboard/vacancy/2/feed',
    sources: [
      makeSource('oleeo_rss', {
        careersUrl: 'https://moelis-careers.tal.net/vx/mobile-0/appcentre-ext/brand-4/candidate/jobboard/vacancy/2/feed',
        verified: true,
        atsSlug: 'moelis',
      }),
    ],
  },
  {
    id: 'pjt-partners',
    name: 'PJT Partners',
    aliases: ['PJT Capital Partners', 'PJT'],
    category: 'elite_boutique',
    careersUrl: 'https://pjtpartners.wd1.myworkdayjobs.com/Students',
    enabled: true,
    priority: 'P0',
    careersProvider: 'workday',
    atsSlug: 'pjtpartners.wd1.myworkdayjobs.com',
    workdayTenant: 'pjtpartners',
    workdaySite: 'Students',
    sources: [
      makeSource('workday', {
        careersUrl: 'https://pjtpartners.wd1.myworkdayjobs.com/Students',
        verified: true,
        atsSlug: 'pjtpartners.wd1.myworkdayjobs.com',
        workdayTenant: 'pjtpartners',
        workdaySite: 'Students',
      }),
    ],
  },
  {
    id: 'rothschild',
    name: 'Rothschild & Co',
    aliases: ['Rothschild', 'Rothschild & Co Multilateral', 'Rothschild & Co Investment Banking'],
    category: 'elite_boutique',
    careersUrl: 'https://rothschild.wd3.myworkdayjobs.com/rothschildandco',
    enabled: false,
    priority: 'P0',
    careersProvider: 'workday',
    atsSlug: 'rothschild.wd3.myworkdayjobs.com',
    workdayTenant: 'rothschild',
    workdaySite: 'rothschildandco',
    notes: 'Phase 2.1 verified: Workday API returns 422 (Cloudflare anti-bot). Needs source discovery to find current careers infrastructure.',
    sources: [
      makeSource('workday', {
        careersUrl: 'https://rothschild.wd3.myworkdayjobs.com/rothschildandco',
        enabled: false,
        verified: false,
        atsSlug: 'rothschild.wd3.myworkdayjobs.com',
        workdayTenant: 'rothschild',
        workdaySite: 'rothschildandco',
      }),
    ],
  },
  {
    id: 'centerview',
    name: 'Centerview Partners',
    category: 'elite_boutique',
    careersUrl: 'https://centerviewpartners.com/careers',
    enabled: false,
    priority: 'P0',
    careersProvider: 'custom',
    atsSlug: null,
    notes: 'Custom careers form — minimal web presence',
    sources: [],
  },
  // P1: Middle Market
  {
    id: 'houlihan-lokey',
    name: 'Houlihan Lokey',
    aliases: ['Houlihan Lokey Inc', 'Houlihan'],
    category: 'middle_market',
    careersUrl: 'https://houlihanlokey.wd1.myworkdayjobs.com/houlihanlokey',
    enabled: false,
    priority: 'P1',
    careersProvider: 'workday',
    atsSlug: 'houlihanlokey.wd1.myworkdayjobs.com',
    workdayTenant: 'houlihanlokey',
    workdaySite: 'houlihanlokey',
    notes: 'Phase 2.1 verified: Workday API returns 422 (Cloudflare anti-bot). Needs source discovery to find current careers infrastructure.',
    sources: [
      makeSource('workday', {
        careersUrl: 'https://houlihanlokey.wd1.myworkdayjobs.com/houlihanlokey',
        enabled: false,
        verified: false,
        atsSlug: 'houlihanlokey.wd1.myworkdayjobs.com',
        workdayTenant: 'houlihanlokey',
        workdaySite: 'houlihanlokey',
      }),
    ],
  },
  {
    id: 'jefferies',
    name: 'Jefferies',
    aliases: ['Jefferies Financial Group', 'Jefferies LLC', 'Jefferies & Company'],
    category: 'middle_market',
    careersUrl: 'https://jefferies.tal.net/vx/mobile-0/appcentre-ext/brand-4/candidate/jobboard/vacancy/2/adv/',
    enabled: true,
    priority: 'P1',
    careersProvider: 'oleeo_rss',
    atsSlug: 'jefferies',
    oleeoRssUrl: 'https://jefferies.tal.net/vx/mobile-0/appcentre-1/brand-4/candidate/jobboard/vacancy/2/feed',
    sources: [
      makeSource('oleeo_rss', {
        careersUrl: 'https://jefferies.tal.net/vx/mobile-0/appcentre-1/brand-4/candidate/jobboard/vacancy/2/feed',
        verified: true,
        atsSlug: 'jefferies',
      }),
    ],
  },
  {
    id: 'william-blair',
    name: 'William Blair',
    category: 'middle_market',
    careersUrl: 'https://boards.greenhouse.io/williamblair',
    enabled: true,
    priority: 'P1',
    careersProvider: 'greenhouse',
    atsSlug: 'williamblair',
    sources: [
      makeSource('greenhouse', {
        careersUrl: 'https://boards.greenhouse.io/williamblair',
        verified: true,
        atsSlug: 'williamblair',
      }),
    ],
  },
  // P1: Buy-Side / Alternatives
  {
    id: 'blackstone',
    name: 'Blackstone',
    category: 'private_equity',
    careersUrl: 'https://blackstone.wd1.myworkdayjobs.com/en-US/Blackstone_Careers',
    enabled: true,
    priority: 'P1',
    careersProvider: 'workday',
    atsSlug: 'blackstone.wd1.myworkdayjobs.com',
    workdayTenant: 'blackstone',
    workdaySite: 'Blackstone_Careers',
    sources: [
      makeSource('workday', {
        careersUrl: 'https://blackstone.wd1.myworkdayjobs.com/en-US/Blackstone_Careers',
        verified: true,
        atsSlug: 'blackstone.wd1.myworkdayjobs.com',
        workdayTenant: 'blackstone',
        workdaySite: 'Blackstone_Careers',
      }),
    ],
  },
  {
    id: 'kkr',
    name: 'KKR',
    category: 'private_equity',
    careersUrl: 'https://www.kkr.com/careers/career-opportunities',
    enabled: false,
    priority: 'P1',
    careersProvider: 'custom',
    atsSlug: null,
    notes: 'Greenhouse staging board (for=stage) not publicly accessible via API; needs custom scraper',
    sources: [],
  },
  {
    id: 'apollo',
    name: 'Apollo Global Management',
    aliases: ['Apollo', 'Apollo Management'],
    category: 'private_equity',
    careersUrl: 'https://apollo.wd1.myworkdayjobs.com/apollo',
    enabled: false,
    priority: 'P1',
    careersProvider: 'workday',
    atsSlug: 'apollo.wd1.myworkdayjobs.com',
    workdayTenant: 'apollo',
    workdaySite: 'apollo',
    notes: 'Phase 2.1 verified: Workday API returns 422 (Cloudflare anti-bot). Needs source discovery to find current careers infrastructure.',
    sources: [
      makeSource('workday', {
        careersUrl: 'https://apollo.wd1.myworkdayjobs.com/apollo',
        enabled: false,
        verified: false,
        atsSlug: 'apollo.wd1.myworkdayjobs.com',
        workdayTenant: 'apollo',
        workdaySite: 'apollo',
      }),
    ],
  },
  {
    id: 'carlyle',
    name: 'The Carlyle Group',
    category: 'private_equity',
    careersUrl: 'https://carlyle.avature.net/externalcareers/SearchJobs',
    enabled: false,
    priority: 'P1',
    careersProvider: 'avature',
    atsSlug: null,
    notes: 'Avature — needs custom adapter',
    sources: [],
  },
  {
    id: 'ares',
    name: 'Ares Management',
    category: 'private_equity',
    careersUrl: 'https://aresmgmt.wd1.myworkdayjobs.com/External',
    enabled: true,
    priority: 'P1',
    careersProvider: 'workday',
    atsSlug: 'aresmgmt.wd1.myworkdayjobs.com',
    workdayTenant: 'aresmgmt',
    workdaySite: 'External',
    sources: [
      makeSource('workday', {
        careersUrl: 'https://aresmgmt.wd1.myworkdayjobs.com/External',
        verified: true,
        atsSlug: 'aresmgmt.wd1.myworkdayjobs.com',
        workdayTenant: 'aresmgmt',
        workdaySite: 'External',
      }),
    ],
  },
  // P1: Hedge Funds / Quant / Trading
  {
    id: 'citadel',
    name: 'Citadel',
    category: 'hedge_fund',
    careersUrl: 'https://www.citadel.com/careers/open-opportunities/',
    enabled: false,
    priority: 'P1',
    careersProvider: 'custom',
    atsSlug: null,
    notes: 'Proprietary careers portal; no public ATS API available',
    sources: [],
  },
  {
    id: 'point72',
    name: 'Point72',
    category: 'hedge_fund',
    careersUrl: 'https://boards.greenhouse.io/point72',
    enabled: true,
    priority: 'P1',
    careersProvider: 'greenhouse',
    atsSlug: 'point72',
    sources: [
      makeSource('greenhouse', {
        careersUrl: 'https://boards.greenhouse.io/point72',
        verified: true,
        atsSlug: 'point72',
      }),
    ],
  },
  {
    id: 'millennium',
    name: 'Millennium Management',
    category: 'hedge_fund',
    careersUrl: 'https://mlp.eightfold.ai/careers',
    enabled: true,
    priority: 'P1',
    careersProvider: 'eightfold',
    atsSlug: null,
    eightfold: { domain: 'mlp.com', slug: 'mlp' },
    notes: 'Eightfold AI — API works',
    sources: [
      { provider: 'eightfold', careersUrl: 'https://mlp.eightfold.ai/careers', enabled: true, sourceOrigin: 'discovered', eightfold: { domain: 'mlp.com', slug: 'mlp' } },
    ],
  },
  {
    id: 'jane-street',
    name: 'Jane Street',
    category: 'prop_trading',
    careersUrl: 'https://boards.greenhouse.io/janestreet',
    enabled: true,
    priority: 'P1',
    careersProvider: 'greenhouse',
    atsSlug: 'janestreet',
    sources: [
      makeSource('greenhouse', {
        careersUrl: 'https://boards.greenhouse.io/janestreet',
        verified: true,
        atsSlug: 'janestreet',
      }),
    ],
  },
  {
    id: 'optiver',
    name: 'Optiver',
    category: 'prop_trading',
    careersUrl: 'https://job-boards.greenhouse.io/optiverus',
    enabled: true,
    priority: 'P1',
    careersProvider: 'greenhouse',
    atsSlug: 'optiverus',
    sources: [
      makeSource('greenhouse', {
        careersUrl: 'https://job-boards.greenhouse.io/optiverus',
        verified: true,
        atsSlug: 'optiverus',
      }),
    ],
  },
  {
    id: 'imc',
    name: 'IMC Trading',
    category: 'prop_trading',
    careersUrl: 'https://job-boards.eu.greenhouse.io/imc',
    enabled: true,
    priority: 'P1',
    careersProvider: 'greenhouse',
    atsSlug: 'imc',
    sources: [
      makeSource('greenhouse', {
        careersUrl: 'https://job-boards.eu.greenhouse.io/imc',
        verified: true,
        atsSlug: 'imc',
      }),
    ],
  },
  {
    id: 'susquehanna',
    name: 'Susquehanna (SIG)',
    category: 'prop_trading',
    careersUrl: 'https://careers.sig.com',
    enabled: false,
    priority: 'P1',
    careersProvider: 'custom',
    atsSlug: null,
    notes: 'Jibe/Radancy — needs custom adapter',
    sources: [],
  },

  // ── Priority A: High-finance firms with catalogue entries ──────
  {
    id: 'd-e-shaw',
    name: 'D. E. Shaw',
    category: 'hedge_fund',
    careersUrl: 'https://www.deshaw.com/careers',
    enabled: true,
    priority: 'P1',
    careersProvider: 'custom',
    atsSlug: null,
    sources: [
      { provider: 'custom', careersUrl: 'https://www.deshaw.com/careers', enabled: true, sourceOrigin: 'discovered' },
    ],
    careerSources: [],
  },
  {
    id: 'macquarie',
    name: 'Macquarie Group',
    category: 'bank',
    careersUrl: 'https://careers.macquarie.com',
    enabled: true,
    priority: 'P1',
    careersProvider: 'avature',
    atsSlug: null,
    sources: [
      { provider: 'avature', careersUrl: 'https://recruitment.macquarie.com/en_US/careers/SearchJobs/feed/?jobRecordsPerPage=50', enabled: true, sourceOrigin: 'discovered' },
    ],
    careerSources: [],
  },
  {
    id: 'nomura',
    name: 'Nomura',
    category: 'bulge_bracket',
    careersUrl: 'https://careers.nomura.com',
    enabled: true,
    priority: 'P1',
    careersProvider: 'successfactors',
    atsSlug: null,
    sources: [
      { provider: 'successfactors', careersUrl: 'https://careers.nomura.com/Nomura/search/?q=&optionsFacetsDD_title=&optionsFacetsDD_facility=&optionsFacetsDD_department=', enabled: true, sourceOrigin: 'discovered' },
    ],
    careerSources: [],
  },
  {
    id: 'squarepoint',
    name: 'Squarepoint Capital',
    category: 'hedge_fund',
    careersUrl: 'https://www.squarepoint.com/careers',
    enabled: true,
    priority: 'P1',
    careersProvider: 'custom',
    atsSlug: null,
    sources: [],
    careerSources: [],
  },
  {
    id: 'balyasny',
    name: 'Balyasny Asset Management',
    category: 'hedge_fund',
    careersUrl: 'https://www.balyasny.com/careers',
    enabled: true,
    priority: 'P1',
    careersProvider: 'custom',
    atsSlug: null,
    sources: [],
    careerSources: [],
  },
  {
    id: 'man-group',
    name: 'Man Group',
    category: 'hedge_fund',
    careersUrl: 'https://boards.greenhouse.io/mangroup',
    enabled: true,
    priority: 'P1',
    careersProvider: 'greenhouse',
    atsSlug: 'mangroup',
    sources: [
      { provider: 'greenhouse', careersUrl: 'https://boards.greenhouse.io/mangroup', enabled: true, sourceOrigin: 'discovered', atsSlug: 'mangroup' },
    ],
    careerSources: [],
  },
  {
    id: 'brevan-howard',
    name: 'Brevan Howard',
    category: 'hedge_fund',
    careersUrl: 'https://www.brevanhoward.com/careers',
    enabled: true,
    priority: 'P1',
    careersProvider: 'custom',
    atsSlug: null,
    sources: [
      { provider: 'custom', careersUrl: 'https://www.brevanhoward.com/careers', enabled: true, sourceOrigin: 'discovered' },
    ],
    careerSources: [],
  },
  {
    id: 'capula',
    name: 'Capula Investment Management',
    category: 'hedge_fund',
    careersUrl: 'https://www.capula.com/careers',
    enabled: true,
    priority: 'P1',
    careersProvider: 'custom',
    atsSlug: null,
    sources: [],
    careerSources: [],
  },
  {
    id: 'abn-amro',
    name: 'ABN AMRO',
    category: 'bank',
    careersUrl: 'https://www.abnamro.com/en/careers',
    enabled: true,
    priority: 'P1',
    careersProvider: 'custom',
    atsSlug: null,
    sources: [],
    careerSources: [],
  },
  {
    id: 'julius-baer',
    name: 'Julius Baer',
    category: 'bank',
    careersUrl: 'https://www.juliusbaer.com/careers',
    enabled: true,
    priority: 'P1',
    careersProvider: 'custom',
    atsSlug: null,
    sources: [],
    careerSources: [],
  },
  {
    id: 'nuveen',
    name: 'Nuveen',
    category: 'asset_management',
    careersUrl: 'https://www.nuveen.com/en-us/careers',
    enabled: true,
    priority: 'P1',
    careersProvider: 'custom',
    atsSlug: null,
    sources: [],
    careerSources: [],
  },
  {
    id: 'dimensional',
    name: 'Dimensional Fund Advisors',
    category: 'asset_management',
    careersUrl: 'https://www.dimensional.com/careers',
    enabled: true,
    priority: 'P1',
    careersProvider: 'custom',
    atsSlug: null,
    sources: [],
    careerSources: [],
  },
  {
    id: 'da-vinci-trading',
    name: 'Da Vinci Trading',
    category: 'hedge_fund',
    careersUrl: 'https://job-boards.eu.greenhouse.io/davinciderivatives',
    enabled: true,
    priority: 'P2',
    careersProvider: 'greenhouse',
    atsSlug: 'davinciderivatives',
    sources: [
      { provider: 'greenhouse', careersUrl: 'https://job-boards.eu.greenhouse.io/davinciderivatives', enabled: true, sourceOrigin: 'curated', atsSlug: 'davinciderivatives' }
    ],
    careerSources: [],
  },
  {
    id: 'maven-securities',
    name: 'Maven Securities',
    category: 'broker_dealer',
    careersUrl: 'https://boards.greenhouse.io/mavensecuritiesholdingltd',
    enabled: true,
    priority: 'P1',
    careersProvider: 'greenhouse',
    atsSlug: 'mavensecuritiesholdingltd',
    sources: [
      { provider: 'greenhouse', careersUrl: 'https://boards.greenhouse.io/mavensecuritiesholdingltd', enabled: true, sourceOrigin: 'curated', atsSlug: 'mavensecuritiesholdingltd' }
    ],
    careerSources: [],
  },
  {
    id: 'bain',
    name: 'Bain & Company',
    category: 'consulting',
    careersUrl: 'https://www.bain.com/careers',
    enabled: true,
    priority: 'P1',
    careersProvider: 'custom',
    atsSlug: null,
    sources: [],
    careerSources: [],
  },
  {
    id: 'kpmg',
    name: 'KPMG',
    category: 'consulting',
    careersUrl: 'https://kpmg.com/xx/en/careers/job-search.html',
    enabled: true,
    priority: 'P1',
    careersProvider: 'custom',
    atsSlug: null,
    sources: [],
    careerSources: [],
  },
  {
    id: 'cd-r',
    name: 'Clayton, Dubilier & Rice',
    category: 'private_equity',
    careersUrl: 'https://www.cdr.com/working-at-cdr',
    enabled: true,
    priority: 'P1',
    careersProvider: 'custom',
    atsSlug: null,
    sources: [],
    careerSources: [],
  },
  {
    id: 'temasek',
    name: 'Temasek',
    category: 'private_equity',
    careersUrl: 'https://www.temasek.com.sg/careers',
    enabled: true,
    priority: 'P1',
    careersProvider: 'custom',
    atsSlug: null,
    sources: [],
    careerSources: [],
  },

  // === EXPANDED: Resolved-but-unregistered firms (Step 3) ===
  // Tier 1: Greenhouse — known working adapter
  {
    id: 'lincoln-international',
    name: 'Lincoln International',
    category: 'middle_market',
    careersUrl: 'https://boards.greenhouse.io/lincolninternational',
    enabled: true,
    priority: 'P1',
    careersProvider: 'greenhouse',
    atsSlug: 'lincolninternational',
    sources: [
      makeSource('greenhouse', {
        careersUrl: 'https://boards.greenhouse.io/lincolninternational',
        verified: false,
        boardSlug: 'lincolninternational',
      }),
    ],
    careerSources: [],
  },
  {
    id: 'gsa-capital',
    name: 'GSA Capital',
    category: 'quant_hedge_fund',
    careersUrl: 'https://boards.greenhouse.io/gsacapital',
    enabled: true,
    priority: 'P1',
    careersProvider: 'greenhouse',
    atsSlug: 'gsacapital',
    sources: [
      makeSource('greenhouse', {
        careersUrl: 'https://boards.greenhouse.io/gsacapital',
        verified: false,
        boardSlug: 'gsacapital',
      }),
    ],
    careerSources: [],
  },
  // Tier 2: Workday — known working adapter (verified 0 failures for these tenants)
  {
    id: 'blackrock',
    name: 'BlackRock',
    category: 'asset_management',
    careersUrl: 'https://blackrock.wd1.myworkdayjobs.com/BlackRock_Professional',
    enabled: true,
    priority: 'P1',
    careersProvider: 'workday',
    atsSlug: 'blackrock.wd1.myworkdayjobs.com',
    workdayTenant: 'blackrock',
    workdaySite: 'BlackRock_Professional',
    sources: [
      makeSource('workday', {
        careersUrl: 'https://blackrock.wd1.myworkdayjobs.com/BlackRock_Professional',
        verified: false,
        tenant: 'blackrock',
        workdaySite: 'BlackRock_Professional',
      }),
    ],
    careerSources: [],
  },
  {
    id: 'barings',
    name: 'Barings',
    category: 'asset_management',
    careersUrl: 'https://barings.wd1.myworkdayjobs.com/barings',
    enabled: true,
    priority: 'P1',
    careersProvider: 'workday',
    atsSlug: 'barings.wd1.myworkdayjobs.com',
    workdayTenant: 'barings',
    workdaySite: 'barings',
    sources: [
      makeSource('workday', {
        careersUrl: 'https://barings.wd1.myworkdayjobs.com/barings',
        verified: false,
        tenant: 'barings',
        workdaySite: 'barings',
      }),
    ],
    careerSources: [],
  },
  {
    id: 'pimco',
    name: 'PIMCO',
    category: 'asset_management',
    careersUrl: 'https://pimco.wd1.myworkdayjobs.com/pimco-careers',
    enabled: true,
    priority: 'P1',
    careersProvider: 'workday',
    atsSlug: 'pimco.wd1.myworkdayjobs.com',
    workdayTenant: 'pimco',
    workdaySite: 'pimco-careers',
    sources: [
      makeSource('workday', {
        careersUrl: 'https://pimco.wd1.myworkdayjobs.com/pimco-careers',
        verified: false,
        tenant: 'pimco',
        workdaySite: 'pimco-careers',
      }),
    ],
    careerSources: [],
  },
  {
    id: 'capital-group',
    name: 'Capital Group',
    category: 'asset_management',
    careersUrl: 'https://capgroup.wd1.myworkdayjobs.com/capitalgroupcareers',
    enabled: true,
    priority: 'P1',
    careersProvider: 'workday',
    atsSlug: 'capgroup.wd1.myworkdayjobs.com',
    workdayTenant: 'capgroup',
    workdaySite: 'capitalgroupcareers',
    sources: [
      makeSource('workday', {
        careersUrl: 'https://capgroup.wd1.myworkdayjobs.com/capitalgroupcareers',
        verified: false,
        tenant: 'capgroup',
        workdaySite: 'capitalgroupcareers',
      }),
    ],
    careerSources: [],
  },
  {
    id: 'cboe',
    name: 'Cboe Global Markets',
    category: 'exchanges',
    careersUrl: 'https://cboe.wd1.myworkdayjobs.com/External_Career_CBOE',
    enabled: true,
    priority: 'P2',
    careersProvider: 'workday',
    atsSlug: 'cboe.wd1.myworkdayjobs.com',
    workdayTenant: 'cboe',
    workdaySite: 'External_Career_CBOE',
    sources: [
      makeSource('workday', {
        careersUrl: 'https://cboe.wd1.myworkdayjobs.com/External_Career_CBOE',
        verified: false,
        tenant: 'cboe',
        workdaySite: 'External_Career_CBOE',
      }),
    ],
    careerSources: [],
  },
  {
    id: 'vanguard',
    name: 'Vanguard',
    category: 'asset_management',
    careersUrl: 'https://vanguard.wd5.myworkdayjobs.com/vanguard_external',
    enabled: true,
    priority: 'P1',
    careersProvider: 'workday',
    atsSlug: 'vanguard.wd5.myworkdayjobs.com',
    workdayTenant: 'vanguard',
    workdaySite: 'vanguard_external',
    sources: [
      makeSource('workday', {
        careersUrl: 'https://vanguard.wd5.myworkdayjobs.com/vanguard_external',
        verified: false,
        tenant: 'vanguard',
        workdaySite: 'vanguard_external',
      }),
    ],
    careerSources: [],
  },
  {
    id: 'fidelity-international',
    name: 'Fidelity International',
    category: 'asset_management',
    careersUrl: 'https://fil.wd3.myworkdayjobs.com/001',
    enabled: true,
    priority: 'P1',
    careersProvider: 'workday',
    atsSlug: 'fil.wd3.myworkdayjobs.com',
    workdayTenant: 'fil',
    workdaySite: '001',
    sources: [
      makeSource('workday', {
        careersUrl: 'https://fil.wd3.myworkdayjobs.com/001',
        verified: false,
        tenant: 'fil',
        workdaySite: '001',
      }),
    ],
    careerSources: [],
  },
  // Tier 3: No supported adapter — add to registry but disabled
  {
    id: 'schroders',
    name: 'Schroders',
    category: 'asset_management',
    careersUrl: 'https://icbpjb.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/jobs',
    enabled: false,
    priority: 'P2',
    careersProvider: 'oracle_hcm',
    atsSlug: null,
    notes: 'Oracle HCM Cloud — needs custom adapter',
    sources: [
      { provider: 'oracle_hcm', careersUrl: 'https://icbpjb.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/jobs', enabled: true, sourceOrigin: 'curated', atsHostname: 'icbpjb.fa.ocs.oraclecloud.com', atsSiteNumber: 'CX_1001' },
    ],
    careerSources: [],
  },
  {
    id: 'interpath',
    name: 'Interpath Advisory',
    category: 'advisory',
    careersUrl: 'https://www.interpath.com/careers',
    enabled: true,
    priority: 'P2',
    careersProvider: 'workable',
    atsSlug: null,
    notes: 'Workable — needs custom adapter',
    sources: [
      { provider: 'workable', careersUrl: 'https://www.interpath.com/careers', enabled: true, sourceOrigin: 'discovered' },
    ],
    careerSources: [],
  },
  {
    id: 'rede-partners',
    name: 'Rede Partners',
    category: 'advisory',
    careersUrl: 'https://www.rede-partners.com/careers-database',
    enabled: false,
    priority: 'P2',
    careersProvider: 'custom',
    atsSlug: null,
    notes: 'No ATS — jobs posted on careers page, apply via careers@rede-partners.com',
    sources: [],
    careerSources: [],
  },
]

function getAllFirms() {
  return FIRMS.map(f => ({ ...f }))
}

function updateFirmCareerSources(firmId, careerSources) {
  const firm = FIRMS.find(f => f.id === firmId)
  if (!firm) return false
  firm.careerSources = careerSources
  return true
}

function addCareerSourceToFirm(firmId, careerSource) {
  const firm = FIRMS.find(f => f.id === firmId)
  if (!firm) return false
  if (!firm.careerSources) firm.careerSources = []
  const existing = firm.careerSources.find(
    cs => cs.provider === careerSource.provider && cs.scope === careerSource.scope
  )
  if (existing) {
    Object.assign(existing, careerSource)
  } else {
    firm.careerSources.push(careerSource)
  }
  // Persist discovered career sources to SQLite
  const allSources = getKV('discovered_career_sources') || {}
  allSources[firmId] = firm.careerSources
  setKV('discovered_career_sources', allSources)
  return true
}

function getEnabledFirms() {
  return FIRMS.filter(f => f.enabled).map(f => ({ ...f }))
}

function getFirmById(id) {
  return FIRMS.find(f => f.id === id) || null
}

function getFirmsByProvider(provider) {
  return FIRMS.filter(f => f.careersProvider === provider && f.enabled).map(f => ({ ...f }))
}

function getFirmsByCategory(category) {
  return FIRMS.filter(f => f.category === category).map(f => ({ ...f }))
}

function toggleFirm(id, enabled) {
  const firm = FIRMS.find(f => f.id === id)
  if (!firm) return null
  firm.enabled = Boolean(enabled)
  return { ...firm }
}

function getEnabledSources(firm) {
  if (!firm || !Array.isArray(firm.sources)) return []
  return firm.sources.filter(s => s.enabled !== false)
}

function getAllSources(firm) {
  if (!firm || !firm.sources) return []
  return firm.sources
}

function getVerifiedSources(firm) {
  if (!firm || !firm.sources) return []
  return firm.sources.filter(s => s.verified)
}

function addSourceToRegistry(firmId, source) {
  const firm = FIRMS.find(f => f.id === firmId)
  if (!firm) return null
  if (!firm.sources) firm.sources = []
  const existing = firm.sources.find(s => s.provider === source.provider)
  if (existing) {
    Object.assign(existing, source)
  } else {
    firm.sources.push(makeSource(source.provider, source))
  }
  return { ...firm }
}

function markSourceVerified(firmId, provider) {
  const firm = FIRMS.find(f => f.id === firmId)
  if (!firm || !firm.sources) return null
  const source = firm.sources.find(s => s.provider === provider)
  if (!source) return null
  source.verified = true
  return { ...firm }
}

function getSourceStats() {
  const providers = {}
  for (const firm of FIRMS) {
    const sources = firm.sources || []
    for (const source of sources) {
      const p = source.provider
      if (!providers[p]) {
        providers[p] = { total: 0, enabled: 0, verified: 0, firms: [] }
      }
      providers[p].total++
      if (source.enabled !== false) providers[p].enabled++
      if (source.verified) providers[p].verified++
      providers[p].firms.push(firm.name)
    }
  }
  return {
    totalFirms: FIRMS.length,
    enabledFirms: FIRMS.filter(f => f.enabled).length,
    byProvider: providers,
  }
}

export {
  getAllFirms,
  getEnabledFirms,
  getFirmById,
  getFirmsByProvider,
  getFirmsByCategory,
  toggleFirm,
  getSourceStats,
  getEnabledSources,
  getAllSources,
  getVerifiedSources,
  addSourceToRegistry,
  markSourceVerified,
  makeSource,
  updateFirmCareerSources,
  addCareerSourceToFirm,
  FIRMS,
}

// Restore discovered career sources from SQLite
try {
  const saved = getKV('discovered_career_sources')
  if (saved && typeof saved === 'object') {
    let restored = 0
    for (const [firmId, sources] of Object.entries(saved)) {
      const firm = FIRMS.find(f => f.id === firmId)
      if (firm && Array.isArray(sources)) {
        firm.careerSources = sources
        restored++
      }
    }
    if (restored > 0) {
      console.log(`[Registry] Restored discovered career sources for ${restored} firms from SQLite`)
    }
  }
} catch (err) {
  console.error('[Registry] Failed to restore career sources:', err.message)
}
