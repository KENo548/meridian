import {
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  isValid,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import {
  APPLIED_OR_BEYOND,
  CLOSED_STATUSES,
  DIVISION_LABELS,
  INTERVIEW_STATUSES,
  OPEN_STATUSES,
  SPECIALIZATION_LABELS,
} from '@/constants'
import type {
  Application,
  ApplicationAvailability,
  ApplicationFilters,
  ApplicationStatus,
  DashboardStats,
  DeadlineUrgency,
  Division,
  DocumentRequirement,
  LanguageRequirement,
  SortState,
  Specialization,
} from '@/types'

export function parseDate(value?: string | null): Date | null {
  if (!value) return null
  const d = parseISO(value.length === 10 ? `${value}T12:00:00` : value)
  return isValid(d) ? d : null
}

export function toDateInput(value?: string | null): string {
  if (!value) return ''
  const d = parseDate(value)
  return d ? format(d, 'yyyy-MM-dd') : ''
}

export function formatDisplayDate(value?: string | null): string {
  const d = parseDate(value)
  return d ? format(d, 'dd MMM yyyy') : '—'
}

export function isClosedStatus(status: ApplicationStatus): boolean {
  return CLOSED_STATUSES.includes(status)
}

export function getDeadlineUrgency(app: Application, today = startOfDay(new Date())): DeadlineUrgency {
  if (isClosedStatus(app.status)) return 'closed'
  if (app.deadlineType === 'rolling' || app.deadlineType === 'until_filled') return 'rolling'
  if (app.deadlineType === 'unknown' || !app.deadline) return 'no_deadline'

  const deadline = parseDate(app.deadline)
  if (!deadline) return 'no_deadline'

  // Already submitted / past apply stage — don't treat as overdue for applying
  const days = differenceInCalendarDays(startOfDay(deadline), today)
  if (days < 0) {
    if (APPLIED_OR_BEYOND.includes(app.status) || isClosedStatus(app.status)) return 'closed'
    return 'overdue'
  }
  if (days === 0) return 'due_today'
  if (days === 1) return 'due_tomorrow'
  if (days <= 7) return 'due_this_week'
  return 'due_later'
}

export function daysUntilDeadline(app: Application, today = startOfDay(new Date())): number | null {
  if (app.deadlineType === 'rolling' || app.deadlineType === 'until_filled' || app.deadlineType === 'unknown') {
    return null
  }
  if (!app.deadline || isClosedStatus(app.status)) return null
  const deadline = parseDate(app.deadline)
  if (!deadline) return null
  return differenceInCalendarDays(startOfDay(deadline), today)
}

export function daysSinceApplication(app: Application, today = startOfDay(new Date())): number | null {
  const applied = parseDate(app.applicationDate)
  if (!applied) return null
  return differenceInCalendarDays(today, startOfDay(applied))
}

export function daysSinceUpdate(app: Application, today = startOfDay(new Date())): number {
  const updated = parseDate(app.updatedAt) ?? new Date(app.updatedAt)
  return differenceInCalendarDays(today, startOfDay(updated))
}

export function deadlineLabel(app: Application): string {
  const urgency = getDeadlineUrgency(app)
  if (urgency === 'rolling') return 'Rolling'
  if (urgency === 'no_deadline') return 'No deadline'
  if (urgency === 'closed') return '—'
  const days = daysUntilDeadline(app)
  if (days === null) return '—'
  if (days < 0) return `Overdue ${Math.abs(days)}d`
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  return `${days}d left`
}

export function emptyFilters(): ApplicationFilters {
  return {
    search: '',
    statuses: [],
    companyTypes: [],
    roleTypes: [],
    divisions: [],
    specializations: [],
    assessments: [],
    eligibleUniversityYears: [],
    targetGraduationYears: [],
    workAuthorizations: [],
    workModes: [],
    priorities: [],
    cvRequired: [],
    coverLetterRequired: [],
    transcriptRequired: [],
    deadlineTypes: [],
    cycles: [],
    countries: [],
    cities: [],
    sources: [],
    tags: [],
    languages: [],
    requirementTypes: [],
    hasInterview: null,
    hasOffer: null,
    rollingDeadline: null,
    deadlineWithinDays: null,
    showArchived: false,
  }
}

/* ------------------------------------------------------------------ */
/* Filter activity counting (PR #1 U5/U8). Shared by the toolbar badge  */
/* and the panel group badges so both counters agree on what is active. */
/* ------------------------------------------------------------------ */

/** A single filter value counts as active when it restricts results. */
export function isActiveFilterValue(v: unknown): boolean {
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'string') return v.trim().length > 0
  if (typeof v === 'number') return true
  // Only `true` counts: `false` (e.g. showArchived default) and null
  // (unset tristates) restrict nothing.
  return v === true
}

