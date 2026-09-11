import NodeCache from 'node-cache';
import { normalizeBatch } from './normalize.js';

const cache = new NodeCache({ stdTTL: 3600, checkperiod: 600, maxKeys: 50 });

const BASE_URL = 'https://api.adzuna.com/v1/api/jobs';

const COUNTRY_MAP = {
  gb: 'gb', us: 'us', de: 'de', fr: 'fr',
};

const FINANCE_KEYWORDS = [
  'finance', 'financial', 'investment', 'banking', 'bank',
  'accounting', 'audit', 'tax', 'asset', 'wealth',
  'portfolio', 'equity', 'capital', 'risk', 'compliance',
  'trading', 'hedge fund', 'private equity', 'venture capital',
  'fintech', 'quantitative', 'analyst', 'analyst',
  'treasury', 'valuation', 'm&a', 'mergers', 'acquisitions',
  'credit', 'fixed income', 'derivatives', 'forex', 'fx',
];

function matchesFinanceKeywords(job) {
  const text = `${job.title || ''} ${job.description || ''}`.toLowerCase();
  return FINANCE_KEYWORDS.some(kw => text.includes(kw));
}

async function searchAdzuna({ query, location, country = 'gb', page = 1, maxDaysOld = 30 }) {
  const cacheKey = `adzuna:${country}:${query || ''}:${location || ''}:${page}:${maxDaysOld}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;

  if (!appId || !appKey) {
    return { jobs: [], error: 'Adzuna API credentials not configured', source: 'adzuna' };
  }

  const countryCode = COUNTRY_MAP[country] || 'gb';
  const url = new URL(`${BASE_URL}/${countryCode}/search/${page}`);
  url.searchParams.set('app_id', appId);
  url.searchParams.set('app_key', appKey);
  url.searchParams.set('results_per_page', '50');
  url.searchParams.set('max_days_old', String(maxDaysOld));

  if (query) url.searchParams.set('what', query);
  if (location) url.searchParams.set('where', location);

  try {
    const response = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Adzuna API error ${response.status}: ${body}`);
    }

    const data = await response.json();
    const rawJobs = data.results || [];

    const jobs = normalizeBatch(rawJobs, 'adzuna').map(job => ({
      ...job,
      country: job.country || countryCode,
    }));

    const result = { jobs, source: 'adzuna', total: data.count || jobs.length };
    cache.set(cacheKey, result);
    return result;
  } catch (err) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      return { jobs: [], error: 'Adzuna API request timed out', source: 'adzuna' };
    }
    return { jobs: [], error: err.message, source: 'adzuna' };
  }
}

function invalidateCache() {
  cache.flushAll();
}

export { searchAdzuna, invalidateCache as adzunaInvalidateCache, matchesFinanceKeywords };
