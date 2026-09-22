import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input } from '@/components/ui/Input'
import { MultiSelect } from '@/components/ui/MultiSelect'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import {
  ASSESSMENT_TYPE_LABELS,
  COMPANY_TYPE_LABELS,
  DEADLINE_TYPE_LABELS,
  DIVISION_LABELS,
  DOC_REQUIREMENT_LABELS,
  ELIGIBLE_YEAR_LABELS,
  PRIORITY_LABELS,
  RECOMMENDED_TIMING_LABELS,
  REQUIREMENT_TYPE_LABELS,
  ROLE_TYPE_LABELS,
  SOURCE_LABELS,
  SPECIALIZATION_LABELS,
  STATUS_LABELS,
  STATUS_ORDER,
  WORK_AUTH_LABELS,
  WORK_MODE_LABELS,
} from '@/constants'
import { useMeridianStore } from '@/lib/store'
import { isValidUrl } from '@/lib/utils'
import type {
  ApplicationStatus,
  AssessmentType,
  CompanyType,
  DeadlineType,
  Division,
  DocumentRequirement,
  EligibleUniversityYear,
  LanguageNeed,
  Priority,
  RecommendedTiming,
  RequirementType,
  RequirementStatus,
  RoleType,
  Source,
  Specialization,
  WorkArrangement,
  WorkAuthorization,
} from '@/types'

const emptyForm = () => ({
  companyName: '',
  jobTitle: '',
  roleType: 'summer_internship' as RoleType,
  divisions: [] as Division[],
  specializations: [] as Specialization[],
  specificTeam: '',
  companyType: '' as '' | CompanyType,
  location: '',
  city: '',
  country: '',
  workArrangement: '' as '' | WorkArrangement,
  eligibleUniversityYears: [] as EligibleUniversityYear[],
  graduationYearsText: '',
  eligibilityRequirements: '',
  visaNotes: '',
  workAuthorization: '' as '' | WorkAuthorization,
  openingDate: '',
  deadline: '',
  deadlineType: 'specific' as DeadlineType,
  applicationDate: '',
  startDate: '',
  endDate: '',
  duration: '',
  recruitmentCycle: '',
  timingNotes: '',
  cvRequired: '' as '' | DocumentRequirement,
  coverLetterRequired: '' as '' | DocumentRequirement,
  transcriptRequired: '' as '' | DocumentRequirement,
  referencesRequired: '' as '' | DocumentRequirement,
  applicationQuestions: '' as '' | 'yes' | 'no' | 'unknown',
  requirementsNotes: '',
  assessments: [] as AssessmentType[],
  assessmentNotes: '',
  applicationProcess: '',
  interviewProcess: '',
  expectedInterviewTimeline: '',
  applicationUrl: '',
  jobUrl: '',
  companyWebsite: '',
  companyCareersPage: '',
  source: '' as '' | Source,
  sourceUrl: '',
  status: 'interested' as ApplicationStatus,
  priority: '' as '' | Priority,
  recommendedTiming: '' as '' | RecommendedTiming,
  nextAction: '',
  nextActionDate: '',
  dateInformationVerified: '',
  notes: '',
  followUpDate: '',
})

const STEP_LABELS = ['Opportunity', 'Eligibility', 'Dates', 'Requirements', 'Process', 'Tracking']
const LINKS_STEP = 5

interface LanguageRow {
  language: string
  requirement: LanguageNeed
  proficiency: string
}

