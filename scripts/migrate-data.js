/**
 * Data Migration Script: SQLite → PostgreSQL (Neon)
 *
 * SOURCE STRATEGY (preferred first):
 *   1. Live SQLite file via structured reads: better-sqlite3 `SELECT *`
 *      per table → parameterized PostgreSQL INSERTs ($1, $2, ...).
 *      Raw `.sql` dump text is NEVER hand-parsed into PostgreSQL
 *      statements (SQLite dialect such as INSERT OR REPLACE / `?`
 *      placeholders is not valid PostgreSQL and would silently corrupt
 *      or partially apply).
 *   2. `.sql` logical-dump fallback: the dump is exec()'d into a LOCAL
 *      TEMPORARY SQLite file under os.tmpdir(), integrity-checked
 *      (PRAGMA integrity_check + per-table counts), then migrated through
 *      the exact same structured path as (1). Temp files live outside the
 *      repo and are deleted afterwards — never committed.
 *
 * ATOMICITY: the whole row migration runs inside a single PostgreSQL
 *   transaction (BEGIN/COMMIT on one pg Client). ANY error aborts the run:
 *   ROLLBACK + nonzero exit. Row/table failures are never logged-and-
 *   continued into a partial COMMIT with a success report.
 *
 * IDEMPOTENCY (deliberate): INSERTs use ON CONFLICT (<primary key>)
 *   DO NOTHING with an explicit conflict target. A conflicting PK means the
 *   row already migrated (expected-existing → counted as `skipped`). A
 *   conflict on any OTHER unique constraint raises → ROLLBACK + nonzero
 *   exit (unexpected). Per-table before/after COUNT(*) values are verified:
 *   after = before + inserted AND inserted + skipped = source rows.
 *
 * DATA BOUNDARY: historical tables have their rows migrated; operational /
 *   ephemeral tables get SCHEMA ONLY via initSchema() (fresh runtime state
 *   is rebuilt by pollers/schedulers after cutover). The final report prints
 *   per table: schema created? → rows migrated? → why?
 *
 * Usage (run from the repo root; driver deps resolve from server/):
 *   node scripts/migrate-data.js --help
 *   node scripts/migrate-data.js --source server/data/meridian.db
 *   node scripts/migrate-data.js --dump   <path-to-sqlite-dump.sql>
 *   node scripts/migrate-data.js [path]        # legacy positional form:
 *                                              # *.sql → --dump, else --source
 *   (no args defaults to --source server/data/meridian.db)
 *
 *   Requires DATABASE_URL (Neon connection string) for anything but --help.
 *   Safe dry-run / arg validation without any database:
 *   node scripts/migrate-data.js --help
 */

