import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import {
  COMPANY_TYPE_LABELS,
  DEADLINE_TYPE_LABELS,
  REQUIREMENT_TYPE_LABELS,
  ROLE_TYPE_LABELS,
  SOURCE_LABELS,
  SPECIALIZATION_LABELS,
  STATUS_LABELS,
  STATUS_ORDER,
} from '@/constants'
import { useMeridianStore } from '@/lib/store'
import { isValidUrl } from '@/lib/utils'
import type {
  ApplicationStatus,
  CompanyType,
  DeadlineType,
  RequirementType,
  RequirementStatus,
  RoleType,
  Source,
  Specialization,
} from '@/types'

const emptyForm = () => ({
  companyName: '',
  jobTitle: '',
  roleType: 'summer_internship' as RoleType,
  division: '',
  specialization: '' as '' | Specialization,
  location: '',
  openingDate: '',
  deadline: '',
  deadlineType: 'specific' as DeadlineType,
  applicationDate: '',
  startDate: '',
  endDate: '',
  duration: '',
  recruitmentCycle: '',
  applicationUrl: '',
  jobUrl: '',
  companyWebsite: '',
  companyCareersPage: '',
  source: '' as '' | Source,
  sourceUrl: '',
  status: 'interested' as ApplicationStatus,
  companyType: '' as '' | CompanyType,
  notes: '',
  followUpDate: '',
})

const STEP_LABELS = ['Role', 'Dates', 'Requirements', 'Links', 'Tracking']

export function AddApplicationWizard() {
  const open = useMeridianStore((s) => s.addWizardOpen)
  const setAddWizardOpen = useMeridianStore((s) => s.setAddWizardOpen)
  const createApplication = useMeridianStore((s) => s.createApplication)
  const pushToast = useMeridianStore((s) => s.pushToast)
  const ensureTag = useMeridianStore((s) => s.ensureTag)
  const tags = useMeridianStore((s) => s.tags)

  const [step, setStep] = useState(0)
  const [form, setForm] = useState(emptyForm)
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

    if (s === 3) {
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

  const submit = async (force = false) => {
    if (!validateStep(0) || !validateStep(3)) {
      if (!validateStep(0)) setStep(0)
      else if (!validateStep(3)) setStep(3)
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

      const result = await createApplication({
        companyName: form.companyName,
        jobTitle: form.jobTitle,
        roleType: form.roleType,
        status: form.status,
        deadlineType: form.deadlineType,
        deadline: form.deadline || undefined,
        openingDate: form.openingDate || undefined,
        location: form.location || undefined,
        division: form.division || undefined,
        specialization: form.specialization || undefined,
        companyType: form.companyType || undefined,
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

  const isLast = step === 4

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
          <Input
            label="Division"
            value={form.division}
            onChange={(e) => patch('division', e.target.value)}
          />
          <Select
            label="Specialization"
            value={form.specialization}
            placeholder="Select…"
            options={(Object.keys(SPECIALIZATION_LABELS) as Specialization[]).map((k) => ({
              value: k,
              label: SPECIALIZATION_LABELS[k],
            }))}
            onChange={(e) => patch('specialization', e.target.value as Specialization | '')}
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
        </div>
      )}

      {step === 2 && (
        <div>
          <p className="text-sm text-[var(--color-muted)] mb-3">
            Select the materials required for this application.
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
      )}

      {step === 3 && (
        <div className="grid sm:grid-cols-2 gap-3">
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
        </div>
      )}

      {step === 4 && (
        <div className="grid sm:grid-cols-2 gap-3">
          <Select
            label="Status"
            value={form.status}
            options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
            onChange={(e) => patch('status', e.target.value as ApplicationStatus)}
          />
          <Select
            label="Company type"
            value={form.companyType}
            placeholder="Select…"
            options={(Object.keys(COMPANY_TYPE_LABELS) as CompanyType[]).map((k) => ({
              value: k,
              label: COMPANY_TYPE_LABELS[k],
            }))}
            onChange={(e) => patch('companyType', e.target.value as CompanyType | '')}
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