/** Count active keys — arrays, strings, numbers and true booleans. */
export function countActiveKeys(
  filters: ApplicationFilters,
  keys: Array<keyof ApplicationFilters>,
): number {
  let n = 0
  for (const k of keys) {
    if (isActiveFilterValue(filters[k])) n++
  }
  return n
}

/** Date bounds count per range pair (from/to together are one filter). */
export function countActiveDateRanges(filters: ApplicationFilters): number {
  let n = 0
  if (filters.openingDateFrom || filters.openingDateTo) n++
  if (filters.deadlineFrom || filters.deadlineTo) n++
  if (filters.startDateFrom || filters.startDateTo) n++
  if (filters.applicationDateFrom || filters.applicationDateTo) n++
  return n
}

/* ------------------------------------------------------------------ */
/* V2 normalization: legacy fields stay stored; arrays are canonical.  */
/* Normalizers never mutate the record — they derive a view of it.     */
/* ------------------------------------------------------------------ */

function reverseLookup<T extends string>(labels: Record<T, string>): Map<string, T> {
  const map = new Map<string, T>()
  for (const [value, label] of Object.entries(labels) as Array<[T, string]>) {
    map.set(value.toLowerCase(), value)
    map.set(label.toLowerCase(), value)
  }
  return map
}

const DIVISION_ALIASES: Record<string, Division> = {
  ib: 'investment_banking',
  's&t': 'sales_and_trading',
  sales_trading: 'sales_and_trading',
  pe: 'private_equity',
  hf: 'hedge_fund',
  am: 'asset_management',
  er: 'equity_research',
  quant: 'quantitative_finance',
  tech: 'technology',
  ops: 'operations',
}

const SPECIALIZATION_ALIASES: Record<string, Specialization> = {
  'm&a': 'manda',
  ib: 'investment_banking',
  levfin: 'leveraged_finance',
  'lev fin': 'leveraged_finance',
  tmt: 'technology_media_telecom',
  fig: 'financial_institutions',
  's&t': 'sales_trading',
  srt: 'structuring',
}

/** Canonical divisions for a record: `divisions`, else legacy `division`, else []. */
export function getDivisions(app: Application): Division[] {
  if (app.divisions && app.divisions.length > 0) {
    const valid = (Object.keys(DIVISION_LABELS) as Division[])
    return app.divisions.filter((d): d is Division => valid.includes(d))
  }
  const mapped = normalizeDivision(app.division)
  return mapped ? [mapped] : []
}

/** Canonical specializations for a record: `specializations`, else legacy, else []. */
export function getSpecializations(app: Application): Specialization[] {
  if (app.specializations && app.specializations.length > 0) {
    const valid = (Object.keys(SPECIALIZATION_LABELS) as Specialization[])
    return app.specializations.filter((s): s is Specialization => valid.includes(s))
  }
  const mapped = normalizeSpecialization(app.specialization)
  return mapped ? [mapped] : []
}

