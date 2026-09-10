import { randomUUID } from 'node:crypto'
import {
  saveEntry, getEntryById, getAllEntries, getEntriesByStatus,
  getEntriesByFirm as dbGetByFirm, deleteEntry as dbDeleteEntry, saveEntries,
  getEntryCount
} from '../../db.js'

const STATES = {
  DISCOVERED: 'discovered',
  RESOLVED: 'resolved',
  REACHABLE: 'reachable',
  VERIFIED_OPEN: 'verified_open',
  VERIFIED: 'verified',
  ENABLED: 'enabled',
  REJECTED: 'rejected',
  NEEDS_REVIEW: 'needs_review',
}

const VALID_TRANSITIONS = {
  [STATES.DISCOVERED]: [STATES.RESOLVED, STATES.REACHABLE, STATES.NEEDS_REVIEW, STATES.REJECTED],
  [STATES.RESOLVED]: [STATES.REACHABLE, STATES.VERIFIED_OPEN, STATES.NEEDS_REVIEW, STATES.REJECTED],
  [STATES.REACHABLE]: [STATES.VERIFIED_OPEN, STATES.VERIFIED, STATES.NEEDS_REVIEW, STATES.REJECTED],
  [STATES.VERIFIED_OPEN]: [STATES.VERIFIED, STATES.NEEDS_REVIEW, STATES.REJECTED],
  [STATES.VERIFIED]: [STATES.ENABLED, STATES.NEEDS_REVIEW, STATES.REJECTED],
  [STATES.ENABLED]: [STATES.NEEDS_REVIEW, STATES.REJECTED],
  [STATES.NEEDS_REVIEW]: [STATES.RESOLVED, STATES.REACHABLE, STATES.REJECTED, STATES.DISCOVERED],
  [STATES.REJECTED]: [],
}

let listeners = []

function generateId() {
  return randomUUID()
}

function createEntry(data) {
  if (!data || !data.companyName) return null

  const name = data.companyName.trim()
  if (name.length < 2 || name.length > 120) return null
  if (/^\d+[hm]\s+ago$/i.test(name)) return null
  if (/^\d+\s+(?:min|hour|day|week|month|year)s?\s+ago$/i.test(name)) return null
  if (/^(?:yesterday|today|tomorrow|just\s+now|loading|error|unknown|n\/a|tbd)$/i.test(name)) return null

  const now = new Date().toISOString()
  const entry = {
    id: generateId(),
    companyName: data.companyName,
    resolvedFirmId: data.resolvedFirmId || null,
    programme: data.programme || null,
    category: data.category || null,
    division: data.division || null,
    office: data.office || null,
    year: data.year || null,
    location: data.location || null,
    country: data.country || null,
    applyUrl: data.applyUrl || null,
    classifiedProvider: data.classifiedProvider || null,
    status: STATES.DISCOVERED,
    observations: data.observations || [],
    createdAt: now,
    updatedAt: now,
    lastVerifiedAt: null,
    consecutiveMisses: 0,
    totalObservations: data.observations?.length || 0,
    lastObservationAt: now,
    sourceDiscovery: null,
    matchedDirectJob: null,
    matchConfidence: null,
    lastMatchAttemptAt: null,
  }

  saveEntry(entry)
  emit('created', entry)
  return { ...entry }
}

function transition(entryId, newState, reason) {
  const entry = getEntryById(entryId)
  if (!entry) return null

  const allowed = VALID_TRANSITIONS[entry.status]
  if (!allowed || !allowed.includes(newState)) {
    return { error: `Invalid transition: ${entry.status} → ${newState}` }
  }

  const from = entry.status
  entry.status = newState
  entry.updatedAt = new Date().toISOString()
  if (reason) entry.rejectionReason = reason

  saveEntry(entry)
  emit('transition', { entry, from, to: newState })
  return { ...entry }
}

function addObservation(entryId, observation) {
  const entry = getEntryById(entryId)
  if (!entry) return null

  const now = new Date().toISOString()
  const existing = entry.observations.find(o => o.source === observation.source)

  if (existing) {
    existing.lastSeenAt = now
    if (observation.closingDate) existing.closingDate = observation.closingDate
    if (observation.openingDate) existing.openingDate = observation.openingDate
    if (observation.status) existing.status = observation.status
    if (observation.rolling !== undefined) existing.rolling = observation.rolling
  } else {
    entry.observations.push({
      source: observation.source,
      sourceUrl: observation.sourceUrl || null,
      firstSeenAt: now,
      lastSeenAt: now,
      programme: observation.programme || null,
      openingDate: observation.openingDate || null,
      closingDate: observation.closingDate || null,
      rolling: observation.rolling || false,
      status: observation.status || null,
      eligibility: observation.eligibility || null,
      process: observation.process || null,
    })
  }

  entry.updatedAt = now
  saveEntry(entry)
  emit('observation', { entry, observation })
  return { ...entry }
}