import { createRequire } from 'node:module'
import { readFileSync, existsSync, unlinkSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { initSchema, getDb, closeDb } from '../server/db-pg.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const DEFAULT_SQLITE_PATH = join(__dirname, '..', 'server', 'data', 'meridian.db')
const SERVER_PKG_PATH = join(__dirname, '..', 'server', 'package.json')

// ─── Dependency loading ───────────────────────────────────────────
// Driver deps (better-sqlite3) live in server/node_modules, which is NOT on
// the module-resolution path for files under scripts/. Resolve via the
// default scope first (works if the operator installed deps at the root),
// then fall back to an explicit require anchored at server/package.json.

function loadBetterSqlite3() {
  const attempts = []
  try {
    return createRequire(import.meta.url)('better-sqlite3')
  } catch (err) {
    attempts.push(`scripts scope: ${err.message}`)
  }
  try {
    return createRequire(SERVER_PKG_PATH)('better-sqlite3')
  } catch (err) {
    attempts.push(`server scope: ${err.message}`)
  }
  throw new Error(
    `Cannot load 'better-sqlite3' (${attempts.join(' | ')}). ` +
      `Run 'npm --prefix server install' first.`
  )
}

// ─── Data boundary ────────────────────────────────────────────────
// MIGRATE_TABLES: historical data whose rows are carried over, in
// foreign-key-safe order (parents before children).
// SCHEMA_ONLY_TABLES: schemas are created via initSchema() but NO
// historical rows are migrated (fresh runtime state is rebuilt live).

const MIGRATE_TABLES = [
  { table: 'users', pk: ['id'], why: 'historical auth identity; required for login continuity' },
  { table: 'password_resets', pk: ['id'], why: 'historical auth continuity (outstanding reset tokens)' },
  { table: 'companies', pk: ['id'], why: 'historical curated company registry' },
  { table: 'company_sources', pk: ['id'], why: 'historical verified source registry' },
  { table: 'canonical_jobs', pk: ['id'], why: 'historical normalized job corpus' },
  { table: 'discovery_entries', pk: ['id'], why: 'historical user discovery submissions' },
  { table: 'pipeline_direct_jobs', pk: ['firm_id'], why: 'historical pipeline cache/state carried over' },
  { table: 'kv_store', pk: ['key'], why: 'audited durable key-value entries (key list printed below)' },
]

const SCHEMA_ONLY_TABLES = [
  { table: 'raw_job_observations', why: 'ephemeral fetch payloads; rebuilt by pollers, not carried over' },
  { table: 'job_source_observations', why: 'derived observation counters; rebuilt from fresh polls' },
  { table: 'job_versions', why: 'transient change history; starts fresh at cutover' },
  { table: 'source_health', why: 'point-in-time health snapshot; recomputed live' },
  { table: 'poll_schedule', why: 'runtime scheduler state; rebuilt on startup' },
  { table: 'discovery_queue', why: 'runtime work queue; starts empty at cutover' },
  { table: 'pipeline_source_discovery', why: 'runtime discovery cache; re-run post-migration' },
  { table: 'job_sightings', why: 'rebuilt by the sighting pipeline from canonical_jobs' },
  { table: 'adapter_health', why: 'runtime adapter telemetry; recomputed live' },
]

// ─── CLI ──────────────────────────────────────────────────────────

function printUsage() {
  console.log(`Usage: node scripts/migrate-data.js [options] [path]
Migrate historical SQLite data into PostgreSQL (Neon) in one transaction.

Options:
  --source <sqlite-file>   live SQLite file (structured SELECT → $n INSERTs)
  --dump   <dump.sql>      SQLite logical dump; rebuilt into a LOCAL TEMP
                           SQLite file under os.tmpdir() (integrity-checked),
                           then migrated via the structured path. Temp files
                           are deleted afterwards and never committed.
  -h, --help               print this help (no DATABASE_URL required)

Legacy positional form (single path only):
  *.sql                    treated as --dump, anything else as --source.
No args defaults to --source server/data/meridian.db.

Requires DATABASE_URL for anything but --help.
Exit codes: 0 success · 1 migration failure (rolled back) · 2 usage error.`)
}

function parseArgs(argv) {
  const opts = { help: false, source: null, dump: null }
  const positionals = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') {
      opts.help = true
    } else if (a === '--source' || a === '--dump') {
      const value = argv[++i]
      if (!value || value.startsWith('-')) {
        throw new Error(`Missing value for ${a} (usage error).`)
      }
      if (a === '--source') opts.source = value
      else opts.dump = value
    } else if (a.startsWith('--source=')) {
      opts.source = a.slice('--source='.length) || null
      if (!opts.source) throw new Error('Missing value for --source (usage error).')
    } else if (a.startsWith('--dump=')) {
      opts.dump = a.slice('--dump='.length) || null
      if (!opts.dump) throw new Error('Missing value for --dump (usage error).')
    } else if (a.startsWith('-')) {
      throw new Error(`Unknown option '${a}' (usage error).`)
    } else {
      positionals.push(a)
    }
  }
  if (positionals.length > 1) {
    throw new Error(`Too many positional arguments (usage error).`)
  }
  if (positionals.length === 1) {
    if (opts.source || opts.dump) {
      throw new Error('Pass either --source/--dump or a positional path, not both (usage error).')
    }
    const p = positionals[0]
    if (p.toLowerCase().endsWith('.sql')) opts.dump = p
    else opts.source = p
  }
  if (opts.source && opts.dump) {
    throw new Error('Pass either --source or --dump, not both (usage error).')
  }
  return opts
}

