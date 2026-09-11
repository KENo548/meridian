import Database from 'better-sqlite3'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync, existsSync } from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const DATA_DIR = join(dirname(__filename), '..', 'data')
const DB_PATH = join(DATA_DIR, 'meridian.db')

if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true })
}

const db = new Database(DB_PATH)

// WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// ─── Schema ─────────────────────────────────────────────────────

db.exec(`
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

  -- ─── Phase 1: Canonical Job Persistence ──────────────────────

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
    posted_at TEXT,
    first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    closed_at TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    confidence REAL DEFAULT 0.5,
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

  -- ─── Phase 2.1: Source Discovery Queue ──────────────────────

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
`)

// ─── Migrations for existing databases ─────────────────────────

const deColumns = db.prepare(`PRAGMA table_info(discovery_entries)`).all().map(c => c.name)
if (!deColumns.includes('user_id')) {
  db.exec(`ALTER TABLE discovery_entries ADD COLUMN user_id TEXT`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_de_user ON discovery_entries(user_id)`)
}

// Phase 2.3: Add opening_date and specialties to canonical_jobs
const cjColumns = db.prepare(`PRAGMA table_info(canonical_jobs)`).all().map(c => c.name)
if (!cjColumns.includes('opening_date')) {
  db.exec(`ALTER TABLE canonical_jobs ADD COLUMN opening_date TEXT`)
}
if (!cjColumns.includes('specialties')) {
  db.exec(`ALTER TABLE canonical_jobs ADD COLUMN specialties TEXT DEFAULT '[]'`)
}
if (!cjColumns.includes('source_url')) {
  db.exec(`ALTER TABLE canonical_jobs ADD COLUMN source_url TEXT`)
}

// ─── Discovery Entries ──────────────────────────────────────────

const stmts = {
  insertEntry: db.prepare(`
    INSERT OR REPLACE INTO discovery_entries (id, data, status, company_name, resolved_firm_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  getEntry: db.prepare(`SELECT data FROM discovery_entries WHERE id = ?`),
  getAllEntries: db.prepare(`SELECT data FROM discovery_entries`),
  getByStatus: db.prepare(`SELECT data FROM discovery_entries WHERE status = ?`),
  getByFirm: db.prepare(`SELECT data FROM discovery_entries WHERE resolved_firm_id = ?`),
  deleteEntry: db.prepare(`DELETE FROM discovery_entries WHERE id = ?`),
  countEntries: db.prepare(`SELECT COUNT(*) as count FROM discovery_entries`),
  updateEntry: db.prepare(`
    UPDATE discovery_entries SET data = ?, status = ?, company_name = ?, resolved_firm_id = ?, updated_at = ?
    WHERE id = ?
  `),
}

export function saveEntry(entry) {
  const data = JSON.stringify(entry)
  stmts.insertEntry.run(
    entry.id,
    data,
    entry.status,
    entry.companyName,
    entry.resolvedFirmId || null,
    entry.createdAt,
    entry.updatedAt
  )
}

export function getEntryById(id) {
  const row = stmts.getEntry.get(id)
  return row ? JSON.parse(row.data) : null
}

export function getAllEntries() {
  return stmts.getAllEntries.all().map(r => JSON.parse(r.data))
}

export function getEntriesByStatus(status) {
  return stmts.getByStatus.all(status).map(r => JSON.parse(r.data))
}

export function getEntriesByFirm(firmId) {
  return stmts.getByFirm.all(firmId).map(r => JSON.parse(r.data))
}

export function deleteEntry(id) {
  stmts.deleteEntry.run(id)
}

export function getEntryCount() {
  return stmts.countEntries.get().count
}

export function saveEntries(entries) {
  const insertMany = db.transaction((entries) => {
    for (const entry of entries) {
      saveEntry(entry)
    }
  })
  insertMany(entries)
}

// ─── Pipeline State ─────────────────────────────────────────────

export function saveDirectJobs(firmId, jobs) {
  db.prepare(`
    INSERT OR REPLACE INTO pipeline_direct_jobs (firm_id, jobs, updated_at)
    VALUES (?, ?, ?)
  `).run(firmId, JSON.stringify(jobs), new Date().toISOString())
}

export function getDirectJobs(firmId) {
  const row = db.prepare(`SELECT jobs FROM pipeline_direct_jobs WHERE firm_id = ?`).get(firmId)
  return row ? JSON.parse(row.jobs) : []
}

export function getAllDirectJobs() {
  const rows = db.prepare(`SELECT firm_id, jobs FROM pipeline_direct_jobs`).all()
  const map = new Map()
  for (const row of rows) {
    map.set(row.firm_id, JSON.parse(row.jobs))
  }
  return map
}

export function clearDirectJobs() {
  db.prepare(`DELETE FROM pipeline_direct_jobs`).run()
}

export function saveSourceDiscovery(firmId, result) {
  db.prepare(`
    INSERT OR REPLACE INTO pipeline_source_discovery (firm_id, result, updated_at)
    VALUES (?, ?, ?)
  `).run(firmId, JSON.stringify(result), new Date().toISOString())
}

export function getSourceDiscovery(firmId) {
  const row = db.prepare(`SELECT result FROM pipeline_source_discovery WHERE firm_id = ?`).get(firmId)
  return row ? JSON.parse(row.result) : null
}

export function getAllSourceDiscoveries() {
  const rows = db.prepare(`SELECT firm_id, result FROM pipeline_source_discovery`).all()
  const map = new Map()
  for (const row of rows) {
    map.set(row.firm_id, JSON.parse(row.result))
  }
  return map
}

export function clearSourceDiscoveries() {
  db.prepare(`DELETE FROM pipeline_source_discovery`).run()
}

// ─── KV Store (generic) ────────────────────────────────────────

export function setKV(key, value) {
  db.prepare(`
    INSERT OR REPLACE INTO kv_store (key, value, updated_at)
    VALUES (?, ?, ?)
  `).run(key, JSON.stringify(value), new Date().toISOString())
}

export function getKV(key) {
  const row = db.prepare(`SELECT value FROM kv_store WHERE key = ?`).get(key)
  return row ? JSON.parse(row.value) : null
}

// ─── Companies ─────────────────────────────────────────────────

export function saveCompany(company) {
  const ts = new Date().toISOString()
  db.prepare(`
    INSERT OR REPLACE INTO companies (id, canonical_name, aliases, domain, careers_url, company_type, company_tier, enabled, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM companies WHERE id = ?), ?), ?)
  `).run(
    company.id, company.canonicalName, JSON.stringify(company.aliases || []),
    company.domain || null, company.careersUrl || null,
    company.companyType || 'unknown', company.companyTier || 'unknown',
    company.enabled !== false ? 1 : 0, company.id, ts, ts
  )
}

export function getCompanyById(id) {
  const row = db.prepare(`SELECT * FROM companies WHERE id = ?`).get(id)
  return row ? { ...row, aliases: JSON.parse(row.aliases || '[]'), enabled: !!row.enabled } : null
}

export function getAllCompanies() {
  return db.prepare(`SELECT * FROM companies ORDER BY canonical_name`).all()
    .map(r => ({ ...r, aliases: JSON.parse(r.aliases || '[]'), enabled: !!r.enabled }))
}

export function getEnabledCompanies() {
  return db.prepare(`SELECT * FROM companies WHERE enabled = 1 ORDER BY canonical_name`).all()
    .map(r => ({ ...r, aliases: JSON.parse(r.aliases || '[]'), enabled: !!r.enabled }))
}

export function upsertCompanyByName(name, domain) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const existing = db.prepare(`SELECT id FROM companies WHERE canonical_name = ?`).get(name)
  if (existing) return existing.id
  const id = `company:${slug}`
  saveCompany({ id, canonicalName: name, domain, companyType: 'unknown', companyTier: 'unknown', enabled: true })
  return id
}

// ─── Company Sources ───────────────────────────────────────────

export function saveCompanySource(source) {
  const ts = new Date().toISOString()
  db.prepare(`
    INSERT OR REPLACE INTO company_sources (
      id, company_id, provider, source_url, careers_url, board_slug, tenant, site,
      company_identifier, enabled, priority, capability, verification_status,
      discovered_at, verified_at, last_checked_at, last_success_at, last_failure_at,
      consecutive_failures, last_job_count, historical_job_count, metadata_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM company_sources WHERE id = ?), ?), ?)
  `).run(
    source.id, source.companyId, source.provider, source.sourceUrl,
    source.careersUrl || null, source.boardSlug || null, source.tenant || null,
    source.site || null, source.companyIdentifier || null,
    source.enabled !== false ? 1 : 0, source.priority || 0,
    source.capability || 'unknown', source.verificationStatus || 'unverified',
    source.discoveredAt || null, source.verifiedAt || null,
    source.lastCheckedAt || null, source.lastSuccessAt || null,
    source.lastFailureAt || null, source.consecutiveFailures || 0,
    source.lastJobCount || 0, source.historicalJobCount || 0,
    JSON.stringify(source.metadata || {}), source.id, ts, ts
  )
}

export function getCompanySourceById(id) {
  const row = db.prepare(`SELECT * FROM company_sources WHERE id = ?`).get(id)
  return row ? { ...row, enabled: !!row.enabled, metadata: JSON.parse(row.metadata_json || '{}') } : null
}

export function getSourcesByCompanyId(companyId) {
  return db.prepare(`SELECT * FROM company_sources WHERE company_id = ? ORDER BY priority DESC`).all()
    .map(r => ({ ...r, enabled: !!r.enabled, metadata: JSON.parse(r.metadata_json || '{}') }))
}

export function getAllEnabledSources() {
  return db.prepare(`SELECT * FROM company_sources WHERE enabled = 1 ORDER BY priority DESC`).all()
    .map(r => ({ ...r, enabled: !!r.enabled, metadata: JSON.parse(r.metadata_json || '{}') }))
}

export function updateSourceHealth(sourceId, data) {
  const ts = new Date().toISOString()
  db.prepare(`
    INSERT OR REPLACE INTO source_health (
      source_id, status, last_checked_at, last_success_at, last_http_status,
      current_job_count, previous_job_count, rolling_avg_job_count,
      consecutive_failures, response_latency_ms, parser_errors, anomaly_flags, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    sourceId, data.status || 'unknown', data.lastCheckedAt || ts,
    data.lastSuccessAt || null, data.lastHttpStatus || null,
    data.currentJobCount || 0, data.previousJobCount || 0,
    data.rollingAvgJobCount || 0, data.consecutiveFailures || 0,
    data.responseLatencyMs || 0, data.parserErrors || 0,
    JSON.stringify(data.anomalyFlags || []), ts
  )
  // Also update the source record
  db.prepare(`
    UPDATE company_sources SET last_checked_at = ?, last_success_at = ?, last_failure_at = ?,
    consecutive_failures = ?, last_job_count = ?, updated_at = ? WHERE id = ?
  `).run(ts, data.lastSuccessAt || null, data.consecutiveFailures > 0 ? ts : null,
    data.consecutiveFailures || 0, data.currentJobCount || 0, ts, sourceId)
}

export function getSourceHealth(sourceId) {
  const row = db.prepare(`SELECT * FROM source_health WHERE source_id = ?`).get(sourceId)
  return row ? { ...row, anomalyFlags: JSON.parse(row.anomaly_flags || '[]') } : null
}

// ─── Canonical Jobs ────────────────────────────────────────────

export function saveCanonicalJob(job) {
  const ts = new Date().toISOString()
  db.prepare(`
    INSERT OR REPLACE INTO canonical_jobs (
      id, company_id, company_name, title, normalized_title, location, country, city,
      application_url, description, programme_type, employment_type, finance_category,
      finance_subcategory, seniority, graduation_year, deadline, opening_date, posted_at,
      first_seen_at, last_seen_at, closed_at, status, confidence, specialties, source_url,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM canonical_jobs WHERE id = ?), ?), ?)
  `).run(
    job.id, job.companyId || null, job.companyName, job.title,
    job.normalizedTitle || null, job.location || null, job.country || null,
    job.city || null, job.applicationUrl || null, job.description || null,
    job.programmeType || 'unknown', job.employmentType || 'unknown',
    job.financeCategory || 'unknown', job.financeSubcategory || null,
    job.seniority || null, job.graduationYear || null, job.deadline || null,
    job.openingDate || null, job.postedAt || null, job.firstSeenAt, job.lastSeenAt,
    job.closedAt || null, job.status || 'active', job.confidence || 0.5,
    JSON.stringify(job.specialties || []), job.sourceUrl || null,
    ts, job.id, ts
  )
  return job.id
}

export function getCanonicalJobById(id) {
  return db.prepare(`SELECT * FROM canonical_jobs WHERE id = ?`).get(id) || null
}

export function getCanonicalJobs({ companyId, status, programmeType, financeCategory, country, limit = 50, offset = 0, sort = 'last_seen_at', order = 'desc' } = {}) {
  let where = []
  let params = []
  if (companyId) { where.push('company_id = ?'); params.push(companyId) }
  if (status) { where.push('status = ?'); params.push(status) }
  if (programmeType) { where.push('programme_type = ?'); params.push(programmeType) }
  if (financeCategory) { where.push('finance_category = ?'); params.push(financeCategory) }
  if (country) { where.push('country = ?'); params.push(country) }
  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
  const allowedSorts = ['first_seen_at', 'last_seen_at', 'posted_at', 'deadline', 'company_name', 'title']
  const sortCol = allowedSorts.includes(sort) ? sort : 'last_seen_at'
  const sortOrder = order === 'asc' ? 'ASC' : 'DESC'
  params.push(limit, offset)
  return db.prepare(`SELECT * FROM canonical_jobs ${whereClause} ORDER BY ${sortCol} ${sortOrder} LIMIT ? OFFSET ?`).all(...params)
}

export function countCanonicalJobs({ companyId, status, programmeType, financeCategory, country } = {}) {
  let where = []
  let params = []
  if (companyId) { where.push('company_id = ?'); params.push(companyId) }
  if (status) { where.push('status = ?'); params.push(status) }
  if (programmeType) { where.push('programme_type = ?'); params.push(programmeType) }
  if (financeCategory) { where.push('finance_category = ?'); params.push(financeCategory) }
  if (country) { where.push('country = ?'); params.push(country) }
  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''
  return db.prepare(`SELECT COUNT(*) as count FROM canonical_jobs ${whereClause}`).get(...params).count
}

export function getNewCanonicalJobs(since) {
  return db.prepare(`SELECT * FROM canonical_jobs WHERE created_at > ? ORDER BY created_at DESC`).all(since)
}

export function getJobsByCompanyId(companyId) {
  return db.prepare(`SELECT * FROM canonical_jobs WHERE company_id = ? ORDER BY last_seen_at DESC`).all(companyId)
}

// ─── Raw Job Observations ──────────────────────────────────────

export function saveRawObservation(obs) {
  const ts = new Date().toISOString()
  db.prepare(`
    INSERT INTO raw_job_observations (id, source_id, company_id, source_job_id, source_url, fetched_at, payload_json, payload_hash, http_status, parser_version, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    obs.id, obs.sourceId, obs.companyId || null, obs.sourceJobId,
    obs.sourceUrl || null, obs.fetchedAt, JSON.stringify(obs.payload),
    obs.payloadHash || null, obs.httpStatus || null, obs.parserVersion || 'v1', ts
  )
}

