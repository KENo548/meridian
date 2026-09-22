import { useEffect, useState } from 'react'
import { X, Trash2, Archive, Plus, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input } from '@/components/ui/Input'
import { MultiSelect } from '@/components/ui/MultiSelect'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { ExternalLink } from '@/components/ui/ExternalLink'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { DeadlineBadge } from '@/components/ui/DeadlineBadge'
import { LanguageEditor } from '@/components/applications/AddApplicationWizard'
import {
  ASSESSMENT_TYPE_LABELS,
  STATUS_LABELS,
  STATUS_ORDER,
  DEADLINE_TYPE_LABELS,
  DIVISION_LABELS,
  DOC_REQUIREMENT_LABELS,
  ELIGIBLE_YEAR_LABELS,
  REQUIREMENT_STATUS_LABELS,
  COMPANY_TYPE_LABELS,
  PRIORITY_LABELS,
  RECOMMENDED_TIMING_LABELS,
  ROLE_TYPE_LABELS,
  SOURCE_LABELS,
  SPECIALIZATION_LABELS,
  WORK_AUTH_LABELS,
} from '@/constants'
import { useMeridianStore } from '@/lib/store'
import {
  toDateInput,
  formatDisplayDate,
  clsx,
  getDivisions,
  getLanguages,
  getSpecializations,
  resolveDocRequirement,
} from '@/lib/utils'
import type {
  ApplicationStatus,
  AssessmentType,
  DeadlineType,
  Division,
  DocumentRequirement,
  EligibleUniversityYear,
  Priority,
  RecommendedTiming,
  RequirementStatus,
  RoleType,
  Specialization,
  WorkAuthorization,
} from '@/types'

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  internship: 'Internship',
  full_time: 'Full-Time',
  part_time: 'Part-Time',
  contract: 'Contract',
  other: 'Other',
}

const WORK_ARRANGEMENT_LABELS: Record<string, string> = {
  onsite: 'On-site',
  hybrid: 'Hybrid',
  remote: 'Remote',
  unknown: 'Unknown',
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] uppercase tracking-wider text-[var(--color-faint)] mb-2">
      {children}
    </p>
  )
}

function Divider() {
  return <hr className="border-[var(--color-border)]" />
}

