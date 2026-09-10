import { Archive, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { STATUS_LABELS, STATUS_ORDER } from '@/constants'
import { useMeridianStore } from '@/lib/store'
import type { ApplicationStatus } from '@/types'

export function BulkActionsBar() {
  const selectedIds = useMeridianStore((s) => s.selectedIds)
  const setSelectedIds = useMeridianStore((s) => s.setSelectedIds)
  const bulkUpdateStatus = useMeridianStore((s) => s.bulkUpdateStatus)
  const archiveApplications = useMeridianStore((s) => s.archiveApplications)
  const deleteApplications = useMeridianStore((s) => s.deleteApplications)

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
        onClick={() => void archiveApplications(selectedIds, true)}
      >
        <Archive className="size-3.5" />
        Archive
      </Button>
      <Button
        variant="danger"
        size="sm"
        onClick={() => {
          if (window.confirm(`Delete ${selectedIds.length} application(s)?`)) {
            void deleteApplications(selectedIds)
          }
        }}
      >
        <Trash2 className="size-3.5" />
        Delete
      </Button>
      <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelectedIds([])}>
        <X className="size-3.5" />
        Clear
      </Button>
    </div>
  )
}
