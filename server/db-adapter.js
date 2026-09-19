/**
 * Database Adapter — True Async Abstraction (correctness-first)
 *
 * PostgreSQL is the authoritative durable state in production.
 * This module exposes ONE async contract regardless of backend:
 *
 *   await db.getUserByUsername(...)
 *   await db.createUser(...)
 *   await db.saveCompany(...)
 *
 * SUCCESS is only returned AFTER the underlying driver resolves.
 * If the driver rejects (Neon failure, constraint violation, timeout),
 * the rejection propagates to the caller. No fire-and-forget durable writes.
 * No authoritative process-memory cache. No write queue.
 *
 * Backend selection:
 *   - DATABASE_URL set    → PostgreSQL driver (db-pg.js)
 *   - DATABASE_URL unset  → SQLite driver (db.js, local development)
 *
 * SQLite driver functions are synchronous; `await` on a non-Promise
 * value is safe, so the single async contract holds for both backends.
 *
 * PRODUCTION FAIL-CLOSED:
 *   - NODE_ENV=production + no DATABASE_URL → throw at import time.
 *   - NODE_ENV=production + PostgreSQL driver load failure → throw.
 *   - Development may fall back to SQLite if the PG driver fails to load.
 */

export const isProduction = process.env.NODE_ENV === 'production'
export const isPostgres = !!process.env.DATABASE_URL

if (isProduction && !isPostgres) {
  const msg = '[DB] FATAL: NODE_ENV=production but DATABASE_URL is not set. Production requires PostgreSQL. Refusing to start with SQLite.'
  console.error(msg)
  throw new Error(msg)
}

let driver

if (isPostgres) {
  console.log('[DB] Using PostgreSQL driver (DATABASE_URL detected)')
  try {
    driver = await import('./db-pg.js')
  } catch (err) {
    const msg = `[DB] FATAL: Failed to load PostgreSQL driver: ${err.message}`
    console.error(msg)
    if (isProduction) throw new Error(msg)
    console.warn('[DB] Falling back to SQLite driver (development only)')
    driver = await import('./db.js')
  }
} else {
  console.log('[DB] Using SQLite driver (no DATABASE_URL)')
  driver = await import('./db.js')
}

// ─── Generic async delegation ─────────────────────────────────────
// Every export awaits the driver, so callers can rely on:
//   resolved → durable commit happened (or driver-confirmed read)
//   rejected → failure propagated, NO success acknowledged.

export async function getDb(...args) { return await driver.getDb(...args) }
export async function initSchema(...args) {
  if (typeof driver.initSchema === 'function') return await driver.initSchema(...args)
  await driver.getDb(...args)
}

// Discovery Entries
export async function saveEntry(...args) { return await driver.saveEntry(...args) }
export async function getEntryById(...args) { return await driver.getEntryById(...args) }
export async function getAllEntries(...args) { return await driver.getAllEntries(...args) }
export async function getEntriesByStatus(...args) { return await driver.getEntriesByStatus(...args) }
export async function getEntriesByFirm(...args) { return await driver.getEntriesByFirm(...args) }
export async function deleteEntry(...args) { return await driver.deleteEntry(...args) }
export async function getEntryCount(...args) { return await driver.getEntryCount(...args) }
export async function saveEntries(...args) { return await driver.saveEntries(...args) }

// Pipeline State
export async function saveDirectJobs(...args) { return await driver.saveDirectJobs(...args) }
export async function getDirectJobs(...args) { return await driver.getDirectJobs(...args) }
export async function getAllDirectJobs(...args) { return await driver.getAllDirectJobs(...args) }
export async function clearDirectJobs(...args) { return await driver.clearDirectJobs(...args) }
export async function saveSourceDiscovery(...args) { return await driver.saveSourceDiscovery(...args) }
export async function getSourceDiscovery(...args) { return await driver.getSourceDiscovery(...args) }
export async function getAllSourceDiscoveries(...args) { return await driver.getAllSourceDiscoveries(...args) }
export async function clearSourceDiscoveries(...args) { return await driver.clearSourceDiscoveries(...args) }

// KV Store
export async function setKV(...args) { return await driver.setKV(...args) }
export async function getKV(...args) { return await driver.getKV(...args) }

// Companies
export async function saveCompany(...args) { return await driver.saveCompany(...args) }
export async function getCompanyById(...args) { return await driver.getCompanyById(...args) }
export async function getAllCompanies(...args) { return await driver.getAllCompanies(...args) }
export async function getEnabledCompanies(...args) { return await driver.getEnabledCompanies(...args) }
export async function upsertCompanyByName(...args) { return await driver.upsertCompanyByName(...args) }

// Company Sources
export async function saveCompanySource(...args) { return await driver.saveCompanySource(...args) }
export async function getCompanySourceById(...args) { return await driver.getCompanySourceById(...args) }
export async function getSourcesByCompanyId(...args) { return await driver.getSourcesByCompanyId(...args) }
export async function getAllEnabledSources(...args) { return await driver.getAllEnabledSources(...args) }
export async function updateSourceHealth(...args) { return await driver.updateSourceHealth(...args) }
export async function getSourceHealth(...args) { return await driver.getSourceHealth(...args) }