// ─── Dump → temp SQLite (fallback source only) ────────────────────
// The dump is NEVER hand-parsed into PostgreSQL statements. SQLite dialect
// stays inside SQLite: exec the dump into a temp SQLite file, verify it,
// then run the normal structured migration against that temp file.
//
// ORDERED EXECUTION: the preserved P1 dump emits some CREATE INDEX
// statements BEFORE their CREATE TABLE (e.g. idx_js_* at line ~169,
// CREATE TABLE job_sightings at line ~201), so a single build.exec(sql)
// fails with "no such table". Statements are therefore split (quote- and
// comment-aware) and applied in two passes: all CREATE TABLE first, then
// everything else in original order. Transaction-control wrappers
// (BEGIN/COMMIT) are dropped — each statement auto-commits on the temp DB.
// Any other failure still throws fail-fast (no partial temp DB is used).

function cleanupTempDb(tempPath) {
  for (const p of [tempPath, `${tempPath}-journal`, `${tempPath}-wal`, `${tempPath}-shm`]) {
    try {
      if (existsSync(p)) unlinkSync(p)
    } catch {
      // best-effort cleanup only
    }
  }
}

function materializeDumpToTempSqlite(dumpPath) {
  const resolved = resolve(dumpPath)
  if (!existsSync(resolved)) {
    throw new Error(`SQL dump not found: ${resolved}`)
  }
  const sql = readFileSync(resolved, 'utf8')
  if (!sql.trim()) {
    throw new Error(`SQL dump is empty: ${resolved}`)
  }
  const Database = loadBetterSqlite3()
  const tempPath = join(tmpdir(), `meridian-migrate-${process.pid}-${Date.now()}.db`)
  console.log('Reconstructing a LOCAL TEMPORARY SQLite DB from the dump (temp-only, never committed):')
  console.log(`  dump: ${resolved}`)
  console.log(`  temp: ${tempPath}`)

  const build = new Database(tempPath)
  try {
    execDumpOrdered(build, sql)
  } catch (err) {
    try {
      build.close()
    } catch {
      // ignore close errors; report the load failure
    }
    cleanupTempDb(tempPath)
    throw new Error(`Dump could not be loaded as SQLite (is it a SQLite logical dump?): ${err.message}`)
  }
  build.close()

  const ro = new Database(tempPath, { readonly: true })
  try {
    const check = ro.prepare('PRAGMA integrity_check').get()
    if (!check || check.integrity_check !== 'ok') {
      throw new Error(`Temp DB integrity_check failed: ${JSON.stringify(check)}`)
    }
    console.log('  integrity_check: ok')
    for (const spec of MIGRATE_TABLES) {
      let n
      try {
        n = ro.prepare(`SELECT COUNT(*) AS c FROM "${spec.table}"`).get().c
      } catch (err) {
        throw new Error(`Temp DB is missing expected table "${spec.table}": ${err.message}`)
      }
      console.log(`  temp source ${spec.table}: ${n} rows`)
    }
  } finally {
    ro.close()
  }
  return tempPath
}

// ─── Ordered dump execution ─────────────────────────────────────────
// Quote- and comment-aware statement splitter + two-pass apply.
// Mirrored in the Phase 3 verify script (temp tooling, not shipped).

