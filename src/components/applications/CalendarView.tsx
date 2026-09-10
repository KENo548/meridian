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
import { ChevronLeft, ChevronRight, CalendarDays, List } from 'lucide-react'
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
  date: Date
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

const EVENT_ICONS: Record<CalendarEvent['type'], string> = {
  deadline: 'DL',
  interview: 'IV',
  task: 'TS',
  followup: 'FU',
}

const LEGEND: { type: CalendarEvent['type']; label: string }[] = [
  { type: 'deadline', label: 'Deadlines' },
  { type: 'interview', label: 'Interviews' },
  { type: 'task', label: 'Tasks' },
  { type: 'followup', label: 'Follow-ups' },
]

function AgendaView({ events }: { events: CalendarEvent[] }) {
  const setActiveApplicationId = useMeridianStore((s) => s.setActiveApplicationId)
  const today = new Date()

  const grouped = useMemo(() => {
    const sorted = [...events].sort((a, b) => a.date.getTime() - b.date.getTime())
    const map = new Map<string, CalendarEvent[]>()
    for (const event of sorted) {
      const key = format(event.date, 'yyyy-MM-dd')
      const list = map.get(key) ?? []
      list.push(event)
      map.set(key, list)
    }
    return map
  }, [events])

  const dateKeys = useMemo(() => [...grouped.keys()], [grouped])

  if (dateKeys.length === 0) {
    return (
      <div className="p-8 text-center">
        <CalendarDays className="size-8 text-[var(--color-faint)] mx-auto mb-2" />
        <p className="text-sm text-[var(--color-muted)]">No upcoming events</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {dateKeys.map((dateKey) => {
        const date = new Date(dateKey + 'T00:00:00')
        const dayEvents = grouped.get(dateKey) ?? []
        const isToday = isSameDay(date, today)

        return (
          <div key={dateKey} className="border-b border-[var(--color-border)] last:border-b-0">
            <div className={clsx(
              'flex items-center gap-3 px-4 py-2.5',
              isToday ? 'bg-[rgba(212,168,83,0.08)]' : 'bg-[var(--color-surface-2)]/30',
            )}>
              <div className={clsx(
                'w-10 h-10 rounded-lg flex flex-col items-center justify-center shrink-0',
                isToday
                  ? 'bg-[var(--color-accent)] text-[#0a0e16]'
                  : 'bg-[var(--color-surface-2)] text-[var(--color-muted)]',
              )}>
                <span className="text-[10px] font-semibold leading-none">{format(date, 'EEE')}</span>
                <span className="text-sm font-bold leading-none mt-0.5">{format(date, 'd')}</span>
              </div>
              <div>
                <p className="text-xs text-[var(--color-muted)]">{format(date, 'MMMM yyyy')}</p>
                <p className="text-xs text-[var(--color-faint)]">{dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <div className="px-4 py-2 space-y-1.5">
              {dayEvents.map((event, i) => {
                const colors = EVENT_COLORS[event.type]
                return (
                  <button
                    key={`${event.type}-${i}`}
                    type="button"
                    className={clsx(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors',
                      colors.hover,
                    )}
                    style={{ backgroundColor: colors.bg }}
                    onClick={() => event.appId && setActiveApplicationId(event.appId)}
                  >
                    <span className={clsx(
                      'size-7 rounded flex items-center justify-center text-[9px] font-bold shrink-0',
                      colors.text,
                    )} style={{ backgroundColor: colors.bg.replace('0.12', '0.25') }}>
                      {EVENT_ICONS[event.type]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={clsx('text-sm font-medium truncate', colors.text)}>{event.label}</p>
                      <p className="text-[11px] text-[var(--color-faint)] capitalize">{event.type}</p>
                    </div>
                    <span className="text-[11px] text-[var(--color-faint)] shrink-0">
                      {format(date, 'h:mm a')}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function CalendarView({ applications }: CalendarViewProps) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))
  const [mobileView, setMobileView] = useState<'grid' | 'agenda'>('agenda')
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
          date: d,
        })
      }
      const interviewDate = parseDate(app.interviewDate)
      if (interviewDate) {
        addEvent(format(interviewDate, 'yyyy-MM-dd'), {
          type: 'interview',
          label: app.companyName,
          appId: app.id,
          date: interviewDate,
        })
      }
      const followUpDate = parseDate(app.followUpDate)
      if (followUpDate) {
        addEvent(format(followUpDate, 'yyyy-MM-dd'), {
          type: 'followup',
          label: app.companyName,
          appId: app.id,
          date: followUpDate,
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
          date: d,
        })
      }
    }

    return map
  }, [applications, tasks])

  const allEvents = useMemo(() => {
    const events: CalendarEvent[] = []
    byDay.forEach((dayEvents) => events.push(...dayEvents))
    return events
  }, [byDay])

  const today = new Date()

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
        <h3 className="font-display font-semibold text-sm sm:text-base">{format(cursor, 'MMMM yyyy')}</h3>
        <div className="flex items-center gap-1">
          <div className="flex md:hidden bg-[var(--color-surface-2)] rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setMobileView('grid')}
              className={clsx(
                'p-1.5 rounded-md transition-colors',
                mobileView === 'grid'
                  ? 'bg-[var(--color-accent)] text-[#0a0e16]'
                  : 'text-[var(--color-muted)]',
              )}
              aria-label="Grid view"
            >
              <CalendarDays className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setMobileView('agenda')}
              className={clsx(
                'p-1.5 rounded-md transition-colors',
                mobileView === 'agenda'
                  ? 'bg-[var(--color-accent)] text-[#0a0e16]'
                  : 'text-[var(--color-muted)]',
              )}
              aria-label="Agenda view"
            >
              <List className="size-3.5" />
            </button>
          </div>
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

      <div className="hidden md:flex items-center gap-3 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/30">
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

      <div className="md:hidden">
        {mobileView === 'agenda' ? (
          <AgendaView events={allEvents} />
        ) : (
          <>
            <div className="grid grid-cols-7 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/50">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div
                  key={`${d}-${i}`}
                  className="py-2 text-[10px] uppercase tracking-wider text-[var(--color-faint)] text-center"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day) => {
                const key = format(day, 'yyyy-MM-dd')
                const events = byDay.get(key) ?? []
                const inMonth = isSameMonth(day, cursor)
                return (
                  <div
                    key={key}
                    className={clsx(
                      'border-t border-r border-[var(--color-border)]/60 p-1 min-h-[52px]',
                      !inMonth && 'bg-[var(--color-bg)]/40 opacity-50',
                    )}
                  >
                    <div
                      className={clsx(
                        'text-[10px] tabular-nums mb-0.5 w-5 h-5 flex items-center justify-center rounded-full',
                        isSameDay(day, today) &&
                          'bg-[var(--color-accent)] text-[#0a0e16] font-semibold',
                        !isSameDay(day, today) && 'text-[var(--color-muted)]',
                      )}
                    >
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-px">
                      {events.slice(0, 2).map((event, i) => {
                        const colors = EVENT_COLORS[event.type]
                        return (
                          <button
                            key={`${event.type}-${i}`}
                            type="button"
                            className={clsx(
                              'w-full text-left truncate rounded px-0.5 py-px text-[8px] cursor-pointer',
                              colors.text,
                            )}
                            style={{ backgroundColor: colors.bg }}
                            onClick={() => event.appId && setActiveApplicationId(event.appId)}
                            title={`${event.type}: ${event.label}`}
                          >
                            {event.label}
                          </button>
                        )
                      })}
                      {events.length > 2 && (
                        <p className="text-[8px] text-[var(--color-faint)] px-0.5">+{events.length - 2}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      <div className="hidden md:block">
        <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/50">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
            <div
              key={d}
              className="flex-1 px-2 py-2 text-[11px] uppercase tracking-wider text-[var(--color-faint)] text-center"
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
    </div>
  )
}