export function normalizeDivision(raw?: string | null): Division | undefined {
  if (!raw || !raw.trim()) return undefined
  const key = raw.trim().toLowerCase()
  return (
    reverseLookup(DIVISION_LABELS).get(key) ??
    DIVISION_ALIASES[key] ??
    (Object.keys(DIVISION_LABELS) as Division[]).find((d) => d === key)
  )
}

export function normalizeSpecialization(raw?: string | null): Specialization | undefined {
  if (!raw || !raw.trim()) return undefined
  const key = raw.trim().toLowerCase()
  return (
    reverseLookup(SPECIALIZATION_LABELS).get(key) ??
    SPECIALIZATION_ALIASES[key] ??
    (Object.keys(SPECIALIZATION_LABELS) as Specialization[]).find((s) => s === key)
  )
}

/**
 * Canonical language requirements. Prefers `languageRequirements`;
 * legacy string entries become `{ requirement: 'unknown' }`.
 * Accepts mixed arrays defensively — stored data predates the schema.
 */
export function getLanguages(app: Application): LanguageRequirement[] {
  if (app.languageRequirements && app.languageRequirements.length > 0) {
    return app.languageRequirements.filter(
      (l): l is LanguageRequirement =>
        !!l && typeof l.language === 'string' && l.language.trim().length > 0,
    )
  }
  return (app.languages ?? [])
    .filter((l): l is string => typeof l === 'string' && l.trim().length > 0)
    .map((language) => ({ language: language.trim(), requirement: 'unknown' as const }))
}

/**
 * Missing document metadata is UNKNOWN — never `no`. Callers must not
 * write the fallback back to the record; it is a read-time view only.
 */
export function resolveDocRequirement(
  value: DocumentRequirement | undefined,
): DocumentRequirement {
  return value ?? 'unknown'
}

/**
 * Derived application availability for "open" reasoning. Uses
 * openingDate, deadline, deadlineType and status together — never
 * `deadline >= today` alone (that fails rolling and not-yet-open).
 * Derived on read; never persisted.
 */
export function getAvailability(
  app: Application,
  today = startOfDay(new Date()),
): ApplicationAvailability {
  if (isClosedStatus(app.status)) return 'closed'

  const opening = parseDate(app.openingDate)
  if (opening && startOfDay(opening) > today) return 'not_yet_open'

  if (app.deadlineType === 'rolling' || app.deadlineType === 'until_filled') return 'rolling'

  if (app.deadlineType === 'unknown' || !app.deadline) return 'unknown'
  const deadline = parseDate(app.deadline)
  if (!deadline) return 'unknown'

  const days = differenceInCalendarDays(startOfDay(deadline), today)
  if (days < 0) return 'closed'
  if (days <= 7) return 'closing_soon'
  return 'open'
}

function matchesDateRange(value: string | undefined, from?: string, to?: string): boolean {
  if (!from && !to) return true
  if (!value) return false
  if (from && value < from) return false
  if (to && value > to) return false
  return true
}