export function AddApplicationWizard() {
  const open = useMeridianStore((s) => s.addWizardOpen)
  const setAddWizardOpen = useMeridianStore((s) => s.setAddWizardOpen)
  const createApplication = useMeridianStore((s) => s.createApplication)
  const pushToast = useMeridianStore((s) => s.pushToast)
  const ensureTag = useMeridianStore((s) => s.ensureTag)
  const tags = useMeridianStore((s) => s.tags)

  const [step, setStep] = useState(0)
  const [form, setForm] = useState(emptyForm)
  const [langRows, setLangRows] = useState<LanguageRow[]>([])
  const [reqMap, setReqMap] = useState<Record<RequirementType, boolean>>(() => {
    const map = {} as Record<RequirementType, boolean>
    for (const key of Object.keys(REQUIREMENT_TYPE_LABELS) as RequirementType[]) {
      map[key] = false
    }
    map.cv = true
    map.cover_letter = true
    return map
  })
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [newTagName, setNewTagName] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [showDuplicateConfirm, setShowDuplicateConfirm] = useState(false)
  const [duplicateTarget, setDuplicateTarget] = useState<{ companyName: string; jobTitle: string } | null>(null)

  const close = () => {
    setAddWizardOpen(false)
    setStep(0)
    setForm(emptyForm())
    setLangRows([])
    setShowDuplicateConfirm(false)
    setDuplicateTarget(null)
    setReqMap(() => {
      const map = {} as Record<RequirementType, boolean>
      for (const key of Object.keys(REQUIREMENT_TYPE_LABELS) as RequirementType[]) {
        map[key] = false
      }
      map.cv = true
      map.cover_letter = true
      return map
    })
    setSelectedTags([])
    setNewTagName('')
    setErrors({})
  }

  const patch = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const toggleList = <T extends string>(key: 'divisions' | 'specializations' | 'eligibleUniversityYears' | 'assessments', value: T) => {
    setForm((f) => {
      const cur = f[key] as unknown as T[]
      return { ...f, [key]: cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value] } as typeof f
    })
  }

  const toggleReq = (type: RequirementType) => {
    setReqMap((m) => ({ ...m, [type]: !m[type] }))
  }

  const toggleTag = (name: string) => {
    setSelectedTags((prev) =>
      prev.includes(name) ? prev.filter((t) => t !== name) : [...prev, name],
    )
  }

  const addNewTag = async () => {
    const name = newTagName.trim()
    if (!name) return
    const tag = await ensureTag(name)
    if (!selectedTags.includes(tag.name)) {
      setSelectedTags((prev) => [...prev, tag.name])
    }
    setNewTagName('')
  }

  const validateStep = (s: number): boolean => {
    const next: Record<string, string> = {}

    if (s === 0) {
      if (!form.companyName.trim()) next.companyName = 'Required'
      if (!form.jobTitle.trim()) next.jobTitle = 'Required'
    }

    if (s === LINKS_STEP) {
      if (form.applicationUrl && !isValidUrl(form.applicationUrl)) next.applicationUrl = 'Invalid URL'
      if (form.jobUrl && !isValidUrl(form.jobUrl)) next.jobUrl = 'Invalid URL'
      if (form.companyWebsite && !isValidUrl(form.companyWebsite))
        next.companyWebsite = 'Invalid URL'
      if (form.companyCareersPage && !isValidUrl(form.companyCareersPage))
        next.companyCareersPage = 'Invalid URL'
      if (form.sourceUrl && !isValidUrl(form.sourceUrl)) next.sourceUrl = 'Invalid URL'
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  const goNext = () => {
    if (!validateStep(step)) return
    setStep((s) => s + 1)
  }

  const parseGraduationYears = (): number[] => {
    const out: number[] = []
    for (const part of form.graduationYearsText.split(/[,|\s]+/)) {
      const year = Number.parseInt(part, 10)
      if (Number.isFinite(year) && year >= 1900 && year <= 2200 && !out.includes(year)) out.push(year)
    }
    return out.sort((a, b) => a - b)
  }

  const submit = async (force = false) => {
    if (!validateStep(0) || !validateStep(LINKS_STEP)) {
      if (!validateStep(0)) setStep(0)
      else if (!validateStep(LINKS_STEP)) setStep(LINKS_STEP)
      return
    }
    setSaving(true)
    try {
      const reqs = (Object.keys(reqMap) as RequirementType[])
        .filter((t) => reqMap[t])
        .map((type) => ({
          type,
          name: REQUIREMENT_TYPE_LABELS[type],
          status: 'required' as RequirementStatus,
        }))

      const tagIds: string[] = []
      for (const tagName of selectedTags) {
        const tag = await ensureTag(tagName)
        tagIds.push(tag.id)
      }

      const languageRequirements = langRows
        .filter((r) => r.language.trim())
        .map((r) => ({
          language: r.language.trim(),
          requirement: r.requirement,
          ...(r.proficiency.trim() ? { proficiency: r.proficiency.trim() } : {}),
        }))

      const result = await createApplication({
        companyName: form.companyName,
        jobTitle: form.jobTitle,
        roleType: form.roleType,
        status: form.status,
        deadlineType: form.deadlineType,
        deadline: form.deadline || undefined,
        openingDate: form.openingDate || undefined,
        location: form.location || undefined,
        city: form.city || undefined,
        country: form.country || undefined,
        workArrangement: form.workArrangement || undefined,
        divisions: form.divisions.length ? form.divisions : undefined,
        specializations: form.specializations.length ? form.specializations : undefined,
        specificTeam: form.specificTeam || undefined,
        companyType: form.companyType || undefined,
        eligibleUniversityYears: form.eligibleUniversityYears.length ? form.eligibleUniversityYears : undefined,
        targetGraduationYears: parseGraduationYears().length ? parseGraduationYears() : undefined,
        eligibilityRequirements: form.eligibilityRequirements || undefined,
        visaNotes: form.visaNotes || undefined,
        workAuthorization: form.workAuthorization || undefined,
        languageRequirements: languageRequirements.length ? languageRequirements : undefined,
        timingNotes: form.timingNotes || undefined,
        source: form.source || undefined,
        applicationUrl: form.applicationUrl || undefined,
        jobUrl: form.jobUrl || undefined,
        notes: form.notes || undefined,
        recruitmentCycle: form.recruitmentCycle || undefined,
        applicationDate: form.applicationDate || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        duration: form.duration || undefined,
        followUpDate: form.followUpDate || undefined,
        companyWebsite: form.companyWebsite || undefined,
        companyCareersPage: form.companyCareersPage || undefined,
        sourceUrl: form.sourceUrl || undefined,
        priority: form.priority || undefined,
        recommendedTiming: form.recommendedTiming || undefined,
        nextAction: form.nextAction || undefined,
        nextActionDate: form.nextActionDate || undefined,
        dateInformationVerified: form.dateInformationVerified || undefined,
        cvRequired: form.cvRequired || undefined,
        coverLetterRequired: form.coverLetterRequired || undefined,
        transcriptRequired: form.transcriptRequired || undefined,
        referencesRequired: form.referencesRequired || undefined,
        applicationQuestions: form.applicationQuestions || undefined,
        requirementsNotes: form.requirementsNotes || undefined,
        assessments: form.assessments.length ? form.assessments : undefined,
        assessmentNotes: form.assessmentNotes || undefined,
        applicationProcess: form.applicationProcess || undefined,
        interviewProcess: form.interviewProcess || undefined,
        expectedInterviewTimeline: form.expectedInterviewTimeline || undefined,
        requirements: reqs,
        tagIds,
        force,
      })

      if (result.duplicate && !force) {
        pushToast('info', 'Possible duplicate — confirm to add anyway')
        setDuplicateTarget({ companyName: result.duplicate.companyName, jobTitle: result.duplicate.jobTitle })
        setShowDuplicateConfirm(true)
        return
      }
      pushToast('success', `Added ${result.app.companyName}`)
      close()
    } finally {
      setSaving(false)
    }
  }

  const isLast = step === STEP_LABELS.length - 1

  const footer = (
    <>
      {step > 0 ? (
        <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
          Back
        </Button>
      ) : (
        <Button variant="ghost" onClick={close}>
          Cancel
        </Button>
      )}
      {isLast ? (
        <Button variant="primary" disabled={saving} onClick={() => void submit()}>
          {saving ? 'Saving…' : 'Create application'}
        </Button>
      ) : (
        <Button variant="primary" onClick={goNext}>
          Continue
        </Button>
      )}
    </>
  )

  const progressWidth = `${((step + 1) / STEP_LABELS.length) * 100}%`

  return (
    <>
    <Modal open={open} onClose={close} title="Add application" size="lg" footer={footer}>
      <div className="mb-5">
        <div className="flex justify-between items-center mb-1.5">
          {STEP_LABELS.map((label, i) => (
            <span
              key={label}
              className={`text-[10px] font-medium ${i <= step ? 'text-[var(--color-accent)]' : 'text-[var(--color-muted)]'}`}
            >
              {label}
            </span>
          ))}
        </div>
        <div className="h-1 bg-[var(--color-surface-3)] rounded-full overflow-hidden">
          <div
            className="h-full bg-[var(--color-accent)] rounded-full transition-all duration-300"
            style={{ width: progressWidth }}
          />
        </div>
      </div>

      {step === 0 && (
        <div className="grid sm:grid-cols-2 gap-3">
          <Input
            label="Company"
            value={form.companyName}
            error={errors.companyName}
            onChange={(e) => patch('companyName', e.target.value)}
            autoFocus
          />
          <Input
            label="Job title"
            value={form.jobTitle}
            error={errors.jobTitle}
            onChange={(e) => patch('jobTitle', e.target.value)}
          />
          <Select
            label="Role type"
            value={form.roleType}
            options={(Object.keys(ROLE_TYPE_LABELS) as RoleType[]).map((k) => ({
              value: k,
              label: ROLE_TYPE_LABELS[k],
            }))}
            onChange={(e) => patch('roleType', e.target.value as RoleType)}
          />
          <Select
            label="Firm category"
            value={form.companyType}
            placeholder="Select…"
            options={(Object.keys(COMPANY_TYPE_LABELS) as CompanyType[]).map((k) => ({
              value: k,
              label: COMPANY_TYPE_LABELS[k],
            }))}
            onChange={(e) => patch('companyType', e.target.value as CompanyType | '')}
          />
          <div className="sm:col-span-2">
            <MultiSelect
              label="Divisions"
              options={(Object.keys(DIVISION_LABELS) as Division[]).map((k) => ({
                value: k,
                label: DIVISION_LABELS[k],
              }))}
              selected={form.divisions}
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
              selected={form.specializations}
              onToggle={(v) => toggleList('specializations', v)}
            />
          </div>
          <Input
            label="Specific team"
            placeholder="e.g. FIG — Banks (free text, never forced into a list)"
            value={form.specificTeam}
            onChange={(e) => patch('specificTeam', e.target.value)}
          />
          <Input
            label="Location"
            value={form.location}
            onChange={(e) => patch('location', e.target.value)}
          />
        </div>
      )}

      {step === 1 && (
        <div className="grid sm:grid-cols-2 gap-3">
          <Input
            label="City"
            value={form.city}
            onChange={(e) => patch('city', e.target.value)}
          />
          <Input
            label="Country"
            value={form.country}
            onChange={(e) => patch('country', e.target.value)}
          />
          <Select
            label="Work mode"
            value={form.workArrangement}
            placeholder="Unknown"
            options={(Object.keys(WORK_MODE_LABELS) as WorkArrangement[]).map((k) => ({
              value: k,
              label: WORK_MODE_LABELS[k],
            }))}
            onChange={(e) => patch('workArrangement', e.target.value as WorkArrangement | '')}
          />
          <Input
            label="Graduation years"
            placeholder="e.g. 2027, 2028"
            value={form.graduationYearsText}
            onChange={(e) => patch('graduationYearsText', e.target.value)}
          />
          <div className="sm:col-span-2">
            <MultiSelect
              label="Eligible university years"
              options={(Object.keys(ELIGIBLE_YEAR_LABELS) as EligibleUniversityYear[]).map((k) => ({
                value: k,
                label: ELIGIBLE_YEAR_LABELS[k],
              }))}
              selected={form.eligibleUniversityYears}
              onToggle={(v) => toggleList('eligibleUniversityYears', v)}
            />
          </div>
          <div className="sm:col-span-2">
            <LanguageEditor rows={langRows} onChange={setLangRows} />
          </div>
          <Select
            label="Work authorization"
            value={form.workAuthorization}
            placeholder="Unknown"
            options={(Object.keys(WORK_AUTH_LABELS) as WorkAuthorization[]).map((k) => ({
              value: k,
              label: WORK_AUTH_LABELS[k],
            }))}
            onChange={(e) => patch('workAuthorization', e.target.value as WorkAuthorization | '')}
          />
          <div className="sm:col-span-2">
            <Textarea
              label="Eligibility notes"
              value={form.eligibilityRequirements}
              onChange={(e) => patch('eligibilityRequirements', e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Textarea
              label="Visa notes"
              value={form.visaNotes}
              onChange={(e) => patch('visaNotes', e.target.value)}
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="grid sm:grid-cols-2 gap-3">
          <Input
            label="Opening date"
            type="date"
            value={form.openingDate}
            onChange={(e) => patch('openingDate', e.target.value)}
          />
          <Input
            label="Deadline"
            type="date"
            value={form.deadline}
            onChange={(e) => patch('deadline', e.target.value)}
          />
          <Select
            label="Deadline type"
            value={form.deadlineType}
            options={(Object.keys(DEADLINE_TYPE_LABELS) as DeadlineType[]).map((k) => ({
              value: k,
              label: DEADLINE_TYPE_LABELS[k],
            }))}
            onChange={(e) => patch('deadlineType', e.target.value as DeadlineType)}
          />
          <Input
            label="Application date"
            type="date"
            value={form.applicationDate}
            onChange={(e) => patch('applicationDate', e.target.value)}
          />
          <Input
            label="Start date"
            type="date"
            value={form.startDate}
            onChange={(e) => patch('startDate', e.target.value)}
          />
          <Input
            label="End date"
            type="date"
            value={form.endDate}
            onChange={(e) => patch('endDate', e.target.value)}
          />
          <Input
            label="Duration"
            placeholder="e.g. 10 weeks"
            value={form.duration}
            onChange={(e) => patch('duration', e.target.value)}
          />
          <Input
            label="Recruitment cycle"
            placeholder="e.g. Summer 2027"
            value={form.recruitmentCycle}
            onChange={(e) => patch('recruitmentCycle', e.target.value)}
          />
          <div className="sm:col-span-2">
            <Textarea
              label="Timing notes"
              placeholder="Approximate timing when no exact date is known — never invents a date"
              value={form.timingNotes}
              onChange={(e) => patch('timingNotes', e.target.value)}
            />
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Select
              label="CV required"
              value={form.cvRequired}
              placeholder="Unknown"
              options={(Object.keys(DOC_REQUIREMENT_LABELS) as DocumentRequirement[]).map((k) => ({
                value: k,
                label: DOC_REQUIREMENT_LABELS[k],
              }))}
              onChange={(e) => patch('cvRequired', e.target.value as DocumentRequirement | '')}
            />
            <Select
              label="Cover letter required"
              value={form.coverLetterRequired}
              placeholder="Unknown"
              options={(Object.keys(DOC_REQUIREMENT_LABELS) as DocumentRequirement[]).map((k) => ({
                value: k,
                label: DOC_REQUIREMENT_LABELS[k],
              }))}
              onChange={(e) => patch('coverLetterRequired', e.target.value as DocumentRequirement | '')}
            />
            <Select
              label="Transcript required"
              value={form.transcriptRequired}
              placeholder="Unknown"
              options={(Object.keys(DOC_REQUIREMENT_LABELS) as DocumentRequirement[]).map((k) => ({
                value: k,
                label: DOC_REQUIREMENT_LABELS[k],
              }))}
              onChange={(e) => patch('transcriptRequired', e.target.value as DocumentRequirement | '')}
            />
            <Select
              label="References required"
              value={form.referencesRequired}
              placeholder="Unknown"
              options={(Object.keys(DOC_REQUIREMENT_LABELS) as DocumentRequirement[]).map((k) => ({
                value: k,
                label: DOC_REQUIREMENT_LABELS[k],
              }))}
              onChange={(e) => patch('referencesRequired', e.target.value as DocumentRequirement | '')}
            />
            <Select
              label="Application questions"
              value={form.applicationQuestions}
              placeholder="Unknown"
              options={[
                { value: 'yes', label: 'Yes' },
                { value: 'no', label: 'No' },
                { value: 'unknown', label: 'Unknown' },
              ]}
              onChange={(e) => patch('applicationQuestions', e.target.value as '' | 'yes' | 'no' | 'unknown')}
            />
            <div className="sm:col-span-2">
              <Textarea
                label="Requirements notes"
                value={form.requirementsNotes}
                onChange={(e) => patch('requirementsNotes', e.target.value)}
              />
            </div>
          </div>
          <MultiSelect
            label="Assessments"
            searchable
            hint="Each type is independently filterable — never a single text blob."
            options={(Object.keys(ASSESSMENT_TYPE_LABELS) as AssessmentType[]).map((k) => ({
              value: k,
              label: ASSESSMENT_TYPE_LABELS[k],
            }))}
            selected={form.assessments}
            onToggle={(v) => toggleList('assessments', v)}
          />
          <Textarea
            label="Assessment notes"
            value={form.assessmentNotes}
            onChange={(e) => patch('assessmentNotes', e.target.value)}
          />
          <div>
            <p className="text-sm text-[var(--color-muted)] mb-3">
              Select the materials required for this application (workflow tracking).
            </p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(REQUIREMENT_TYPE_LABELS) as RequirementType[]).map((type) => {
                const on = reqMap[type]
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleReq(type)}
                    className={`rounded border px-2.5 py-1.5 text-xs cursor-pointer transition-colors ${
                      on
                        ? 'border-[var(--color-accent)] bg-[rgba(212,168,83,0.12)] text-[var(--color-accent)]'
                        : 'border-[var(--color-border)] text-[var(--color-muted)]'
                    }`}
                  >
                    {REQUIREMENT_TYPE_LABELS[type]}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Textarea
              label="Application process"
              placeholder="e.g. Application → Numerical Test → HireVue → AC → Offer"
              value={form.applicationProcess}
              onChange={(e) => patch('applicationProcess', e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Textarea
              label="Interview process"
              value={form.interviewProcess}
              onChange={(e) => patch('interviewProcess', e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Textarea
              label="Expected interview timeline"
              value={form.expectedInterviewTimeline}
              onChange={(e) => patch('expectedInterviewTimeline', e.target.value)}
            />
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="grid sm:grid-cols-2 gap-3">
          <Select
            label="Status"
            value={form.status}
            options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
            onChange={(e) => patch('status', e.target.value as ApplicationStatus)}
          />
          <Select
            label="Priority"
            value={form.priority}
            placeholder="Select…"
            options={(Object.keys(PRIORITY_LABELS) as Priority[]).map((k) => ({
              value: k,
              label: PRIORITY_LABELS[k],
            }))}
            onChange={(e) => patch('priority', e.target.value as Priority | '')}
          />
          <Select
            label="Recommended timing"
            value={form.recommendedTiming}
            placeholder="Unknown"
            options={(Object.keys(RECOMMENDED_TIMING_LABELS) as RecommendedTiming[]).map((k) => ({
              value: k,
              label: RECOMMENDED_TIMING_LABELS[k],
            }))}
            onChange={(e) => patch('recommendedTiming', e.target.value as RecommendedTiming | '')}
          />
          <Input
            label="Next action"
            placeholder="e.g. Submit application"
            value={form.nextAction}
            onChange={(e) => patch('nextAction', e.target.value)}
          />
          <Input
            label="Next action date"
            type="date"
            value={form.nextActionDate}
            onChange={(e) => patch('nextActionDate', e.target.value)}
          />
          <Input
            label="Information verified"
            type="date"
            value={form.dateInformationVerified}
            onChange={(e) => patch('dateInformationVerified', e.target.value)}
          />
          <Input
            label="Application URL"
            value={form.applicationUrl}
            error={errors.applicationUrl}
            onChange={(e) => patch('applicationUrl', e.target.value)}
          />
          <Input
            label="Job posting URL"
            value={form.jobUrl}
            error={errors.jobUrl}
            onChange={(e) => patch('jobUrl', e.target.value)}
          />
          <Input
            label="Company website URL"
            value={form.companyWebsite}
            error={errors.companyWebsite}
            onChange={(e) => patch('companyWebsite', e.target.value)}
          />
          <Input
            label="Company careers page URL"
            value={form.companyCareersPage}
            error={errors.companyCareersPage}
            onChange={(e) => patch('companyCareersPage', e.target.value)}
          />
          <Select
            label="Source"
            value={form.source}
            placeholder="Select…"
            options={(Object.keys(SOURCE_LABELS) as Source[]).map((k) => ({
              value: k,
              label: SOURCE_LABELS[k],
            }))}
            onChange={(e) => patch('source', e.target.value as Source | '')}
          />
          <Input
            label="Source URL"
            value={form.sourceUrl}
            error={errors.sourceUrl}
            onChange={(e) => patch('sourceUrl', e.target.value)}
          />
          <div className="sm:col-span-2">
            <Textarea
              label="Notes"
              value={form.notes}
              onChange={(e) => patch('notes', e.target.value)}
            />
          </div>
          <Input
            label="Follow-up date"
            type="date"
            value={form.followUpDate}
            onChange={(e) => patch('followUpDate', e.target.value)}
          />
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-[var(--color-muted)] mb-1.5">
              Tags
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => {
                const on = selectedTags.includes(tag.name)
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.name)}
                    className={`rounded border px-2.5 py-1.5 text-xs cursor-pointer transition-colors ${
                      on
                        ? 'border-[var(--color-accent)] bg-[rgba(212,168,83,0.12)] text-[var(--color-accent)]'
                        : 'border-[var(--color-border)] text-[var(--color-muted)]'
                    }`}
                  >
                    {tag.name}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="New tag name…"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
              />
              <Button variant="ghost" onClick={() => void addNewTag()}>
                Add tag
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>

      <ConfirmDialog
        open={showDuplicateConfirm}
        title="Possible Duplicate"
        message={`Looks similar to ${duplicateTarget?.companyName} — ${duplicateTarget?.jobTitle}. Add anyway?`}
        confirmLabel="Add anyway"
        variant="warning"
        onConfirm={() => { setShowDuplicateConfirm(false); void submit(true) }}
        onCancel={() => { setShowDuplicateConfirm(false); setDuplicateTarget(null) }}
      />
    </>
  )
}

export function LanguageEditor({
  rows,
  onChange,
}: {
  rows: LanguageRow[]
  onChange: (rows: LanguageRow[]) => void
}) {
  const patchRow = (index: number, patch: Partial<LanguageRow>) => {
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }

  return (
    <div>
      <span className="text-[var(--color-muted)] font-medium text-xs tracking-wide uppercase">
        Languages
      </span>
      <p className="text-[11px] text-[var(--color-faint)] mb-1.5">
        Whether each language is required or preferred matters more than proficiency levels.
      </p>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-[1fr_110px_1fr_auto] gap-2 items-center">
            <Input
              placeholder="Language"
              value={row.language}
              onChange={(e) => patchRow(i, { language: e.target.value })}
            />
            <select
              value={row.requirement}
              onChange={(e) => patchRow(i, { requirement: e.target.value as LanguageNeed })}
              aria-label={`Language requirement for ${row.language || 'row ' + (i + 1)}`}
              className="h-9 rounded-md bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs text-[var(--color-text)]"
            >
              <option value="required">Required</option>
              <option value="preferred">Preferred</option>
              <option value="optional">Optional</option>
              <option value="unknown">Unknown</option>
            </select>
            <Input
              placeholder="Proficiency (optional)"
              value={row.proficiency}
              onChange={(e) => patchRow(i, { proficiency: e.target.value })}
            />
            <Button
              variant="ghost"
              aria-label={`Remove ${row.language || 'language'} requirement`}
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
            >
              ×
            </Button>
          </div>
        ))}
        <Button
          variant="ghost"
          onClick={() => onChange([...rows, { language: '', requirement: 'unknown' as LanguageNeed, proficiency: '' }])}
        >
          + Add language
        </Button>
      </div>
    </div>
  )
}