function findOrCreate(data) {
  if (!data || !data.companyName) return null

  let existing = findByCompanyAndProgramme(data.companyName, data.programme)
  if (!existing && data.division && data.office) {
    existing = findByCompanyDivisionOffice(data.companyName, data.division, data.office)
  }

  if (existing) {
    const hasObservations = data.observations && data.observations.length > 0
    // Handle applyUrl upgrade separately if no observations to add
    if (data.applyUrl && !existing.applyUrl) {
      if (hasObservations) {
        addObservation(existing.id, { source: 'discovery', applyUrl: data.applyUrl })
      } else {
        existing.applyUrl = data.applyUrl
        existing.updatedAt = new Date().toISOString()
        saveEntry(existing)
      }
    }
    // Add observations via addObservation (which handles its own save)
    if (hasObservations) {
      for (const obs of data.observations) {
        addObservation(existing.id, obs)
      }
    }
    // Re-read from DB to get fully up-to-date version
    const fresh = getEntryById(existing.id)
    return { ...(fresh || existing), created: false }
  }

  return { ...createEntry(data), created: true }
}

function findByCompanyAndProgramme(companyName, programme) {
  const norm = companyName.toLowerCase().trim()
  const all = getAllEntries()
  return all.find(e =>
    e.companyName.toLowerCase().trim() === norm &&
    (!programme || e.programme === programme)
  ) || null
}

function findByCompanyDivisionOffice(companyName, division, office) {
  const norm = companyName.toLowerCase().trim()
  const all = getAllEntries()
  return all.find(e =>
    e.companyName.toLowerCase().trim() === norm &&
    (!division || e.division === division) &&
    (!office || e.office === office)
  ) || null
}

function findByFirmId(firmId) {
  return getEntriesByFirm(firmId)
}

function findByStatus(status) {
  return getEntriesByStatus(status)
}

function getAll() {
  return getAllEntries()
}

function getById(id) {
  return getEntryById(id)
}

function updateField(entryId, field, value) {
  const entry = getEntryById(entryId)
  if (!entry) return null
  entry[field] = value
  entry.updatedAt = new Date().toISOString()
  saveEntry(entry)
  return { ...entry }
}

function updateSourceDiscovery(entryId, discoveryResult) {
  const entry = getEntryById(entryId)
  if (!entry) return null
  entry.sourceDiscovery = discoveryResult
  entry.updatedAt = new Date().toISOString()
  saveEntry(entry)
  return { ...entry }
}

function updateMatchResult(entryId, matchResult) {
  const entry = getEntryById(entryId)
  if (!entry) return null
  entry.matchedDirectJob = matchResult?.bestMatch || null
  entry.matchConfidence = matchResult?.bestMatch?.confidence || null
  entry.lastMatchAttemptAt = new Date().toISOString()
  entry.updatedAt = new Date().toISOString()
  saveEntry(entry)
  return { ...entry }
}

function getUnmatchedEntries() {
  const all = getAllEntries()
  return all.filter(e =>
    e.status !== STATES.REJECTED &&
    !e.matchedDirectJob &&
    e.resolvedFirmId
  )
}

function getEntriesByFirmId(firmId) {
  return dbGetByFirm(firmId)
}

function getStats() {
  const all = getAllEntries()
  const stats = {
    total: all.length,
    byStatus: {},
    bySource: {},
    byProvider: {},
    resolved: 0,
    verified: 0,
    needsReview: 0,
  }

  for (const entry of all) {
    stats.byStatus[entry.status] = (stats.byStatus[entry.status] || 0) + 1
    if (entry.resolvedFirmId) stats.resolved++
    if (entry.status === STATES.VERIFIED || entry.status === STATES.ENABLED) stats.verified++
    if (entry.status === STATES.NEEDS_REVIEW) stats.needsReview++

    for (const obs of entry.observations) {
      stats.bySource[obs.source] = (stats.bySource[obs.source] || 0) + 1
    }

    if (entry.classifiedProvider) {
      stats.byProvider[entry.classifiedProvider] = (stats.byProvider[entry.classifiedProvider] || 0) + 1
    }
  }

  return stats
}

function clear() {
  const all = getAllEntries()
  for (const entry of all) {
    dbDeleteEntry(entry.id)
  }
  emit('cleared')
}

function on(event, listener) {
  listeners.push({ event, listener })
  return () => {
    listeners = listeners.filter(l => l !== listener)
  }
}

function emit(event, data) {
  for (const l of listeners) {
    if (l.event === event || l.event === '*') {
      try { l.listener(event, data) } catch {}
    }
  }
}

// Backward compat — called from startup but now a no-op (SQLite is always loaded)
function loadFromDisk() {
  const count = getEntryCount()
  console.log(`[DiscoveryStore] Loaded ${count} entries from SQLite`)
  return count
}

function getLastDiscoveryTimestamp() {
  const all = getAllEntries()
  if (all.length === 0) return null

  let latest = null
  for (const entry of all) {
    for (const obs of entry.observations || []) {
      if (obs.lastSeenAt) {
        const d = new Date(obs.lastSeenAt)
        if (!latest || d > latest) latest = d
      }
    }
  }
  return latest ? latest.toISOString() : null
}

function saveToDisk() {
  // No-op — SQLite writes immediately
}

export {
  STATES,
  VALID_TRANSITIONS,
  createEntry,
  transition,
  addObservation,
  findOrCreate,
  findByCompanyAndProgramme,
  findByCompanyDivisionOffice,
  findByFirmId,
  findByStatus,
  getAll,
  getById,
  updateField,
  updateSourceDiscovery,
  updateMatchResult,
  getUnmatchedEntries,
  getStats,
  getLastDiscoveryTimestamp,
  clear,
  on,
  loadFromDisk,
  saveToDisk,
}

export { getEntriesByFirmId as getEntriesByFirm }

// Log on module import
const count = getEntryCount()
console.log(`[DiscoveryStore] SQLite loaded — ${count} entries`)
