/**
 * db-adapter.js — true-async contract tests (node:test, no external deps).
 *
 * Proves the correctness invariants of the async conversion:
 *  1. ONE async contract: every DB export is an async function.
 *  2. Durable-before-success: awaited writes are visible on re-read.
 *  3. Errors propagate: uniqueness violations reject (no silent success).
 *  4. Production fail-closed: NODE_ENV=production without DATABASE_URL
 *     refuses to start (verified in a child process).
 *  5. No sync-facade remnants: adapter source contains no write queue,
 *     no authoritative in-memory cache.
 *
 * NOTE: CRUD tests run against the local dev SQLite DB
 * (server/data/meridian.db) and clean up after themselves, except for one
 * clearly-named `__async_test_user__` row (users table has no delete path;
 * the row is inert and clearly marked).
 */
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join, dirname } from 'node:path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const SERVER_DIR = join(__dirname, '..')
const ADAPTER_PATH = join(SERVER_DIR, 'db-adapter.js')
const ADAPTER_URL = `file://${ADAPTER_PATH.replace(/\\/g, '/')}`

const ADAPTER_FNS = [
  'getDb', 'initSchema',
  'saveEntry', 'getEntryById', 'getAllEntries', 'getEntriesByStatus',
  'getEntriesByFirm', 'deleteEntry', 'getEntryCount', 'saveEntries',
  'saveDirectJobs', 'getDirectJobs', 'getAllDirectJobs', 'clearDirectJobs',
  'saveSourceDiscovery', 'getSourceDiscovery', 'getAllSourceDiscoveries',
  'clearSourceDiscoveries',
  'setKV', 'getKV',
  'saveCompany', 'getCompanyById', 'getAllCompanies', 'getEnabledCompanies',
  'upsertCompanyByName',
  'saveCompanySource', 'getCompanySourceById', 'getSourcesByCompanyId',
  'getAllEnabledSources', 'updateSourceHealth', 'getSourceHealth',
  'saveCanonicalJob', 'getCanonicalJobById', 'getCanonicalJobs',
  'countCanonicalJobs', 'getNewCanonicalJobs', 'getJobsByCompanyId',
  'saveRawObservation', 'getObservationsBySourceId',
  'saveJobSourceObservation', 'getObservationsForJob',
  'upsertSighting', 'deactivateSighting', 'getActiveSightingsForJob',
  'getActiveSightingsForJobs', 'getAllSightingsForJob',
  'getSightingBySourceAndJob', 'getActiveSightingCount',
  'getSourceTierForSighting',
  'updateCanonicalLifecycle', 'incrementAbsences', 'resetAbsences',
  'getOpenCanonicalJobs', 'findCanonicalByFingerprint',
  'findCanonicalByExternalKey',
  'upsertAdapterHealth', 'getAdapterHealth', 'getAllAdapterHealth',
  'getUnhealthyAdapters',
  'saveJobVersion', 'getVersionsForJob',
  'savePollSchedule', 'getDueSources', 'updatePollScheduleAfterRun',
  'createDiscoveryTarget', 'getDiscoveryTarget', 'getDiscoveryTargetsByStatus',
  'getAllDiscoveryTargets', 'updateDiscoveryTarget', 'getDiscoveryStats',
  'createUser', 'getUserById', 'getUserByUsername', 'getUserByEmail',
  'updateUserPassword',
  'createPasswordReset', 'getPasswordReset', 'usePasswordReset',
  'cleanupExpiredResets',
  'getDbStats', 'closeDb',
]

function runNode(args, env) {
  return new Promise((resolve) => {
    execFile(process.execPath, args, { env, cwd: SERVER_DIR }, (error, stdout, stderr) => {
      resolve({ exit: error ? (error.code ?? 1) : 0, stdout, stderr })
    })
  })
}

