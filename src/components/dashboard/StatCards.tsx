import {
  Briefcase,
  CalendarClock,
  TrendingUp,
  MessageSquare,
  Handshake,
  XCircle,
  Percent,
  Clock,
  BarChart3,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { computeStats, emptyFilters, clsx } from '@/lib/utils'
import { useMeridianStore } from '@/lib/store'
import { INTERVIEW_STATUSES, OPEN_STATUSES } from '@/constants'
import type { LucideIcon } from 'lucide-react'
import type { ApplicationFilters, ApplicationStatus } from '@/types'

interface StatDef {
  key: string
  label: string
  value: number | string
  hint?: string
  icon: LucideIcon
  accent?: string
  /** Exact store filter for the card's cohort; absent = not linkable. */
  filter?: Partial<ApplicationFilters>
}

export function StatCards() {
  const applications = useMeridianStore((s) => s.applications)
  const setFilters = useMeridianStore((s) => s.setFilters)
  const navigate = useNavigate()
  const stats = computeStats(applications)

  const openList = (filter: Partial<ApplicationFilters>) => {
    setFilters({ ...emptyFilters(), ...filter })
    navigate('/applications')
  }

  const cards: StatDef[] = [
    {
      key: 'total',
      label: 'Total Applications',
      value: stats.total,
      icon: Briefcase,
      accent: 'text-[var(--color-accent)]',
      filter: {},
    },
    {
      key: 'thisWeek',
      label: 'This Week',
      value: stats.thisWeek,
      icon: CalendarClock,
      accent: 'text-[var(--color-teal)]',
    },
    {
      key: 'thisMonth',
      label: 'This Month',
      value: stats.thisMonth,
      icon: BarChart3,
      accent: 'text-[var(--color-info)]',
    },
    {
      key: 'open',
      label: 'Open',
      value: stats.open,
      icon: TrendingUp,
      accent: 'text-[var(--color-teal)]',
      filter: { statuses: OPEN_STATUSES },
    },
    {
      key: 'interviews',
      label: 'Interviews',
      value: stats.interviews,
      icon: MessageSquare,
      accent: 'text-[var(--color-info)]',
      filter: { statuses: INTERVIEW_STATUSES },
    },
    {
      key: 'offers',
      label: 'Offers',
      value: stats.offers,
      icon: Handshake,
      accent: 'text-[var(--color-success)]',
      filter: { statuses: ['offer', 'accepted'] as ApplicationStatus[] },
    },
    {
      key: 'rejections',
      label: 'Rejected',
      value: stats.rejections,
      icon: XCircle,
      accent: 'text-[var(--color-danger)]',
      filter: { statuses: ['rejected'] as ApplicationStatus[] },
    },
    {
      key: 'deadlines',
      label: 'Due Soon',
      value: stats.upcomingDeadlines,
      hint: 'This week',
      icon: Clock,
      accent: 'text-[var(--color-warning)]',
    },
    {
      key: 'responseRate',
      label: 'Response Rate',
      value: `${stats.responseRate}%`,
      icon: Percent,
      accent: 'text-[var(--color-accent)]',
    },
    {
      key: 'interviewRate',
      label: 'Interview Rate',
      value: `${stats.interviewRate}%`,
      icon: Percent,
      accent: 'text-[var(--color-info)]',
    },
    {
      key: 'offerRate',
      label: 'Offer Rate',
      value: `${stats.offerRate}%`,
      icon: Percent,
      accent: 'text-[var(--color-success)]',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6 gap-3">
      {cards.map((c) => {
        const Icon = c.icon
        const body = (
          <>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] uppercase tracking-wider text-[var(--color-faint)]">
                {c.label}
              </span>
              <Icon className={clsx('size-4', c.accent ?? 'text-[var(--color-muted)]')} />
            </div>
            <p className="mt-2 font-display text-2xl font-bold tabular-nums">{c.value}</p>
            {c.hint ? <p className="mt-0.5 text-xs text-[var(--color-muted)]">{c.hint}</p> : null}
          </>
        )
        // Only cohorts with an exact store filter become links; aggregates
        // (periods, rates, urgency) stay static rather than mislead.
        return c.filter ? (
          <button
            key={c.key}
            type="button"
            onClick={() => openList(c.filter as Partial<ApplicationFilters>)}
            title={`View ${c.label} applications`}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-left w-full cursor-pointer transition-colors hover:border-[var(--color-accent)]"
          >
            {body}
          </button>
        ) : (
          <div
            key={c.key}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3"
          >
            {body}
          </div>
        )
      })}
    </div>
  )
}