// Canonical Jobs
export async function saveCanonicalJob(...args) { return await driver.saveCanonicalJob(...args) }
export async function getCanonicalJobById(...args) { return await driver.getCanonicalJobById(...args) }
export async function getCanonicalJobs(...args) { return await driver.getCanonicalJobs(...args) }
export async function countCanonicalJobs(...args) { return await driver.countCanonicalJobs(...args) }
export async function getNewCanonicalJobs(...args) { return await driver.getNewCanonicalJobs(...args) }
export async function getJobsByCompanyId(...args) { return await driver.getJobsByCompanyId(...args) }

// Raw Job Observations
export async function saveRawObservation(...args) { return await driver.saveRawObservation(...args) }
export async function getObservationsBySourceId(...args) { return await driver.getObservationsBySourceId(...args) }

// Job Source Observations
export async function saveJobSourceObservation(...args) { return await driver.saveJobSourceObservation(...args) }
export async function getObservationsForJob(...args) { return await driver.getObservationsForJob(...args) }

// Job Sightings
export async function upsertSighting(...args) { return await driver.upsertSighting(...args) }
export async function deactivateSighting(...args) { return await driver.deactivateSighting(...args) }
export async function getActiveSightingsForJob(...args) { return await driver.getActiveSightingsForJob(...args) }
export async function getActiveSightingsForJobs(...args) { return await driver.getActiveSightingsForJobs(...args) }
export async function getAllSightingsForJob(...args) { return await driver.getAllSightingsForJob(...args) }
export async function getSightingBySourceAndJob(...args) { return await driver.getSightingBySourceAndJob(...args) }
export async function getActiveSightingCount(...args) { return await driver.getActiveSightingCount(...args) }
export async function getSourceTierForSighting(...args) { return await driver.getSourceTierForSighting(...args) }

// Canonical Job Lifecycle
export async function updateCanonicalLifecycle(...args) { return await driver.updateCanonicalLifecycle(...args) }
export async function incrementAbsences(...args) { return await driver.incrementAbsences(...args) }
export async function resetAbsences(...args) { return await driver.resetAbsences(...args) }
export async function getOpenCanonicalJobs(...args) { return await driver.getOpenCanonicalJobs(...args) }
export async function findCanonicalByFingerprint(...args) { return await driver.findCanonicalByFingerprint(...args) }
export async function findCanonicalByExternalKey(...args) { return await driver.findCanonicalByExternalKey(...args) }

// Adapter Health
export async function upsertAdapterHealth(...args) { return await driver.upsertAdapterHealth(...args) }
export async function getAdapterHealth(...args) { return await driver.getAdapterHealth(...args) }
export async function getAllAdapterHealth(...args) { return await driver.getAllAdapterHealth(...args) }
export async function getUnhealthyAdapters(...args) { return await driver.getUnhealthyAdapters(...args) }

// Job Versions
export async function saveJobVersion(...args) { return await driver.saveJobVersion(...args) }
export async function getVersionsForJob(...args) { return await driver.getVersionsForJob(...args) }

// Poll Schedule
export async function savePollSchedule(...args) { return await driver.savePollSchedule(...args) }
export async function getDueSources(...args) { return await driver.getDueSources(...args) }
export async function updatePollScheduleAfterRun(...args) { return await driver.updatePollScheduleAfterRun(...args) }

// Discovery Queue
export async function createDiscoveryTarget(...args) { return await driver.createDiscoveryTarget(...args) }
export async function getDiscoveryTarget(...args) { return await driver.getDiscoveryTarget(...args) }
export async function getDiscoveryTargetsByStatus(...args) { return await driver.getDiscoveryTargetsByStatus(...args) }
export async function getAllDiscoveryTargets(...args) { return await driver.getAllDiscoveryTargets(...args) }
export async function updateDiscoveryTarget(...args) { return await driver.updateDiscoveryTarget(...args) }
export async function getDiscoveryStats(...args) { return await driver.getDiscoveryStats(...args) }

// Users (correctness-critical: never ACK before commit)
export async function createUser(...args) { return await driver.createUser(...args) }
export async function getUserById(...args) { return await driver.getUserById(...args) }
export async function getUserByUsername(...args) { return await driver.getUserByUsername(...args) }
export async function getUserByEmail(...args) { return await driver.getUserByEmail(...args) }
export async function updateUserPassword(...args) { return await driver.updateUserPassword(...args) }

// Password Resets (correctness-critical)
export async function createPasswordReset(...args) { return await driver.createPasswordReset(...args) }
export async function getPasswordReset(...args) { return await driver.getPasswordReset(...args) }
export async function usePasswordReset(...args) { return await driver.usePasswordReset(...args) }
export async function cleanupExpiredResets(...args) { return await driver.cleanupExpiredResets(...args) }

// Maintenance
export async function getDbStats(...args) { return await driver.getDbStats(...args) }
export async function closeDb(...args) { return await driver.closeDb(...args) }

export default getDb
