import Papa from 'papaparse'
import { nowIso, uid } from '@/lib/db'
import { getLanguages, normalizeDivision, normalizeSpecialization } from '@/lib/utils'
import type {
  Application,
  ApplicationQuestionRequirement,
  ApplicationStatus,
  AssessmentType,
  CompanyType,
  DeadlineType,
  Division,
  DocumentRequirement,
  EligibleUniversityYear,
  LanguageRequirement,
  Priority,
  RecommendedTiming,
  RoleType,
  Source,
  Specialization,
  WorkArrangement,
  WorkAuthorization,
} from '@/types'
import {
  ASSESSMENT_TYPE_LABELS,
  COMPANY_TYPE_LABELS,
  DIVISION_LABELS,
  ELIGIBLE_YEAR_LABELS,
  SPECIALIZATION_LABELS,
} from '@/constants'

/* ------------------------------------------------------------------ */
/* CSV conventions (V2, documented per release requirements).           */
/*                                                                     */
/* - The original 21 export columns are unchanged in name and order;   */
/*   new columns are appended. Old exports import identically.         */
/* - Multi-value cells join entries with `|` (pipe). Within a cell,   */
/*   entries are canonical snake_case identifiers, e.g.                */
/*     investment_banking|capital_markets                               */
/*     numerical_reasoning|situational_judgement|hirevue               */
/*     2027|2028                                                       */
/* - Languages use `language:need[:proficiency]` entries joined by     */
/*   `|`, e.g. `German:required:fluent|French:preferred`. `need` is    */
/*   one of required|preferred|optional|unknown (anything else reads   */
/*   as unknown). Proficiency is free text and may itself contain      */
/*   `:` — parsing splits each entry into at most 3 parts.            */
/* - The literal cell value `unknown` for document/work-auth fields   */
/*   imports as undefined (read-time unknown) to keep stored records   */
/*   clean; explicit yes/no/optional import canonically.               */
/* - PapaParse owns all quoting/escaping; values containing commas,   */
/*   quotes, pipes or newlines round-trip through standard CSV rules.  */
/* ------------------------------------------------------------------ */

const STATUS_MAP: Record<string, ApplicationStatus> = {
  researching: 'researching',
  research: 'researching',
  watching: 'watching',
  watch: 'watching',
  'not open': 'not_open',
  not_open: 'not_open',
  interested: 'interested',
  'to apply': 'to_apply',
  to_apply: 'to_apply',
  'application started': 'application_started',
  preparing: 'preparing',
  applied: 'applied',
  'online assessment': 'online_assessment',
  oa: 'online_assessment',
  hirevue: 'hirevue',
  'phone interview': 'phone_interview',
  'first interview': 'first_interview',
  'first round': 'first_round',
  interview: 'first_interview',
  'second interview': 'second_interview',
  'second round': 'second_round',
  'final interview': 'final_interview',
  'assessment centre': 'assessment_centre',
  'assessment center': 'assessment_centre',
  superday: 'superday',
  offer: 'offer',
  accepted: 'accepted',
  rejected: 'rejected',
  withdrawn: 'withdrawn',
  ghosted: 'ghosted',
  closed: 'closed',
  'missed deadline': 'missed_deadline',
}

const ROLE_MAP: Record<string, RoleType> = {
  'summer internship': 'summer_internship',
  summer: 'summer_internship',
  'off-cycle': 'off_cycle_internship',
  'off cycle': 'off_cycle_internship',
  'spring week': 'spring_week',
  spring: 'spring_week',
  'spring insight': 'spring_insight',
  'insight programme': 'insight_programme',
  'insight program': 'insight_programme',
  'first-year programme': 'first_year_programme',
  'first year programme': 'first_year_programme',
  'first-year': 'first_year_programme',
  'early careers': 'early_careers_programme',
  diversity: 'diversity_programme',
  graduate: 'graduate_programme',
  'full-time': 'full_time',
  'full time': 'full_time',
  'part-time internship': 'part_time_internship',
  'part-time': 'part_time',
  'part time': 'part_time',
  'working student': 'working_student',
  apprenticeship: 'apprenticeship',
  'industrial placement': 'industrial_placement',
  placement: 'placement',
}

