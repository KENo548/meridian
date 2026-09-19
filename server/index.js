import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import authRouter, { verifyAuth } from './auth.js';
import { extractLanguagesFromJob } from './sources/extractLanguages.js';

process.on('unhandledRejection', (err) => {
  console.error('[UnhandledRejection]', err?.message || err);
});

// ─── Lazy imports — heavy modules loaded on first use ────────────
// These are NOT imported at startup. They load on first route hit,
// so the server can start listening and respond to /api/health in <2s.

let _lazy = null
async function lazy() {
  if (_lazy) return _lazy
  const [adzuna, jsearch, rss, registry, ats, scanMod, store, idx, resolve, pipeline, staleness] = await Promise.all([
    import('./sources/adzuna.js'),
    import('./sources/jsearch.js'),
    import('./sources/rss.js'),
    import('./sources/registry.js'),
    import('./sources/ats.js'),
    import('./sources/scan.js'),
    import('./sources/discovery/store.js'),
    import('./sources/discovery/index.js'),
    import('./sources/discovery/resolve-ats.js'),
    import('./sources/discovery/pipeline.js'),
    import('./sources/discovery/staleness.js'),
  ])
  _lazy = {
    searchAdzuna: adzuna.searchAdzuna,
    searchJSearch: jsearch.searchJSearch,
    getConfiguredFeeds: rss.getConfiguredFeeds,
    addFeed: rss.addFeed,
    addFeedWithCheck: rss.addFeedWithCheck,
    removeFeed: rss.removeFeed,
    toggleFeed: rss.toggleFeed,
    fetchAllFeeds: rss.fetchAllFeeds,
    getAllFirms: registry.getAllFirms,
    getEnabledFirms: registry.getEnabledFirms,
    getFirmById: registry.getFirmById,
    toggleFirm: registry.toggleFirm,
    getSourceStats: registry.getSourceStats,
    fetchFirmJobs: ats.fetchFirmJobs,
    fetchAllEnabledFirms: ats.fetchAllEnabledFirms,
    getCapability: ats.getCapability,
    CAPABILITY: ats.CAPABILITY,
    getSupportedProviders: ats.getSupportedProviders,
    getCoverageReport: scanMod.getCoverageReport,
    scanAll: scanMod.scanAll,
    scanSingleFirm: scanMod.scanSingleFirm,
    getLastScanResult: scanMod.getLastScanResult,
    getScanStatus: scanMod.getScanStatus,
    startCronScan: scanMod.startCronScan,
    getAllDiscoveries: store.getAll,
    getDiscoveryStats: store.getStats,
    runDiscovery: idx.runDiscovery,
    getDiscoveryReport: idx.getDiscoveryStats,
    resolveOpportunities: resolve.resolveOpportunities,
    generateCoverageGapReport: resolve.generateCoverageGapReport,
    SUPPORTED_DIRECT_PROVIDERS: resolve.SUPPORTED_DIRECT_PROVIDERS,
    discoverFirmSources: pipeline.discoverFirmSources,
    enumerateDirectJobs: pipeline.enumerateDirectJobs,
    matchTrackerToDirect: pipeline.matchTrackerToDirect,
    getPipelineStatus: pipeline.getPipelineStatus,
    clearPipelineState: pipeline.clearPipelineState,
    getStalenessReport: staleness.getStalenessReport,
    applyStalenessTransitions: staleness.applyStalenessTransitions,
  }
  // Hydrate module state from the authoritative database before serving.
  // All four are idempotent. initPipelineState/loadFromDisk propagate DB
  // failures (DB unavailable → route 500, never silent success).
  // initRssFeeds/initRegistry degrade to file/defaults on DB read failure
  // (reads only); their durable WRITES always propagate rejections.
  await Promise.all([
    rss.initRssFeeds(),
    registry.initRegistry(),
    pipeline.initPipelineState(),
    store.loadFromDisk(),
  ])
  return _lazy
}

// DB functions — lazy-loaded (getDb() triggers DB open on first call)
import {
  getCanonicalJobs,
  getOpenCanonicalJobs,
  countCanonicalJobs,
  getActiveSightingsForJob,
  getActiveSightingsForJobs,
  getAllSightingsForJob,
  getCanonicalJobById,
  getAllAdapterHealth,
  getDb,
} from './db-adapter.js';

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true)
    const allowed = [
      'http://localhost:5173', 'http://127.0.0.1:5173',
      'http://localhost:5174', 'http://127.0.0.1:5174',
    ]
    // In dev, allow any LAN origin
    if (allowed.includes(origin) || /^https?:\/\/(localhost|127\.0\.0\.1|\d+\.\d+\.\d+\.\d+):\d+$/.test(origin)) {
      return callback(null, true)
    }
    // Allow configured frontend URLs (comma-separated)
    if (process.env.FRONTEND_URL) {
      const urls = process.env.FRONTEND_URL.split(',').map(u => u.trim())
      if (urls.includes(origin)) return callback(null, true)
    }
    // In staging, allow any Vercel preview URL for this project
    if (process.env.NODE_ENV === 'staging' && /\.vercel\.app$/.test(origin)) {
      return callback(null, true)
    }
    callback(new Error('Not allowed by CORS'), false)
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser());

