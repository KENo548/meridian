import { useEffect, useState } from 'react'
import { X, Trash2, Archive, Plus, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Textarea } from '@/components/ui/Textarea'
import { ExternalLink } from '@/components/ui/ExternalLink'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { DeadlineBadge } from '@/components/ui/DeadlineBadge'
import {
  STATUS_LABELS,
  STATUS_ORDER,
  DEADLINE_TYPE_LABELS,
  REQUIREMENT_STATUS_LABELS,
  COMPANY_TYPE_LABELS,
  SOURCE_LABELS,
  SPECIALIZATION_LABELS,
} from '@/constants'
import { useMeridianStore } from '@/lib/store'
import { toDateInput, formatDisplayDate, clsx } from '@/lib/utils'
import type {
  ApplicationStatus,
  DeadlineType,
  RequirementStatus,
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

  useEffect(() => {
    setNotes(app?.notes ?? '')
  }, [app?.id, app?.notes])

  if (!app) return null

  const appReqs = requirements.filter((r) => r.applicationId === app.id)
  const appTasks = tasks.filter((t) => t.applicationId === app.id)
  const appContacts = contacts.filter((c) => c.applicationId === app.id)
  const appTags = allTags.filter((t) => app.tagIds.includes(t.id))

  const saveField = (patch: Parameters<typeof updateApplication>[1]) => {
    void updateApplication(app.id, patch)
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
            onClick={() => {
              if (window.confirm('Delete this application?')) {
                void deleteApplications([app.id])
              }
            }}
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        </div>
      </aside>
    </>
  )
}
