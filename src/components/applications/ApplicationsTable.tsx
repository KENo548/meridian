import { ArrowDown, ArrowUp } from 'lucide-react'
import { DeadlineBadge } from '@/components/ui/DeadlineBadge'
import { Select } from '@/components/ui/Select'
import { PRIORITY_LABELS, STATUS_LABELS, STATUS_ORDER, ROLE_TYPE_LABELS } from '@/constants'
import { useMeridianStore } from '@/lib/store'
import { formatDisplayDate, clsx } from '@/lib/utils'
import type { Application, ApplicationStatus, SortField } from '@/types'

interface ApplicationsTableProps {
  applications: Application[]
}

function SortHeader({
  field,
  label,
  current,
  onSort,
}: {
  field: SortField
  label: string
  current: { field: SortField; direction: 'asc' | 'desc' }
  onSort: (field: SortField) => void
}) {
  const active = current.field === field
  return (
    <button
      type="button"
      className={clsx(
        'inline-flex items-center gap-1 text-[11px] uppercase tracking-wider cursor-pointer',
        active ? 'text-[var(--color-accent)]' : 'text-[var(--color-faint)] hover:text-[var(--color-muted)]',
      )}
      onClick={() => onSort(field)}
    >
      {label}
      {active ? (
        current.direction === 'asc' ? (
          <ArrowUp className="size-3" />
        ) : (
          <ArrowDown className="size-3" />
        )
      ) : null}
    </button>
  )
}

export function ApplicationsTable({ applications }: ApplicationsTableProps) {
  const selectedIds = useMeridianStore((s) => s.selectedIds)
  const setSelectedIds = useMeridianStore((s) => s.setSelectedIds)
  const toggleSelected = useMeridianStore((s) => s.toggleSelected)
  const setActiveApplicationId = useMeridianStore((s) => s.setActiveApplicationId)
  const updateApplication = useMeridianStore((s) => s.updateApplication)
  const sort = useMeridianStore((s) => s.sort)
  const setSort = useMeridianStore((s) => s.setSort)

  const allSelected =
    applications.length > 0 && applications.every((a) => selectedIds.includes(a.id))

  const onSort = (field: SortField) => {
    if (sort.field === field) {
      setSort({ field, direction: sort.direction === 'asc' ? 'desc' : 'asc' })
    } else {
      setSort({ field, direction: field === 'deadline' ? 'asc' : 'asc' })
    }
  }

  return (
    <div className="hidden md:block overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
      <table className="w-full text-sm text-left min-w-[900px]">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/60">
            <th className="px-3 py-2.5 w-10">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() =>
                  setSelectedIds(allSelected ? [] : applications.map((a) => a.id))
                }
                className="accent-[var(--color-accent)]"
                aria-label="Select all"
              />
            </th>
            <th className="px-3 py-2.5">
              <SortHeader field="companyName" label="Company" current={sort} onSort={onSort} />
            </th>
            <th className="px-3 py-2.5">
              <SortHeader field="jobTitle" label="Role" current={sort} onSort={onSort} />
            </th>
            <th className="px-3 py-2.5">
              <SortHeader field="status" label="Status" current={sort} onSort={onSort} />
            </th>
            <th className="px-3 py-2.5">
              <SortHeader field="priority" label="Priority" current={sort} onSort={onSort} />
            </th>
            <th className="px-3 py-2.5">
              <SortHeader field="deadline" label="Deadline" current={sort} onSort={onSort} />
            </th>
            <th className="px-3 py-2.5">
              <SortHeader field="location" label="Location" current={sort} onSort={onSort} />
            </th>
            <th className="px-3 py-2.5">
              <SortHeader field="applicationDate" label="Applied" current={sort} onSort={onSort} />
            </th>
          </tr>
        </thead>
        <tbody>
          {applications.map((app) => {
            const selected = selectedIds.includes(app.id)
            return (
              <tr
                key={app.id}
                className={clsx(
                  'border-b border-[var(--color-border)]/70 hover:bg-[var(--color-surface-2)]/50 cursor-pointer transition-colors',
                  selected && 'bg-[rgba(212,168,83,0.06)]',
                )}
                onClick={() => setActiveApplicationId(app.id)}
              >
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleSelected(app.id)}
                    className="accent-[var(--color-accent)]"
                    aria-label={`Select ${app.companyName}`}
                  />
                </td>
                <td className="px-3 py-2.5">
                  <div className="font-medium text-[var(--color-text)]">{app.companyName}</div>
                  {app.isDemo ? (
                    <span className="text-[10px] text-[var(--color-faint)] uppercase">Demo</span>
                  ) : null}
                </td>
                <td className="px-3 py-2.5">
                  <div className="text-[var(--color-text)]">{app.jobTitle}</div>
                  <div className="text-xs text-[var(--color-muted)]">
                    {ROLE_TYPE_LABELS[app.roleType]}
                  </div>
                </td>
                <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <Select
                    aria-label="Status"
                    className="h-8 text-xs min-w-[140px]"
                    value={app.status}
                    options={STATUS_ORDER.map((s) => ({
                      value: s,
                      label: STATUS_LABELS[s],
                    }))}
                    onChange={(e) => {
                      void updateApplication(app.id, {
                        status: e.target.value as ApplicationStatus,
                      })
                    }}
                  />
                </td>
                <td className="px-3 py-2.5">
                  {app.priority ? (
                    <span
                      className={clsx(
                        'inline-block rounded-full px-2 py-0.5 text-[11px] font-medium',
                        app.priority === 'high' && 'bg-[var(--color-danger)]/15 text-[var(--color-danger)]',
                        app.priority === 'medium' && 'bg-[var(--color-warning)]/15 text-[var(--color-warning)]',
                        app.priority === 'low' && 'bg-[var(--color-surface-3)] text-[var(--color-muted)]',
                      )}
                    >
                      {PRIORITY_LABELS[app.priority]}
                    </span>
                  ) : (
                    <span className="text-[var(--color-faint)]">—</span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-col gap-1 items-start">
                    <DeadlineBadge application={app} />
                    {app.deadline ? (
                      <span className="text-[11px] text-[var(--color-faint)]">
                        {formatDisplayDate(app.deadline)}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-[var(--color-muted)]">
                  {app.location || app.city || '—'}
                </td>
                <td className="px-3 py-2.5 text-[var(--color-muted)]">
                  {formatDisplayDate(app.applicationDate)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