function splitSqlStatements(sql) {
  const stmts = []
  let buf = ''
  let i = 0
  const n = sql.length
  let inSingle = false
  let inDouble = false
  let inBacktick = false
  let inBracket = false
  let inLineComment = false
  let inBlockComment = false
  while (i < n) {
    const c = sql[i]
    const next = i + 1 < n ? sql[i + 1] : ''
    if (inLineComment) {
      buf += c
      if (c === '\n') inLineComment = false
      i++
      continue
    }
    if (inBlockComment) {
      buf += c
      if (c === '*' && next === '/') {
        buf += next
        i += 2
        continue
      }
      i++
      continue
    }
    if (inSingle) {
      buf += c
      if (c === "'") {
        if (next === "'") {
          buf += next
          i += 2
          continue
        }
        inSingle = false
      }
      i++
      continue
    }
    if (inDouble) {
      buf += c
      if (c === '"') {
        if (next === '"') {
          buf += next
          i += 2
          continue
        }
        inDouble = false
      }
      i++
      continue
    }
    if (inBacktick) {
      buf += c
      if (c === '`') inBacktick = false
      i++
      continue
    }
    if (inBracket) {
      buf += c
      if (c === ']') inBracket = false
      i++
      continue
    }
    if (c === '-' && next === '-') {
      inLineComment = true
      buf += c
      i++
      continue
    }
    if (c === '/' && next === '*') {
      inBlockComment = true
      buf += c
      i++
      continue
    }
    if (c === "'") {
      inSingle = true
      buf += c
      i++
      continue
    }
    if (c === '"') {
      inDouble = true
      buf += c
      i++
      continue
    }
    if (c === '`') {
      inBacktick = true
      buf += c
      i++
      continue
    }
    if (c === '[') {
      inBracket = true
      buf += c
      i++
      continue
    }
    if (c === ';') {
      buf += c
      const stmt = buf.trim()
      if (stmt) stmts.push(stmt)
      buf = ''
      i++
      continue
    }
    buf += c
    i++
  }
  const tail = buf.trim()
  if (tail) stmts.push(tail)
  return stmts
}

function statementHead(stmt) {
  const lines = stmt.split('\n').filter((l) => !/^\s*--/.test(l))
  return lines.join('\n').trim()
}

function execDumpOrdered(build, sql) {
  const stmts = splitSqlStatements(sql)
  const tables = []
  const rest = []
  for (const s of stmts) {
    const head = statementHead(s)
    if (!head) continue
    if (/^(BEGIN|COMMIT|END|ROLLBACK|SAVEPOINT|RELEASE)\b/i.test(head)) continue
    if (/^CREATE\s+TABLE\b/i.test(head)) tables.push(s)
    else rest.push(s)
  }
  for (const s of tables) build.exec(s)
  for (const s of rest) build.exec(s)
  console.log(`  dump statements: ${stmts.length} (${tables.length} CREATE TABLE first, ${rest.length} following)`)
}

// ─── PostgreSQL helpers ───────────────────────────────────────────

async function tableExists(client, table) {
  const { rows } = await client.query('SELECT to_regclass($1) AS r', [`public."${table}"`])
  return rows[0] && rows[0].r !== null
}

async function pgCount(client, table) {
  const { rows } = await client.query(`SELECT COUNT(*) AS count FROM "${table}"`)
  return parseInt(rows[0].count, 10)
}

// ─── Per-table migration (inside the caller's transaction) ───────
// Any throw aborts the whole migration → ROLLBACK + nonzero exit.
// No log-and-continue: unexpected conflicts/surprises propagate.

