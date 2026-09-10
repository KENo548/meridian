import { useMeridianStore } from '@/lib/store'
import { computeStats } from '@/lib/utils'
import { StatCards } from '@/components/dashboard/StatCards'
import { AnalyticsPanel } from '@/components/dashboard/AnalyticsPanel'

export function AnalyticsPage() {
  const applications = useMeridianStore((s) => s.applications)
  const stats = computeStats(applications)

  return (
    <div className="space-y-6 animate-fade-in">
      <header>
        <h1 className="font-display text-2xl font-bold text-[var(--color-text)]">Analytics</h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">Pipeline conversion and distribution</p>
      </header>
      <StatCards />
      <AnalyticsPanel />
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