// ─── Auth middleware ─────────────────────────────────────────

// JWT-based auth — verifyAuth is imported from auth.js
// No server-side session state needed. /api/auth/me responds in <1ms.

// Mount auth routes (public — no auth required)
app.use('/api/auth', authRouter);

// Protect all /api routes except health, sources, and auth
app.use('/api', (req, res, next) => {
  // Public routes — skip auth
  if (req.path === '/health' || req.path === '/sources' || req.path.startsWith('/auth')) {
    return next()
  }
  // JWT auth — verify token from cookie (sub-millisecond, no DB)
  verifyAuth(req, res, next)
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

const ADZUNA_ENABLED = process.env.ADZUNA_ENABLED === 'true';
const JSEARCH_ENABLED = process.env.JSEARCH_ENABLED === 'true';
const EFC_ENABLED = process.env.EFC_ENABLED === 'true';
const CRON_INTERVAL_HOURS = parseInt(process.env.CRON_INTERVAL_HOURS || '6', 10);

const SOURCES = {
  greenhouse: { name: 'Greenhouse (Direct ATS)', configured: true, description: 'Public Greenhouse job board API — no auth needed' },
  oleeo_rss: { name: 'Oleeo/TalentCentral RSS', configured: true, description: 'RSS feeds from Oleeo-powered career pages' },
  ashby: { name: 'Ashby (Direct ATS)', configured: true, description: 'Public Ashby job board API — no auth needed' },
  workday: { name: 'Workday (Direct ATS)', configured: true, description: 'Workday career portal API — paginated' },
  smartrecruiters: { name: 'SmartRecruiters (Direct ATS)', configured: true, description: 'SmartRecruiters public postings API' },
  lever: { name: 'Lever (Direct ATS)', configured: true, description: 'Lever public postings API — no auth needed' },
  oracle_hcm: { name: 'Oracle HCM (Direct ATS)', configured: true, description: 'Oracle HCM Candidate Experience API — no auth needed' },
  rss: { name: 'RSS Feeds', configured: true, description: 'RSS job feeds from various banks and firms' },
  adzuna: { name: 'Adzuna', configured: ADZUNA_ENABLED, description: 'Adzuna job search API' },
  jsearch: { name: 'JSearch', configured: JSEARCH_ENABLED, description: 'JSearch (RapidAPI) job search' },
  efc: { name: 'eFinancialCareers', configured: EFC_ENABLED, description: 'eFinancialCareers job scraping' },
};

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    sources: Object.fromEntries(
      Object.entries(SOURCES).map(([key, src]) => [key, { configured: src.configured }])
    ),
  });
});

// Adapter health
app.get('/api/adapter-health', async (_req, res) => {
  try {
    const health = await getAllAdapterHealth()
    res.json({ adapters: health })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch adapter health', details: err.message })
  }
})

// Source listing
app.get('/api/sources', (_req, res) => {
  res.json({
    sources: Object.entries(SOURCES).map(([key, src]) => ({
      id: key,
      name: src.name,
      configured: src.configured,
      description: src.description,
    })),
  });
});

// Search across all sources
app.get('/api/search', async (req, res) => {
  try {
    const { searchAdzuna, searchJSearch, fetchAllFeeds } = await lazy();
    const { q, sources, location, country, page, datePosted, employmentType } = req.query;

    const requestedSources = sources
      ? sources.split(',').map(s => s.trim().toLowerCase())
      : ['rss'];

    const searchParams = {
      query: q || '',
      location: location || '',
      country: country || 'gb',
      page: parseInt(page, 10) || 1,
      datePosted: datePosted || 'week',
      employmentType: employmentType || 'FULLTIME',
    };

    const promises = [];

    if (requestedSources.includes('adzuna') && ADZUNA_ENABLED) {
      promises.push(
        searchAdzuna(searchParams).catch(err => ({
          jobs: [], source: 'adzuna', error: err.message || 'Adzuna search failed',
        }))
      );
    }

    if (requestedSources.includes('jsearch') && JSEARCH_ENABLED) {
      promises.push(
        searchJSearch(searchParams).catch(err => ({
          jobs: [], source: 'jsearch', error: err.message || 'JSearch search failed',
        }))
      );
    }

    if (requestedSources.includes('rss')) {
      promises.push(
        fetchAllFeeds().catch(err => ({
          jobs: [], source: 'rss', error: err.message || 'RSS fetch failed',
        }))
      );
    }

    const results = await Promise.allSettled(promises);

    let allJobs = [];
    const sourceResults = {};

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        const { jobs, source, error } = result.value;
        allJobs = allJobs.concat(jobs || []);
        sourceResults[source] = { count: (jobs || []).length, error: error || null };
      }
    });

    const sortedJobs = allJobs.sort((a, b) => {
      if (a.posted && b.posted) return new Date(b.posted) - new Date(a.posted);
      if (a.posted) return -1;
      if (b.posted) return 1;
      return 0;
    });

    res.json({
      jobs: sortedJobs,
      total: sortedJobs.length,
      sources: sourceResults,
      query: q || '',
      location: location || '',
    });
  } catch (err) {
    res.status(500).json({ error: 'Search failed', details: err.message });
  }
});