function pick(row: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const found = Object.keys(row).find((k) => k.trim().toLowerCase() === key.toLowerCase())
    if (found && row[found]?.trim()) return row[found].trim()
  }
  return ''
}

function mapStatus(raw: string): ApplicationStatus {
  return STATUS_MAP[raw.trim().toLowerCase()] ?? 'interested'
}

function mapRole(raw: string): RoleType {
  const k = raw.trim().toLowerCase()
  for (const [needle, value] of Object.entries(ROLE_MAP)) {
    if (k.includes(needle)) return value
  }
  return 'other'
}

function mapDeadlineType(raw: string, deadline: string): DeadlineType {
  const k = raw.trim().toLowerCase()
  if (k.includes('roll')) return 'rolling'
  if (k.includes('filled')) return 'until_filled'
  if (k.includes('estimat')) return 'estimated'
  if (deadline) return 'specific'
  if (!raw && !deadline) return 'unknown'
  return 'specific'
}

function mapSource(raw: string): Source | undefined {
  const k = raw.trim().toLowerCase()
  if (!k) return undefined
  if (k.includes('linkedin')) return 'linkedin'
  if (k.includes('fyntraq')) return 'fyntraq'
  if (k.includes('trackr')) return 'trackr'
  if (k.includes('jobortunity')) return 'jobortunity'
  if (k.includes('indeed')) return 'indeed'
  if (k.includes('efinancial')) return 'efinancialcareers'
  if (k.includes('bright')) return 'bright_network'
  if (k.includes('handshake')) return 'handshake'
  if (k.includes('referral')) return 'referral'
  if (k.includes('university') || k.includes('portal')) return 'university_portal'
  if (k.includes('recruiter')) return 'recruiter'
  if (k.includes('company') || k.includes('website') || k.includes('career')) return 'company_website'
  return 'other'
}

function mapCompanyType(raw: string): CompanyType | undefined {
  const k = raw.trim().toLowerCase()
  if (!k) return undefined
  for (const [value, label] of Object.entries(COMPANY_TYPE_LABELS) as Array<[CompanyType, string]>) {
    if (k === value || k === label.toLowerCase()) return value
  }
  return undefined
}

function splitPipe(raw: string): string[] {
  return raw
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
}

function mapDivisions(raw: string, legacy: string): Division[] {
  const out: Division[] = []
  for (const entry of splitPipe(raw)) {
    const direct = (Object.keys(DIVISION_LABELS) as Division[]).find((d) => d === entry.toLowerCase())
    if (direct) {
      if (!out.includes(direct)) out.push(direct)
      continue
    }
    const mapped = normalizeDivision(entry)
    if (mapped && !out.includes(mapped)) out.push(mapped)
  }
  if (out.length === 0) {
    const mapped = normalizeDivision(legacy)
    if (mapped) out.push(mapped)
  }
  return out
}

function mapSpecializations(raw: string, legacy: string): Specialization[] {
  const out: Specialization[] = []
  for (const entry of splitPipe(raw)) {
    const direct = (Object.keys(SPECIALIZATION_LABELS) as Specialization[]).find(
      (s) => s === entry.toLowerCase(),
    )
    if (direct) {
      if (!out.includes(direct)) out.push(direct)
      continue
    }
    const mapped = normalizeSpecialization(entry)
    if (mapped && !out.includes(mapped)) out.push(mapped)
  }
  if (out.length === 0) {
    const mapped = normalizeSpecialization(legacy)
    if (mapped) out.push(mapped)
  }
  return out
}

function mapAssessments(raw: string): AssessmentType[] {
  const valid = Object.keys(ASSESSMENT_TYPE_LABELS) as AssessmentType[]
  const out: AssessmentType[] = []
  for (const entry of splitPipe(raw)) {
    const value = valid.find((a) => a === entry.toLowerCase())
    if (value && !out.includes(value)) out.push(value)
  }
  return out
}

