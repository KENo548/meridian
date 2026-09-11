import NodeCache from 'node-cache';
import { normalizeBatch } from './normalize.js';

const cache = new NodeCache({ stdTTL: 3600, checkperiod: 600, maxKeys: 50 });

const API_URL = 'https://jsearch.p.rapidapi.com/search';

async function searchJSearch({ query, location, page = 1, numPages = 1, datePosted = 'week', employmentType = 'FULLTIME' }) {
  const cacheKey = `jsearch:${query || ''}:${location || ''}:${page}:${numPages}:${datePosted}:${employmentType}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const apiKey = process.env.JSEARCH_API_KEY;

  if (!apiKey) {
    return { jobs: [], error: 'JSearch API key not configured', source: 'jsearch' };
  }

  const searchQuery = [query, location].filter(Boolean).join(' in ');

  const params = new URLSearchParams({
    query: searchQuery,
    page: String(page),
    num_pages: String(numPages),
    date_posted: datePosted,
    employment_type: employmentType,
    remote_jobs_only: 'false',
  });

  try {
    const response = await fetch(`${API_URL}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`JSearch API error ${response.status}: ${body}`);
    }

    const data = await response.json();
    const rawJobs = (data.data || []).map((job, index) => ({
      id: job.job_id || `jsearch-${page}-${index}`,
      title: job.job_title || '',
      company: job.employer_name || '',
      location: job.job_city || job.job_state || job.job_country || '',
      country: job.job_country || '',
      city: job.job_city || '',
      url: job.job_apply_link || job.job_google_link || '',
      companyUrl: job.employer_website || '',
      description: job.job_description || '',
      salary: job.job_min_salary && job.job_max_salary
        ? `$${job.job_min_salary} - $${job.job_max_salary}`
        : job.job_salary || undefined,
      posted: job.job_posted_at_datetime_utc || undefined,
      type: job.job_employment_type || undefined,
      remote: Boolean(job.job_is_remote),
      tags: job.job_highlights?.qualifications || [],
      source: 'jsearch',
    }));

    const jobs = normalizeBatch(rawJobs, 'jsearch');
    const result = { jobs, source: 'jsearch', total: jobs.length };
    cache.set(cacheKey, result);
    return result;
  } catch (err) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      return { jobs: [], error: 'JSearch API request timed out', source: 'jsearch' };
    }
    return { jobs: [], error: err.message, source: 'jsearch' };
  }
}

function invalidateCache() {
  cache.flushAll();
}

export { searchJSearch, invalidateCache as jsearchInvalidateCache };