// ─── Registry routes ───────────────────────────────────────────

app.get('/api/registry', async (_req, res) => {
  const { getAllFirms, getSourceStats } = await lazy();
  try {
    // Awaited: registry reads resolve only after the DB commit/read completes.
    // try/catch is required — Express 4 does not forward async rejections.
    const firms = await getAllFirms();
    const stats = await getSourceStats();
    res.json({ firms, stats });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch registry', details: err.message });
  }
});

app.get('/api/registry/:firmId', async (req, res) => {
  const { getFirmById } = await lazy();
  try {
    const firm = await getFirmById(req.params.firmId);
    if (!firm) return res.status(404).json({ error: 'Firm not found' });
    res.json({ firm });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch firm', details: err.message });
  }
});

app.post('/api/registry/:firmId/toggle', async (req, res) => {
  const { toggleFirm } = await lazy();
  try {
    // toggleFirm(id, enabled) defaults Boolean(undefined) to false, so a
    // missing `enabled` would always disable. Require it explicitly.
    const { enabled } = req.body || {};
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: '`enabled` (boolean) is required' });
    }
    const firm = await toggleFirm(req.params.firmId, enabled);
    if (!firm) return res.status(404).json({ error: 'Firm not found' });
    res.json({ firm });
  } catch (err) {
    res.status(500).json({ error: 'Toggle failed', details: err.message });
  }
});

// ─── Jobs routes ────────────────────────────────────────────────

app.get('/api/jobs', async (req, res) => {
  try {
    const jobs = await getCanonicalJobs({
      status: req.query.status,
      programmeType: req.query.programmeType,
      financeCategory: req.query.financeCategory,
      country: req.query.country,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0,
      sort: req.query.sort,
      order: req.query.order,
    });
    
    const total = await countCanonicalJobs({
      status: req.query.status,
      programmeType: req.query.programmeType,
      financeCategory: req.query.financeCategory,
      country: req.query.country,
    });
    
    res.json({ jobs, total });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch jobs', details: err.message });
  }
});

