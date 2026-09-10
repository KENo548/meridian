import { useMemo } from 'react'
import { CalendarView } from '@/components/applications/CalendarView'
import { useMeridianStore } from '@/lib/store'
import { filterApplications } from '@/lib/utils'

export function CalendarPage() {
  const applications = useMeridianStore((s) => s.applications)
  const filters = useMeridianStore((s) => s.filters)

  const visible = useMemo(
    () => filterApplications(applications, filters),
    [applications, filters],
  )

  return (
    <div className="space-y-4 animate-fade-in max-w-6xl">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Calendar</h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          Deadlines mapped across the month.
        </p>
      </div>
      <CalendarView applications={visible} />
    </div>
  )
}
