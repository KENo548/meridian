import { StatusBadge } from '@/components/ui/StatusBadge'
import { DeadlineBadge } from '@/components/ui/DeadlineBadge'
import { ROLE_TYPE_LABELS } from '@/constants'
import { useMeridianStore } from '@/lib/store'
import { clsx } from '@/lib/utils'
import type { Application } from '@/types'

interface ApplicationCardListProps {
  applications: Application[]
}

export function ApplicationCardList({ applications }: ApplicationCardListProps) {
  const selectedIds = useMeridianStore((s) => s.selectedIds)
  const toggleSelected = useMeridianStore((s) => s.toggleSelected)
  const setActiveApplicationId = useMeridianStore((s) => s.setActiveApplicationId)

  return (
    <div className="md:hidden space-y-2">
      {applications.map((app) => {
        const selected = selectedIds.includes(app.id)
        return (
          <article
            key={app.id}
            className={clsx(
              'rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 cursor-pointer',
              selected && 'border-[var(--color-accent)]',
            )}
            onClick={() => setActiveApplicationId(app.id)}
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={selected}
                onChange={() => toggleSelected(app.id)}
                onClick={(e) => e.stopPropagation()}
                className="mt-1 accent-[var(--color-accent)]"
                aria-label={`Select ${app.companyName}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-medium truncate">{app.companyName}</h3>
                    <p className="text-sm text-[var(--color-muted)] truncate">{app.jobTitle}</p>
                  </div>
                  <StatusBadge status={app.status} />
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--color-faint)]">
                  <DeadlineBadge application={app} />
                  <span>{ROLE_TYPE_LABELS[app.roleType]}</span>
                  {app.location || app.city ? <span>{app.location || app.city}</span> : null}
                </div>
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}
