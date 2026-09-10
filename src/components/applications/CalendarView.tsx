import { useMemo, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useMeridianStore } from '@/lib/store'
import { parseDate, clsx } from '@/lib/utils'
import type { Application } from '@/types'

interface CalendarViewProps {
  applications: Application[]
}

interface CalendarEvent {
  type: 'deadline' | 'interview' | 'task' | 'followup'
  label: string
  appId?: string
}

const EVENT_COLORS: Record<CalendarEvent['type'], { bg: string; text: string; hover: string }> = {
  deadline: {
    bg: 'rgba(212,168,83,0.12)',
    text: 'text-[var(--color-accent)]',
    hover: 'hover:bg-[rgba(212,168,83,0.22)]',
  },
  interview: {
    bg: 'rgba(20,184,166,0.12)',
    text: 'text-[var(--color-teal)]',
    hover: 'hover:bg-[rgba(20,184,166,0.22)]',
  },
  task: {
    bg: 'rgba(59,130,246,0.12)',
    text: 'text-[var(--color-info)]',
    hover: 'hover:bg-[rgba(59,130,246,0.22)]',
  },
  followup: {
    bg: 'rgba(245,158,11,0.12)',
    text: 'text-[var(--color-warning)]',
    hover: 'hover:bg-[rgba(245,158,11,0.22)]',
  },
}

const LEGEND: { type: CalendarEvent['type']; label: string }[] = [
  { type: 'deadline', label: 'Deadlines' },
  { type: 'interview', label: 'Interviews' },
  { type: 'task', label: 'Tasks' },
  { type: 'followup', label: 'Follow-ups' },
]

export function CalendarView({ applications }: CalendarViewProps) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))
  const setActiveApplicationId = useMeridianStore((s) => s.setActiveApplicationId)
  const tasks = useMeridianStore((s) => s.tasks)

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [cursor])

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()

    const addEvent = (key: string, event: CalendarEvent) => {
      const list = map.get(key) ?? []
      list.push(event)
      map.set(key, list)
    }

    for (const app of applications) {
      const d = parseDate(app.deadline)
      if (d) {
        addEvent(format(d, 'yyyy-MM-dd'), {
          type: 'deadline',
          label: app.companyName,
          appId: app.id,
        })
      }
      const interviewDate = parseDate(app.interviewDate)
      if (interviewDate) {
        addEvent(format(interviewDate, 'yyyy-MM-dd'), {
          type: 'interview',
          label: app.companyName,
          appId: app.id,
        })
      }
      const followUpDate = parseDate(app.followUpDate)
      if (followUpDate) {
        addEvent(format(followUpDate, 'yyyy-MM-dd'), {
          type: 'followup',
          label: app.companyName,
          appId: app.id,
        })
      }
    }

    for (const task of tasks) {
      if (task.completed) continue
      const d = parseDate(task.dueDate)
      if (d) {
        addEvent(format(d, 'yyyy-MM-dd'), {
          type: 'task',
          label: task.title,
          appId: task.applicationId,
        })
      }
    }

    return map
  }, [applications, tasks])

  const today = new Date()

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <h3 className="font-display font-semibold">{format(cursor, 'MMMM yyyy')}</h3>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setCursor((c) => subMonths(c, 1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor(startOfMonth(new Date()))}>
            Today
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setCursor((c) => addMonths(c, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/30">
        {LEGEND.map((item) => {
          const colors = EVENT_COLORS[item.type]
          return (
            <div key={item.type} className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: colors.bg.replace('0.12', '1') }}
              />
              <span className="text-[11px] text-[var(--color-muted)]">{item.label}</span>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-7 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/50">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div
            key={d}
            className="px-2 py-2 text-[11px] uppercase tracking-wider text-[var(--color-faint)] text-center"
          >
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 auto-rows-[minmax(88px,1fr)]">
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd')
          const events = byDay.get(key) ?? []
          const inMonth = isSameMonth(day, cursor)
          return (
            <div
              key={key}
              className={clsx(
                'border-t border-r border-[var(--color-border)]/60 p-1.5 min-h-[88px]',
                !inMonth && 'bg-[var(--color-bg)]/40 opacity-50',
              )}
            >
              <div
                className={clsx(
                  'text-xs tabular-nums mb-1 w-6 h-6 flex items-center justify-center rounded-full',
                  isSameDay(day, today) &&
                    'bg-[var(--color-accent)] text-[#0a0e16] font-semibold',
                  !isSameDay(day, today) && 'text-[var(--color-muted)]',
                )}
              >
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5">
                {events.slice(0, 3).map((event, i) => {
                  const colors = EVENT_COLORS[event.type]
                  return (
                    <button
                      key={`${event.type}-${i}`}
                      type="button"
                      className={clsx(
                        'w-full text-left truncate rounded px-1 py-0.5 text-[10px] cursor-pointer',
                        colors.text,
                        colors.hover,
                      )}
                      style={{ backgroundColor: colors.bg }}
                      onClick={() => event.appId && setActiveApplicationId(event.appId)}
                      title={`${event.type}: ${event.label}`}
                    >
                      {event.label}
                    </button>
                  )
                })}
                {events.length > 3 ? (
                  <p className="text-[10px] text-[var(--color-faint)] px-1">+{events.length - 3}</p>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