export function getObservationsBySourceId(sourceId, limit = 100) {
  return db.prepare(`SELECT * FROM raw_job_observations WHERE source_id = ? ORDER BY fetched_at DESC LIMIT ?`).all(sourceId, limit)
}

// ─── Job Source Observations ───────────────────────────────────

export function saveJobSourceObservation(canonicalJobId, sourceId, sourceJobId, sourceUrl) {
  const ts = new Date().toISOString()
  db.prepare(`
    INSERT INTO job_source_observations (canonical_job_id, source_id, source_job_id, source_url, first_seen_at, last_seen_at, observation_count)
    VALUES (?, ?, ?, ?, ?, ?, 1)
    ON CONFLICT (canonical_job_id, source_id) DO UPDATE SET
      last_seen_at = excluded.last_seen_at,
      source_job_id = excluded.source_job_id,
      source_url = excluded.source_url,
      observation_count = observation_count + 1
  `).run(canonicalJobId, sourceId, sourceJobId || null, sourceUrl || null, ts, ts)
}

export function getObservationsForJob(canonicalJobId) {
  return db.prepare(`
    SELECT jso.*, cs.provider, cs.source_url as cs_url, c.canonical_name as company_name
    FROM job_source_observations jso
    JOIN company_sources cs ON jso.source_id = cs.id
    LEFT JOIN companies c ON cs.company_id = c.id
    WHERE jso.canonical_job_id = ?
  `).all(canonicalJobId)
}

