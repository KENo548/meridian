import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import authRouter from './auth.js';

process.on('unhandledRejection', (err) => {
  console.error('[UnhandledRejection]', err?.message || err);
});
import { searchAdzuna } from './sources/adzuna.js';
import { searchJSearch } from './sources/jsearch.js';
import {
  getConfiguredFeeds,
  addFeed,
  removeFeed,
  toggleFeed,
  fetchAllFeeds,
} from './sources/rss.js';
import {
  getAllFirms,
  getEnabledFirms,
  getFirmById,
  toggleFirm,
  getSourceStats,
} from './sources/registry.js';
import { fetchFirmJobs, fetchAllEnabledFirms } from './sources/ats.js';
import {
  scanAll,
  scanSingleFirm,
  getLastScanResult,
  getScanStatus,
  startCronScan,
} from './sources/scan.js';
import { getAll as getAllDiscoveries, getStats as getDiscoveryStats } from './sources/discovery/store.js';
import { runDiscovery, getDiscoveryStats as getDiscoveryReport } from './sources/discovery/index.js';
import { resolveOpportunities, generateCoverageGapReport, SUPPORTED_DIRECT_PROVIDERS } from './sources/discovery/resolve-ats.js';
import { discoverFirmSources, enumerateDirectJobs, matchTrackerToDirect, getPipelineStatus, clearPipelineState } from './sources/discovery/pipeline.js';
import { getStalenessReport, applyStalenessTransitions } from './sources/discovery/staleness.js';
import {
  getCanonicalJobs,
  getOpenCanonicalJobs,
  countCanonicalJobs,
  getActiveSightingsForJob,
  getAllSightingsForJob,
  getCanonicalJobById,
  getAllAdapterHealth,
} from './db.js';

const app = express();
const PORT = process.env.PORT || 3001;

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
    // In production, allow the configured frontend URL
    if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
      return callback(null, true)
    }
    callback(null, true)
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(express.json());

// ─── Session middleware ───────────────────────────────────────

const SESSION_SECRET = process.env.SESSION_SECRET || 'meridian-dev-secret-change-in-production'
const isProduction = process.env.NODE_ENV === 'production'

app.use(session({
  name: 'meridian.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
}))

// ─── Auth middleware ─────────────────────────────────────────

function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Authentication required' })
  }
  next()
}

// Mount auth routes (public — no auth required)
app.use('/api/auth', authRouter);