export function filterApplications(
  apps: Application[],
  filters: ApplicationFilters,
  requirementAppIds?: Set<string>,
): Application[] {
  const q = filters.search.trim().toLowerCase()

  return apps.filter((app) => {
    if (!filters.showArchived && app.archived) return false

  if (q) {
    const hay = [
      app.companyName,
      app.jobTitle,
      app.location,
      app.city,
      app.country,
      app.division,
      ...getDivisions(app).map((d) => DIVISION_LABELS[d]),
      app.specialization,
      ...getSpecializations(app).map((s) => SPECIALIZATION_LABELS[s]),
      app.status,
      app.source,
      app.team,
      app.specificTeam,
      app.office,
      app.notes,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    if (!hay.includes(q)) return false
  }

  if (filters.statuses.length && !filters.statuses.includes(app.status)) return false
  if (filters.companyTypes.length && (!app.companyType || !filters.companyTypes.includes(app.companyType))) {
    return false
  }
  if (filters.roleTypes.length && !filters.roleTypes.includes(app.roleType)) return false
  if (filters.divisions.length && !getDivisions(app).some((d) => filters.divisions.includes(d))) {
    return false
  }
  if (
    filters.specializations.length &&
    !getSpecializations(app).some((s) => filters.specializations.includes(s))
  ) {
    return false
  }
    if (filters.countries.length && (!app.country || !filters.countries.includes(app.country))) return false
    if (filters.cities.length && (!app.city || !filters.cities.includes(app.city))) return false
    if (filters.sources.length && (!app.source || !filters.sources.includes(app.source))) return false
    if (filters.tags.length && !filters.tags.some((t) => app.tagIds.includes(t))) return false
    if (filters.languages.length && !getLanguages(app).some((l) => filters.languages.includes(l.language))) return false

    // Multi-value taxonomy filters: a record matches on intersection,
    // never exact array equality. Missing data never matches an active
    // filter — unknown is not a value.
    if (filters.assessments.length && !(app.assessments ?? []).some((a) => filters.assessments.includes(a))) {
      return false
    }
    if (
      filters.eligibleUniversityYears.length &&
      !(app.eligibleUniversityYears ?? []).some((y) => filters.eligibleUniversityYears.includes(y))
    ) {
      return false
    }
    if (
      filters.targetGraduationYears.length &&
      !(app.targetGraduationYears ?? []).some((y) => filters.targetGraduationYears.includes(y))
    ) {
      return false
    }
    if (
      filters.workAuthorizations.length &&
      (!app.workAuthorization || !filters.workAuthorizations.includes(app.workAuthorization))
    ) {
      return false
    }
    if (
      filters.workModes.length &&
      (!app.workArrangement || !filters.workModes.includes(app.workArrangement))
    ) {
      return false
    }
    if (filters.priorities.length && (!app.priority || !filters.priorities.includes(app.priority))) {
      return false
    }
    // Document filters match the resolved value, so `unknown` is an
    // explicit selectable state and old records surface under it —
    // never under `no`.
    if (filters.cvRequired.length && !filters.cvRequired.includes(resolveDocRequirement(app.cvRequired))) {
      return false
    }
    if (
      filters.coverLetterRequired.length &&
      !filters.coverLetterRequired.includes(resolveDocRequirement(app.coverLetterRequired))
    ) {
      return false
    }
    if (
      filters.transcriptRequired.length &&
      !filters.transcriptRequired.includes(resolveDocRequirement(app.transcriptRequired))
    ) {
      return false
    }
    if (filters.deadlineTypes.length && !filters.deadlineTypes.includes(app.deadlineType)) return false
    if (filters.cycles.length && (!app.recruitmentCycle || !filters.cycles.includes(app.recruitmentCycle))) {
      return false
    }
    if (filters.deadlineWithinDays !== null && filters.deadlineWithinDays !== undefined) {
      const days = daysUntilDeadline(app)
      if (days === null || days < 0 || days > filters.deadlineWithinDays) return false
    }

    if (filters.hasInterview === true && !INTERVIEW_STATUSES.includes(app.status) && !app.interviewDate) {
      return false
    }
    if (filters.hasInterview === false && (INTERVIEW_STATUSES.includes(app.status) || app.interviewDate)) {
      return false
    }
    if (filters.hasOffer === true && app.status !== 'offer' && app.status !== 'accepted') return false
    if (filters.hasOffer === false && (app.status === 'offer' || app.status === 'accepted')) return false

    if (filters.rollingDeadline === true && app.deadlineType !== 'rolling') return false
    if (filters.rollingDeadline === false && app.deadlineType === 'rolling') return false

    if (!matchesDateRange(app.openingDate, filters.openingDateFrom, filters.openingDateTo)) return false
    if (!matchesDateRange(app.deadline, filters.deadlineFrom, filters.deadlineTo)) return false
    if (!matchesDateRange(app.startDate, filters.startDateFrom, filters.startDateTo)) return false
    if (!matchesDateRange(app.applicationDate, filters.applicationDateFrom, filters.applicationDateTo)) {
      return false
    }

    if (filters.requirementTypes.length && requirementAppIds) {
      if (!requirementAppIds.has(app.id)) return false
    }

    return true
  })
}

const STATUS_RANK: Record<ApplicationStatus, number> = {
  researching: 0,
  watching: 0,
  not_open: 0,
  interested: 0,
  to_apply: 1,
  application_started: 1,
  preparing: 2,
  applied: 3,
  online_assessment: 4,
  hirevue: 5,
  phone_interview: 5,
  first_interview: 5,
  first_round: 5,
  second_interview: 6,
  second_round: 6,
  final_interview: 7,
  assessment_centre: 8,
  superday: 9,
  offer: 10,
  accepted: 11,
  rejected: 12,
  withdrawn: 13,
  ghosted: 14,
  closed: 15,
  missed_deadline: 15,
}

function urgencyRank(app: Application): number {
  const u = getDeadlineUrgency(app)
  switch (u) {
    case 'overdue':
      return 0
    case 'due_today':
      return 1
    case 'due_tomorrow':
      return 2
    case 'due_this_week':
      return 3
    case 'due_later':
      return 4
    case 'rolling':
      return 5
    case 'no_deadline':
      return 6
    case 'closed':
      return 7
    default:
      return 8
  }
}

export function sortApplications(apps: Application[], sort: SortState): Application[] {
  const sorted = [...apps]
  const dir = sort.direction === 'asc' ? 1 : -1

  sorted.sort((a, b) => {
    // Default urgency-aware deadline sort
    if (sort.field === 'deadline') {
      const ua = urgencyRank(a)
      const ub = urgencyRank(b)
      if (ua !== ub) return (ua - ub) * (sort.direction === 'asc' ? 1 : -1)
      const da = daysUntilDeadline(a)
      const db = daysUntilDeadline(b)
      if (da === null && db === null) return a.companyName.localeCompare(b.companyName)
      if (da === null) return 1
      if (db === null) return -1
      return (da - db) * dir
    }

    const get = (app: Application): string | number => {
      switch (sort.field) {
        case 'openingDate':
          return app.openingDate ?? ''
        case 'applicationDate':
          return app.applicationDate ?? ''
        case 'companyName':
          return app.companyName.toLowerCase()
        case 'jobTitle':
          return app.jobTitle.toLowerCase()
        case 'status':
          return STATUS_RANK[app.status]
        case 'priority':
          return app.priority === 'high' ? 0 : app.priority === 'medium' ? 1 : app.priority === 'low' ? 2 : 3
        case 'nextActionDate':
          return app.nextActionDate ?? ''
        case 'location':
          return (app.location ?? app.city ?? '').toLowerCase()
        case 'startDate':
          return app.startDate ?? ''
        case 'updatedAt':
          return app.updatedAt
        default:
          return ''
      }
    }

    const av = get(a)
    const bv = get(b)
    if (av < bv) return -1 * dir
    if (av > bv) return 1 * dir
    return a.companyName.localeCompare(b.companyName)
  })

  return sorted
}

export function computeStats(apps: Application[]): DashboardStats {
  const today = startOfDay(new Date())
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 })
  const monthStart = startOfMonth(today)
  const monthEnd = endOfMonth(today)

  const active = apps.filter((a) => !a.archived)
  const total = active.length

  const createdThisWeek = active.filter((a) => {
    const d = parseDate(a.createdAt)
    return d && d >= weekStart && d <= weekEnd
  }).length

  const createdThisMonth = active.filter((a) => {
    const d = parseDate(a.createdAt)
    return d && d >= monthStart && d <= monthEnd
  }).length

  const open = active.filter((a) => OPEN_STATUSES.includes(a.status)).length
  const interviews = active.filter(
    (a) => INTERVIEW_STATUSES.includes(a.status) || Boolean(a.interviewDate),
  ).length
  const offers = active.filter((a) => a.status === 'offer' || a.status === 'accepted').length
  const rejections = active.filter((a) => a.status === 'rejected').length

  const upcomingDeadlines = active.filter((a) => {
    const u = getDeadlineUrgency(a)
    return u === 'overdue' || u === 'due_today' || u === 'due_tomorrow' || u === 'due_this_week'
  }).length

  const appliedCount = active.filter((a) => APPLIED_OR_BEYOND.includes(a.status)).length
  const responded = active.filter(
    (a) =>
      INTERVIEW_STATUSES.includes(a.status) ||
      a.status === 'offer' ||
      a.status === 'accepted' ||
      a.status === 'rejected' ||
      a.status === 'online_assessment',
  ).length

  const responseRate = appliedCount ? Math.round((responded / appliedCount) * 100) : 0
  const interviewRate = appliedCount ? Math.round((interviews / appliedCount) * 100) : 0
  const offerRate = appliedCount ? Math.round((offers / appliedCount) * 100) : 0

  const byStatus: Record<string, number> = {}
  const byDivision: Record<string, number> = {}
  const byCompany: Record<string, number> = {}
  const byCountry: Record<string, number> = {}
  const byMonth: Record<string, number> = {}

  for (const a of active) {
    byStatus[a.status] = (byStatus[a.status] ?? 0) + 1
    const div = a.division || a.specialization || 'Other'
    byDivision[div] = (byDivision[div] ?? 0) + 1
    byCompany[a.companyName] = (byCompany[a.companyName] ?? 0) + 1
    const country = a.country || 'Unknown'
    byCountry[country] = (byCountry[country] ?? 0) + 1
    const created = parseDate(a.createdAt)
    if (created) {
      const key = format(created, 'yyyy-MM')
      byMonth[key] = (byMonth[key] ?? 0) + 1
    }
  }

  const interviewDays: number[] = []
  const outcomeDays: number[] = []
  for (const a of active) {
    const applied = parseDate(a.applicationDate)
    if (!applied) continue
    if (a.interviewDate) {
      const interview = parseDate(a.interviewDate)
      if (interview) interviewDays.push(differenceInCalendarDays(interview, applied))
    }
    if (a.status === 'offer' || a.status === 'accepted' || a.status === 'rejected') {
      const outcome = parseDate(a.closingDate) ?? parseDate(a.updatedAt)
      if (outcome) outcomeDays.push(differenceInCalendarDays(outcome, applied))
    }
  }

  const avg = (nums: number[]) =>
    nums.length ? Math.round(nums.reduce((s, n) => s + n, 0) / nums.length) : null

  return {
    total,
    thisWeek: createdThisWeek,
    thisMonth: createdThisMonth,
    open,
    interviews,
    offers,
    rejections,
    upcomingDeadlines,
    responseRate,
    interviewRate,
    offerRate,
    byStatus,
    byDivision,
    byCompany,
    byCountry,
    byMonth,
    avgDaysToInterview: avg(interviewDays),
    avgDaysToOutcome: avg(outcomeDays),
  }
}

export function findDuplicate(
  apps: Application[],
  candidate: Pick<Application, 'companyName' | 'jobTitle' | 'location' | 'recruitmentCycle'>,
  excludeId?: string,
): Application | undefined {
  const norm = (s?: string) => (s ?? '').trim().toLowerCase()
  return apps.find(
    (a) =>
      a.id !== excludeId &&
      !a.archived &&
      norm(a.companyName) === norm(candidate.companyName) &&
      norm(a.jobTitle) === norm(candidate.jobTitle) &&
      norm(a.location) === norm(candidate.location) &&
      norm(a.recruitmentCycle) === norm(candidate.recruitmentCycle),
  )
}

export function isValidUrl(value?: string): boolean {
  if (!value?.trim()) return true
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export function clsx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
