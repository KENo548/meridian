import { Link } from 'react-router-dom'
import { Briefcase, Plus } from 'lucide-react'
import { StatCards } from '@/components/dashboard/StatCards'
import { UpcomingTasks } from '@/components/dashboard/UpcomingTasks'
import { AnalyticsPanel } from '@/components/dashboard/AnalyticsPanel'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { DeadlineBadge } from '@/components/ui/DeadlineBadge'
import { useMeridianStore } from '@/lib/store'
import { filterApplications, sortApplications, getDeadlineUrgency } from '@/lib/utils'

export function DashboardPage() {
  const applications = useMeridianStore((s) => s.applications)
  const hydrated = useMeridianStore((s) => s.hydrated)
  const filters = useMeridianStore((s) => s.filters)
  const setAddWizardOpen = useMeridianStore((s) => s.setAddWizardOpen)
  const setActiveApplicationId = useMeridianStore((s) => s.setActiveApplicationId)

  const active = filterApplications(applications, { ...filters, search: '', statuses: [] })
  const urgent = sortApplications(
    active.filter((a) => {
      const u = getDeadlineUrgency(a)
      return u === 'overdue' || u === 'due_today' || u === 'due_tomorrow' || u === 'due_this_week'
    }),
    { field: 'deadline', direction: 'asc' },
  ).slice(0, 6)

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            Pipeline overview for your finance recruiting season.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/applications">
            <Button variant="secondary" size="sm">
              <Briefcase className="size-3.5" />
              All applications
            </Button>
          </Link>
          <Button variant="primary" size="sm" onClick={() => setAddWizardOpen(true)}>
            <Plus className="size-3.5" />
            Add
          </Button>
        </div>
      </div>

      {!hydrated ? (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-8">
          <p className="text-sm text-[var(--color-faint)]">Loading your data…</p>
        </div>
      ) : applications.filter((a) => !a.archived).length === 0 ? (
        <EmptyState
          icon={<Briefcase className="size-10" />}
          onAction={() => setAddWizardOpen(true)}
        />
      ) : (
        <>
          <StatCards />
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                <h3 className="font-display font-semibold mb-3">Upcoming deadlines</h3>
                {urgent.length === 0 ? (
                  <p className="text-sm text-[var(--color-faint)]">Nothing urgent this week.</p>
                ) : (
                  <ul className="space-y-2">
                    {urgent.map((app) => (
                      <li key={app.id}>
                        <button
                          type="button"
                          className="w-full flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-[var(--color-surface-2)] text-left cursor-pointer"
                          onClick={() => setActiveApplicationId(app.id)}
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{app.companyName}</p>
                            <p className="text-xs text-[var(--color-muted)] truncate">
                              {app.jobTitle}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <StatusBadge status={app.status} />
                            <DeadlineBadge application={app} />
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <AnalyticsPanel />
            </div>
            <UpcomingTasks />
          </div>
        </>
      )}
    </div>
  )
}