// Protect all /api routes except health, sources, and auth
app.use('/api', (req, res, next) => {
  // Public routes — skip auth
  if (req.path === '/health' || req.path === '/sources' || req.path.startsWith('/auth')) {
    return next()
  }
  // Check session
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'Authentication required' })
  }
  next()
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
app.get('/api/adapter-health', (_req, res) => {
  try {
    const health = getAllAdapterHealth()
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

app.get('/api/registry', (_req, res) => {
  const firms = getAllFirms();
  const stats = getSourceStats();
  res.json({ firms, stats });
});

app.get('/api/registry/:firmId', (req, res) => {
  const firm = getFirmById(req.params.firmId);
  if (!firm) return res.status(404).json({ error: 'Firm not found' });
  res.json({ firm });
});

app.post('/api/registry/:firmId/toggle', (req, res) => {
  const { enabled } = req.body;
  const firm = toggleFirm(req.params.firmId, enabled);
  if (!firm) return res.status(404).json({ error: 'Firm not found' });
  res.json({ firm });
});

// ─── Scan routes ───────────────────────────────────────────────

app.get('/api/scan/status', (_req, res) => {
  res.json(getScanStatus());
});

app.get('/api/scan/last', (_req, res) => {
  const result = getLastScanResult();
  if (!result) return res.status(404).json({ error: 'No scan results yet' });
  res.json(result);
});

app.post('/api/scan', async (_req, res) => {
  try {
    const result = await scanAll();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Scan failed', details: err.message });
  }
});

app.post('/api/scan/:firmId', async (req, res) => {
  try {
    const result = await scanSingleFirm(req.params.firmId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Firm scan failed', details: err.message });
  }
});

// ─── Firm scan routes ──────────────────────────────────────────

app.get('/api/firms/:firmId/jobs', async (req, res) => {
  try {
    const firm = getFirmById(req.params.firmId);
    if (!firm) return res.status(404).json({ error: 'Firm not found' });
    const result = await fetchFirmJobs(firm);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch firm jobs', details: err.message });
  }
});

// ─── RSS routes (legacy) ───────────────────────────────────────

app.get('/api/rss/feeds', (_req, res) => {
  try {
    const feeds = getConfiguredFeeds();
    res.json({ feeds, total: feeds.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to list feeds', details: err.message });
  }
});

app.post('/api/rss/feeds', (req, res) => {
  try {
    const { action, name, url } = req.body;

    if (action === 'add') {
      if (!url) return res.status(400).json({ error: 'URL is required' });
      const feed = addFeed(name, url);
      return res.json({ feed, message: 'Feed added' });
    }

    if (action === 'remove') {
      if (!url) return res.status(400).json({ error: 'URL is required' });
      const removed = removeFeed(url);
      if (!removed) return res.status(404).json({ error: 'Feed not found' });
      return res.json({ message: 'Feed removed' });
    }

    if (action === 'toggle') {
      if (!url) return res.status(400).json({ error: 'URL is required' });
      const enabled = req.body.enabled !== false;
      const feed = toggleFeed(url, enabled);
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

// ─── Opportunities routes ─────────────────────────────────────

import { extractLanguagesFromJob } from './sources/extractLanguages.js';

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

function deriveOpportunityFromCanonical(job) {
  const sightings = getActiveSightingsForJob(job.id)
  const sources = [...new Set(sightings.map(s => s.source).filter(Boolean))]
  const hasEmployerSource = sightings.some(s => s.source_tier === 'employer_ats' || s.source_tier === 'employer_url')
  const hasTrackerSource = sightings.some(s => s.source_tier === 'tracker')

  // Derive deadline from the earliest closing date across sightings
  const deadlines = sightings.map(s => {
    try { return JSON.parse(s.raw_payload || '{}').closingDate } catch { return null }
  }).filter(Boolean).sort()

  const deadline = job.deadline || (deadlines.length > 0 ? deadlines[deadlines.length - 1] : null)

  // Derive opening date
  const openings = sightings.map(s => {
    try { return JSON.parse(s.raw_payload || '{}').openingDate } catch { return null }
  }).filter(Boolean).sort()
  const opening = job.opening_date || (openings.length > 0 ? openings[0] : null)

  // Derive status
  let status = 'unknown'
  if (job.lifecycle === 'closed') status = 'closed'
  else if (hasEmployerSource) status = 'verified_open'
  else if (hasTrackerSource) status = 'tracker_open'
  else status = 'unknown'

  // Days until close
  let daysUntilClose = null
  if (deadline) {
    const closeTime = new Date(deadline).getTime()
    const now = Date.now()
    daysUntilClose = Math.ceil((closeTime - now) / (1000 * 60 * 60 * 24))
    if (daysUntilClose < 0) status = 'closed'
  }

  // Languages
  const languages = extractLanguagesFromJob({
    title: job.title || '',
    description: job.description || '',
  })

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
  }
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

app.get('/api/opportunities', (req, res) => {
  try {
    const {
      q,
      category,
      division,
      country,
      status,
      source,
      firm,
      deadline,
      programme,
      language,
      lifecycle,
      sort,
      order,
      page,
      limit,
    } = req.query;

    // Read from canonical jobs
    const canonicalJobs = getCanonicalJobs({ status: 'active', limit: 100000 });

    // Derive opportunities from canonical jobs + sightings
    let opportunities = canonicalJobs.map(deriveOpportunityFromCanonical);

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
        const monthFromNow = now + 30 * 24 * 60 * 60 * 1000;
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
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = Math.min(parseInt(limit, 10) || 50, 100);
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

app.get('/api/opportunities/metrics', (_req, res) => {
  try {
    const entries = getAllDiscoveries();
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
    const { verify = false, limit = 50 } = req.body || {};
    const result = await resolveOpportunities({ verify, limit });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Resolution failed', details: err.message });
  }
});

app.get('/api/opportunities/coverage', (_req, res) => {
  try {
    const entries = getAllDiscoveries();
    const report = generateCoverageGapReport(entries);
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: 'Coverage report failed', details: err.message });
  }
});

app.get('/api/opportunities/staleness', (_req, res) => {
  try {
    const report = getStalenessReport();
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: 'Staleness report failed', details: err.message });
  }
});

app.post('/api/opportunities/staleness/apply', (_req, res) => {
  try {
    const result = applyStalenessTransitions();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Apply staleness failed', details: err.message });
  }
});

app.get('/api/opportunities/:id', (req, res) => {
  try {
    // Try canonical jobs first (primary store)
    const canonicalJob = getCanonicalJobById(req.params.id)
    if (canonicalJob) {
      return res.json(deriveOpportunityFromCanonical(canonicalJob))
    }

    // Fallback to legacy discovery store
    const entries = getAllDiscoveries()
    const entry = entries.find(e => e.id === req.params.id)
    if (!entry) return res.status(404).json({ error: 'Opportunity not found' })
    res.json(deriveOpportunityFromEntry(entry))
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch opportunity', details: err.message });
  }
});

// ─── Pipeline routes ──────────────────────────────────────────

app.get('/api/pipeline/status', (_req, res) => {
  try {
    const status = getPipelineStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: 'Pipeline status failed', details: err.message });
  }
});

app.post('/api/pipeline/discover-sources', async (req, res) => {
  try {
    const { maxDepth = 2, concurrency = 3 } = req.body || {};
    const result = await discoverFirmSources({ maxDepth, concurrency });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Source discovery failed', details: err.message });
  }
});

app.post('/api/pipeline/enumerate-jobs', async (req, res) => {
  try {
    const { firmIds = null } = req.body || {};
    const result = await enumerateDirectJobs(firmIds);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Job enumeration failed', details: err.message });
  }
});

app.post('/api/pipeline/match', (_req, res) => {
  try {
    const result = matchTrackerToDirect();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Matching failed', details: err.message });
  }
});

app.post('/api/pipeline/run-all', async (req, res) => {
  try {
    const startTime = Date.now();
    const force = req.body?.force === true;
    const sourceDiscovery = await discoverFirmSources({ maxDepth: 2, concurrency: 3, force });
    const jobEnumeration = await enumerateDirectJobs(null, { force });
    const matching = matchTrackerToDirect();
    const status = getPipelineStatus();

    res.json({
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      sourceDiscovery,
      jobEnumeration,
      matching,
      status,
    });
  } catch (err) {
    res.status(500).json({ error: 'Pipeline run failed', details: err.message });
  }
});

app.post('/api/pipeline/clear', (_req, res) => {
  try {
    clearPipelineState();
    res.json({ cleared: true });
  } catch (err) {
    res.status(500).json({ error: 'Clear pipeline failed', details: err.message });
  }
});

// ─── Gold Set & Matcher V3 Evaluation ────────────────────────────────

import { getGoldSet, evaluateMatcher } from './sources/discovery/gold-set.js';
import { matchOpportunityV3, MATCH_THRESHOLDS as V3_THRESHOLDS } from './sources/discovery/matcher-v3.js';

app.get('/api/gold-set', (_req, res) => {
  try {
    const goldSet = getGoldSet();
    res.json({ count: goldSet.length, entries: goldSet });
  } catch (err) {
    res.status(500).json({ error: 'Gold set failed', details: err.message });
  }
});

app.post('/api/gold-set/evaluate', (_req, res) => {
  try {
    const evaluation = evaluateMatcher((tracker, direct) => {
      if (!direct) return null
      return matchOpportunityV3(tracker, direct)
    });
    res.json(evaluation);
  } catch (err) {
    res.status(500).json({ error: 'Gold set evaluation failed', details: err.message });
  }
});

app.post('/api/matcher/test', (req, res) => {
  try {
    const { tracker, direct } = req.body || {};
    if (!tracker || !direct) {
      return res.status(400).json({ error: 'Both tracker and direct job required' });
    }
    const result = matchOpportunityV3(tracker, direct);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Matcher test failed', details: err.message });
  }
});

// ─── Canonical Jobs API (Phase 1) ──────────────────────────────

import {
  getCanonicalJobs,
  countCanonicalJobs,
  getCanonicalJobById,
  getNewCanonicalJobs,
  getObservationsForJob,
  getVersionsForJob,
  getAllEnabledSources,
  getSourceHealth,
  getAllCompanies,
  getEnabledCompanies,
  saveCompany,
  saveCompanySource,
  getSourcesByCompanyId,
  getAllDiscoveryTargets as getAllDiscoveryQueueTargets,
  getDiscoveryStats as getDiscoveryQueueStats,
} from './db.js'
import { getCoverageReport } from './sources/scan.js'
import { getCapability, CAPABILITY, getSupportedProviders } from './sources/ats.js'

app.get('/api/jobs', (req, res) => {
  try {
    const { company, status, programmeType, financeCategory, country, sort, order, limit, offset, q } = req.query
    const jobs = getCanonicalJobs({
      companyId: company || undefined,
      status: status || undefined,
      programmeType: programmeType || undefined,
      financeCategory: financeCategory || undefined,
      country: country || undefined,
      sort: sort || 'last_seen_at',
      order: order || 'desc',
      limit: Math.min(parseInt(limit) || 50, 500),
      offset: parseInt(offset) || 0,
    })
    const total = countCanonicalJobs({
      companyId: company || undefined,
      status: status || undefined,
      programmeType: programmeType || undefined,
      financeCategory: financeCategory || undefined,
      country: country || undefined,
    })
    res.json({ jobs, total, limit: parseInt(limit) || 50, offset: parseInt(offset) || 0 })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch jobs', details: err.message })
  }
})

app.get('/api/jobs/new', (req, res) => {
  try {
    const since = req.query.since || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const jobs = getNewCanonicalJobs(since)
    res.json({ jobs, since, count: jobs.length })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch new jobs', details: err.message })
  }
})

app.get('/api/jobs/:id', (req, res) => {
  try {
    const job = getCanonicalJobById(req.params.id)
    if (!job) return res.status(404).json({ error: 'Job not found' })
    const observations = getObservationsForJob(req.params.id)
    const versions = getVersionsForJob(req.params.id)
    res.json({ ...job, observations, versions })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch job', details: err.message })
  }
})

app.get('/api/jobs/:id/history', (req, res) => {
  try {
    const versions = getVersionsForJob(req.params.id)
    const observations = getObservationsForJob(req.params.id)
    res.json({ versions, observations })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch job history', details: err.message })
  }
})

app.get('/api/sources/health', (_req, res) => {
  try {
    const sources = getAllEnabledSources()
    const healthData = sources.map(s => ({
      ...s,
      health: getSourceHealth(s.id),
      capability: getCapability(s.provider),
    }))
    res.json({ sources: healthData, capabilities: CAPABILITY })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch source health', details: err.message })
  }
})

app.get('/api/coverage/stats', (_req, res) => {
  try {
    const report = getCoverageReport()
    const companies = getAllCompanies()
    const enabledCompanies = getEnabledCompanies()
    const sources = getAllEnabledSources()
    const supportedProviders = getSupportedProviders()

    res.json({
      ...report,
      companies: {
        total: companies.length,
        enabled: enabledCompanies.length,
      },
      sources: {
        total: sources.length,
        byProvider: sources.reduce((acc, s) => {
          acc[s.provider] = (acc[s.provider] || 0) + 1
          return acc
        }, {}),
      },
      supportedProviders,
    })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch coverage stats', details: err.message })
  }
})

app.get('/api/companies', (_req, res) => {
  try {
    const companies = getAllCompanies()
    res.json({ companies, total: companies.length })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch companies', details: err.message })
  }
})

app.get('/api/companies/:id/sources', (req, res) => {
  try {
    const sources = getSourcesByCompanyId(req.params.id)
    res.json({ sources })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch company sources', details: err.message })
  }
})

// ─── Phase 2.1: Source Discovery Endpoints ────────────────────

app.get('/api/discovery/queue', (_req, res) => {
  try {
    const targets = getAllDiscoveryQueueTargets()
    const stats = getDiscoveryQueueStats()
    res.json({ targets, stats })
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch discovery queue', details: err.message })
  }
})

app.get('/api/discovery/stats', (_req, res) => {
  try {
    res.json(getDiscoveryQueueStats())
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch discovery stats', details: err.message })
  }
})

app.post('/api/discovery/company/:id', async (req, res) => {
  try {
    const firms = getAllFirms()
    const firm = firms.find(f => f.id === req.params.id)
    if (!firm) return res.status(404).json({ error: 'Company not found' })

    const { discoverCompany: discoverSingleCompany } = await import('./sources/discovery/discover.js')
    const result = await discoverSingleCompany(firm)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: 'Discovery failed', details: err.message })
  }
})

app.post('/api/discovery/run', async (req, res) => {
  try {
    const { unknownOnly = true, limit = 10, dryRun = false } = req.body || {}
    const { runDiscovery: runFullDiscovery } = await import('./sources/discovery/discover.js')
    const results = await runFullDiscovery({ unknownOnly, limit, dryRun })
    res.json({ results, count: results.length })
  } catch (err) {
    res.status(500).json({ error: 'Discovery run failed', details: err.message })
  }
})

// ─── 404 handler ───────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, _req, res, _next) => {
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// ─── Start server ──────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Meridian server running on http://localhost:${PORT}`);
  console.log(`Health: http://localhost:${PORT}/api/health`);
  console.log(`Registry: http://localhost:${PORT}/api/registry`);
  console.log(`Scan: http://localhost:${PORT}/api/scan`);

  const stats = getSourceStats();
  console.log(`Firms: ${stats.enabledFirms} enabled / ${stats.totalFirms} total`);
  console.log(`Sources: ${Object.entries(SOURCES).filter(([, s]) => s.configured).map(([k]) => k).join(', ')}`);

  startCronScan();

  // Auto-run discovery pipeline on startup (background, non-blocking)
  runStartupPipeline().catch(err => {
    console.error('[Startup] Pipeline failed:', err.message);
  });
});

async function runStartupPipeline() {
  const startTime = Date.now();
  console.log('[Startup] Running discovery pipeline...');

  try {
    console.log('[Startup] Phase 1: Tracker discovery...');
    try { await runDiscovery(); } catch (e) { console.error('[Startup] Phase 1 error:', e.message); }
    console.log('[Startup] Phase 1 done');

    console.log('[Startup] Phase 2: Firm source discovery...');
    try {
      const sourceResult = await discoverFirmSources({ maxDepth: 2, concurrency: 3 });
      console.log(`[Startup] Phase 2 done: ${sourceResult.discovered} sources discovered${sourceResult.skipped ? ' (skipped)' : ''}`);
    } catch (e) { console.error('[Startup] Phase 2 error:', e.message); }

    console.log('[Startup] Phase 3: Direct job enumeration...');
    try {
      const jobsResult = await enumerateDirectJobs();
      console.log(`[Startup] Phase 3 done: ${jobsResult.totalJobs || 0} direct jobs${jobsResult.skipped ? ' (skipped)' : ''}`);
    } catch (e) { console.error('[Startup] Phase 3 error:', e.message); }

    console.log('[Startup] Phase 4: Tracker-to-direct matching...');
    try {
      const matchResult = await matchTrackerToDirect();
      console.log(`[Startup] Phase 4 done: ${matchResult.stats?.autoMatched || 0} auto-matched`);
    } catch (e) { console.error('[Startup] Phase 4 error:', e.message); }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[Startup] Pipeline complete in ${duration}s`);
  } catch (err) {
    console.error('[Startup] Pipeline failed:', err.message);
  }
}

// Prevent unhandled errors from crashing the server
process.on('uncaughtException', (err) => {
  console.error('[UncaughtException]', err.message, err.stack);
});
process.on('SIGTERM', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