describe('db-adapter async contract', () => {
  let db
  before(async () => {
    delete process.env.DATABASE_URL
    db = await import(ADAPTER_URL)
  })

  it('exposes one async contract: every DB export is an async function', () => {
    assert.equal(db.isPostgres, false, 'test env must use SQLite (no DATABASE_URL)')
    for (const name of ADAPTER_FNS) {
      assert.equal(typeof db[name], 'function', `${name} is exported`)
      assert.equal(
        db[name].constructor.name, 'AsyncFunction',
        `${name} must be async (returns a Promise; success only after resolve)`
      )
    }
  })

  it('durable-before-success: awaited entry write is visible on re-read', async () => {
    const id = `__async_test_entry_${Date.now()}`
    const now = new Date().toISOString()
    await db.saveEntry({
      id, companyName: '__async_test__', status: 'discovered',
      resolvedFirmId: null, createdAt: now, updatedAt: now, observations: [],
    })
    try {
      const reread = await db.getEntryById(id)
      assert.ok(reread, 'committed write must be readable')
      assert.equal(reread.companyName, '__async_test__')
    } finally {
      await db.deleteEntry(id)
    }
    assert.equal(await db.getEntryById(id), null, 'delete must commit too')
  })

  it('durable-before-success: awaited KV write is visible on re-read', async () => {
    const key = `__async_test_kv_${Date.now()}`
    const value = { n: 42 }
    await db.setKV(key, value)
    try {
      assert.deepEqual(await db.getKV(key), value)
    } finally {
      const { getDb } = db
      const sqlite = await getDb()
      sqlite.prepare('DELETE FROM kv_store WHERE key = ?').run(key)
    }
  })

  it('errors propagate: duplicate username rejects (never silent success)', async () => {
    // Unique per run: the users table has no delete path, so a fixed name
    // persists across runs and would fail setup instead of testing the reject.
    const stamp = Date.now()
    const uname = `__async_test_user_${stamp}__`
    const email = `__async_test_${stamp}@example.invalid`
    await db.createUser(`__async_test_${stamp}`, uname, email, 'opaque-hash')
    await assert.rejects(
      db.createUser(`__async_test_dup_${stamp}`, uname, `dup_${email}`, 'opaque-hash'),
      'second createUser with same username must reject (uniqueness conflict)'
    )
    const found = await db.getUserByUsername(uname)
    assert.ok(found, 'first user must exist')
    assert.equal(found.email, email.toLowerCase())
  })

  it('adapter source contains no write queue / authoritative cache remnants', async () => {
    const src = await readFile(ADAPTER_PATH, 'utf8')
    assert.ok(!src.includes('writeQueue'), 'no write queue may remain')
    assert.ok(!src.includes('queueWrite'), 'no queued-write helper may remain')
    assert.ok(!src.includes('new Map()'), 'no in-memory authoritative cache may remain')
    assert.ok(src.includes('isProduction'), 'fail-closed guard must exist')
  })
})

describe('db-adapter driver selection (child processes)', () => {
  it('development without DATABASE_URL selects SQLite', async () => {
    const env = { ...process.env, NODE_ENV: 'test' }
    delete env.DATABASE_URL
    const r = await runNode(['--input-type=module', '-e',
      `const db = await import('./db-adapter.js'); console.log(db.isPostgres ? 'PG' : 'SQLITE');`], env)
    assert.equal(r.exit, 0, `import must succeed (stderr: ${r.stderr})`)
    assert.match(r.stdout, /SQLITE/)
  })

  it('production without DATABASE_URL fails closed', async () => {
    const env = { ...process.env, NODE_ENV: 'production' }
    delete env.DATABASE_URL
    const r = await runNode(['--input-type=module', '-e',
      `await import('./db-adapter.js'); console.log('SHOULD NOT REACH');`], env)
    assert.notEqual(r.exit, 0, 'production import without DATABASE_URL must fail')
    assert.match(r.stderr, /FATAL.*DATABASE_URL/, 'must print explicit FATAL message')
    assert.ok(!r.stdout.includes('SHOULD NOT REACH'), 'must not proceed to driver load')
  })
})
