import { useMemo } from 'react'
import { useMeridianStore } from '@/lib/store'
import { computeStats, emptyFilters, filterApplications } from '@/lib/utils'
import { ROLE_TYPE_LABELS } from '@/constants'
import { StatCards } from '@/components/dashboard/StatCards'
import { AnalyticsPanel } from '@/components/dashboard/AnalyticsPanel'

export function AnalyticsPage() {
  const applications = useMeridianStore((s) => s.applications)
  const stats = computeStats(applications)

  const byRoleType = useMemo(() => {
    const counts = new Map<string, number>()
    for (const app of applications) {
      if (app.archived) continue
      counts.set(app.roleType, (counts.get(app.roleType) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [applications])

  const upcoming = useMemo(
    () => filterApplications(applications, { ...emptyFilters(), deadlineWithinDays: 14 }),
    [applications],
  )
  const rolling = useMemo(
    () => filterApplications(applications, { ...emptyFilters(), deadlineTypes: ['rolling'] }),
    [applications],
  )

  return (
    <div className="space-y-6 animate-fade-in">
      <header>
        <h1 className="font-display text-2xl font-bold text-[var(--color-text)]">Analytics</h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">Pipeline conversion and distribution</p>
      </header>
      <StatCards />
      <AnalyticsPanel />
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h2 className="font-display font-semibold text-sm text-[var(--color-text)] mb-3">By role type</h2>
          {byRoleType.length === 0 ? (
            <p className="text-sm text-[var(--color-faint)]">No activity yet</p>
          ) : (
            <ul className="space-y-2">
              {byRoleType.map(([role, count]) => (
                <li key={role} className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-muted)]">{ROLE_TYPE_LABELS[role as keyof typeof ROLE_TYPE_LABELS] ?? role}</span>
                  <span className="font-medium text-[var(--color-text)] tabular-nums">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h2 className="font-display font-semibold text-sm text-[var(--color-text)] mb-3">
            Upcoming deadlines <span className="text-[var(--color-faint)] font-normal">(14 days)</span>
          </h2>
          <p className="text-2xl font-bold font-display text-[var(--color-warning)] tabular-nums">{upcoming.length}</p>
          <p className="text-xs text-[var(--color-muted)] mt-1">open opportunities due soon</p>
        </section>
        <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h2 className="font-display font-semibold text-sm text-[var(--color-text)] mb-3">Rolling</h2>
          <p className="text-2xl font-bold font-display text-[var(--color-teal)] tabular-nums">{rolling.length}</p>
          <p className="text-xs text-[var(--color-muted)] mt-1">rolling opportunities tracked</p>
        </section>
      </div>
      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h2 className="font-display font-semibold text-sm text-[var(--color-text)] mb-3">Activity by month</h2>
        {!Object.keys(stats.byMonth).length ? (
          <p className="text-sm text-[var(--color-faint)]">No activity yet</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(stats.byMonth)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([month, count]) => (
                <li
                  key={month}
                  className="flex items-center justify-between rounded-md bg-[var(--color-surface-2)] px-3 py-2 text-sm"
                >
                  <span className="text-[var(--color-muted)] font-mono text-xs">{month}</span>
                  <span className="font-medium text-[var(--color-text)] tabular-nums">{count}</span>
                </li>
              ))}
          </ul>
        )}
      </section>
    </div>
  )
}
