# Meridian Migration Progress Summary

## Completed Work

### P0: Git/Workspace Safety ✓
- Created migration worktree at `C:\Users\Admin\Documents\Meridian-migrate`
- Branch: `migrate/neon-postgres`
- RSS work isolated in main worktree (untouched)
- Migration worktree is clean (no RSS changes)

### P1: SQLite Backup ✓
- Created backup script: `scripts/backup-sqlite.js`
- Backup location: `backups/meridian-backup-2026-09-16T19-27-55.sql`
- Backup size: 39.7 MB
- SHA-256: `c03bc0caa64fed26d359a43fa8f2ce772a723c06c58760c60000fd2b1beaa723`
- Verified: 9 users, 905 companies, 8,765 canonical_jobs

### M0: Neon Foundation ✓
Created in migration worktree:

1. **`server/db-pg.js`** - PostgreSQL driver with:
   - Same API as `db.js` (all functions async)
   - Uses `pg` package with connection pooling
   - SSL support for Neon
   - Lazy initialization (health check still fast)
   - All 17 tables created with proper indexes

2. **`server/db-adapter.js`** - Automatic driver selection:
   - Detects `DATABASE_URL` environment variable
   - Uses PostgreSQL if set, SQLite if not
   - Unified API for all database functions

3. **`server/auth-db-adapter.js`** - Auth adapter:
   - Wraps async functions for auth.js compatibility
   - Works with both SQLite and PostgreSQL

4. **`server/auth.js`** - Updated auth router:
   - Imports from `auth-db-adapter.js` instead of `db.js`
   - All database calls are async/await
   - Same API and behavior as original

5. **`server/index.js`** - Updated Express server:
   - Imports from `db-adapter.js` instead of `db.js`
   - All database routes are async
   - Same API and behavior as original

6. **`server/package.json`** - Updated dependencies:
   - Added `pg: ^8.13.0`
   - Kept `better-sqlite3` for local development

### M1: Data Migration Tooling ✓
Created:

1. **`scripts/migrate-data.js`** - Data migration script:
   - Reads from SQLite backup SQL file
   - Inserts into PostgreSQL with `ON CONFLICT DO NOTHING`
   - Idempotent (can run multiple times)
   - Verification step counts rows in all tables

2. **`scripts/test-pg.js`** - PostgreSQL connection test:
   - Tests connection to Neon
   - Verifies basic queries
   - Shows connection pool stats

## Architecture

```
Production Flow:
Vercel → Render Free (stateless) → Neon Free PG (durable)

Local Development:
Vercel → localhost:3001 (SQLite) → local SQLite file
```

## Key Design Decisions

1. **Driver Selection**: Automatic based on `DATABASE_URL` env var
2. **Schema**: PostgreSQL-compatible (no SQLite-specific syntax)
3. **Auth**: bcrypt hashes copied verbatim as opaque strings
4. **JSONB Policy**: TEXT columns kept as TEXT (not auto-converted to JSONB)
5. **Timestamps**: TEXT (ISO 8601) - compatible with both SQLite and PostgreSQL
6. **Booleans**: INTEGER (0/1) - compatible with both databases

## Next Steps for Operator

### 1. Create Neon Free Project
- Go to https://neon.tech
- Sign up / log in
- Create new project
- Copy connection string (pooled)

### 2. Run Data Migration (BEFORE deploying new code)
```bash
cd server
DATABASE_URL=<neon-connection-string> node ../scripts/migrate-data.js ../backups/meridian-backup-2026-09-16T19-27-55.sql
```
**CRITICAL**: Data migration must complete BEFORE deploying new code with DATABASE_URL set. Otherwise, the app will start with an empty database.

### 3. Set Environment Variables on Render
```bash
DATABASE_URL=<neon-connection-string>
```

### 4. Deploy Migration Worktree
Option A: Push `migrate/neon-postgres` branch and deploy to Render
Option B: Copy files to main worktree and deploy

### 5. Verify
- Test signup/login
- Verify data counts match
- Check `/api/health` (should be fast, no DB)
- Check `/api/jobs` (should load from Neon)

## File Locations

**Migration Worktree**: `C:\Users\Admin\Documents\Meridian-migrate`
- `server/db-pg.js` - PostgreSQL driver
- `server/db-adapter.js` - Driver selector
- `server/auth-db-adapter.js` - Auth adapter
- `server/auth.js` - Updated auth (async)
- `server/index.js` - Updated server (async)
- `server/package.json` - Updated dependencies
- `scripts/migrate-data.js` - Migration script
- `scripts/test-pg.js` - Connection test

**Main Worktree**: `C:\Users\Admin\Documents\Meridian`
- `backups/meridian-backup-2026-09-16T19-27-55.sql` - SQLite backup

## Gate B Status

**NOT YET REACHED** - Changes are prepared but not committed.

Before committing, operator must:
1. Create Neon project
2. Test connection with `scripts/test-pg.js`
3. Review all changes
4. Approve the diff
5. Provide rollback plan

## Rollback Plan

### Code Rollback
```bash
git checkout main
git pull origin main
# RSS work is still here, migration changes are gone
```

### Data Rollback
After Neon cutover, new accounts written to Neon would disappear on code rollback to SQLite. Therefore:
1. **Before cutover**: SQLite is authoritative
2. **After cutover**: Neon is authoritative
3. **Never restore SQLite as authoritative after cutover**

### Divergence Assessment
- **Before cutover**: No divergence (SQLite only)
- **During cutover**: Brief window where both may have writes
- **After cutover**: Neon is authoritative, SQLite is backup only

## CU Budget Reminder

Neon Free: 100 CU-hours/month
- `/api/health`: DB-free (0 CU)
- DB init: Lazy (only on first query)
- Keep-alive probes: Must never touch DB
- Pipeline polls: Every 4-6 hours (~4-6 CU/month)
- User queries: ~100 CU budget remaining
