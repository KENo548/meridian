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
import { computeStats, clsx } from '@/lib/utils'
import { useMeridianStore } from '@/lib/store'
import type { LucideIcon } from 'lucide-react'

interface StatDef {
  key: string
  label: string
  value: number | string
  hint?: string
  icon: LucideIcon
  accent?: string
}

export function StatCards() {
  const applications = useMeridianStore((s) => s.applications)
  const stats = computeStats(applications)

  const cards: StatDef[] = [
    {
      key: 'total',
      label: 'Total Applications',
      value: stats.total,
      icon: Briefcase,
      accent: 'text-[var(--color-accent)]',
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
    },
    {
      key: 'interviews',
      label: 'Interviews',
      value: stats.interviews,
      icon: MessageSquare,
      accent: 'text-[var(--color-info)]',
    },
    {
      key: 'offers',
      label: 'Offers',
      value: stats.offers,
      icon: Handshake,
      accent: 'text-[var(--color-success)]',
    },
    {
      key: 'rejections',
      label: 'Rejected',
      value: stats.rejections,
      icon: XCircle,
      accent: 'text-[var(--color-danger)]',
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
        return (
          <div
            key={c.key}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] uppercase tracking-wider text-[var(--color-faint)]">
                {c.label}
              </span>
              <Icon className={clsx('size-4', c.accent ?? 'text-[var(--color-muted)]')} />
            </div>
            <p className="mt-2 font-display text-2xl font-bold tabular-nums">{c.value}</p>
            {c.hint ? <p className="mt-0.5 text-xs text-[var(--color-muted)]">{c.hint}</p> : null}
          </div>
        )
      })}
    </div>
  )
}