function mapEligibleYears(raw: string): EligibleUniversityYear[] {
  const valid = Object.keys(ELIGIBLE_YEAR_LABELS) as EligibleUniversityYear[]
  const out: EligibleUniversityYear[] = []
  for (const entry of splitPipe(raw)) {
    const normalized = entry.toLowerCase().replace(/[\s-]+/g, '_')
    const value = valid.find((y) => y === normalized)
    if (value && !out.includes(value)) out.push(value)
  }
  return out
}

function mapGraduationYears(raw: string): number[] {
  const out: number[] = []
  for (const entry of splitPipe(raw)) {
    const year = Number.parseInt(entry, 10)
    if (Number.isFinite(year) && year >= 1900 && year <= 2200 && !out.includes(year)) out.push(year)
  }
  return out.sort((a, b) => a - b)
}

function mapDocRequirement(raw: string): DocumentRequirement | undefined {
  const k = raw.trim().toLowerCase()
  if (!k || k === 'unknown') return undefined
  if (k === 'yes' || k === 'required' || k === 'true') return 'yes'
  if (k === 'no' || k === 'not required' || k === 'false') return 'no'
  if (k === 'optional') return 'optional'
  return undefined
}

function mapAppQuestions(raw: string): ApplicationQuestionRequirement | undefined {
  const k = raw.trim().toLowerCase()
  if (!k || k === 'unknown') return undefined
  if (k === 'yes' || k === 'true') return 'yes'
  if (k === 'no' || k === 'false') return 'no'
  return undefined
}

function mapWorkAuthorization(raw: string): WorkAuthorization | undefined {
  const k = raw.trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (!k || k === 'unknown') return undefined
  const values: WorkAuthorization[] = [
    'sponsorship_available',
    'sponsorship_not_available',
    'existing_authorization_required',
    'unclear',
    'not_applicable',
  ]
  return values.find((v) => v === k)
}

function mapWorkMode(raw: string): WorkArrangement | undefined {
  const k = raw.trim().toLowerCase()
  if (!k) return undefined
  if (['onsite', 'on-site', 'office'].includes(k)) return 'onsite'
  if (k === 'hybrid') return 'hybrid'
  if (k === 'remote') return 'remote'
  return undefined
}

function mapPriority(raw: string): Priority | undefined {
  const k = raw.trim().toLowerCase()
  if (k === 'high' || k === 'medium' || k === 'low') return k
  return undefined
}

function mapTiming(raw: string): RecommendedTiming | undefined {
  const k = raw.trim().toLowerCase().replace(/[\s-]+/g, '_')
  const values: RecommendedTiming[] = ['immediately', 'within_3_days', 'within_1_week', 'before_deadline']
  if (!k || k === 'unknown') return undefined
  return values.find((v) => v === k)
}

export function parseLanguageCell(raw: string): LanguageRequirement[] {
  const out: LanguageRequirement[] = []
  for (const entry of splitPipe(raw)) {
    const [language = '', need = '', ...rest] = entry.split(':')
    const name = language.trim()
    if (!name) continue
    const requirement = ['required', 'preferred', 'optional'].includes(need.trim().toLowerCase())
      ? (need.trim().toLowerCase() as LanguageRequirement['requirement'])
      : ('unknown' as const)
    const proficiency = rest.join(':').trim() || undefined
    out.push(proficiency ? { language: name, requirement, proficiency } : { language: name, requirement })
  }
  return out
}

export function serializeLanguageCell(languages: LanguageRequirement[]): string {
  return languages
    .map((l) => (l.proficiency ? `${l.language}:${l.requirement}:${l.proficiency}` : `${l.language}:${l.requirement}`))
    .join('|')
}