app.get('/api/jobs/:jobId', async (req, res) => {
  try {
    const job = await getCanonicalJobById(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    
    const sightings = await getAllSightingsForJob(req.params.jobId);
    res.json({ job, sightings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch job', details: err.message });
  }
});

app.get('/api/jobs/:jobId/observations', async (req, res) => {
  try {
    const observations = await getActiveSightingsForJob(req.params.jobId);
    res.json({ observations });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch observations', details: err.message });
  }
});

app.post('/api/jobs/batch', async (req, res) => {
  try {
    const { jobIds } = req.body;
    if (!Array.isArray(jobIds)) {
      return res.status(400).json({ error: 'jobIds must be an array' });
    }
    
    const jobs = await getActiveSightingsForJobs(jobIds);
    res.json({ jobs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch batch', details: err.message });
  }
});

// ─── Scan routes ────────────────────────────────────────────────

app.post('/api/scan', async (req, res) => {
  const { scanAll, startCronScan } = await lazy();
  try {
    const result = await scanAll();
    res.json({ result });
  } catch (err) {
    res.status(500).json({ error: 'Scan failed', details: err.message });
  }
});

app.post('/api/scan/:firmId', async (req, res) => {
  const { scanSingleFirm } = await lazy();
  try {
    const result = await scanSingleFirm(req.params.firmId);
    res.json({ result });
  } catch (err) {
    res.status(500).json({ error: 'Scan failed', details: err.message });
  }
});

app.get('/api/scan/status', async (_req, res) => {
  const { getScanStatus } = await lazy();
  const status = await getScanStatus();
  res.json({ status });
});

app.get('/api/scan/last', async (_req, res) => {
  const { getLastScanResult } = await lazy();
  const result = await getLastScanResult();
  res.json({ result });
});

// ─── Cron routes ────────────────────────────────────────────────

app.post('/api/cron/start', async (_req, res) => {
  const { startCronScan } = await lazy();
  try {
    startCronScan(CRON_INTERVAL_HOURS);
    res.json({ message: `Cron started (every ${CRON_INTERVAL_HOURS}h)` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to start cron', details: err.message });
  }
});

// ─── Coverage routes ────────────────────────────────────────────

app.get('/api/coverage', async (_req, res) => {
  const { getCoverageReport } = await lazy();
  try {
    const report = await getCoverageReport();
    res.json({ report });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get coverage', details: err.message });
  }
});

// ─── Discovery routes ───────────────────────────────────────────

app.get('/api/discovery', async (_req, res) => {
  const { getAllDiscoveries, getDiscoveryStats } = await lazy();
  try {
    const discoveries = await getAllDiscoveries();
    const stats = await getDiscoveryStats();
    res.json({ discoveries, stats });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get discoveries', details: err.message });
  }
});

app.post('/api/discovery/run', async (_req, res) => {
  const { runDiscovery } = await lazy();
  try {
    const result = await runDiscovery();
    res.json({ result });
  } catch (err) {
    res.status(500).json({ error: 'Discovery failed', details: err.message });
  }
});

// ─── Pipeline routes ────────────────────────────────────────────

app.get('/api/pipeline/status', async (_req, res) => {
  const { getPipelineStatus } = await lazy();
  try {
    const status = await getPipelineStatus();
    res.json({ status });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get pipeline status', details: err.message });
  }
});

app.post('/api/pipeline/clear', async (_req, res) => {
  const { clearPipelineState } = await lazy();
  try {
    await clearPipelineState();
    res.json({ message: 'Pipeline state cleared' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear pipeline', details: err.message });
  }
});

// ─── Staleness routes ──────────────────────────────────────────

app.get('/api/staleness', async (_req, res) => {
  const { getStalenessReport } = await lazy();
  try {
    const report = await getStalenessReport();
    res.json({ report });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get staleness report', details: err.message });
  }
});

app.post('/api/staleness/apply', async (_req, res) => {
  const { applyStalenessTransitions, getAllDiscoveries } = await lazy();
  try {
    // applyStalenessTransitions requires the entry list; calling it with
    // no arguments throws (for...of undefined). Fetch first, then apply.
    const entries = await getAllDiscoveries();
    const result = await applyStalenessTransitions(entries);
    res.json({ result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to apply staleness', details: err.message });
  }
});

// ─── RSS routes ─────────────────────────────────────────────────

app.get('/api/rss/feeds', async (_req, res) => {
  const { getConfiguredFeeds } = await lazy();
  try {
    const feeds = await getConfiguredFeeds();
    res.json({ feeds });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get feeds', details: err.message });
  }
});

app.post('/api/rss/feeds', async (req, res) => {
  // Frontend contract (src/lib/jobSources.ts): { action: 'add'|'remove'|'toggle', url, name?, enabled? }
  // Restored from committed HEAD semantics, ported to async rss.js.
  try {
    const { addFeed, removeFeed, toggleFeed } = await lazy();
    const { action, name, url } = req.body || {};

    if (action === 'add') {
      if (!url) return res.status(400).json({ error: 'URL is required' });
      const feed = await addFeed(name, url);
      return res.json({ feed, message: 'Feed added' });
    }

    if (action === 'remove') {
      if (!url) return res.status(400).json({ error: 'URL is required' });
      const removed = await removeFeed(url);
      if (!removed) return res.status(404).json({ error: 'Feed not found' });
      return res.json({ message: 'Feed removed' });
    }

    if (action === 'toggle') {
      if (!url) return res.status(400).json({ error: 'URL is required' });
      const enabled = req.body.enabled !== false;
      const feed = await toggleFeed(url, enabled);
      if (!feed) return res.status(404).json({ error: 'Feed not found' });
      return res.json({ feed, message: `Feed ${enabled ? 'enabled' : 'disabled'}` });
    }

    res.status(400).json({ error: 'Invalid action. Use "add", "remove", or "toggle".' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to modify feeds', details: err.message });
  }
});

app.get('/api/rss/check', async (_req, res) => {
  try {
    const { fetchAllFeeds } = await lazy();
    const result = await fetchAllFeeds();
    res.json({
      jobs: result.jobs,
      feeds: result.feeds,
      total: result.total,
      checkedAt: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: 'RSS check failed', details: err.message });
  }
});

app.delete('/api/rss/feeds/:feedId', async (req, res) => {
  const { removeFeed } = await lazy();
  try {
    const removed = await removeFeed(req.params.feedId);
    if (!removed) return res.status(404).json({ error: 'Feed not found' });
    res.json({ message: 'Feed removed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove feed', details: err.message });
  }
});

app.post('/api/rss/feeds/:feedId/toggle', async (req, res) => {
  const { toggleFeed } = await lazy();
  try {
    // toggleFeed(url, enabled) forces Boolean(undefined) to false, so a
    // missing `enabled` would always disable. Require it explicitly.
    const { enabled } = req.body || {};
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: '`enabled` (boolean) is required' });
    }
    const feed = await toggleFeed(req.params.feedId, enabled);
    if (!feed) return res.status(404).json({ error: 'Feed not found' });
    res.json({ feed });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle feed', details: err.message });
  }
});

// ─── Opportunities routes ─────────────────────────────────────
// Restored committed HEAD API (frontend src/lib/jobSources.ts depends on
// these paths shapes), ported to the async db-adapter: every DB call is
// awaited, so responses are only sent after durable commits/reads resolve.

function classifyOpportunityStatus(entry) {
  if (entry.status === 'verified' || entry.status === 'enabled') return 'verified_open';
  if (entry.status === 'reachable') return 'reachable';
  if (entry.status === 'resolved') return 'tracker_open';
  if (entry.classifiedProvider && entry.classifiedProvider !== 'unknown') return 'tracker_open';
  if (entry.observations && entry.observations.length > 0) return 'tracker_open';
  return 'unknown';
}

function deriveDivisionFromText(text) {
  if (!text) return null;
  const t = text.toLowerCase();
  if (/investment\s*bank/i.test(t) || /\bibd?\b/i.test(t) || /corporate\s*finance/i.test(t) || /restructuring/i.test(t) || /m&a/i.test(t)) return 'Investment Banking';
  if (/private\s*equity/i.test(t) || /\bpe\b/i.test(t) || /buyout/i.test(t)) return 'Private Equity';
  if (/private\s*credit/i.test(t) || /direct\s*lending/i.test(t)) return 'Private Credit';
  if (/asset\s*management/i.test(t) || /investment\s*management/i.test(t) || /wealth\s*management/i.test(t) || /portfolio\s*management/i.test(t)) return 'Asset Management';
  if (/sales\s*(?:and|&)\s*trading/i.test(t) || /\bs&t\b/i.test(t) || /global\s*markets/i.test(t) || /ficc/i.test(t) || /trading/i.test(t) || /trader/i.test(t)) return 'Sales & Trading';
  if (/quantitative/i.test(t) || /\bquant\b/i.test(t) || /systematic/i.test(t)) return 'Quantitative';
  if (/research/i.test(t) || /equity\s*research/i.test(t)) return 'Research';
  if (/risk\s*management/i.test(t) || /market\s*risk/i.test(t)) return 'Risk Management';
  if (/technology/i.test(t) || /\btech\b/i.test(t) || /engineering/i.test(t) || /software/i.test(t) || /data\s*science/i.test(t)) return 'Technology';
  if (/consulting/i.test(t) || /consultant/i.test(t) || /transaction\s*advisory/i.test(t)) return 'Consulting';
  return null;
}

async function deriveOpportunityFromCanonical(job, sightingsMap) {
  // Batch-loaded map preferred (avoids N+1); per-job fallback when missing.
  const sightings = sightingsMap
    ? (sightingsMap.get(job.id) || await getActiveSightingsForJob(job.id))
    : await getActiveSightingsForJob(job.id);
  const sources = [...new Set(sightings.map(s => s.source).filter(Boolean))];
  const hasEmployerSource = sightings.some(s => s.source_tier === 'employer_ats' || s.source_tier === 'employer_url');
  const hasTrackerSource = sightings.some(s => s.source_tier === 'tracker');

  const deadlines = sightings.map(s => {
    try { return JSON.parse(s.raw_payload || '{}').closingDate; } catch { return null; }
  }).filter(Boolean).sort();

  const deadline = job.deadline || (deadlines.length > 0 ? deadlines[deadlines.length - 1] : null);

  const openings = sightings.map(s => {
    try { return JSON.parse(s.raw_payload || '{}').openingDate; } catch { return null; }
  }).filter(Boolean).sort();
  const opening = job.opening_date || (openings.length > 0 ? openings[0] : null);

  let status = 'unknown';
  if (job.lifecycle === 'closed') status = 'closed';
  else if (hasEmployerSource) status = 'verified_open';
  else if (hasTrackerSource) status = 'tracker_open';
  else status = 'unknown';

  let daysUntilClose = null;
  if (deadline) {
    const closeTime = new Date(deadline).getTime();
    const now = Date.now();
    daysUntilClose = Math.ceil((closeTime - now) / (1000 * 60 * 60 * 24));
    if (daysUntilClose < 0) status = 'closed';
  }

  const languages = extractLanguagesFromJob({
    title: job.title || '',
    description: job.description || '',
  });

  return {
    id: job.id,
    companyName: job.company_name,
    title: job.title,
    programme: job.title,
    category: job.programme_type,
    division: null,
    office: null,
    year: null,
    location: job.location,
    country: job.country,
    applyUrl: job.application_url,
    status,
    lifecycle: job.lifecycle,
    deadline,
    opening,
    rolling: false,
    daysUntilClose,
    sources,
    sourceCount: sources.length,
    languages,
    hasEmployerSource,
    hasTrackerSource,
    sightings: sightings.map(s => ({
      source: s.source,
      sourceTier: s.source_tier,
      sourceUrl: s.source_url,
      employerUrl: s.employer_url,
      firstSeenAt: s.first_seen_at,
      lastSeenAt: s.last_seen_at,
      externalKey: s.source_external_key,
    })),
    firstSeenAt: job.first_seen_at,
    lastSeenAt: job.last_seen_at,
    lastVerifiedOpenAt: job.last_verified_open_at,
    consecutiveAbsences: job.consecutive_absences || 0,
    identityTier: job.identity_tier,
    fingerprint: job.fingerprint,
    specialties: JSON.parse(job.specialties || '[]'),
  };
}

function deriveOpportunityFromEntry(entry) {
  const observations = entry.observations || [];
  const sources = [...new Set(observations.map(o => o.source).filter(Boolean))];
  const closingDates = observations.map(o => o.closingDate).filter(Boolean).sort();
  const openingDates = observations.map(o => o.openingDate).filter(Boolean).sort();
  const programme = entry.programme || observations.find(o => o.programme)?.programme || null;
  const category = entry.category || observations.find(o => o.category && o.category !== 'unknown')?.category || 'unknown';
  const division = entry.division || deriveDivisionFromText(programme || '') || null;
  const office = entry.office || null;
  const year = entry.year || null;
  const country = entry.country || observations.find(o => o.country)?.country || null;
  const location = entry.location || observations.find(o => o.location)?.location || null;
  const rolling = observations.some(o => o.rolling);
  const languages = extractLanguagesFromJob({
    title: programme || '',
    description: observations.map(o => o.eligibility || o.process || '').filter(Boolean).join(' '),
  });

  let status = classifyOpportunityStatus(entry);
  let daysUntilClose = null;
  let deadline = closingDates.length > 0 ? closingDates[closingDates.length - 1] : null;
  let opening = openingDates.length > 0 ? openingDates[0] : null;

  if (deadline) {
    const closeTime = new Date(deadline).getTime();
    const now = Date.now();
    daysUntilClose = Math.ceil((closeTime - now) / (1000 * 60 * 60 * 24));
    if (daysUntilClose < 0) status = 'closed';
  }

  if (rolling) deadline = null;

  return {
    id: entry.id,
    companyName: entry.companyName,
    resolvedFirmId: entry.resolvedFirmId,
    programme,
    category,
    division,
    office,
    year,
    location,
    country,
    applyUrl: entry.applyUrl,
    status,
    deadline,
    opening,
    rolling,
    daysUntilClose,
    sources,
    sourceCount: sources.length,
    languages,
    observations: observations.map(o => ({
      source: o.source,
      sourceUrl: o.sourceUrl,
      firstSeenAt: o.firstSeenAt,
      lastSeenAt: o.lastSeenAt,
      programme: o.programme,
      closingDate: o.closingDate,
      openingDate: o.openingDate,
      rolling: o.rolling,
      status: o.status,
      eligibility: o.eligibility,
      process: o.process,
    })),
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
    lastObservationAt: entry.lastObservationAt,
    consecutiveMisses: entry.consecutiveMisses || 0,
    totalObservations: entry.totalObservations || observations.length,
  };
}

app.get('/api/opportunities', async (req, res) => {
  try {
    const {
      q, category, division, country, status, source, firm, deadline,
      programme, language, lifecycle, sort, order, page, limit,
    } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = Math.min(parseInt(limit, 10) || 50, 100);
    const canonicalJobs = await getCanonicalJobs({ status: 'active', limit: 5000 });

    // Batch-load all sightings to avoid N+1 queries
    const sightingsMap = await getActiveSightingsForJobs(canonicalJobs.map(j => j.id));

    // Independent derivations — safe to parallelize (map pre-fetched).
    let opportunities = await Promise.all(
      canonicalJobs.map(job => deriveOpportunityFromCanonical(job, sightingsMap))
    );

    if (q) {
      const query = q.toLowerCase();
      opportunities = opportunities.filter(o =>
        o.companyName.toLowerCase().includes(query) ||
        (o.title && o.title.toLowerCase().includes(query)) ||
        (o.location && o.location.toLowerCase().includes(query))
      );
    }

    if (category) {
      const cats = category.split(',').map(c => c.trim().toLowerCase());
      opportunities = opportunities.filter(o => cats.includes(o.category));
    }

    if (division) {
      const divs = division.split(',').map(d => d.trim().toLowerCase());
      opportunities = opportunities.filter(o => o.division && divs.includes(o.division.toLowerCase()));
    }

    if (country) {
      const countries = country.split(',').map(c => c.trim().toLowerCase());
      opportunities = opportunities.filter(o => o.country && countries.includes(o.country.toLowerCase()));
    }

    if (status) {
      const statuses = status.split(',').map(s => s.trim());
      opportunities = opportunities.filter(o => statuses.includes(o.status));
    }

    if (lifecycle) {
      const lifecycles = lifecycle.split(',').map(l => l.trim());
      opportunities = opportunities.filter(o => lifecycles.includes(o.lifecycle));
    }

    if (source) {
      const sources = source.split(',').map(s => s.trim());
      opportunities = opportunities.filter(o => o.sources.some(s => sources.includes(s)));
    }

    if (firm) {
      const firms = firm.split(',').map(f => f.trim().toLowerCase());
      opportunities = opportunities.filter(o =>
        firms.includes(o.companyName.toLowerCase())
      );
    }

    if (deadline) {
      const now = Date.now();
      if (deadline === 'this_week') {
        const weekFromNow = now + 7 * 24 * 60 * 60 * 1000;
        opportunities = opportunities.filter(o =>
          o.deadline && new Date(o.deadline).getTime() <= weekFromNow && new Date(o.deadline).getTime() >= now
        );
      } else if (deadline === 'this_month') {
        const monthFromNow = now + 30 * 60 * 60 * 1000 * 24;
        opportunities = opportunities.filter(o =>
          o.deadline && new Date(o.deadline).getTime() <= monthFromNow && new Date(o.deadline).getTime() >= now
        );
      } else if (deadline === 'closing_soon') {
        opportunities = opportunities.filter(o =>
          o.daysUntilClose !== null && o.daysUntilClose >= 0 && o.daysUntilClose <= 7
        );
      }
    }

    if (programme) {
      const progs = programme.split(',').map(p => p.trim().toLowerCase());
      opportunities = opportunities.filter(o => o.title && progs.some(p =>
        o.title.toLowerCase().includes(p)
      ));
    }

    if (language) {
      const langs = language.split(',').map(l => l.trim().toLowerCase());
      opportunities = opportunities.filter(o => o.languages && o.languages.some(l =>
        langs.includes(l.toLowerCase())
      ));
    }

    const sortField = sort || 'lastSeenAt';
    const sortOrder = order === 'asc' ? 1 : -1;
    opportunities.sort((a, b) => {
      if (sortField === 'companyName') return sortOrder * a.companyName.localeCompare(b.companyName);
      if (sortField === 'daysUntilClose') {
        const aVal = a.daysUntilClose ?? Infinity;
        const bVal = b.daysUntilClose ?? Infinity;
        return sortOrder * (aVal - bVal);
      }
      if (sortField === 'sourceCount') return sortOrder * (a.sourceCount - b.sourceCount);
      const aVal = a[sortField] || '';
      const bVal = b[sortField] || '';
      return sortOrder * String(aVal).localeCompare(String(bVal));
    });

    const total = opportunities.length;
    const offset = (pageNum - 1) * limitNum;
    const paged = opportunities.slice(offset, offset + limitNum);

    const metrics = {
      total: canonicalJobs.length,
      live: opportunities.filter(o => o.status !== 'closed').length,
      verified_open: opportunities.filter(o => o.lifecycle === 'open' && o.hasEmployerSource).length,
      tracker_open: opportunities.filter(o => o.lifecycle === 'open' && !o.hasEmployerSource).length,
      unknown: opportunities.filter(o => o.lifecycle === 'unknown').length,
      closed: opportunities.filter(o => o.lifecycle === 'closed').length,
      closing_soon: opportunities.filter(o => o.daysUntilClose !== null && o.daysUntilClose >= 0 && o.daysUntilClose <= 7).length,
      byCategory: {},
      byCountry: {},
      bySource: {},
      byLanguage: {},
    };

    for (const opp of opportunities) {
      if (opp.category) metrics.byCategory[opp.category] = (metrics.byCategory[opp.category] || 0) + 1;
      if (opp.country) metrics.byCountry[opp.country] = (metrics.byCountry[opp.country] || 0) + 1;
      for (const src of opp.sources) metrics.bySource[src] = (metrics.bySource[src] || 0) + 1;
      for (const lang of (opp.languages || [])) metrics.byLanguage[lang] = (metrics.byLanguage[lang] || 0) + 1;
    }

    res.json({
      opportunities: paged,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
      metrics,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch opportunities', details: err.message });
  }
});

app.get('/api/opportunities/metrics', async (_req, res) => {
  try {
    const { getAllDiscoveries } = await lazy();
    const entries = await getAllDiscoveries();
    const opportunities = entries.map(deriveOpportunityFromEntry);

    const metrics = {
      total: entries.length,
      live: opportunities.filter(o => o.status !== 'closed').length,
      verified_open: opportunities.filter(o => o.status === 'verified_open').length,
      reachable: opportunities.filter(o => o.status === 'reachable').length,
      tracker_open: opportunities.filter(o => o.status === 'tracker_open').length,
      unknown: opportunities.filter(o => o.status === 'unknown').length,
      closed: opportunities.filter(o => o.status === 'closed').length,
      rolling: opportunities.filter(o => o.rolling).length,
      closing_soon: opportunities.filter(o => o.daysUntilClose !== null && o.daysUntilClose >= 0 && o.daysUntilClose <= 7).length,
      byCategory: {},
      byCountry: {},
      bySource: {},
      byLanguage: {},
    };

    for (const opp of opportunities) {
      if (opp.category) metrics.byCategory[opp.category] = (metrics.byCategory[opp.category] || 0) + 1;
      if (opp.country) metrics.byCountry[opp.country] = (metrics.byCountry[opp.country] || 0) + 1;
      for (const src of opp.sources) metrics.bySource[src] = (metrics.bySource[src] || 0) + 1;
      for (const lang of (opp.languages || [])) metrics.byLanguage[lang] = (metrics.byLanguage[lang] || 0) + 1;
    }

    res.json(metrics);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch metrics', details: err.message });
  }
});

// ─── Resolution & Verification routes ──────────────────────────

app.post('/api/opportunities/resolve', async (req, res) => {
  try {
    const { resolveOpportunities } = await lazy();
    const { verify = false, limit = 50 } = req.body || {};
    const result = await resolveOpportunities({ verify, limit });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Resolution failed', details: err.message });
  }
});

app.get('/api/opportunities/coverage', async (_req, res) => {
  try {
    const { getAllDiscoveries, generateCoverageGapReport } = await lazy();
    const entries = await getAllDiscoveries();
    const report = generateCoverageGapReport(entries);
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: 'Coverage report failed', details: err.message });
  }
});

app.get('/api/opportunities/staleness', async (_req, res) => {
  try {
    const { getStalenessReport } = await lazy();
    const report = await getStalenessReport();
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: 'Staleness report failed', details: err.message });
  }
});

app.post('/api/opportunities/staleness/apply', async (_req, res) => {
  try {
    const { applyStalenessTransitions, getAllDiscoveries } = await lazy();
    // applyStalenessTransitions requires the entry list (for...of undefined
    // crashes without it) — fetch first, then apply.
    const entries = await getAllDiscoveries();
    const result = await applyStalenessTransitions(entries);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Apply staleness failed', details: err.message });
  }
});

app.get('/api/opportunities/:id', async (req, res) => {
  try {
    // Try canonical jobs first (primary store)
    const canonicalJob = await getCanonicalJobById(req.params.id);
    if (canonicalJob) {
      return res.json(await deriveOpportunityFromCanonical(canonicalJob));
    }

    // Fallback to legacy discovery store
    const { getAllDiscoveries } = await lazy();
    const entries = await getAllDiscoveries();
    const entry = entries.find(e => e.id === req.params.id);
    if (!entry) return res.status(404).json({ error: 'Opportunity not found' });
    res.json(deriveOpportunityFromEntry(entry));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch opportunity', details: err.message });
  }
});

// ─── Health check with DB stats ─────────────────────────────────

app.get('/api/health/stats', async (_req, res) => {
  try {
    const { getDbStats } = await import('./db-adapter.js');
    const stats = await getDbStats();
    res.json({ stats });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get stats', details: err.message });
  }
});

// ─── Start server ───────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[Server] Running on http://localhost:${PORT}`);
  console.log(`[Server] Environment: ${isProduction ? 'production' : 'development'}`);
  
  // Start cron if configured
  if (process.env.CRON_ENABLED === 'true') {
    lazy().then(({ startCronScan }) => {
      startCronScan(CRON_INTERVAL_HOURS);
      console.log(`[Server] Cron started (every ${CRON_INTERVAL_HOURS}h)`);
    });
  }
});
