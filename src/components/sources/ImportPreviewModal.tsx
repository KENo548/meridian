import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { STATUS_LABELS, ROLE_TYPE_LABELS, SOURCE_LABELS } from '@/constants'
import { jobToApplication, type JobResult } from '@/lib/jobSources'
import { useMeridianStore } from '@/lib/store'
import { findDuplicate } from '@/lib/utils'
import type { ApplicationStatus, RoleType, Source } from '@/types'
import { AlertTriangle, ExternalLink, MapPin, Building2, Banknote, Briefcase } from 'lucide-react'

interface ImportPreviewModalProps {
  job: JobResult | null
  open: boolean
  onClose: () => void
  onImported: () => void
}

const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({
  value,
  label,
}))

const ROLE_OPTIONS = Object.entries(ROLE_TYPE_LABELS).map(([value, label]) => ({
  value,
  label,
}))

const SOURCE_OPTIONS = Object.entries(SOURCE_LABELS).map(([value, label]) => ({
  value,
  label,
}))

export function ImportPreviewModal({ job, open, onClose, onImported }: ImportPreviewModalProps) {
  const applications = useMeridianStore((s) => s.applications)
  const createApplication = useMeridianStore((s) => s.createApplication)
  const pushToast = useMeridianStore((s) => s.pushToast)

  const [status, setStatus] = useState<ApplicationStatus>('interested')
  const [roleType, setRoleType] = useState<RoleType>('full_time')
  const [source, setSource] = useState<Source>('other')
  const [importing, setImporting] = useState(false)

  if (!job) return null

  const partial = jobToApplication(job)
  const duplicate = findDuplicate(applications, {
    companyName: job.company,
    jobTitle: job.title,
    location: job.location,
  })

  async function handleImport() {
    if (!job) return
    setImporting(true)
    try {
      const result = await createApplication({
        companyId: '',
        companyName: job.company,
        jobTitle: job.title,
        location: job.location,
        city: job.city ?? partial.city ?? '',
        country: job.country ?? partial.country ?? '',
        status,
        roleType,
        source,
        sourceUrl: job.url,
        jobUrl: job.url,
        companyUrl: job.companyUrl,
        deadlineType: job.deadline ? 'specific' : 'unknown',
        deadline: job.deadline,
        notes: partial.notes,
        tagIds: [],
        force: !!duplicate,
      })
      if (result.duplicate) {
        pushToast('info', 'Similar application already exists — imported anyway')
      } else {
        pushToast('success', `Imported ${job.company} — ${job.title}`)
      }
      onImported()
      onClose()
    } catch (err) {
      pushToast('error', 'Failed to import job')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import Job"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleImport} disabled={importing}>
            {importing ? 'Importing...' : 'Import'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {duplicate && (
          <div className="flex items-start gap-3 rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5 p-3">
            <AlertTriangle className="size-4 mt-0.5 shrink-0 text-[var(--color-warning)]" />
            <div>
              <p className="text-sm font-medium text-[var(--color-warning)]">Potential Duplicate</p>
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                A similar application for <strong>{duplicate.jobTitle}</strong> at{' '}
                <strong>{duplicate.companyName}</strong> already exists (status: {STATUS_LABELS[duplicate.status]}).
              </p>
            </div>
          </div>
        )}

        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-[var(--color-text)]">{job.title}</h3>
              <div className="mt-1.5 flex items-center gap-2 text-sm text-[var(--color-muted)]">
                <Building2 className="size-3.5" />
                {job.company}
              </div>
              <div className="mt-1 flex items-center gap-2 text-xs text-[var(--color-faint)]">
                <MapPin className="size-3" />
                {job.location}
              </div>
            </div>
            <Badge tone="accent">{job.source}</Badge>
          </div>

          <div className="mt-3 flex flex-wrap gap-3 text-xs text-[var(--color-muted)]">
            {job.salary && (
              <span className="flex items-center gap-1">
                <Banknote className="size-3" />
                {job.salary}
              </span>
            )}
            {job.type && (
              <span className="flex items-center gap-1">
                <Briefcase className="size-3" />
                {job.type}
              </span>
            )}
            {job.posted && <span>Posted: {job.posted}</span>}
          </div>

          {job.description && (
            <div className="mt-3 text-xs text-[var(--color-faint)] leading-relaxed line-clamp-4">
              {job.description}
            </div>
          )}

          <div className="mt-3">
            <a
              href={job.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-[var(--color-accent)] hover:underline"
            >
              <ExternalLink className="size-3" />
              View original posting
            </a>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
            options={STATUS_OPTIONS}
          />
          <Select
            label="Role Type"
            value={roleType}
            onChange={(e) => setRoleType(e.target.value as RoleType)}
            options={ROLE_OPTIONS}
          />
          <Select
            label="Source"
            value={source}
            onChange={(e) => setSource(e.target.value as Source)}
            options={SOURCE_OPTIONS}
          />
        </div>
      </div>
    </Modal>
  )
}
