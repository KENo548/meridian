import Parser from 'rss-parser';
import NodeCache from 'node-cache';
import { normalize } from './normalize.js';
import { setKV, getKV } from '../db.js';

const cache = new NodeCache({ stdTTL: 1800, checkperiod: 300 });
const parser = new Parser({
  timeout: 10000,
  headers: { 'User-Agent': 'Meridian-Job-Tracker/1.0' },
});

const KV_KEY = 'rss_configured_feeds';

const DEFAULT_FEEDS = [
  {
    name: 'Goldman Sachs Careers',
    url: 'https://careers.goldman/rss/search?q=',
    enabled: true,
  },
  {
    name: 'J.P. Morgan Careers',
    url: 'https://jpmorganchase.wd5.myworkdayjobs.com/External/rss',
    enabled: true,
  },
  {
    name: 'Deutsche Bank Careers',
    url: 'https://careers.db.com/rss/',
    enabled: true,
  },
  {
    name: 'Morgan Stanley Careers',
    url: 'https://morganstanley.taleo.net/careersection/rss',
    enabled: true,
  },
  {
    name: 'Citigroup Careers',
    url: 'https://jobs.citi.com/rss/',
    enabled: true,
  },
  {
    name: 'Barclays Careers',
    url: 'https://search.jobsnet.io/rss/barclays',
    enabled: true,
  },
  {
    name: 'HSBC Careers',
    url: 'https://hsbc.taleo.net/careersection/rss',
    enabled: true,
  },
  {
    name: 'UBS Careers',
    url: 'https://jobs.ubs.com/rss/',
    enabled: true,
  },
  {
    name: 'Credit Suisse (UBS)',
    url: 'https://jobs.ubs.com/rss/?search=credit+suisse',
    enabled: true,
  },
  {
    name: 'Nomura Holdings',
    url: 'https://nomura.wd3.myworkdayjobs.com/External/rss',
    enabled: true,
  },
  {
    name: 'Wells Fargo Careers',
    url: 'https://www.wellsfargojobs.com/rss/',
    enabled: true,
  },
  {
    name: 'Bank of America Careers',
    url: 'https://careers.bankofamerica.com/rss/',
    enabled: true,
  },
  {
    name: 'Capital One Careers',
    url: 'https://www.capitalonecareers.com/rss/',
    enabled: true,
  },
  {
    name: 'Two Sigma Careers',
    url: 'https://careers.twosigma.com/rss/',
    enabled: true,
  },
  {
    name: 'Jane Street Careers',
    url: 'https://www.janestreet.com/join-jane-street/rss/',
    enabled: true,
  },
  {
    name: 'Citadel Careers',
    url: 'https://www.citadel.com/careers/rss/',
    enabled: true,
  },
];

let configuredFeeds = loadFeedsFromStorage();

function loadFeedsFromStorage() {
  try {
    const saved = getKV(KV_KEY);
    if (Array.isArray(saved) && saved.length > 0) {
      const savedMap = new Map(saved.map(f => [f.url, f]));
      const merged = DEFAULT_FEEDS.map(f => savedMap.get(f.url) || { ...f });
      for (const f of saved) {
        if (!merged.some(m => m.url === f.url)) {
          merged.push(f);
        }
      }
      return merged;
    }
  } catch {
    // KV store not available, fall back to defaults
  }
  return [...DEFAULT_FEEDS];
}

function persistFeeds() {
  try {
    setKV(KV_KEY, configuredFeeds);
  } catch {
    // KV store not available, feeds will be in-memory only
  }
}

function getConfiguredFeeds() {
  return [...configuredFeeds];
}

function addFeed(name, url) {
  if (!url) throw new Error('Feed URL is required');
  const feedUrl = String(url).trim();
  const feedName = String(name || feedUrl).trim();

  const existing = configuredFeeds.find(f => f.url === feedUrl);
  if (existing) {
    existing.enabled = true;
    existing.name = feedName;
    persistFeeds();
    return existing;
  }

  const feed = { name: feedName, url: feedUrl, enabled: true };
  configuredFeeds.push(feed);
  persistFeeds();
  return feed;
}

function removeFeed(url) {
  const feedUrl = String(url).trim();
  const index = configuredFeeds.findIndex(f => f.url === feedUrl);
  if (index === -1) return false;
  configuredFeeds.splice(index, 1);
  cache.flushAll();
  persistFeeds();
  return true;
}

function toggleFeed(url, enabled) {
  const feedUrl = String(url).trim();
  const feed = configuredFeeds.find(f => f.url === feedUrl);
  if (!feed) return null;
  feed.enabled = Boolean(enabled);
  persistFeeds();
  return feed;
}

function parseFeedItem(item, feedName) {
  const link = item.link || item.guid || item.id || '';
  const title = item.title || item['title'] || '';
  const description = item.contentSnippet || item.content || item.description || '';
  const pubDate = item.pubDate || item.isoDate || item.date || '';

  const job = {
    id: link || title,
    title,
    company: feedName || item.creator || item.author || '',
    location: item.location || item['location'] || extractLocationFromText(description),
    url: link,
    description: description.substring(0, 5000),
    posted: pubDate || undefined,
    source: 'rss',
  };

  return normalize(job, 'rss');
}

function extractLocationFromText(text) {
  if (!text) return '';
  const locationPatterns = [
    /location[:\s]+([^\n,;]+)/i,
    /based in ([^\n,;]+)/i,
    /(London|New York|San Francisco|Chicago|Hong Kong|Singapore|Tokyo|Frankfurt|Paris|Dublin|Edinburgh)[^\n,;]*/i,
  ];
  for (const pattern of locationPatterns) {
    const match = text.match(pattern);
    if (match) return match[1] || match[0];
  }
  return '';
}

async function fetchFeed(feed) {
  if (!feed.enabled) return { jobs: [], feed: feed.name, error: null, skipped: true };

  const cacheKey = `rss:${feed.url}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  try {
    const rss = await parser.parseURL(feed.url);
    const items = rss.items || [];
    const jobs = items
      .map(item => parseFeedItem(item, feed.name))
      .filter(Boolean);

    const result = { jobs, feed: feed.name, error: null, skipped: false };
    cache.set(cacheKey, result);
    return result;
  } catch (err) {
    return { jobs: [], feed: feed.name, error: err.message, skipped: false };
  }
}

async function fetchAllFeeds() {
  const feeds = configuredFeeds.filter(f => f.enabled);
  const results = await Promise.allSettled(feeds.map(feed => fetchFeed(feed)));

  const allJobs = [];
  const feedStatuses = [];

  results.forEach((result, index) => {
    const feed = feeds[index];
    if (result.status === 'fulfilled') {
      const { jobs, error } = result.value;
      allJobs.push(...jobs);
      feedStatuses.push({ name: feed.name, url: feed.url, count: jobs.length, error });
    } else {
      feedStatuses.push({ name: feed.name, url: feed.url, count: 0, error: result.reason?.message || 'Unknown error' });
    }
  });

  return {
    jobs: allJobs,
    feeds: feedStatuses,
    total: allJobs.length,
  };
}

function invalidateCache() {
  cache.flushAll();
}

export {
  getConfiguredFeeds,
  addFeed,
  removeFeed,
  toggleFeed,
  fetchFeed,
  fetchAllFeeds,
  invalidateCache as rssInvalidateCache,
};