// ─── Job Versions ──────────────────────────────────────────────

export function saveJobVersion(version) {
  const ts = new Date().toISOString()
  db.prepare(`
    INSERT INTO job_versions (id, canonical_job_id, version_number, changed_fields, previous_values, new_values, detected_at, source_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    version.id, version.canonicalJobId, version.versionNumber,
    JSON.stringify(version.changedFields), JSON.stringify(version.previousValues),
    JSON.stringify(version.newValues), ts, version.sourceId || null
  )
}

export function getVersionsForJob(canonicalJobId) {
  return db.prepare(`SELECT * FROM job_versions WHERE canonical_job_id = ? ORDER BY version_number DESC`).all(canonicalJobId)
}

// ─── Poll Schedule ─────────────────────────────────────────────

export function savePollSchedule(schedule) {
  const ts = new Date().toISOString()
  db.prepare(`
    INSERT OR REPLACE INTO poll_schedule (source_id, next_check_at, last_checked_at, last_success_at, priority, poll_interval_ms, consecutive_failures, last_error, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    schedule.sourceId, schedule.nextCheckAt, schedule.lastCheckedAt || null,
    schedule.lastSuccessAt || null, schedule.priority || 'normal',
    schedule.pollIntervalMs || 3600000, schedule.consecutiveFailures || 0,
    schedule.lastError || null, ts
  )
}

export function getDueSources() {
  const now = new Date().toISOString()
  return db.prepare(`
    SELECT ps.*, cs.provider, cs.source_url, cs.company_id, cs.enabled, c.canonical_name
    FROM poll_schedule ps
    JOIN company_sources cs ON ps.source_id = cs.id
    LEFT JOIN companies c ON cs.company_id = c.id
    WHERE ps.next_check_at <= ? AND cs.enabled = 1
    ORDER BY ps.priority DESC, ps.next_check_at ASC
  `).all(now)
}

export function updatePollScheduleAfterRun(sourceId, success, error) {
  const ts = new Date().toISOString()
  const schedule = db.prepare(`SELECT * FROM poll_schedule WHERE source_id = ?`).get(sourceId)
  if (!schedule) return
  const failures = success ? 0 : schedule.consecutive_failures + 1
  const baseInterval = schedule.poll_interval_ms
  // Exponential backoff: 1x, 2x, 4x, 8x, max 24h
  const backoffMultiplier = Math.min(Math.pow(2, failures), 24)
  const newInterval = Math.min(baseInterval * backoffMultiplier, 24 * 60 * 60 * 1000)
  // Add jitter: ±10%
  const jitter = newInterval * 0.1 * (Math.random() * 2 - 1)
  const nextCheck = new Date(Date.now() + newInterval + jitter).toISOString()
  db.prepare(`
    UPDATE poll_schedule SET next_check_at = ?, last_checked_at = ?, last_success_at = ?,
    consecutive_failures = ?, poll_interval_ms = ?, last_error = ?, updated_at = ?
    WHERE source_id = ?
  `).run(nextCheck, ts, success ? ts : schedule.last_success_at, failures, newInterval, error || null, ts, sourceId)
}

// ─── Phase 2.1: Discovery Queue ───────────────────────────────

export function createDiscoveryTarget(companyId, companyName, domain, knownCareersUrl) {
  const ts = new Date().toISOString()
  const id = `dq_${companyId}_${Date.now()}`
  db.prepare(`
    INSERT OR IGNORE INTO discovery_queue
    (id, company_id, company_name, domain, known_careers_url, status, attempt_count, evidence, careers_pages_found, multi_source, manual_review_required, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'pending', 0, '[]', '[]', '[]', 0, ?, ?)
  `).run(id, companyId, companyName, domain, knownCareersUrl, ts, ts)
  return id
}

export function getDiscoveryTarget(companyId) {
  return db.prepare(`SELECT * FROM discovery_queue WHERE company_id = ?`).get(companyId) || null
}

export function getDiscoveryTargetsByStatus(status, limit = 50) {
  return db.prepare(`SELECT * FROM discovery_queue WHERE status = ? ORDER BY next_attempt_at ASC NULLS LAST LIMIT ?`).all(status, limit)
}

export function getAllDiscoveryTargets() {
  return db.prepare(`SELECT * FROM discovery_queue ORDER BY status, company_name`).all()
}

export function updateDiscoveryTarget(companyId, updates) {
  const ts = new Date().toISOString()
  const fields = []
  const values = []
  for (const [key, value] of Object.entries(updates)) {
    if (key === 'id' || key === 'company_id' || key === 'created_at') continue
    const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase()
    fields.push(`${dbKey} = ?`)
    values.push(typeof value === 'object' ? JSON.stringify(value) : value)
  }
  fields.push('updated_at = ?')
  values.push(ts)
  values.push(companyId)
  db.prepare(`UPDATE discovery_queue SET ${fields.join(', ')} WHERE company_id = ?`).run(...values)
}

export function getDiscoveryStats() {
  const rows = db.prepare(`SELECT status, COUNT(*) as count FROM discovery_queue GROUP BY status`).all()
  const stats = { pending: 0, discovering: 0, supported_source_found: 0, unsupported_ats_found: 0, custom_careers_found: 0, multiple_sources_found: 0, access_restricted: 0, no_careers_source_found: 0, ambiguous: 0, failed: 0, manual_review: 0, total: 0 }
  for (const row of rows) {
    const key = row.status.replace(/-/g, '_')
    if (key in stats) stats[key] = row.count
    stats.total += row.count
  }
  return stats
}

// ─── Users ─────────────────────────────────────────────────────

export function createUser(id, username, email, passwordHash) {
  const ts = new Date().toISOString()
  db.prepare(`
    INSERT INTO users (id, username, email, password_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, username.toLowerCase(), email.toLowerCase(), passwordHash, ts, ts)
  return { id, username: username.toLowerCase(), email: email.toLowerCase(), createdAt: ts, updatedAt: ts }
}

export function getUserById(id) {
  const row = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id)
  return row || null
}

export function getUserByUsername(username) {
  const row = db.prepare(`SELECT * FROM users WHERE username = ?`).get(username?.toLowerCase())
  return row || null
}

export function getUserByEmail(email) {
  const row = db.prepare(`SELECT * FROM users WHERE email = ?`).get(email?.toLowerCase())
  return row || null
}

export function updateUserPassword(id, passwordHash) {
  const ts = new Date().toISOString()
  db.prepare(`UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?`).run(passwordHash, ts, id)
}

// ─── Password Resets ───────────────────────────────────────────

export function createPasswordReset(id, userId, tokenHash, expiresAt) {
  const ts = new Date().toISOString()
  db.prepare(`
    INSERT INTO password_resets (id, user_id, token_hash, expires_at, used, created_at)
    VALUES (?, ?, ?, ?, 0, ?)
  `).run(id, userId, tokenHash, expiresAt, ts)
}

export function getPasswordReset(tokenHash) {
  return db.prepare(`SELECT * FROM password_resets WHERE token_hash = ? AND used = 0`).get(tokenHash) || null
}

export function usePasswordReset(tokenHash) {
  db.prepare(`UPDATE password_resets SET used = 1 WHERE token_hash = ?`).run(tokenHash)
}

export function cleanupExpiredResets() {
  db.prepare(`DELETE FROM password_resets WHERE expires_at < ? OR used = 1`).run(new Date().toISOString())
}

// ─── Maintenance ────────────────────────────────────────────────

export function getDbStats() {
  const entryCount = getEntryCount()
  const directJobFirms = db.prepare(`SELECT COUNT(*) as count FROM pipeline_direct_jobs`).get().count
  const sourceDiscoveryFirms = db.prepare(`SELECT COUNT(*) as count FROM pipeline_source_discovery`).get().count
  const userCount = db.prepare(`SELECT COUNT(*) as count FROM users`).get().count
  return { entryCount, directJobFirms, sourceDiscoveryFirms, userCount }
}

export function closeDb() {
  db.close()
}

export default db
