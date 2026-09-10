import Papa from 'papaparse'
import { nowIso, uid } from '@/lib/db'
import type { Application, ApplicationStatus, DeadlineType, RoleType, Source } from '@/types'

const STATUS_MAP: Record<string, ApplicationStatus> = {
  interested: 'interested',
  'to apply': 'to_apply',
  to_apply: 'to_apply',
  preparing: 'preparing',
  applied: 'applied',
  'online assessment': 'online_assessment',
  oa: 'online_assessment',
  'first interview': 'first_interview',
  interview: 'first_interview',
  'second interview': 'second_interview',
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
}

const ROLE_MAP: Record<string, RoleType> = {
  'summer internship': 'summer_internship',
  summer: 'summer_internship',
  'off-cycle': 'off_cycle_internship',
  'off cycle': 'off_cycle_internship',
  'spring week': 'spring_week',
  spring: 'spring_week',
  graduate: 'graduate_programme',
  'full-time': 'full_time',
  'full time': 'full_time',
  'part-time': 'part_time',
  'working student': 'working_student',
  apprenticeship: 'apprenticeship',
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
  if (k.includes('referral')) return 'referral'
  if (k.includes('university') || k.includes('portal')) return 'university_portal'
  if (k.includes('recruiter')) return 'recruiter'
  if (k.includes('company') || k.includes('website') || k.includes('career')) return 'company_website'
  return 'other'
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

    apps.push({
      id: uid('app'),
      companyName,
      jobTitle,
      companyType: undefined,
      country: pick(row, ['Country', 'country']) || undefined,
      city: pick(row, ['City', 'city']) || undefined,
      location: pick(row, ['Location', 'location']) || undefined,
      division: pick(row, ['Division', 'division']) || undefined,
      specialization: undefined,
      roleType: mapRole(roleRaw),
      openingDate: pick(row, ['Opening Date', 'Detected', 'opening_date']) || undefined,
      deadline: deadline || undefined,
      deadlineType: mapDeadlineType(deadlineTypeRaw, deadline),
      applicationDate: pick(row, ['Application Date', 'Applied', 'applied', 'application_date']) || undefined,
      startDate: pick(row, ['Start', 'Start Date', 'start_date']) || undefined,
      status: mapStatus(statusRaw || 'interested'),
      source: mapSource(pick(row, ['Source', 'source'])),
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
    Specialization: a.specialization ?? '',
    Location: a.location ?? '',
    City: a.city ?? '',
    Country: a.country ?? '',
    'Opening Date': a.openingDate ?? '',
    Deadline: a.deadline ?? '',
    'Deadline Type': a.deadlineType,
    'Application Date': a.applicationDate ?? '',
    'Start Date': a.startDate ?? '',
    'End Date': a.endDate ?? '',
    Source: a.source ?? '',
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
