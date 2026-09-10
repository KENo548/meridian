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
`)

// ─── Migrations for existing databases ─────────────────────────

const deColumns = db.prepare(`PRAGMA table_info(discovery_entries)`).all().map(c => c.name)
if (!deColumns.includes('user_id')) {
  db.exec(`ALTER TABLE discovery_entries ADD COLUMN user_id TEXT`)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_de_user ON discovery_entries(user_id)`)
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