export function ApplicationDetailPanel() {
  const activeId = useMeridianStore((s) => s.activeApplicationId)
  const setActiveApplicationId = useMeridianStore((s) => s.setActiveApplicationId)
  const applications = useMeridianStore((s) => s.applications)
  const requirements = useMeridianStore((s) => s.requirements)
  const tasks = useMeridianStore((s) => s.tasks)
  const contacts = useMeridianStore((s) => s.contacts)
  const allTags = useMeridianStore((s) => s.tags)
  const updateApplication = useMeridianStore((s) => s.updateApplication)
  const deleteApplications = useMeridianStore((s) => s.deleteApplications)
  const archiveApplications = useMeridianStore((s) => s.archiveApplications)
  const setRequirementStatus = useMeridianStore((s) => s.setRequirementStatus)
  const toggleTask = useMeridianStore((s) => s.toggleTask)
  const upsertTask = useMeridianStore((s) => s.upsertTask)
  const upsertContact = useMeridianStore((s) => s.upsertContact)
  const deleteContact = useMeridianStore((s) => s.deleteContact)
  const ensureTag = useMeridianStore((s) => s.ensureTag)

  const app = applications.find((a) => a.id === activeId) ?? null
  const [notes, setNotes] = useState('')
  const [newTask, setNewTask] = useState('')
  const [newTagName, setNewTagName] = useState('')
  const [newContact, setNewContact] = useState({
    name: '',
    email: '',
    linkedinUrl: '',
    notes: '',
  })
  const [showContactForm, setShowContactForm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  // Graduation-year draft: the persisted value only holds valid years, so
  // typing into it directly would reject the first keystroke and wipe the
  // field (PR #1 U9). Draft locally, commit parsed years on blur.
  const [gradDraft, setGradDraft] = useState<string | null>(null)

  useEffect(() => {
    setNotes(app?.notes ?? '')
    setGradDraft(null)
  }, [app?.id, app?.notes])

  if (!app) return null

  const appReqs = requirements.filter((r) => r.applicationId === app.id)
  const appTasks = tasks.filter((t) => t.applicationId === app.id)
  const appContacts = contacts.filter((c) => c.applicationId === app.id)
  const appTags = allTags.filter((t) => app.tagIds.includes(t.id))

  const saveField = (patch: Parameters<typeof updateApplication>[1]) => {
    void updateApplication(app.id, patch)
  }

  const toggleList = <T extends string>(key: 'divisions' | 'specializations' | 'eligibleUniversityYears' | 'assessments', value: T) => {
    // Divisions/specializations normalize legacy single values first so
    // the first toggle never silently drops existing data.
    const base: T[] =
      key === 'divisions'
        ? (getDivisions(app) as unknown as T[])
        : key === 'specializations'
          ? (getSpecializations(app) as unknown as T[])
          : ((app[key] ?? []) as unknown as T[])
    const next = base.includes(value) ? base.filter((x) => x !== value) : [...base, value]
    // Once the canonical array is authoritative, the legacy scalar must go:
    // getDivisions/getSpecializations fall back to it whenever the array is
    // empty, so a leftover scalar would resurrect a removed value (PR #1 T6).
    // Server PUT replaces the whole record, so `undefined` clears end to end.
    saveField({
      [key]: next,
      ...(key === 'divisions' ? { division: undefined } : {}),
      ...(key === 'specializations' ? { specialization: undefined } : {}),
    } as Parameters<typeof updateApplication>[1])
  }

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/40"
        aria-label="Close detail panel"
        onClick={() => setActiveApplicationId(null)}
      />
      <aside
        className={clsx(
          'fixed top-0 right-0 z-50 h-full w-full max-w-md border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl animate-slide-in flex flex-col',
        )}
        role="dialog"
        aria-label="Application details"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-[var(--color-border)] shrink-0">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold truncate">{app.companyName}</h2>
            <p className="text-sm text-[var(--color-muted)] truncate">{app.jobTitle}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <StatusBadge status={app.status} />
              <DeadlineBadge application={app} />
              {app.isDemo ? (
                <span className="text-[10px] uppercase text-[var(--color-faint)]">Demo</span>
              ) : null}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setActiveApplicationId(null)} aria-label="Close">
            <X className="size-4" />
          </Button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* ── Overview ──────────────────────────────── */}
          <section className="space-y-3">
            <SectionHeader>Overview</SectionHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Company" value={app.companyName} onChange={(e) => saveField({ companyName: e.target.value })} />
              <Input label="Role" value={app.jobTitle} onChange={(e) => saveField({ jobTitle: e.target.value })} />
              <Select
                label="Role type"
                value={app.roleType}
                options={(Object.keys(ROLE_TYPE_LABELS) as RoleType[]).map((k) => ({
                  value: k,
                  label: ROLE_TYPE_LABELS[k],
                }))}
                onChange={(e) => saveField({ roleType: e.target.value as RoleType })}
              />
              <Input
                label="Specific team"
                value={app.specificTeam ?? app.team ?? ''}
                placeholder="Free text — never forced into a list"
                onChange={(e) => saveField({ specificTeam: e.target.value || undefined })}
              />
              <div className="sm:col-span-2">
                <MultiSelect
                  label="Divisions"
                  options={(Object.keys(DIVISION_LABELS) as Division[]).map((k) => ({
                    value: k,
                    label: DIVISION_LABELS[k],
                  }))}
                  selected={getDivisions(app)}
                  onToggle={(v) => toggleList('divisions', v)}
                />
              </div>
              <div className="sm:col-span-2">
                <MultiSelect
                  label="Specializations"
                  searchable
                  options={(Object.keys(SPECIALIZATION_LABELS) as Specialization[]).map((k) => ({
                    value: k,
                    label: SPECIALIZATION_LABELS[k],
                  }))}
                  selected={getSpecializations(app)}
                  onToggle={(v) => toggleList('specializations', v)}
                />
              </div>
              <Input
                label="Location"
                value={app.location ?? ''}
                onChange={(e) => saveField({ location: e.target.value || undefined })}
              />
              <Input
                label="City"
                value={app.city ?? ''}
                onChange={(e) => saveField({ city: e.target.value || undefined })}
              />
              <Input
                label="Country"
                value={app.country ?? ''}
                onChange={(e) => saveField({ country: e.target.value || undefined })}
              />
              <Select
                label="Status"
                value={app.status}
                options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
                onChange={(e) => saveField({ status: e.target.value as ApplicationStatus })}
              />
              <Input
                label="Deadline"
                type="date"
                value={toDateInput(app.deadline)}
                onChange={(e) => saveField({ deadline: e.target.value || undefined })}
              />
              <Select
                label="Deadline type"
                value={app.deadlineType}
                options={(Object.keys(DEADLINE_TYPE_LABELS) as DeadlineType[]).map((k) => ({
                  value: k,
                  label: DEADLINE_TYPE_LABELS[k],
                }))}
                onChange={(e) => saveField({ deadlineType: e.target.value as DeadlineType })}
              />
            </div>
          </section>

          <Divider />

          {/* ── Company ───────────────────────────────── */}
          <section className="space-y-3">
            <SectionHeader>Company</SectionHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Company type"
                value={app.companyType ?? ''}
                options={[
                  { value: '', label: '—' },
                  ...(Object.keys(COMPANY_TYPE_LABELS) as (keyof typeof COMPANY_TYPE_LABELS)[]).map((k) => ({
                    value: k,
                    label: COMPANY_TYPE_LABELS[k],
                  })),
                ]}
                onChange={(e) => saveField({ companyType: (e.target.value || undefined) as any })}
              />
              <Input
                label="Industry"
                value={app.industry ?? ''}
                onChange={(e) => saveField({ industry: e.target.value || undefined })}
              />
              <Input
                label="Website"
                value={app.companyWebsite ?? ''}
                onChange={(e) => saveField({ companyWebsite: e.target.value || undefined })}
              />
              <Input
                label="Careers page"
                value={app.companyCareersPage ?? ''}
                onChange={(e) => saveField({ companyCareersPage: e.target.value || undefined })}
              />
              <Select
                label="Work arrangement"
                value={app.workArrangement ?? ''}
                options={[
                  { value: '', label: '—' },
                  ...Object.entries(WORK_ARRANGEMENT_LABELS).map(([value, label]) => ({
                    value,
                    label,
                  })),
                ]}
                onChange={(e) => saveField({ workArrangement: (e.target.value || undefined) as any })}
              />
              <Select
                label="Employment type"
                value={app.employmentType ?? ''}
                options={[
                  { value: '', label: '—' },
                  ...Object.entries(EMPLOYMENT_TYPE_LABELS).map(([value, label]) => ({
                    value,
                    label,
                  })),
                ]}
                onChange={(e) => saveField({ employmentType: (e.target.value || undefined) as any })}
              />
              <Input
                label="Team"
                value={app.team ?? ''}
                onChange={(e) => saveField({ team: e.target.value || undefined })}
              />
              <Input
                label="Office"
                value={app.office ?? ''}
                onChange={(e) => saveField({ office: e.target.value || undefined })}
              />
            </div>
            {app.specialization && (
              <p className="text-xs text-[var(--color-muted)]">
                Track: {SPECIALIZATION_LABELS[app.specialization]}
              </p>
            )}
            {app.source && (
              <p className="text-xs text-[var(--color-muted)]">
                Source: {SOURCE_LABELS[app.source]}
              </p>
            )}
          </section>

          <Divider />

          {/* ── Eligibility ─────────────────────────────── */}
          <section className="space-y-3">
            <SectionHeader>Eligibility</SectionHeader>
            <MultiSelect
              label="Eligible university years"
              options={(Object.keys(ELIGIBLE_YEAR_LABELS) as EligibleUniversityYear[]).map((k) => ({
                value: k,
                label: ELIGIBLE_YEAR_LABELS[k],
              }))}
              selected={app.eligibleUniversityYears ?? []}
              onToggle={(v) => toggleList('eligibleUniversityYears', v)}
            />
            <Input
              label="Target graduation years"
              placeholder="e.g. 2027, 2028"
              value={gradDraft ?? (app.targetGraduationYears ?? []).join(', ')}
              onChange={(e) => {
                setGradDraft(e.target.value)
              }}
              onBlur={(e) => {
                const years: number[] = []
                for (const part of e.target.value.split(/[,|\s]+/)) {
                  const year = Number.parseInt(part, 10)
                  if (Number.isFinite(year) && year >= 1900 && year <= 2200 && !years.includes(year)) {
                    years.push(year)
                  }
                }
                setGradDraft(null)
                saveField({ targetGraduationYears: years.length ? years.sort((a, b) => a - b) : undefined })
              }}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Work authorization"
                value={app.workAuthorization ?? ''}
                placeholder="Unknown"
                options={(Object.keys(WORK_AUTH_LABELS) as WorkAuthorization[]).map((k) => ({
                  value: k,
                  label: WORK_AUTH_LABELS[k],
                }))}
                onChange={(e) => saveField({ workAuthorization: (e.target.value || undefined) as WorkAuthorization | undefined })}
              />
            </div>
            <LanguageEditor
              rows={getLanguages(app).map((l) => ({
                language: l.language,
                requirement: l.requirement,
                proficiency: l.proficiency ?? '',
              }))}
              onChange={(rows) => {
                const cleaned = rows
                  .filter((r) => r.language.trim())
                  .map((r) => ({
                    language: r.language.trim(),
                    requirement: r.requirement,
                    ...(r.proficiency.trim() ? { proficiency: r.proficiency.trim() } : {}),
                  }))
                saveField({ languageRequirements: cleaned.length ? cleaned : undefined })
              }}
            />
            <Textarea
              label="Eligibility requirements"
              value={app.eligibilityRequirements ?? ''}
              onChange={(e) => saveField({ eligibilityRequirements: e.target.value || undefined })}
            />
            <Textarea
              label="Visa notes"
              value={app.visaNotes ?? ''}
              onChange={(e) => saveField({ visaNotes: e.target.value || undefined })}
            />
          </section>

          <Divider />

          {/* ── Dates ─────────────────────────────────── */}
          <section className="space-y-3">
            <SectionHeader>Dates</SectionHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Opening date"
                type="date"
                value={toDateInput(app.openingDate)}
                onChange={(e) => saveField({ openingDate: e.target.value || undefined })}
              />
              <Input
                label="Application date"
                type="date"
                value={toDateInput(app.applicationDate)}
                onChange={(e) => saveField({ applicationDate: e.target.value || undefined })}
              />
              <Input
                label="Interview date"
                type="date"
                value={toDateInput(app.interviewDate)}
                onChange={(e) => saveField({ interviewDate: e.target.value || undefined })}
              />
              <Input
                label="Offer deadline"
                type="date"
                value={toDateInput(app.offerDeadline)}
                onChange={(e) => saveField({ offerDeadline: e.target.value || undefined })}
              />
              <Input
                label="Start date"
                type="date"
                value={toDateInput(app.startDate)}
                onChange={(e) => saveField({ startDate: e.target.value || undefined })}
              />
              <Input
                label="End date"
                type="date"
                value={toDateInput(app.endDate)}
                onChange={(e) => saveField({ endDate: e.target.value || undefined })}
              />
              <Input
                label="Closing date"
                type="date"
                value={toDateInput(app.closingDate)}
                onChange={(e) => saveField({ closingDate: e.target.value || undefined })}
              />
              <Input
                label="Duration"
                value={app.duration ?? ''}
                placeholder="e.g. 3 months"
                onChange={(e) => saveField({ duration: e.target.value || undefined })}
              />
              <div className="sm:col-span-2">
                <Textarea
                  label="Timing notes"
                  placeholder="Approximate timing when no exact date is known"
                  value={app.timingNotes ?? ''}
                  onChange={(e) => saveField({ timingNotes: e.target.value || undefined })}
                />
              </div>
            </div>
          </section>

          <Divider />

          {/* ── Application requirements ────────────────── */}
          <section className="space-y-3">
            <SectionHeader>Application Requirements</SectionHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(
                [
                  ['cvRequired', 'CV'],
                  ['coverLetterRequired', 'Cover letter'],
                  ['transcriptRequired', 'Transcript'],
                  ['referencesRequired', 'References'],
                ] as const
              ).map(([key, label]) => (
                <Select
                  key={key}
                  label={`${label} — ${resolveDocRequirement(app[key]) === 'unknown' ? 'unknown' : DOC_REQUIREMENT_LABELS[resolveDocRequirement(app[key])]}`}
                  value={app[key] ?? ''}
                  placeholder="Unknown"
                  options={(Object.keys(DOC_REQUIREMENT_LABELS) as DocumentRequirement[]).map((k) => ({
                    value: k,
                    label: DOC_REQUIREMENT_LABELS[k],
                  }))}
                  onChange={(e) =>
                    saveField({ [key]: (e.target.value || undefined) as DocumentRequirement | undefined })
                  }
                />
              ))}
              <Select
                label="Application questions"
                value={app.applicationQuestions ?? ''}
                placeholder="Unknown"
                options={[
                  { value: 'yes', label: 'Yes' },
                  { value: 'no', label: 'No' },
                  { value: 'unknown', label: 'Unknown' },
                ]}
                onChange={(e) =>
                  saveField({
                    applicationQuestions: (e.target.value || undefined) as
                      | 'yes'
                      | 'no'
                      | 'unknown'
                      | undefined,
                  })
                }
              />
            </div>
            <Textarea
              label="Requirements notes"
              value={app.requirementsNotes ?? ''}
              onChange={(e) => saveField({ requirementsNotes: e.target.value || undefined })}
            />
          </section>

          <Divider />

          {/* ── Assessments ─────────────────────────────── */}
          <section className="space-y-3">
            <SectionHeader>Assessments</SectionHeader>
            {(app.assessments ?? []).length > 0 ? (
              <ul className="space-y-1.5">
                {(app.assessments ?? []).map((a) => (
                  <li key={a} className="flex items-center gap-2 text-sm">
                    <span className="text-[var(--color-success)]">✓</span>
                    {ASSESSMENT_TYPE_LABELS[a] ?? a}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-[var(--color-faint)]">No assessments recorded</p>
            )}
            <MultiSelect
              label="Edit assessments"
              searchable
              options={(Object.keys(ASSESSMENT_TYPE_LABELS) as AssessmentType[]).map((k) => ({
                value: k,
                label: ASSESSMENT_TYPE_LABELS[k],
              }))}
              selected={app.assessments ?? []}
              onToggle={(v) => toggleList('assessments', v)}
            />
            <Textarea
              label="Assessment notes"
              value={app.assessmentNotes ?? ''}
              onChange={(e) => saveField({ assessmentNotes: e.target.value || undefined })}
            />
          </section>

          <Divider />

          {/* ── Recruitment process ─────────────────────── */}
          <section className="space-y-3">
            <SectionHeader>Recruitment Process</SectionHeader>
            <Textarea
              label="Application process"
              value={app.applicationProcess ?? ''}
              onChange={(e) => saveField({ applicationProcess: e.target.value || undefined })}
            />
            <Textarea
              label="Interview process"
              value={app.interviewProcess ?? ''}
              onChange={(e) => saveField({ interviewProcess: e.target.value || undefined })}
            />
            <Textarea
              label="Expected interview timeline"
              value={app.expectedInterviewTimeline ?? ''}
              onChange={(e) => saveField({ expectedInterviewTimeline: e.target.value || undefined })}
            />
          </section>

          <Divider />

          {/* ── My tracking ─────────────────────────────── */}
          <section className="space-y-3">
            <SectionHeader>My Tracking</SectionHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Priority"
                value={app.priority ?? ''}
                placeholder="Select…"
                options={(Object.keys(PRIORITY_LABELS) as Priority[]).map((k) => ({
                  value: k,
                  label: PRIORITY_LABELS[k],
                }))}
                onChange={(e) => saveField({ priority: (e.target.value || undefined) as Priority | undefined })}
              />
              <Select
                label="Recommended timing"
                value={app.recommendedTiming ?? ''}
                placeholder="Unknown"
                options={(Object.keys(RECOMMENDED_TIMING_LABELS) as RecommendedTiming[]).map((k) => ({
                  value: k,
                  label: RECOMMENDED_TIMING_LABELS[k],
                }))}
                onChange={(e) =>
                  saveField({ recommendedTiming: (e.target.value || undefined) as RecommendedTiming | undefined })
                }
              />
              <Input
                label="Next action"
                value={app.nextAction ?? ''}
                onChange={(e) => saveField({ nextAction: e.target.value || undefined })}
              />
              <Input
                label="Next action date"
                type="date"
                value={toDateInput(app.nextActionDate)}
                onChange={(e) => saveField({ nextActionDate: e.target.value || undefined })}
              />
              <Input
                label="Last checked"
                type="date"
                value={toDateInput(app.lastChecked)}
                onChange={(e) => saveField({ lastChecked: e.target.value || undefined })}
              />
              <Input
                label="Information verified"
                type="date"
                value={toDateInput(app.dateInformationVerified)}
                onChange={(e) => saveField({ dateInformationVerified: e.target.value || undefined })}
              />
            </div>
          </section>

          <Divider />

          {/* ── Links ─────────────────────────────────── */}
          <section className="space-y-3">
            <SectionHeader>Links</SectionHeader>
            <div className="space-y-2 text-sm">
              <div className="flex flex-col gap-1.5">
                <ExternalLink href={app.applicationUrl}>Application</ExternalLink>
                <ExternalLink href={app.jobUrl}>Job posting</ExternalLink>
                <ExternalLink href={app.companyUrl || app.companyWebsite}>Company site</ExternalLink>
                <ExternalLink href={app.companyCareersPage}>Careers page</ExternalLink>
                <ExternalLink href={app.sourceUrl}>Source</ExternalLink>
              </div>
            </div>
            <div className="space-y-3">
              <Select
                label="Source"
                value={app.source ?? ''}
                options={[
                  { value: '', label: '—' },
                  ...(Object.keys(SOURCE_LABELS) as (keyof typeof SOURCE_LABELS)[]).map((k) => ({
                    value: k,
                    label: SOURCE_LABELS[k],
                  })),
                ]}
                onChange={(e) => saveField({ source: (e.target.value || undefined) as typeof app.source })}
              />
              <Input
                label="Application URL"
                value={app.applicationUrl ?? ''}
                onChange={(e) => saveField({ applicationUrl: e.target.value || undefined })}
              />
              <Input
                label="Job URL"
                value={app.jobUrl ?? ''}
                onChange={(e) => saveField({ jobUrl: e.target.value || undefined })}
              />
              <Input
                label="Company URL"
                value={app.companyUrl ?? ''}
                onChange={(e) => saveField({ companyUrl: e.target.value || undefined })}
              />
              <Input
                label="Company careers page"
                value={app.companyCareersPage ?? ''}
                onChange={(e) => saveField({ companyCareersPage: e.target.value || undefined })}
              />
              <Input
                label="Source URL"
                value={app.sourceUrl ?? ''}
                onChange={(e) => saveField({ sourceUrl: e.target.value || undefined })}
              />
            </div>
          </section>

          <Divider />

          {/* ── Requirements ──────────────────────────── */}
          <section>
            <SectionHeader>Requirements</SectionHeader>
            {appReqs.length === 0 ? (
              <p className="text-sm text-[var(--color-faint)]">None yet</p>
            ) : (
              <ul className="space-y-2">
                {appReqs.map((req) => (
                  <li
                    key={req.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-[var(--color-border)] px-3 py-2"
                  >
                    <span className="text-sm truncate">{req.name}</span>
                    <Select
                      aria-label={`${req.name} status`}
                      className="h-8 text-xs w-32"
                      value={req.status}
                      options={(Object.keys(REQUIREMENT_STATUS_LABELS) as RequirementStatus[]).map(
                        (k) => ({ value: k, label: REQUIREMENT_STATUS_LABELS[k] }),
                      )}
                      onChange={(e) =>
                        void setRequirementStatus(req.id, e.target.value as RequirementStatus)
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Divider />

          {/* ── Contacts ──────────────────────────────── */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <SectionHeader>Contacts</SectionHeader>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowContactForm((v) => !v)}
              >
                <UserPlus className="size-3.5" />
                Add
              </Button>
            </div>

            {showContactForm && (
              <form
                className="rounded-md border border-[var(--color-border)] p-3 space-y-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!newContact.name.trim()) return
                  void upsertContact({
                    applicationId: app.id,
                    name: newContact.name.trim(),
                    email: newContact.email.trim() || undefined,
                    linkedinUrl: newContact.linkedinUrl.trim() || undefined,
                    notes: newContact.notes.trim() || undefined,
                  })
                  setNewContact({ name: '', email: '', linkedinUrl: '', notes: '' })
                  setShowContactForm(false)
                }}
              >
                <Input
                  placeholder="Name *"
                  value={newContact.name}
                  onChange={(e) => setNewContact((p) => ({ ...p, name: e.target.value }))}
                  required
                />
                <Input
                  placeholder="Email"
                  value={newContact.email}
                  onChange={(e) => setNewContact((p) => ({ ...p, email: e.target.value }))}
                />
                <Input
                  placeholder="LinkedIn URL"
                  value={newContact.linkedinUrl}
                  onChange={(e) => setNewContact((p) => ({ ...p, linkedinUrl: e.target.value }))}
                />
                <Input
                  placeholder="Notes"
                  value={newContact.notes}
                  onChange={(e) => setNewContact((p) => ({ ...p, notes: e.target.value }))}
                />
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowContactForm(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" size="sm">
                    Save
                  </Button>
                </div>
              </form>
            )}

            {appContacts.length === 0 && !showContactForm ? (
              <p className="text-sm text-[var(--color-faint)]">No contacts yet</p>
            ) : (
              <ul className="space-y-2">
                {appContacts.map((c) => (
                  <li
                    key={c.id}
                    className="rounded-md border border-[var(--color-border)] px-3 py-2 space-y-1"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        {c.position ? (
                          <p className="text-xs text-[var(--color-muted)] truncate">{c.position}</p>
                        ) : null}
                        {c.company ? (
                          <p className="text-xs text-[var(--color-muted)] truncate">{c.company}</p>
                        ) : null}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        onClick={() => void deleteContact(c.id)}
                        aria-label={`Delete contact ${c.name}`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--color-muted)]">
                      {c.email && <span>{c.email}</span>}
                      {c.linkedinUrl && (
                        <ExternalLink href={c.linkedinUrl} showIcon={false} className="text-xs">
                          LinkedIn
                        </ExternalLink>
                      )}
                      {c.relationship && <span>{c.relationship}</span>}
                      {c.dateContacted && (
                        <span>Contacted {formatDisplayDate(c.dateContacted)}</span>
                      )}
                    </div>
                    {c.notes && (
                      <p className="text-xs text-[var(--color-faint)] line-clamp-2">{c.notes}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Divider />

          {/* ── Tags ──────────────────────────────────── */}
          <section className="space-y-3">
            <SectionHeader>Tags</SectionHeader>
            {appTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {appTags.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)] px-2.5 py-0.5 text-xs text-[var(--color-muted)]"
                  >
                    {tag.name}
                    <button
                      type="button"
                      className="ml-0.5 text-[var(--color-faint)] hover:text-[var(--color-danger)] transition-colors"
                      aria-label={`Remove tag ${tag.name}`}
                      onClick={() =>
                        saveField({ tagIds: app.tagIds.filter((id) => id !== tag.id) })
                      }
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <form
              className="flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault()
                const trimmed = newTagName.trim()
                if (!trimmed) return
                const tag = await ensureTag(trimmed)
                if (!app.tagIds.includes(tag.id)) {
                  saveField({ tagIds: [...app.tagIds, tag.id] })
                }
                setNewTagName('')
              }}
            >
              <Input
                placeholder="Add tag…"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" size="sm" variant="secondary">
                <Plus className="size-3.5" />
              </Button>
            </form>
          </section>

          <Divider />

          {/* ── Tasks ─────────────────────────────────── */}
          <section className="space-y-2">
            <SectionHeader>Tasks</SectionHeader>
            <ul className="space-y-1.5 mb-2">
              {appTasks.map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={t.completed}
                    onChange={() => void toggleTask(t.id)}
                    className="accent-[var(--color-accent)]"
                  />
                  <span className={t.completed ? 'line-through text-[var(--color-faint)]' : ''}>
                    {t.title}
                  </span>
                  {t.dueDate ? (
                    <span className="text-xs text-[var(--color-faint)] ml-auto">
                      {formatDisplayDate(t.dueDate)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (!newTask.trim()) return
                void upsertTask({
                  title: newTask.trim(),
                  applicationId: app.id,
                  completed: false,
                })
                setNewTask('')
              }}
            >
              <Input
                placeholder="Add a task…"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                className="flex-1"
              />
              <Button type="submit" size="sm" variant="secondary">
                Add
              </Button>
            </form>
          </section>

          <Divider />

          {/* ── Notes ─────────────────────────────────── */}
          <section className="space-y-2">
            <SectionHeader>Notes</SectionHeader>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => {
                if (notes !== (app.notes ?? '')) saveField({ notes: notes || undefined })
              }}
            />
          </section>

          <p className="text-[11px] text-[var(--color-faint)]">
            Updated {formatDisplayDate(app.updatedAt)}
          </p>
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--color-border)] px-5 py-3 flex gap-2 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void archiveApplications([app.id], !app.archived)}
          >
            <Archive className="size-3.5" />
            {app.archived ? 'Restore' : 'Archive'}
          </Button>
          <Button
            variant="danger"
            size="sm"
            className="ml-auto"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        </div>
      </aside>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Application"
        message={`Permanently delete ${app.companyName} — ${app.jobTitle}? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => { void deleteApplications([app.id]); setShowDeleteConfirm(false) }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  )
}
