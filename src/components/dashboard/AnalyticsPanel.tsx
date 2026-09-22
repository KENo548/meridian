import { useNavigate } from 'react-router-dom'
import { STATUS_LABELS } from '@/constants'
import { computeStats, emptyFilters } from '@/lib/utils'
import { useMeridianStore } from '@/lib/store'
import type { ApplicationStatus } from '@/types'

export function AnalyticsPanel() {
  const applications = useMeridianStore((s) => s.applications)
  const setFilters = useMeridianStore((s) => s.setFilters)
  const navigate = useNavigate()
  const stats = computeStats(applications)

  const openStatusList = (status: ApplicationStatus) => {
    setFilters({ ...emptyFilters(), statuses: [status] })
    navigate('/applications')
  }

  const openCompanyList = (name: string) => {
    setFilters({ ...emptyFilters(), search: name })
    navigate('/applications')
  }

  const statusEntries = Object.entries(stats.byStatus)
    .map(([k, v]) => ({ status: k as ApplicationStatus, count: v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  const companyEntries = Object.entries(stats.byCompany)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)

  const maxStatus = Math.max(1, ...statusEntries.map((e) => e.count))
  const maxCompany = Math.max(1, ...companyEntries.map((e) => e[1]))

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h3 className="font-display font-semibold mb-1">Pipeline by status</h3>
        <p className="text-xs text-[var(--color-muted)] mb-4">
          Response {stats.responseRate}% · Interview {stats.interviewRate}% · Offer {stats.offerRate}%
        </p>
        {statusEntries.length === 0 ? (
          <p className="text-sm text-[var(--color-faint)]">No data yet.</p>
        ) : (
          <ul className="space-y-2.5">
            {statusEntries.map((e) => (
              <li key={e.status}>
                <button
                  type="button"
                  onClick={() => openStatusList(e.status)}
                  title={`View ${STATUS_LABELS[e.status] ?? e.status} applications`}
                  className="w-full text-left cursor-pointer rounded-md px-1 -mx-1 transition-colors hover:bg-[var(--color-surface-2)]"
                >
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[var(--color-muted)]">
                      {STATUS_LABELS[e.status] ?? e.status}
                    </span>
                    <span className="tabular-nums text-[var(--color-text)]">{e.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--color-surface-3)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--color-accent)]"
                      style={{ width: `${(e.count / maxStatus) * 100}%` }}
                    />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h3 className="font-display font-semibold mb-1">Top companies</h3>
        <p className="text-xs text-[var(--color-muted)] mb-4">
          Avg days to interview:{' '}
          {stats.avgDaysToInterview != null ? stats.avgDaysToInterview : '—'}
        </p>
        {companyEntries.length === 0 ? (
          <p className="text-sm text-[var(--color-faint)]">No data yet.</p>
        ) : (
          <ul className="space-y-2.5">
            {companyEntries.map(([name, count]) => (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => openCompanyList(name)}
                  title={`View ${name} applications`}
                  className="w-full text-left cursor-pointer rounded-md px-1 -mx-1 transition-colors hover:bg-[var(--color-surface-2)]"
                >
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[var(--color-muted)] truncate pr-2">{name}</span>
                    <span className="tabular-nums text-[var(--color-text)]">{count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--color-surface-3)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--color-teal)]"
                      style={{ width: `${(count / maxCompany) * 100}%` }}
                    />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
