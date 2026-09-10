import { format, parseISO, isValid } from 'date-fns'
import { CheckSquare } from 'lucide-react'
import { useMeridianStore } from '@/lib/store'
import { formatDisplayDate, clsx } from '@/lib/utils'
import { EmptyState } from '@/components/ui/EmptyState'

export function UpcomingTasks() {
  const tasks = useMeridianStore((s) => s.tasks)
  const applications = useMeridianStore((s) => s.applications)
  const toggleTask = useMeridianStore((s) => s.toggleTask)
  const setActiveApplicationId = useMeridianStore((s) => s.setActiveApplicationId)

  const upcoming = [...tasks]
    .filter((t) => !t.completed)
    .sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return a.dueDate.localeCompare(b.dueDate)
    })
    .slice(0, 8)

  if (!upcoming.length) {
    return (
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h3 className="font-display font-semibold text-[var(--color-text)]">Upcoming tasks</h3>
        <EmptyState
          title="No open tasks"
          description="Tasks linked to applications will show up here."
          className="border-0 bg-transparent py-8"
        />
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center gap-2 mb-3">
        <CheckSquare className="size-4 text-[var(--color-accent)]" />
        <h3 className="font-display font-semibold">Upcoming tasks</h3>
      </div>
      <ul className="space-y-2">
        {upcoming.map((task) => {
          const app = applications.find((a) => a.id === task.applicationId)
          const due = task.dueDate ? parseISO(task.dueDate) : null
          const overdue = due && isValid(due) && due < new Date()
          return (
            <li
              key={task.id}
              className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-[var(--color-surface-2)]"
            >
              <button
                type="button"
                className="mt-0.5 size-4 rounded border border-[var(--color-border-strong)] hover:border-[var(--color-accent)] cursor-pointer shrink-0"
                aria-label="Complete task"
                onClick={() => void toggleTask(task.id)}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-[var(--color-text)] truncate">{task.title}</p>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-xs text-[var(--color-muted)]">
                  {app ? (
                    <button
                      type="button"
                      className="hover:text-[var(--color-accent)] cursor-pointer truncate"
                      onClick={() => setActiveApplicationId(app.id)}
                    >
                      {app.companyName}
                    </button>
                  ) : null}
                  {task.dueDate ? (
                    <span className={clsx(overdue && 'text-[var(--color-danger)]')}>
                      {formatDisplayDate(task.dueDate)}
                      {due && isValid(due) ? ` · ${format(due, 'EEE')}` : ''}
                    </span>
                  ) : null}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