async function migrateTable(client, sqlite, spec) {
  const { table, pk, why } = spec
  if (!(await tableExists(client, table))) {
    throw new Error(`[${table}] schema missing in PostgreSQL after initSchema — aborting`)
  }
  const before = await pgCount(client, table)

  let sourceRows
  try {
    sourceRows = sqlite.prepare(`SELECT * FROM "${table}"`).all()
  } catch (err) {
    throw new Error(`[${table}] cannot read source SQLite table: ${err.message}`)
  }

  let inserted = 0
  let skipped = 0
  let detail = null

  if (sourceRows.length > 0) {
    const columns = Object.keys(sourceRows[0])
    const colList = columns.map((c) => `"${c}"`).join(', ')
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ')
    const conflictTarget = pk.map((c) => `"${c}"`).join(', ')
    const insertSql =
      `INSERT INTO "${table}" (${colList}) VALUES (${placeholders}) ` +
      `ON CONFLICT (${conflictTarget}) DO NOTHING`
    console.log(`  Migrating ${table}: ${sourceRows.length} source rows (pg before=${before})...`)
    for (const row of sourceRows) {
      const values = columns.map((c) => (row[c] === undefined ? null : row[c]))
      // Throws on anything unexpected (e.g. a conflict on a DIFFERENT
      // unique constraint) → caller rolls back. rowCount 1 = inserted,
      // rowCount 0 = ON CONFLICT (<pk>) hit = expected-existing row.
      const res = await client.query(insertSql, values)
      if (res.rowCount === 1) inserted++
      else skipped++
    }
  } else {
    console.log(`  ${table}: 0 source rows, nothing to insert (pg before=${before})`)
  }

  if (inserted + skipped !== sourceRows.length) {
    throw new Error(
      `[${table}] bookkeeping mismatch: inserted=${inserted} skipped=${skipped} source=${sourceRows.length}`
    )
  }
  const after = await pgCount(client, table)
  if (after !== before + inserted) {
    throw new Error(
      `[${table}] count verification failed: before=${before} inserted=${inserted} after=${after} ` +
        `(expected ${before + inserted})`
    )
  }

  if (table === 'kv_store') {
    try {
      detail = `keys=[${sqlite.prepare('SELECT key AS k FROM kv_store ORDER BY key').all().map((r) => r.k).join(', ')}]`
    } catch {
      detail = null
    }
  }

  return { table, schema: 'created', rowsMigrated: sourceRows.length > 0, why, source: sourceRows.length, before, inserted, skipped, after, detail }
}

async function auditSchemaOnlyTable(client, sqlite, spec) {
  const { table, why } = spec
  if (!(await tableExists(client, table))) {
    throw new Error(`[${table}] schema missing in PostgreSQL after initSchema — aborting`)
  }
  const before = await pgCount(client, table)
  let sourceCount = null
  try {
    sourceCount = sqlite.prepare(`SELECT COUNT(*) AS c FROM "${table}"`).get().c
  } catch {
    sourceCount = null // older source without this table; schema still created, rows still none
  }
  return {
    table,
    schema: 'created',
    rowsMigrated: false,
    why,
    source: sourceCount,
    before,
    inserted: 0,
    skipped: 0,
    after: before,
    detail: sourceCount === null ? 'not present in source' : `${sourceCount} source row(s) intentionally left behind`,
  }
}

// ─── Reporting ────────────────────────────────────────────────────

function printBoundaryReport(report) {
  console.log('\nPer-table boundary report (TABLE → schema created? → rows migrated? → why?):')
  console.log('TABLE                     SCHEMA   ROWS MIGRATED                        WHY')
  console.log('─'.repeat(100))
  for (const r of report) {
    const rows = r.rowsMigrated
      ? `yes (src ${r.source}, +${r.inserted} new, ${r.skipped} skipped-existing)`
      : `no  (src ${r.source === null ? 'n/a' : r.source}, schema only)`
    console.log(`${r.table.padEnd(26)}${r.schema.padEnd(9)}${rows.padEnd(36)}${r.why}`)
    if (r.detail) console.log(`${''.padEnd(26)}${''.padEnd(9)}${('└ ' + r.detail).padEnd(36)}`)
  }
  const migrated = report.filter((r) => MIGRATE_TABLES.some((s) => s.table === r.table))
  const totals = migrated.reduce(
    (acc, r) => ({ source: acc.source + r.source, inserted: acc.inserted + r.inserted, skipped: acc.skipped + r.skipped }),
    { source: 0, inserted: 0, skipped: 0 }
  )
  console.log('─'.repeat(100))
  console.log(
    `Migrated tables: ${migrated.length} · source rows: ${totals.source} · ` +
      `inserted: ${totals.inserted} · skipped (expected-existing): ${totals.skipped}`
  )
  console.log(`Schema-only tables: ${report.length - migrated.length} (schemas created, 0 rows migrated)`)
}

