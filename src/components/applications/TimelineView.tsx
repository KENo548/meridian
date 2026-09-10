import { useMemo } from 'react'
import { format } from 'date-fns'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { DeadlineBadge } from '@/components/ui/DeadlineBadge'
import { useMeridianStore } from '@/lib/store'
import { parseDate, daysUntilDeadline, formatDisplayDate } from '@/lib/utils'
import type { Application } from '@/types'

interface TimelineViewProps {
  applications: Application[]
}

export function TimelineView({ applications }: TimelineViewProps) {
  const setActiveApplicationId = useMeridianStore((s) => s.setActiveApplicationId)

  const groups = useMemo(() => {
    const withDeadline = applications
      .map((app) => ({ app, date: parseDate(app.deadline) }))
      .filter((x): x is { app: Application; date: Date } => Boolean(x.date))
      .sort((a, b) => a.date.getTime() - b.date.getTime())

    const map = new Map<string, Application[]>()
    for (const { app, date } of withDeadline) {
      const key = format(date, 'yyyy-MM')
      const list = map.get(key) ?? []
      list.push(app)
      map.set(key, list)
    }
    return [...map.entries()]
  }, [applications])

  const rolling = applications.filter(
    (a) => a.deadlineType === 'rolling' || a.deadlineType === 'until_filled',
  )
  const unknown = applications.filter(
    (a) => !a.deadline && a.deadlineType !== 'rolling' && a.deadlineType !== 'until_filled',
  )

  if (!groups.length && !rolling.length && !unknown.length) {
    return (
      <p className="text-sm text-[var(--color-muted)] py-8 text-center">
        No dated applications to show on the timeline.
      </p>
    )
  }

  return (
    <div className="space-y-8">
      {groups.map(([monthKey, apps]) => {
        const labelDate = parseDate(`${monthKey}-01`)
        return (
          <section key={monthKey}>
            <h3 className="font-display font-semibold text-[var(--color-accent)] mb-3">
              {labelDate ? format(labelDate, 'MMMM yyyy') : monthKey}
            </h3>
            <ol className="relative border-l border-[var(--color-border)] ml-3 space-y-3">
              {apps.map((app) => {
                const days = daysUntilDeadline(app)
                return (
                  <li key={app.id} className="ml-4 relative">
                    <span className="absolute -left-[1.3rem] top-3 size-2.5 rounded-full bg-[var(--color-accent)] border-2 border-[var(--color-bg)]" />
                    <button
                      type="button"
                      className="w-full text-left rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 hover:border-[var(--color-border-strong)] cursor-pointer"
                      onClick={() => setActiveApplicationId(app.id)}
                    >
                      <div className="flex flex-wrap items-center gap-2 justify-between">
                        <div>
                          <p className="font-medium">{app.companyName}</p>
                          <p className="text-sm text-[var(--color-muted)]">{app.jobTitle}</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <StatusBadge status={app.status} />
                          <DeadlineBadge application={app} />
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-[var(--color-faint)]">
                        Deadline {formatDisplayDate(app.deadline)}
                        {days != null ? ` · ${days}d` : ''}
                        {app.location || app.city ? ` · ${app.location || app.city}` : ''}
                      </p>
                    </button>
                  </li>
                )
              })}
            </ol>
          </section>
        )
      })}

      {rolling.length > 0 ? (
        <section>
          <h3 className="font-display font-semibold text-[var(--color-teal)] mb-3">Rolling</h3>
          <div className="space-y-2">
            {rolling.map((app) => (
              <button
                key={app.id}
                type="button"
                className="w-full text-left rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 cursor-pointer"
                onClick={() => setActiveApplicationId(app.id)}
              >
                <p className="font-medium">{app.companyName}</p>
                <p className="text-sm text-[var(--color-muted)]">{app.jobTitle}</p>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {unknown.length > 0 ? (
        <section>
          <h3 className="font-display font-semibold text-[var(--color-faint)] mb-3">No deadline</h3>
          <div className="space-y-2">
            {unknown.map((app) => (
              <button
                key={app.id}
                type="button"
                className="w-full text-left rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 cursor-pointer"
                onClick={() => setActiveApplicationId(app.id)}
              >
                <p className="font-medium">{app.companyName}</p>
                <p className="text-sm text-[var(--color-muted)]">{app.jobTitle}</p>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
