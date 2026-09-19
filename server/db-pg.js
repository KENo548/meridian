/**
 * PostgreSQL Database Driver for Meridian
 * 
 * Drop-in replacement for db.js using PostgreSQL instead of SQLite.
 * Same export API, but all functions are async.
 * 
 * Usage: Set DATABASE_URL environment variable to Neon connection string.
 */

import pg from 'pg'
import { fileURLToPath } from 'node:url'

const { Pool } = pg

let _pool = null
let _initialized = false

function getPool() {
  if (_pool) return _pool
  
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set')
  }
  
  _pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  })
  
  _pool.on('error', (err) => {
    console.error('[DB-PG] Unexpected pool error:', err.message)
  })
  
  return _pool
}

export async function getDb() {
  return getPool()
}

async function query(text, params = []) {
  const pool = getPool()
  return pool.query(text, params)
}

async function transaction(fn) {
  const pool = getPool()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ─── Schema Initialization ──────────────────────────────────────

export async function initSchema() {
  if (_initialized) return
  
  console.log('[DB-PG] Initializing schema...')
  const t0 = Date.now()
  
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_pr_user ON password_resets(user_id);

    CREATE TABLE IF NOT EXISTS discovery_entries (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'discovered',
      company_name TEXT NOT NULL,
      resolved_firm_id TEXT,
      user_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_de_status ON discovery_entries(status);
    CREATE INDEX IF NOT EXISTS idx_de_company ON discovery_entries(company_name);
    CREATE INDEX IF NOT EXISTS idx_de_firm ON discovery_entries(resolved_firm_id);
    CREATE INDEX IF NOT EXISTS idx_de_user ON discovery_entries(user_id);

    CREATE TABLE IF NOT EXISTS pipeline_direct_jobs (
      firm_id TEXT NOT NULL,
      jobs TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (firm_id)
    );

    CREATE TABLE IF NOT EXISTS pipeline_source_discovery (
      firm_id TEXT NOT NULL,
      result TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (firm_id)
    );

    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY,
      canonical_name TEXT NOT NULL,
      aliases TEXT DEFAULT '[]',
      domain TEXT,
      careers_url TEXT,
      company_type TEXT DEFAULT 'unknown',
      company_tier TEXT DEFAULT 'unknown',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_companies_name ON companies(canonical_name);
    CREATE INDEX IF NOT EXISTS idx_companies_domain ON companies(domain);
    CREATE INDEX IF NOT EXISTS idx_companies_type ON companies(company_type);

    CREATE TABLE IF NOT EXISTS company_sources (
      id TEXT PRIMARY KEY,
      company_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      source_url TEXT NOT NULL,
      careers_url TEXT,
      board_slug TEXT,
      tenant TEXT,
      site TEXT,
      company_identifier TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      priority INTEGER NOT NULL DEFAULT 0,
      capability TEXT NOT NULL DEFAULT 'unknown',
      verification_status TEXT NOT NULL DEFAULT 'unverified',
      discovered_at TEXT,
      verified_at TEXT,
      last_checked_at TEXT,
      last_success_at TEXT,
      last_failure_at TEXT,
      consecutive_failures INTEGER NOT NULL DEFAULT 0,
      last_job_count INTEGER DEFAULT 0,
      historical_job_count INTEGER DEFAULT 0,
      metadata_json TEXT DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_cs_company ON company_sources(company_id);
    CREATE INDEX IF NOT EXISTS idx_cs_provider ON company_sources(provider);
    CREATE INDEX IF NOT EXISTS idx_cs_enabled ON company_sources(enabled);

    CREATE TABLE IF NOT EXISTS canonical_jobs (
      id TEXT PRIMARY KEY,
      company_id TEXT,
      company_name TEXT NOT NULL,
      title TEXT NOT NULL,
      normalized_title TEXT,
      location TEXT,
      country TEXT,
      city TEXT,
      application_url TEXT,
      description TEXT,
      programme_type TEXT DEFAULT 'unknown',
      employment_type TEXT DEFAULT 'unknown',
      finance_category TEXT DEFAULT 'unknown',
      finance_subcategory TEXT,
      seniority TEXT,
      graduation_year TEXT,
      deadline TEXT,
      opening_date TEXT,
      posted_at TEXT,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      closed_at TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      confidence REAL DEFAULT 0.5,
      specialties TEXT DEFAULT '[]',
      source_url TEXT,
      identity_tier TEXT DEFAULT 'text',
      fingerprint TEXT,
      lifecycle TEXT DEFAULT 'open',
      closure_reason TEXT,
      consecutive_absences INTEGER DEFAULT 0,
      last_verified_open_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_cj_company ON canonical_jobs(company_id);
    CREATE INDEX IF NOT EXISTS idx_cj_status ON canonical_jobs(status);
    CREATE INDEX IF NOT EXISTS idx_cj_first_seen ON canonical_jobs(first_seen_at);
    CREATE INDEX IF NOT EXISTS idx_cj_last_seen ON canonical_jobs(last_seen_at);
    CREATE INDEX IF NOT EXISTS idx_cj_programme ON canonical_jobs(programme_type);
    CREATE INDEX IF NOT EXISTS idx_cj_finance ON canonical_jobs(finance_category);
    CREATE INDEX IF NOT EXISTS idx_cj_country ON canonical_jobs(country);

    CREATE TABLE IF NOT EXISTS raw_job_observations (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      company_id TEXT,
      source_job_id TEXT NOT NULL,
      source_url TEXT,
      fetched_at TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      payload_hash TEXT,
      http_status INTEGER,
      parser_version TEXT DEFAULT 'v1',
      created_at TEXT NOT NULL,
      FOREIGN KEY (source_id) REFERENCES company_sources(id) ON DELETE CASCADE,
      FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_rjo_source ON raw_job_observations(source_id);
    CREATE INDEX IF NOT EXISTS idx_rjo_company ON raw_job_observations(company_id);
    CREATE INDEX IF NOT EXISTS idx_rjo_fetched ON raw_job_observations(fetched_at);
    CREATE INDEX IF NOT EXISTS idx_rjo_hash ON raw_job_observations(payload_hash);

    CREATE TABLE IF NOT EXISTS job_source_observations (
      canonical_job_id TEXT NOT NULL,
      source_id TEXT NOT NULL,
      source_job_id TEXT,
      source_url TEXT,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      observation_count INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (canonical_job_id, source_id),
      FOREIGN KEY (canonical_job_id) REFERENCES canonical_jobs(id) ON DELETE CASCADE,
      FOREIGN KEY (source_id) REFERENCES company_sources(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_jso_job ON job_source_observations(canonical_job_id);
    CREATE INDEX IF NOT EXISTS idx_jso_source ON job_source_observations(source_id);

    CREATE TABLE IF NOT EXISTS job_versions (
      id TEXT PRIMARY KEY,
      canonical_job_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      changed_fields TEXT NOT NULL,
      previous_values TEXT NOT NULL,
      new_values TEXT NOT NULL,
      detected_at TEXT NOT NULL,
      source_id TEXT,
      FOREIGN KEY (canonical_job_id) REFERENCES canonical_jobs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_jv_job ON job_versions(canonical_job_id);
    CREATE INDEX IF NOT EXISTS idx_jv_detected ON job_versions(detected_at);

    CREATE TABLE IF NOT EXISTS source_health (
      source_id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'unknown',
      last_checked_at TEXT,
      last_success_at TEXT,
      last_http_status INTEGER,
      current_job_count INTEGER DEFAULT 0,
      previous_job_count INTEGER DEFAULT 0,
      rolling_avg_job_count REAL DEFAULT 0,
      consecutive_failures INTEGER NOT NULL DEFAULT 0,
      response_latency_ms INTEGER DEFAULT 0,
      parser_errors INTEGER NOT NULL DEFAULT 0,
      anomaly_flags TEXT DEFAULT '[]',
      updated_at TEXT NOT NULL,
      FOREIGN KEY (source_id) REFERENCES company_sources(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS poll_schedule (
      source_id TEXT PRIMARY KEY,
      next_check_at TEXT NOT NULL,
      last_checked_at TEXT,
      last_success_at TEXT,
      priority TEXT NOT NULL DEFAULT 'normal',
      poll_interval_ms INTEGER NOT NULL DEFAULT 3600000,
      consecutive_failures INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (source_id) REFERENCES company_sources(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS discovery_queue (
      id TEXT PRIMARY KEY,
      company_id TEXT,
      company_name TEXT NOT NULL,
      domain TEXT,
      known_careers_url TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      attempt_count INTEGER NOT NULL DEFAULT 0,
      last_attempt_at TEXT,
      next_attempt_at TEXT,
      discovered_provider TEXT,
      discovered_source_url TEXT,
      confidence REAL DEFAULT 0,
      evidence TEXT DEFAULT '[]',
      careers_pages_found TEXT DEFAULT '[]',
      multi_source TEXT DEFAULT '[]',
      manual_review_required INTEGER NOT NULL DEFAULT 0,
      failure_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_dq_status ON discovery_queue(status);
    CREATE INDEX IF NOT EXISTS idx_dq_company ON discovery_queue(company_id);
    CREATE INDEX IF NOT EXISTS idx_dq_next ON discovery_queue(next_attempt_at);

    CREATE TABLE IF NOT EXISTS job_sightings (
      id TEXT PRIMARY KEY,
      canonical_job_id TEXT NOT NULL,
      source TEXT NOT NULL,
      source_tier TEXT NOT NULL DEFAULT 'tracker',
      source_external_key TEXT,
      source_job_id TEXT,
      source_url TEXT,
      employer_url TEXT,
      raw_title TEXT,
      raw_company TEXT,
      raw_location TEXT,
      raw_payload TEXT,
      content_hash TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      last_checked_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (canonical_job_id) REFERENCES canonical_jobs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_js_job ON job_sightings(canonical_job_id);
    CREATE INDEX IF NOT EXISTS idx_js_source ON job_sightings(source);
    CREATE INDEX IF NOT EXISTS idx_js_tier ON job_sightings(source_tier);
    CREATE INDEX IF NOT EXISTS idx_js_active ON job_sightings(is_active);
    CREATE INDEX IF NOT EXISTS idx_js_ext_key ON job_sightings(source_external_key);

    CREATE TABLE IF NOT EXISTS adapter_health (
      source TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'unknown',
      scan_started_at TEXT,
      scan_finished_at TEXT,
      http_status INTEGER,
      jobs_found INTEGER DEFAULT 0,
      previous_jobs_found INTEGER DEFAULT 0,
      baseline_avg_jobs REAL DEFAULT 0,
      duration_ms INTEGER DEFAULT 0,
      parser_version TEXT DEFAULT 'v1',
      error_message TEXT,
      consecutive_zero_scans INTEGER DEFAULT 0,
      last_non_zero_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)
  
  console.log(`[DB-PG] Schema initialized in ${Date.now() - t0}ms`)
  _initialized = true
}

// ─── Discovery Entries ──────────────────────────────────────────

export async function saveEntry(entry) {
  const data = JSON.stringify(entry)
  await query(`
    INSERT INTO discovery_entries (id, data, status, company_name, resolved_firm_id, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (id) DO UPDATE SET
      data = excluded.data,
      status = excluded.status,
      company_name = excluded.company_name,
      resolved_firm_id = excluded.resolved_firm_id,
      updated_at = excluded.updated_at
  `, [entry.id, data, entry.status, entry.companyName, entry.resolvedFirmId || null, entry.createdAt, entry.updatedAt])
}

export async function getEntryById(id) {
  const { rows } = await query(`SELECT data FROM discovery_entries WHERE id = $1`, [id])
  return rows[0] ? JSON.parse(rows[0].data) : null
}

export async function getAllEntries() {
  const { rows } = await query(`SELECT data FROM discovery_entries`)
  return rows.map(r => JSON.parse(r.data))
}

export async function getEntriesByStatus(status) {
  const { rows } = await query(`SELECT data FROM discovery_entries WHERE status = $1`, [status])
  return rows.map(r => JSON.parse(r.data))
}

export async function getEntriesByFirm(firmId) {
  const { rows } = await query(`SELECT data FROM discovery_entries WHERE resolved_firm_id = $1`, [firmId])
  return rows.map(r => JSON.parse(r.data))
}

export async function deleteEntry(id) {
  await query(`DELETE FROM discovery_entries WHERE id = $1`, [id])
}

export async function getEntryCount() {
  const { rows } = await query(`SELECT COUNT(*) as count FROM discovery_entries`)
  return parseInt(rows[0].count)
}

export async function saveEntries(entries) {
  await transaction(async (client) => {
    for (const entry of entries) {
      const data = JSON.stringify(entry)
      await client.query(`
        INSERT INTO discovery_entries (id, data, status, company_name, resolved_firm_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
          data = excluded.data,
          status = excluded.status,
          company_name = excluded.company_name,
          resolved_firm_id = excluded.resolved_firm_id,
          updated_at = excluded.updated_at
      `, [entry.id, data, entry.status, entry.companyName, entry.resolvedFirmId || null, entry.createdAt, entry.updatedAt])
    }
  })
}

// ─── Pipeline State ─────────────────────────────────────────────

export async function saveDirectJobs(firmId, jobs) {
  await query(`
    INSERT INTO pipeline_direct_jobs (firm_id, jobs, updated_at)
    VALUES ($1, $2, $3)
    ON CONFLICT (firm_id) DO UPDATE SET
      jobs = excluded.jobs,
      updated_at = excluded.updated_at
  `, [firmId, JSON.stringify(jobs), new Date().toISOString()])
}

export async function getDirectJobs(firmId) {
  const { rows } = await query(`SELECT jobs FROM pipeline_direct_jobs WHERE firm_id = $1`, [firmId])
  return rows[0] ? JSON.parse(rows[0].jobs) : []
}

export async function getAllDirectJobs() {
  const { rows } = await query(`SELECT firm_id, jobs FROM pipeline_direct_jobs`)
  const map = new Map()
  for (const row of rows) {
    map.set(row.firm_id, JSON.parse(row.jobs))
  }
  return map
}

export async function clearDirectJobs() {
  await query(`DELETE FROM pipeline_direct_jobs`)
}

export async function saveSourceDiscovery(firmId, result) {
  await query(`
    INSERT INTO pipeline_source_discovery (firm_id, result, updated_at)
    VALUES ($1, $2, $3)
    ON CONFLICT (firm_id) DO UPDATE SET
      result = excluded.result,
      updated_at = excluded.updated_at
  `, [firmId, JSON.stringify(result), new Date().toISOString()])
}

export async function getSourceDiscovery(firmId) {
  const { rows } = await query(`SELECT result FROM pipeline_source_discovery WHERE firm_id = $1`, [firmId])
  return rows[0] ? JSON.parse(rows[0].result) : null
}

export async function getAllSourceDiscoveries() {
  const { rows } = await query(`SELECT firm_id, result FROM pipeline_source_discovery`)
  const map = new Map()
  for (const row of rows) {
    map.set(row.firm_id, JSON.parse(row.result))
  }
  return map
}

export async function clearSourceDiscoveries() {
  await query(`DELETE FROM pipeline_source_discovery`)
}

// ─── KV Store (generic) ────────────────────────────────────────

export async function setKV(key, value) {
  await query(`
    INSERT INTO kv_store (key, value, updated_at)
    VALUES ($1, $2, $3)
    ON CONFLICT (key) DO UPDATE SET
      value = excluded.value,
      updated_at = excluded.updated_at
  `, [key, JSON.stringify(value), new Date().toISOString()])
}

export async function getKV(key) {
  const { rows } = await query(`SELECT value FROM kv_store WHERE key = $1`, [key])
  return rows[0] ? JSON.parse(rows[0].value) : null
}

// ─── Companies ─────────────────────────────────────────────────

export async function saveCompany(company) {
  const ts = new Date().toISOString()
  await query(`
    INSERT INTO companies (id, canonical_name, aliases, domain, careers_url, company_type, company_tier, enabled, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE((SELECT created_at FROM companies WHERE id = $1), $9), $10)
    ON CONFLICT (id) DO UPDATE SET
      canonical_name = excluded.canonical_name,
      aliases = excluded.aliases,
      domain = excluded.domain,
      careers_url = excluded.careers_url,
      company_type = excluded.company_type,
      company_tier = excluded.company_tier,
      enabled = excluded.enabled,
      updated_at = excluded.updated_at
  `, [
    company.id, company.canonicalName, JSON.stringify(company.aliases || []),
    company.domain || null, company.careersUrl || null,
    company.companyType || 'unknown', company.companyTier || 'unknown',
    company.enabled !== false ? 1 : 0, ts, ts
  ])
}

export async function getCompanyById(id) {
  const { rows } = await query(`SELECT * FROM companies WHERE id = $1`, [id])
  return rows[0] ? { ...rows[0], aliases: JSON.parse(rows[0].aliases || '[]'), enabled: !!rows[0].enabled } : null
}

export async function getAllCompanies() {
  const { rows } = await query(`SELECT * FROM companies ORDER BY canonical_name`)
  return rows.map(r => ({ ...r, aliases: JSON.parse(r.aliases || '[]'), enabled: !!r.enabled }))
}

export async function getEnabledCompanies() {
  const { rows } = await query(`SELECT * FROM companies WHERE enabled = 1 ORDER BY canonical_name`)
  return rows.map(r => ({ ...r, aliases: JSON.parse(r.aliases || '[]'), enabled: !!r.enabled }))
}

export async function upsertCompanyByName(name, domain) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const { rows } = await query(`SELECT id FROM companies WHERE canonical_name = $1`, [name])
  if (rows[0]) return rows[0].id
  const id = `company:${slug}`
  await saveCompany({ id, canonicalName: name, domain, companyType: 'unknown', companyTier: 'unknown', enabled: true })
  return id
}

// ─── Company Sources ───────────────────────────────────────────

export async function saveCompanySource(source) {
  const ts = new Date().toISOString()
  await query(`
    INSERT INTO company_sources (
      id, company_id, provider, source_url, careers_url, board_slug, tenant, site,
      company_identifier, enabled, priority, capability, verification_status,
      discovered_at, verified_at, last_checked_at, last_success_at, last_failure_at,
      consecutive_failures, last_job_count, historical_job_count, metadata_json, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, COALESCE((SELECT created_at FROM company_sources WHERE id = $1), $23), $24)
    ON CONFLICT (id) DO UPDATE SET
      company_id = excluded.company_id,
      provider = excluded.provider,
      source_url = excluded.source_url,
      careers_url = excluded.careers_url,
      board_slug = excluded.board_slug,
      tenant = excluded.tenant,
      site = excluded.site,
      company_identifier = excluded.company_identifier,
      enabled = excluded.enabled,
      priority = excluded.priority,
      capability = excluded.capability,
      verification_status = excluded.verification_status,
      discovered_at = excluded.discovered_at,
      verified_at = excluded.verified_at,
      last_checked_at = excluded.last_checked_at,
      last_success_at = excluded.last_success_at,
      last_failure_at = excluded.last_failure_at,
      consecutive_failures = excluded.consecutive_failures,
      last_job_count = excluded.last_job_count,
      historical_job_count = excluded.historical_job_count,
      metadata_json = excluded.metadata_json,
      updated_at = excluded.updated_at
  `, [
    source.id, source.companyId, source.provider, source.sourceUrl,
    source.careersUrl || null, source.boardSlug || null, source.tenant || null,
    source.site || null, source.companyIdentifier || null,
    source.enabled !== false ? 1 : 0, source.priority || 0,
    source.capability || 'unknown', source.verificationStatus || 'unverified',
    source.discoveredAt || null, source.verifiedAt || null,
    source.lastCheckedAt || null, source.lastSuccessAt || null,
    source.lastFailureAt || null, source.consecutiveFailures || 0,
    source.lastJobCount || 0, source.historicalJobCount || 0,
    JSON.stringify(source.metadata || {}), ts, ts
  ])
}

export async function getCompanySourceById(id) {
  const { rows } = await query(`SELECT * FROM company_sources WHERE id = $1`, [id])
  return rows[0] ? { ...rows[0], enabled: !!rows[0].enabled, metadata: JSON.parse(rows[0].metadata_json || '{}') } : null
}

export async function getSourcesByCompanyId(companyId) {
  const { rows } = await query(`SELECT * FROM company_sources WHERE company_id = $1 ORDER BY priority DESC`, [companyId])
  return rows.map(r => ({ ...r, enabled: !!r.enabled, metadata: JSON.parse(r.metadata_json || '{}') }))
}

export async function getAllEnabledSources() {
  const { rows } = await query(`SELECT * FROM company_sources WHERE enabled = 1 ORDER BY priority DESC`)
  return rows.map(r => ({ ...r, enabled: !!r.enabled, metadata: JSON.parse(r.metadata_json || '{}') }))
}

export async function updateSourceHealth(sourceId, data) {
  const ts = new Date().toISOString()
  await query(`
    INSERT INTO source_health (
      source_id, status, last_checked_at, last_success_at, last_http_status,
      current_job_count, previous_job_count, rolling_avg_job_count,
      consecutive_failures, response_latency_ms, parser_errors, anomaly_flags, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    ON CONFLICT (source_id) DO UPDATE SET
      status = excluded.status,
      last_checked_at = excluded.last_checked_at,
      last_success_at = excluded.last_success_at,
      last_http_status = excluded.last_http_status,
      current_job_count = excluded.current_job_count,
      previous_job_count = excluded.previous_job_count,
      rolling_avg_job_count = excluded.rolling_avg_job_count,
      consecutive_failures = excluded.consecutive_failures,
      response_latency_ms = excluded.response_latency_ms,
      parser_errors = excluded.parser_errors,
      anomaly_flags = excluded.anomaly_flags,
      updated_at = excluded.updated_at
  `, [
    sourceId, data.status || 'unknown', data.lastCheckedAt || ts,
    data.lastSuccessAt || null, data.lastHttpStatus || null,
    data.currentJobCount || 0, data.previousJobCount || 0,
    data.rollingAvgJobCount || 0, data.consecutiveFailures || 0,
    data.responseLatencyMs || 0, data.parserErrors || 0,
    JSON.stringify(data.anomalyFlags || []), ts
  ])
  await query(`
    UPDATE company_sources SET last_checked_at = $1, last_success_at = $2, last_failure_at = $3,
    consecutive_failures = $4, last_job_count = $5, updated_at = $6 WHERE id = $7
  `, [ts, data.lastSuccessAt || null, data.consecutiveFailures > 0 ? ts : null,
    data.consecutiveFailures || 0, data.currentJobCount || 0, ts, sourceId])
}

export async function getSourceHealth(sourceId) {
  const { rows } = await query(`SELECT * FROM source_health WHERE source_id = $1`, [sourceId])
  return rows[0] ? { ...rows[0], anomalyFlags: JSON.parse(rows[0].anomaly_flags || '[]') } : null
}

// ─── Canonical Jobs ────────────────────────────────────────────

export async function saveCanonicalJob(job) {
  const ts = new Date().toISOString()
  const { rows } = await query(`
    INSERT INTO canonical_jobs (
      id, company_id, company_name, title, normalized_title, location, country, city,
      application_url, description, programme_type, employment_type, finance_category,
      finance_subcategory, seniority, graduation_year, deadline, opening_date, posted_at,
      first_seen_at, last_seen_at, closed_at, status, confidence, specialties, source_url,
      identity_tier, fingerprint, lifecycle, closure_reason, consecutive_absences, last_verified_open_at,
      created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, COALESCE((SELECT created_at FROM canonical_jobs WHERE id = $1), $33), $34)
    ON CONFLICT (id) DO UPDATE SET
      company_id = excluded.company_id,
      company_name = excluded.company_name,
      title = excluded.title,
      normalized_title = excluded.normalized_title,
      location = excluded.location,
      country = excluded.country,
      city = excluded.city,
      application_url = excluded.application_url,
      description = excluded.description,
      programme_type = excluded.programme_type,
      employment_type = excluded.employment_type,
      finance_category = excluded.finance_category,
      finance_subcategory = excluded.finance_subcategory,
      seniority = excluded.seniority,
      graduation_year = excluded.graduation_year,
      deadline = excluded.deadline,
      opening_date = excluded.opening_date,
      posted_at = excluded.posted_at,
      first_seen_at = excluded.first_seen_at,
      last_seen_at = excluded.last_seen_at,
      closed_at = excluded.closed_at,
      status = excluded.status,
      confidence = excluded.confidence,
      specialties = excluded.specialties,
      source_url = excluded.source_url,
      identity_tier = excluded.identity_tier,
      fingerprint = excluded.fingerprint,
      lifecycle = excluded.lifecycle,
      closure_reason = excluded.closure_reason,
      consecutive_absences = excluded.consecutive_absences,
      last_verified_open_at = excluded.last_verified_open_at,
      updated_at = excluded.updated_at
    RETURNING id
  `, [
    job.id, job.companyId || null, job.companyName, job.title,
    job.normalizedTitle || null, job.location || null, job.country || null,
    job.city || null, job.applicationUrl || null, job.description || null,
    job.programmeType || 'unknown', job.employmentType || 'unknown',
    job.financeCategory || 'unknown', job.financeSubcategory || null,
    job.seniority || null, job.graduationYear || null, job.deadline || null,
    job.openingDate || null, job.postedAt || null, job.firstSeenAt, job.lastSeenAt,
    job.closedAt || null, job.status || 'active', job.confidence || 0.5,
    JSON.stringify(job.specialties || []), job.sourceUrl || null,
    job.identityTier || 'text', job.fingerprint || null,
    job.lifecycle || 'open', job.closureReason || null,
    job.consecutiveAbsences ?? 0, job.lastVerifiedOpenAt || null,
    ts, job.id, ts
  ])
  return rows[0]?.id || job.id
}

export async function getCanonicalJobById(id) {
  const { rows } = await query(`SELECT * FROM canonical_jobs WHERE id = $1`, [id])
  return rows[0] || null
}

export async function getCanonicalJobs({ companyId, status, programmeType, financeCategory, country, limit = 50, offset = 0, sort = 'last_seen_at', order = 'desc' } = {}) {
  let where = []
  let params = []
  let paramIndex = 1
  
  if (companyId) { where.push(`company_id = $${paramIndex++}`); params.push(companyId) }
  if (status) { where.push(`status = $${paramIndex++}`); params.push(status) }
  if (programmeType) { where.push(`programme_type = $${paramIndex++}`); params.push(programmeType) }
  if (financeCategory) { where.push(`finance_category = $${paramIndex++}`); params.push(financeCategory) }
  if (country) { where.push(`country = $${paramIndex++}`); params.push(country) }
  
  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
  const allowedSorts = ['first_seen_at', 'last_seen_at', 'posted_at', 'deadline', 'company_name', 'title']
  const sortCol = allowedSorts.includes(sort) ? sort : 'last_seen_at'
  const sortOrder = order === 'asc' ? 'ASC' : 'DESC'
  
  params.push(limit, offset)
  const { rows } = await query(`SELECT * FROM canonical_jobs ${whereClause} ORDER BY ${sortCol} ${sortOrder} LIMIT $${paramIndex++} OFFSET $${paramIndex++}`, params)
  return rows
}

export async function countCanonicalJobs({ companyId, status, programmeType, financeCategory, country } = {}) {
  let where = []
  let params = []
  let paramIndex = 1
  
  if (companyId) { where.push(`company_id = $${paramIndex++}`); params.push(companyId) }
  if (status) { where.push(`status = $${paramIndex++}`); params.push(status) }
  if (programmeType) { where.push(`programme_type = $${paramIndex++}`); params.push(programmeType) }
  if (financeCategory) { where.push(`finance_category = $${paramIndex++}`); params.push(financeCategory) }
  if (country) { where.push(`country = $${paramIndex++}`); params.push(country) }
  
  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
  const { rows } = await query(`SELECT COUNT(*) as count FROM canonical_jobs ${whereClause}`, params)
  return parseInt(rows[0].count)
}

export async function getNewCanonicalJobs(since) {
  const { rows } = await query(`SELECT * FROM canonical_jobs WHERE created_at > $1 ORDER BY created_at DESC`, [since])
  return rows
}

export async function getJobsByCompanyId(companyId) {
  const { rows } = await query(`SELECT * FROM canonical_jobs WHERE company_id = $1 ORDER BY last_seen_at DESC`, [companyId])
  return rows
}

// ─── Raw Job Observations ──────────────────────────────────────

export async function saveRawObservation(obs) {
  const ts = new Date().toISOString()
  await query(`
    INSERT INTO raw_job_observations (id, source_id, company_id, source_job_id, source_url, fetched_at, payload_json, payload_hash, http_status, parser_version, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
  `, [
    obs.id, obs.sourceId, obs.companyId || null, obs.sourceJobId,
    obs.sourceUrl || null, obs.fetchedAt, JSON.stringify(obs.payload),
    obs.payloadHash || null, obs.httpStatus || null, obs.parserVersion || 'v1', ts
  ])
}

export async function getObservationsBySourceId(sourceId, limit = 100) {
  const { rows } = await query(`SELECT * FROM raw_job_observations WHERE source_id = $1 ORDER BY fetched_at DESC LIMIT $2`, [sourceId, limit])
  return rows
}

// ─── Job Source Observations ───────────────────────────────────

export async function saveJobSourceObservation(canonicalJobId, sourceId, sourceJobId, sourceUrl) {
  const ts = new Date().toISOString()
  await query(`
    INSERT INTO job_source_observations (canonical_job_id, source_id, source_job_id, source_url, first_seen_at, last_seen_at, observation_count)
    VALUES ($1, $2, $3, $4, $5, $6, 1)
    ON CONFLICT (canonical_job_id, source_id) DO UPDATE SET
      last_seen_at = excluded.last_seen_at,
      source_job_id = excluded.source_job_id,
      source_url = excluded.source_url,
      observation_count = job_source_observations.observation_count + 1
  `, [canonicalJobId, sourceId, sourceJobId || null, sourceUrl || null, ts, ts])
}

export async function getObservationsForJob(canonicalJobId) {
  const { rows } = await query(`
    SELECT jso.*, cs.provider, cs.source_url as cs_url, c.canonical_name as company_name
    FROM job_source_observations jso
    JOIN company_sources cs ON jso.source_id = cs.id
    LEFT JOIN companies c ON cs.company_id = c.id
    WHERE jso.canonical_job_id = $1
  `, [canonicalJobId])
  return rows
}

// ─── Job Sightings (Sprint 1) ──────────────────────────────────

export async function upsertSighting(sighting) {
  const ts = new Date().toISOString()
  const { rows } = await query(
    `SELECT id FROM job_sightings WHERE canonical_job_id = $1 AND source = $2`,
    [sighting.canonicalJobId, sighting.source]
  )

  if (rows[0]) {
    await query(`
      UPDATE job_sightings SET
        source_external_key = COALESCE($1, source_external_key),
        source_job_id = COALESCE($2, source_job_id),
        source_url = COALESCE($3, source_url),
        employer_url = COALESCE($4, employer_url),
        raw_title = COALESCE($5, raw_title),
        raw_company = COALESCE($6, raw_company),
        raw_location = COALESCE($7, raw_location),
        raw_payload = COALESCE($8, raw_payload),
        content_hash = COALESCE($9, content_hash),
        is_active = 1,
        last_seen_at = $10,
        last_checked_at = $11
      WHERE id = $12
    `, [
      sighting.sourceExternalKey || null,
      sighting.sourceJobId || null,
      sighting.sourceUrl || null,
      sighting.employerUrl || null,
      sighting.rawTitle || null,
      sighting.rawCompany || null,
      sighting.rawLocation || null,
      sighting.rawPayload || null,
      sighting.contentHash || null,
      ts, ts,
      rows[0].id
    ])
    return rows[0].id
  } else {
    const id = `sighting:${sighting.canonicalJobId}:${sighting.source}:${Date.now()}`
    await query(`
      INSERT INTO job_sightings (
        id, canonical_job_id, source, source_tier, source_external_key,
        source_job_id, source_url, employer_url,
        raw_title, raw_company, raw_location, raw_payload, content_hash,
        is_active, first_seen_at, last_seen_at, last_checked_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 1, $14, $15, $16, $17)
    `, [
      id, sighting.canonicalJobId, sighting.source, sighting.sourceTier || 'tracker',
      sighting.sourceExternalKey || null,
      sighting.sourceJobId || null, sighting.sourceUrl || null,
      sighting.employerUrl || null,
      sighting.rawTitle || null, sighting.rawCompany || null,
      sighting.rawLocation || null, sighting.rawPayload || null,
      sighting.contentHash || null,
      ts, ts, ts, ts
    ])
    return id
  }
}

export async function deactivateSighting(canonicalJobId, source) {
  const ts = new Date().toISOString()
  await query(`
    UPDATE job_sightings SET is_active = 0, last_checked_at = $1
    WHERE canonical_job_id = $2 AND source = $3
  `, [ts, canonicalJobId, source])
}

export async function getActiveSightingsForJob(canonicalJobId) {
  const { rows } = await query(`
    SELECT * FROM job_sightings WHERE canonical_job_id = $1 AND is_active = 1
    ORDER BY source_tier ASC, last_seen_at DESC
  `, [canonicalJobId])
  return rows
}

export async function getActiveSightingsForJobs(canonicalJobIds) {
  if (!canonicalJobIds || canonicalJobIds.length === 0) return new Map()
  const placeholders = canonicalJobIds.map((_, i) => `$${i + 1}`).join(',')
  const { rows } = await query(`
    SELECT * FROM job_sightings WHERE canonical_job_id IN (${placeholders}) AND is_active = 1
    ORDER BY source_tier ASC, last_seen_at DESC
  `, canonicalJobIds)
  const map = new Map()
  for (const row of rows) {
    if (!map.has(row.canonical_job_id)) map.set(row.canonical_job_id, [])
    map.get(row.canonical_job_id).push(row)
  }
  return map
}

export async function getAllSightingsForJob(canonicalJobId) {
  const { rows } = await query(`
    SELECT * FROM job_sightings WHERE canonical_job_id = $1
    ORDER BY source_tier ASC, last_seen_at DESC
  `, [canonicalJobId])
  return rows
}

export async function getSightingBySourceAndJob(canonicalJobId, source) {
  const { rows } = await query(
    `SELECT * FROM job_sightings WHERE canonical_job_id = $1 AND source = $2`,
    [canonicalJobId, source]
  )
  return rows[0] || null
}

export async function getActiveSightingCount(canonicalJobId) {
  const { rows } = await query(
    `SELECT COUNT(*) as count FROM job_sightings WHERE canonical_job_id = $1 AND is_active = 1`,
    [canonicalJobId]
  )
  return rows[0] ? parseInt(rows[0].count) : 0
}

export async function getSourceTierForSighting(canonicalJobId, source) {
  const { rows } = await query(
    `SELECT source_tier FROM job_sightings WHERE canonical_job_id = $1 AND source = $2`,
    [canonicalJobId, source]
  )
  return rows[0] ? rows[0].source_tier : null
}

// ─── Canonical Job Lifecycle Updates (Sprint 1) ────────────────

export async function updateCanonicalLifecycle(id, lifecycle, closureReason) {
  const ts = new Date().toISOString()
  const sets = ['lifecycle = $1', 'updated_at = $2']
  const params = [lifecycle, ts]
  let paramIndex = 3
  
  if (closureReason !== undefined) {
    sets.push(`closure_reason = $${paramIndex++}`)
    params.push(closureReason)
  }
  if (lifecycle === 'closed') {
    sets.push(`closed_at = $${paramIndex++}`)
    params.push(ts)
  }
  params.push(id)
  await query(`UPDATE canonical_jobs SET ${sets.join(', ')} WHERE id = $${paramIndex}`, params)
}

export async function incrementAbsences(id) {
  const ts = new Date().toISOString()
  await query(`
    UPDATE canonical_jobs SET consecutive_absences = consecutive_absences + 1, updated_at = $1
    WHERE id = $2
  `, [ts, id])
}

export async function resetAbsences(id) {
  const ts = new Date().toISOString()
  await query(`
    UPDATE canonical_jobs SET consecutive_absences = 0, last_verified_open_at = $1, updated_at = $2
    WHERE id = $3
  `, [ts, ts, id])
}

export async function getOpenCanonicalJobs() {
  const { rows } = await query(
    `SELECT * FROM canonical_jobs WHERE lifecycle IN ('open', 'closing_soon') ORDER BY last_verified_open_at DESC`
  )
  return rows
}

export async function findCanonicalByFingerprint(fingerprint) {
  if (!fingerprint) return null
  const { rows } = await query(
    `SELECT * FROM canonical_jobs WHERE fingerprint = $1 LIMIT 1`,
    [fingerprint]
  )
  return rows[0] || null
}

export async function findCanonicalByExternalKey(sourceExternalKey) {
  if (!sourceExternalKey) return null
  const { rows } = await query(`
    SELECT cj.* FROM canonical_jobs cj
    JOIN job_sightings js ON cj.id = js.canonical_job_id
    WHERE js.source_external_key = $1 AND js.is_active = 1
    LIMIT 1
  `, [sourceExternalKey])
  return rows[0] || null
}

// ─── Adapter Health (Sprint 1) ─────────────────────────────────

export async function upsertAdapterHealth(health) {
  const ts = new Date().toISOString()
  const { rows } = await query(`SELECT source FROM adapter_health WHERE source = $1`, [health.source])

  if (rows[0]) {
    await query(`
      UPDATE adapter_health SET
        status = $1, scan_started_at = $2, scan_finished_at = $3,
        http_status = $4, jobs_found = $5, previous_jobs_found = $6,
        baseline_avg_jobs = $7, duration_ms = $8, parser_version = $9,
        error_message = $10, consecutive_zero_scans = $11, last_non_zero_at = $12,
        updated_at = $13
      WHERE source = $14
    `, [
      health.status || 'unknown',
      health.scanStartedAt || null,
      health.scanFinishedAt || null,
      health.httpStatus || null,
      health.jobsFound ?? 0,
      health.previousJobsFound ?? 0,
      health.baselineAvgJobs ?? 0,
      health.durationMs ?? 0,
      health.parserVersion || 'v1',
      health.errorMessage || null,
      health.consecutiveZeroScans ?? 0,
      health.lastNonZeroAt || null,
      ts,
      health.source
    ])
  } else {
    await query(`
      INSERT INTO adapter_health (
        source, status, scan_started_at, scan_finished_at, http_status,
        jobs_found, previous_jobs_found, baseline_avg_jobs, duration_ms,
        parser_version, error_message, consecutive_zero_scans, last_non_zero_at,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    `, [
      health.source,
      health.status || 'unknown',
      health.scanStartedAt || null,
      health.scanFinishedAt || null,
      health.httpStatus || null,
      health.jobsFound ?? 0,
      health.previousJobsFound ?? 0,
      health.baselineAvgJobs ?? 0,
      health.durationMs ?? 0,
      health.parserVersion || 'v1',
      health.errorMessage || null,
      health.consecutiveZeroScans ?? 0,
      health.lastNonZeroAt || null,
      ts, ts
    ])
  }
}

export async function getAdapterHealth(source) {
  const { rows } = await query(`SELECT * FROM adapter_health WHERE source = $1`, [source])
  return rows[0] || null
}

export async function getAllAdapterHealth() {
  const { rows } = await query(`SELECT * FROM adapter_health ORDER BY source`)
  return rows
}

export async function getUnhealthyAdapters(threshold = 3) {
  const { rows } = await query(
    `SELECT * FROM adapter_health WHERE consecutive_zero_scans >= $1 OR status = 'error' ORDER BY consecutive_zero_scans DESC`,
    [threshold]
  )
  return rows
}

// ─── Job Versions ──────────────────────────────────────────────

export async function saveJobVersion(version) {
  const ts = new Date().toISOString()
  await query(`
    INSERT INTO job_versions (id, canonical_job_id, version_number, changed_fields, previous_values, new_values, detected_at, source_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
  `, [
    version.id, version.canonicalJobId, version.versionNumber,
    JSON.stringify(version.changedFields), JSON.stringify(version.previousValues),
    JSON.stringify(version.newValues), ts, version.sourceId || null
  ])
}

export async function getVersionsForJob(canonicalJobId) {
  const { rows } = await query(`SELECT * FROM job_versions WHERE canonical_job_id = $1 ORDER BY version_number DESC`, [canonicalJobId])
  return rows
}

// ─── Poll Schedule ─────────────────────────────────────────────

export async function savePollSchedule(schedule) {
  const ts = new Date().toISOString()
  await query(`
    INSERT INTO poll_schedule (source_id, next_check_at, last_checked_at, last_success_at, priority, poll_interval_ms, consecutive_failures, last_error, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    ON CONFLICT (source_id) DO UPDATE SET
      next_check_at = excluded.next_check_at,
      last_checked_at = excluded.last_checked_at,
      last_success_at = excluded.last_success_at,
      priority = excluded.priority,
      poll_interval_ms = excluded.poll_interval_ms,
      consecutive_failures = excluded.consecutive_failures,
      last_error = excluded.last_error,
      updated_at = excluded.updated_at
  `, [
    schedule.sourceId, schedule.nextCheckAt, schedule.lastCheckedAt || null,
    schedule.lastSuccessAt || null, schedule.priority || 'normal',
    schedule.pollIntervalMs || 3600000, schedule.consecutiveFailures || 0,
    schedule.lastError || null, ts
  ])
}

export async function getDueSources() {
  const now = new Date().toISOString()
  const { rows } = await query(`
    SELECT ps.*, cs.provider, cs.source_url, cs.company_id, cs.enabled, c.canonical_name
    FROM poll_schedule ps
    JOIN company_sources cs ON ps.source_id = cs.id
    LEFT JOIN companies c ON cs.company_id = c.id
    WHERE ps.next_check_at <= $1 AND cs.enabled = 1
    ORDER BY ps.priority DESC, ps.next_check_at ASC
  `, [now])
  return rows
}

export async function updatePollScheduleAfterRun(sourceId, success, error) {
  const ts = new Date().toISOString()
  const { rows } = await query(`SELECT * FROM poll_schedule WHERE source_id = $1`, [sourceId])
  if (!rows[0]) return
  
  const schedule = rows[0]
  const failures = success ? 0 : schedule.consecutive_failures + 1
  const baseInterval = schedule.poll_interval_ms
  const backoffMultiplier = Math.min(Math.pow(2, failures), 24)
  const newInterval = Math.min(baseInterval * backoffMultiplier, 24 * 60 * 60 * 1000)
  const jitter = newInterval * 0.1 * (Math.random() * 2 - 1)
  const nextCheck = new Date(Date.now() + newInterval + jitter).toISOString()
  
  await query(`
    UPDATE poll_schedule SET next_check_at = $1, last_checked_at = $2, last_success_at = $3,
    consecutive_failures = $4, poll_interval_ms = $5, last_error = $6, updated_at = $7
    WHERE source_id = $8
  `, [nextCheck, ts, success ? ts : schedule.last_success_at, failures, newInterval, error || null, ts, sourceId])
}

// ─── Phase 2.1: Discovery Queue ───────────────────────────────

export async function createDiscoveryTarget(companyId, companyName, domain, knownCareersUrl) {
  const ts = new Date().toISOString()
  const id = `dq_${companyId}_${Date.now()}`
  await query(`
    INSERT INTO discovery_queue
    (id, company_id, company_name, domain, known_careers_url, status, attempt_count, evidence, careers_pages_found, multi_source, manual_review_required, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, 'pending', 0, '[]', '[]', '[]', 0, $6, $7)
    ON CONFLICT DO NOTHING
  `, [id, companyId, companyName, domain, knownCareersUrl, ts, ts])
  return id
}

export async function getDiscoveryTarget(companyId) {
  const { rows } = await query(`SELECT * FROM discovery_queue WHERE company_id = $1`, [companyId])
  return rows[0] || null
}

export async function getDiscoveryTargetsByStatus(status, limit = 50) {
  const { rows } = await query(`SELECT * FROM discovery_queue WHERE status = $1 ORDER BY CASE WHEN next_attempt_at IS NULL THEN 1 ELSE 0 END, next_attempt_at ASC LIMIT $2`, [status, limit])
  return rows
}

export async function getAllDiscoveryTargets() {
  const { rows } = await query(`SELECT * FROM discovery_queue ORDER BY status, company_name`)
  return rows
}

export async function updateDiscoveryTarget(companyId, updates) {
  const ts = new Date().toISOString()
  const fields = []
  const values = []
  let paramIndex = 1
  const ALLOWED_COLUMNS = [
    'status', 'company_name', 'resolved_firm_id', 'careers_url', 'ats_type',
    'ats_hostname', 'confidence', 'notes', 'next_attempt_at', 'last_attempt_at',
    'attempt_count', 'error_message', 'source', 'user_id', 'updated_at',
  ]
  
  for (const [key, value] of Object.entries(updates)) {
    if (key === 'id' || key === 'company_id' || key === 'created_at') continue
    const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase()
    if (!ALLOWED_COLUMNS.includes(dbKey)) continue
    fields.push(`${dbKey} = $${paramIndex++}`)
    values.push(typeof value === 'object' ? JSON.stringify(value) : value)
  }
  fields.push(`updated_at = $${paramIndex++}`)
  values.push(ts)
  values.push(companyId)
  await query(`UPDATE discovery_queue SET ${fields.join(', ')} WHERE company_id = $${paramIndex}`, values)
}

export async function getDiscoveryStats() {
  const { rows } = await query(`SELECT status, COUNT(*) as count FROM discovery_queue GROUP BY status`)
  const stats = { pending: 0, discovering: 0, supported_source_found: 0, unsupported_ats_found: 0, custom_careers_found: 0, multiple_sources_found: 0, access_restricted: 0, no_careers_source_found: 0, ambiguous: 0, failed: 0, manual_review: 0, total: 0 }
  for (const row of rows) {
    const key = row.status.replace(/-/g, '_')
    if (key in stats) stats[key] = parseInt(row.count)
    stats.total += parseInt(row.count)
  }
  return stats
}

// ─── Users ─────────────────────────────────────────────────────

export async function createUser(id, username, email, passwordHash) {
  const ts = new Date().toISOString()
  await query(`
    INSERT INTO users (id, username, email, password_hash, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6)
  `, [id, username.toLowerCase(), email.toLowerCase(), passwordHash, ts, ts])
  return { id, username: username.toLowerCase(), email: email.toLowerCase(), createdAt: ts, updatedAt: ts }
}

export async function getUserById(id) {
  const { rows } = await query(`SELECT * FROM users WHERE id = $1`, [id])
  return rows[0] || null
}

export async function getUserByUsername(username) {
  const { rows } = await query(`SELECT * FROM users WHERE username = $1`, [username?.toLowerCase()])
  return rows[0] || null
}

export async function getUserByEmail(email) {
  const { rows } = await query(`SELECT * FROM users WHERE email = $1`, [email?.toLowerCase()])
  return rows[0] || null
}

export async function updateUserPassword(id, passwordHash) {
  const ts = new Date().toISOString()
  await query(`UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3`, [passwordHash, ts, id])
}

// ─── Password Resets ───────────────────────────────────────────

export async function createPasswordReset(id, userId, tokenHash, expiresAt) {
  const ts = new Date().toISOString()
  await query(`
    INSERT INTO password_resets (id, user_id, token_hash, expires_at, used, created_at)
    VALUES ($1, $2, $3, $4, 0, $5)
  `, [id, userId, tokenHash, expiresAt, ts])
}

export async function getPasswordReset(tokenHash) {
  const { rows } = await query(`SELECT * FROM password_resets WHERE token_hash = $1 AND used = 0`, [tokenHash])
  return rows[0] || null
}

export async function usePasswordReset(tokenHash) {
  await query(`UPDATE password_resets SET used = 1 WHERE token_hash = $1`, [tokenHash])
}

export async function cleanupExpiredResets() {
  await query(`DELETE FROM password_resets WHERE expires_at < $1 OR used = 1`, [new Date().toISOString()])
}

// ─── Maintenance ────────────────────────────────────────────────

export async function getDbStats() {
  const entryCount = await getEntryCount()
  const { rows: pj } = await query(`SELECT COUNT(*) as count FROM pipeline_direct_jobs`)
  const { rows: sd } = await query(`SELECT COUNT(*) as count FROM pipeline_source_discovery`)
  const { rows: u } = await query(`SELECT COUNT(*) as count FROM users`)
  return {
    entryCount,
    directJobFirms: parseInt(pj[0].count),
    sourceDiscoveryFirms: parseInt(sd[0].count),
    userCount: parseInt(u[0].count)
  }
}

export async function closeDb() {
  if (_pool) {
    await _pool.end()
    _pool = null
    _initialized = false
  }
}

export default getDb