export function parseApplicationsCsv(csvText: string): { apps: Application[]; errors: string[] } {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })

  const errors: string[] = [...(parsed.errors.map((e) => e.message) ?? [])]
  const apps: Application[] = []
  const ts = nowIso()

  for (const [i, row] of (parsed.data ?? []).entries()) {
    const companyName = pick(row, ['Company', 'company', 'Firm', 'Employer'])
    const jobTitle = pick(row, ['Job Title', 'Position', 'Role', 'Title', 'job_title'])
    if (!companyName || !jobTitle) {
      errors.push(`Row ${i + 2}: missing Company or Job Title — skipped`)
      continue
    }

    const deadline = pick(row, ['Deadline', 'Application Deadline', 'deadline'])
    const deadlineTypeRaw = pick(row, ['Deadline Type', 'deadline_type'])
    const statusRaw = pick(row, ['Status', 'status', 'Stage'])
    const roleRaw = pick(row, ['Role Type', 'Contract', 'Type', 'role_type'])
    const legacyDivision = pick(row, ['Division', 'division'])
    const legacySpecialization = pick(row, ['Specialization', 'specialization'])

    apps.push({
      id: uid('app'),
      companyName,
      jobTitle,
      companyType: mapCompanyType(pick(row, ['Firm Category', 'Company Type', 'company_type'])),
      country: pick(row, ['Country', 'country']) || undefined,
      city: pick(row, ['City', 'city']) || undefined,
      location: pick(row, ['Location', 'location']) || undefined,
      division: legacyDivision || undefined,
      divisions: mapDivisions(pick(row, ['Divisions', 'divisions']), legacyDivision),
      team: pick(row, ['Team', 'team']) || undefined,
      specificTeam: pick(row, ['Specific Team', 'specific_team']) || undefined,
      specialization: undefined,
      specializations: mapSpecializations(pick(row, ['Specializations', 'specializations']), legacySpecialization),
      languageRequirements: parseLanguageCell(pick(row, ['Languages', 'languages'])),
      targetGraduationYears: mapGraduationYears(pick(row, ['Graduation Years', 'Target Graduation Years'])),
      eligibleUniversityYears: mapEligibleYears(pick(row, ['Eligible Years', 'University Years'])),
      eligibilityRequirements: pick(row, ['Eligibility Requirements', 'Eligibility']) || undefined,
      workAuthorization: mapWorkAuthorization(pick(row, ['Work Authorization', 'Sponsorship'])),
      visaNotes: pick(row, ['Visa Notes', 'visa_notes']) || undefined,
      roleType: mapRole(roleRaw),
      workArrangement: mapWorkMode(pick(row, ['Work Mode', 'Work Arrangement'])),
      openingDate: pick(row, ['Opening Date', 'Detected', 'opening_date']) || undefined,
      deadline: deadline || undefined,
      deadlineType: mapDeadlineType(deadlineTypeRaw, deadline),
      timingNotes: pick(row, ['Timing Notes', 'timing_notes']) || undefined,
      applicationDate: pick(row, ['Application Date', 'Applied', 'applied', 'application_date']) || undefined,
      startDate: pick(row, ['Start', 'Start Date', 'start_date']) || undefined,
      endDate: pick(row, ['End Date', 'end_date']) || undefined,
      duration: pick(row, ['Duration', 'duration']) || undefined,
      status: mapStatus(statusRaw || 'interested'),
      priority: mapPriority(pick(row, ['Priority', 'priority'])),
      recommendedTiming: mapTiming(pick(row, ['Recommended Timing', 'Apply Timing'])),
      nextAction: pick(row, ['Next Action', 'next_action']) || undefined,
      nextActionDate: pick(row, ['Next Action Date', 'next_action_date']) || undefined,
      cvRequired: mapDocRequirement(pick(row, ['CV Required', 'CV'])),
      coverLetterRequired: mapDocRequirement(pick(row, ['Cover Letter Required', 'Cover Letter'])),
      transcriptRequired: mapDocRequirement(pick(row, ['Transcript Required', 'Transcript'])),
      referencesRequired: mapDocRequirement(pick(row, ['References Required', 'References'])),
      applicationQuestions: mapAppQuestions(pick(row, ['Application Questions'])),
      requirementsNotes: pick(row, ['Requirements Notes']) || undefined,
      assessments: mapAssessments(pick(row, ['Assessments', 'Assessment Types'])),
      assessmentNotes: pick(row, ['Assessment Notes']) || undefined,
      applicationProcess: pick(row, ['Application Process']) || undefined,
      interviewProcess: pick(row, ['Interview Process']) || undefined,
      expectedInterviewTimeline: pick(row, ['Expected Timeline']) || undefined,
      source: mapSource(pick(row, ['Source', 'source'])),
      sourceUrl: pick(row, ['Source URL', 'source_url']) || undefined,
      applicationUrl: pick(row, ['Application Link', 'Apply URL', 'application_url', 'URL']) || undefined,
      jobUrl: pick(row, ['Job Posting', 'Job URL', 'job_url']) || undefined,
      companyUrl: pick(row, ['Company Website', 'Website', 'company_url']) || undefined,
      notes: pick(row, ['Notes', 'notes']) || undefined,
      recruitmentCycle: pick(row, ['Cycle', 'Year', 'recruitment_cycle']) || undefined,
      archived: false,
      tagIds: [],
      createdAt: ts,
      updatedAt: ts,
    })
  }

  return { apps, errors }
}