// Read-only post-commit verification (outside the transaction).
async function verifyPostCommit(pool, report) {
  console.log('\nVerifying migration (post-commit, read-only)...')
  for (const r of report) {
    const { rows } = await pool.query(`SELECT COUNT(*) AS count FROM "${r.table}"`)
    const count = parseInt(rows[0].count, 10)
    if (count !== r.after) {
      throw new Error(
        `[${r.table}] post-commit verification failed: expected ${r.after}, found ${count}`
      )
    }
    console.log(`  ${r.table}: ${count} rows ✓`)
  }
}

// ─── Orchestration ────────────────────────────────────────────────

async function runMigration(sqlitePath) {
  const Database = loadBetterSqlite3()
  console.log(`Reading from SQLite (structured SELECTs): ${sqlitePath}`)
  const sqlite = new Database(sqlitePath, { readonly: true })
  try {
    // Creates schemas for ALL tables (migrated + schema-only) idempotently.
    await initSchema()
    const pool = await getDb()
    const client = await pool.connect()
    let report
    try {
      await client.query('BEGIN')
      try {
        report = []
        for (const spec of MIGRATE_TABLES) {
          report.push(await migrateTable(client, sqlite, spec))
        }
        for (const spec of SCHEMA_ONLY_TABLES) {
          report.push(await auditSchemaOnlyTable(client, sqlite, spec))
        }
        await client.query('COMMIT')
      } catch (err) {
        try {
          await client.query('ROLLBACK')
        } catch {
          // Preserve the original failure, not the rollback error.
        }
        throw err
      }
    } finally {
      client.release()
    }
    printBoundaryReport(report)
    await verifyPostCommit(pool, report)
  } finally {
    sqlite.close()
  }
}

async function main() {
  // NOTE: failures set process.exitCode and RETURN (never process.exit),
  // so the finally block below always runs temp-file cleanup + pool shutdown.
  let opts
  try {
    opts = parseArgs(process.argv.slice(2))
  } catch (err) {
    console.error(`Error: ${err.message}\n`)
    printUsage()
    process.exitCode = 2
    return
  }
  if (opts.help) {
    printUsage()
    return // exit 0; help requires no DATABASE_URL and touches nothing
  }

  if (!process.env.DATABASE_URL) {
    console.error('Error: DATABASE_URL environment variable is not set (Neon connection string required).')
    process.exitCode = 1
    return
  }

  let sqlitePath
  let tempPath = null
  try {
    if (opts.dump) {
      tempPath = materializeDumpToTempSqlite(opts.dump)
      sqlitePath = tempPath
    } else {
      sqlitePath = resolve(opts.source ?? DEFAULT_SQLITE_PATH)
      if (!existsSync(sqlitePath)) {
        console.error(`Error: SQLite file not found: ${sqlitePath}\n`)
        printUsage()
        process.exitCode = 2
        return
      }
    }

    await runMigration(sqlitePath)
    console.log('\n✓ Migration and verification complete')
  } catch (err) {
    console.error(`\n✗ Migration FAILED (rolled back): ${err.message}`)
    process.exitCode = 1
  } finally {
    if (tempPath) cleanupTempDb(tempPath)
    try {
      await closeDb()
    } catch {
      // best-effort pool shutdown
    }
  }
}

main()
