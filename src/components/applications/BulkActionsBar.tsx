import { useState } from 'react'
import { Archive, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { STATUS_LABELS, STATUS_ORDER } from '@/constants'
import { useMeridianStore } from '@/lib/store'
import type { ApplicationStatus } from '@/types'

export function BulkActionsBar() {
  const selectedIds = useMeridianStore((s) => s.selectedIds)
  const setSelectedIds = useMeridianStore((s) => s.setSelectedIds)
  const bulkUpdateStatus = useMeridianStore((s) => s.bulkUpdateStatus)
  const archiveApplications = useMeridianStore((s) => s.archiveApplications)
  const deleteApplications = useMeridianStore((s) => s.deleteApplications)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  if (!selectedIds.length) return null

  return (
    <div className="sticky bottom-4 z-20 mx-auto max-w-3xl rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-2)] shadow-xl px-3 sm:px-4 py-2.5 sm:py-3 flex flex-wrap items-center gap-2 sm:gap-3 animate-fade-in">
      <span className="text-sm font-medium text-[var(--color-text)]">
        {selectedIds.length} selected
      </span>
      <div className="w-36 sm:w-44">
        <Select
          aria-label="Bulk status"
          placeholder="Set status…"
          value=""
          options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
          onChange={(e) => {
            const status = e.target.value as ApplicationStatus
            if (status) void bulkUpdateStatus(selectedIds, status)
          }}
        />
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setShowArchiveConfirm(true)}
      >
        <Archive className="size-3.5" />
        Archive
      </Button>
      <Button
        variant="danger"
        size="sm"
        onClick={() => setShowDeleteConfirm(true)}
      >
        <Trash2 className="size-3.5" />
        Delete
      </Button>
      <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelectedIds([])}>
        <X className="size-3.5" />
        Clear
      </Button>

      <ConfirmDialog
        open={showArchiveConfirm}
        title="Archive Applications"
        message={`Archive ${selectedIds.length} selected application(s)? They'll be hidden from the main list but not deleted.`}
        confirmLabel="Archive"
        variant="warning"
        onConfirm={() => { void archiveApplications(selectedIds, true); setShowArchiveConfirm(false) }}
        onCancel={() => setShowArchiveConfirm(false)}
      />
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Applications"
        message={`Permanently delete ${selectedIds.length} selected application(s)? This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => { void deleteApplications(selectedIds); setShowDeleteConfirm(false) }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  )
}
