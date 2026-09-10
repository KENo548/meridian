const DIRECT_SOURCES = new Set([
  'greenhouse',
  'workday',
  'oleeo_rss',
  'smartrecruiters',
  'lever',
  'ashby',
  'oracle_hcm',
  'avature',
  'eightfold',
  'successfactors',
])

function getDedupKey(job) {
  if (job.canonicalId) return job.canonicalId

  return `text:${[
    (job.company || '').toLowerCase().trim(),
    (job.title || '').toLowerCase().trim(),
    (job.location || '').toLowerCase().trim(),
  ].join(':')}`
}

function sourcePriority(source) {
  if (DIRECT_SOURCES.has(source)) return 2
  if (source === 'efc') return 1
  return 0
}

function pickWinner(existing, incoming) {
  const existingPriority = sourcePriority(existing.source)
  const incomingPriority = sourcePriority(incoming.source)

  if (incomingPriority > existingPriority) return 'incoming'
  if (incomingPriority < existingPriority) return 'existing'

  const existingTime = new Date(existing.lastSeenAt || existing.firstSeenAt || 0).getTime()
  const incomingTime = new Date(incoming.lastSeenAt || incoming.firstSeenAt || 0).getTime()
  if (incomingTime > existingTime) return 'incoming'

  return 'existing'
}

function deduplicateJobs(jobs) {
  const seen = new Map()
  const deduped = []
  const report = { total: jobs.length, deduplicated: 0, bySource: {} }

  for (const job of jobs) {
    if (!job || typeof job !== 'object') continue

    const key = getDedupKey(job)
    if (!key) continue

    const existingFirstSeen = job.firstSeenAt || new Date().toISOString()
    const existingLastSeen = job.lastSeenAt || existingFirstSeen

    if (!seen.has(key)) {
      const entry = { ...job, firstSeenAt: existingFirstSeen, lastSeenAt: existingLastSeen }
      seen.set(key, entry)
      deduped.push(entry)
    } else {
      const existing = seen.get(key)
      report.deduplicated++

      const winner = pickWinner(existing, job)

      if (winner === 'incoming') {
        const idx = deduped.indexOf(existing)
        if (idx !== -1) {
          const earlierFirstSeen = earlierTimestamp(existing.firstSeenAt, job.firstSeenAt)
          const laterLastSeen = laterTimestamp(existing.lastSeenAt, job.lastSeenAt)

          deduped[idx] = {
            ...job,
            firstSeenAt: earlierFirstSeen,
            lastSeenAt: laterLastSeen,
          }
          seen.set(key, deduped[idx])
        }
      } else {
        const earlierFirstSeen = earlierTimestamp(existing.firstSeenAt, job.firstSeenAt)
        const laterLastSeen = laterTimestamp(existing.lastSeenAt, job.lastSeenAt)

        existing.firstSeenAt = earlierFirstSeen
        existing.lastSeenAt = laterLastSeen
      }
    }

    const src = job.source || 'unknown'
    report.bySource[src] = (report.bySource[src] || 0) + 1
  }

  report.output = deduped.length
  return { jobs: deduped, report }
}

function earlierTimestamp(a, b) {
  if (!a) return b
  if (!b) return a
  const tA = new Date(a).getTime()
  const tB = new Date(b).getTime()
  if (isNaN(tA)) return b
  if (isNaN(tB)) return a
  return tA <= tB ? a : b
}

function laterTimestamp(a, b) {
  if (!a) return b
  if (!b) return a
  const tA = new Date(a).getTime()
  const tB = new Date(b).getTime()
  if (isNaN(tA)) return b
  if (isNaN(tB)) return a
  return tA >= tB ? a : b
}

function mergeWithPersisted(newJobs, persistedJobs) {
  const persistedMap = new Map()
  for (const job of persistedJobs) {
    const key = getDedupKey(job)
    if (key) persistedMap.set(key, job)
  }

  const merged = []
  const report = { newJobs: 0, updatedJobs: 0, persistedUnchanged: 0 }

  for (const job of newJobs) {
    const key = getDedupKey(job)
    const existing = key ? persistedMap.get(key) : null

    if (!existing) {
      merged.push({
        ...job,
        firstSeenAt: job.firstSeenAt || new Date().toISOString(),
        lastSeenAt: job.lastSeenAt || job.firstSeenAt || new Date().toISOString(),
      })
      report.newJobs++
    } else {
      merged.push({
        ...job,
        firstSeenAt: earlierTimestamp(existing.firstSeenAt, job.firstSeenAt),
        lastSeenAt: laterTimestamp(existing.lastSeenAt, job.lastSeenAt),
      })
      report.updatedJobs++
      persistedMap.delete(key)
    }
  }

  for (const remaining of persistedMap.values()) {
    merged.push(remaining)
    report.persistedUnchanged++
  }

  return { jobs: merged, report }
}

export { deduplicateJobs, mergeWithPersisted, getDedupKey, DIRECT_SOURCES }