export function exportApplicationsCsv(apps: Application[]): string {
  const rows = apps.map((a) => ({
    Company: a.companyName,
    'Job Title': a.jobTitle,
    Status: a.status,
    'Role Type': a.roleType,
    Division: a.division ?? '',
    Divisions: (a.divisions ?? []).join('|'),
    Specialization: a.specialization ?? '',
    Specializations: (a.specializations ?? []).join('|'),
    'Specific Team': a.specificTeam ?? a.team ?? '',
    Location: a.location ?? '',
    City: a.city ?? '',
    Country: a.country ?? '',
    'Work Mode': a.workArrangement ?? '',
    'Firm Category': a.companyType ?? '',
    'Graduation Years': (a.targetGraduationYears ?? []).join('|'),
    'Eligible Years': (a.eligibleUniversityYears ?? []).join('|'),
    'Eligibility Requirements': a.eligibilityRequirements ?? '',
    Languages: serializeLanguageCell(getLanguages(a)),
    'Work Authorization': a.workAuthorization ?? '',
    'Visa Notes': a.visaNotes ?? '',
    'Opening Date': a.openingDate ?? '',
    Deadline: a.deadline ?? '',
    'Deadline Type': a.deadlineType,
    'Timing Notes': a.timingNotes ?? '',
    'Application Date': a.applicationDate ?? '',
    'Start Date': a.startDate ?? '',
    'End Date': a.endDate ?? '',
    Duration: a.duration ?? '',
    Priority: a.priority ?? '',
    'Recommended Timing': a.recommendedTiming ?? '',
    'Next Action': a.nextAction ?? '',
    'Next Action Date': a.nextActionDate ?? '',
    'CV Required': a.cvRequired ?? '',
    'Cover Letter Required': a.coverLetterRequired ?? '',
    'Transcript Required': a.transcriptRequired ?? '',
    'References Required': a.referencesRequired ?? '',
    'Application Questions': a.applicationQuestions ?? '',
    'Requirements Notes': a.requirementsNotes ?? '',
    Assessments: (a.assessments ?? []).join('|'),
    'Assessment Notes': a.assessmentNotes ?? '',
    'Application Process': a.applicationProcess ?? '',
    'Interview Process': a.interviewProcess ?? '',
    'Expected Timeline': a.expectedInterviewTimeline ?? '',
    Source: a.source ?? '',
    'Source URL': a.sourceUrl ?? '',
    'Application Link': a.applicationUrl ?? '',
    'Job URL': a.jobUrl ?? '',
    'Company URL': a.companyUrl ?? '',
    Notes: a.notes ?? '',
    Cycle: a.recruitmentCycle ?? '',
  }))
  return Papa.unparse(rows)
}

export function exportJsonBackup(payload: unknown): string {
  return JSON.stringify(payload, null, 2)
}
