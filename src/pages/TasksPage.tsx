import { useState } from 'react'
import { CheckSquare, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { EmptyState } from '@/components/ui/EmptyState'
import { useMeridianStore } from '@/lib/store'
import { formatDisplayDate, clsx } from '@/lib/utils'

export function TasksPage() {
  const tasks = useMeridianStore((s) => s.tasks)
  const applications = useMeridianStore((s) => s.applications)
  const upsertTask = useMeridianStore((s) => s.upsertTask)
  const toggleTask = useMeridianStore((s) => s.toggleTask)
  const deleteTask = useMeridianStore((s) => s.deleteTask)
  const setActiveApplicationId = useMeridianStore((s) => s.setActiveApplicationId)

  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [applicationId, setApplicationId] = useState('')
  const [showDone, setShowDone] = useState(false)

  const visible = [...tasks]
    .filter((t) => (showDone ? true : !t.completed))
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1
      if (!a.dueDate && !b.dueDate) return 0
      if (!a.dueDate) return 1
      if (!b.dueDate) return -1
      return a.dueDate.localeCompare(b.dueDate)
    })

  return (
    <div className="space-y-4 animate-fade-in max-w-3xl">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Tasks</h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          Follow-ups, essays, and prep milestones.
        </p>
      </div>

      <form
        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 grid sm:grid-cols-[1fr_auto_auto] gap-3 items-end"
        onSubmit={(e) => {
          e.preventDefault()
          if (!title.trim()) return
          void upsertTask({
            title: title.trim(),
            dueDate: dueDate || undefined,
            applicationId: applicationId || undefined,
            completed: false,
          })
          setTitle('')
          setDueDate('')
          setApplicationId('')
        }}
      >
        <Input
          label="New task"
          placeholder="e.g. Draft Goldman cover letter"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Input
          label="Due"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
        <Button type="submit" variant="primary">
          <Plus className="size-4" />
          Add
        </Button>
        <div className="sm:col-span-3">
          <Select
            label="Link to application"
            value={applicationId}
            placeholder="Optional"
            options={applications
              .filter((a) => !a.archived)
              .map((a) => ({ value: a.id, label: `${a.companyName} — ${a.jobTitle}` }))}
            onChange={(e) => setApplicationId(e.target.value)}
          />
        </div>
      </form>

      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--color-muted)]">{visible.length} shown</p>
        <Button variant="ghost" size="sm" onClick={() => setShowDone((v) => !v)}>
          {showDone ? 'Hide completed' : 'Show completed'}
        </Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<CheckSquare className="size-10" />}
          title="No tasks yet."
          description="Break applications into actionable next steps."
          className="py-12"
        />
      ) : (
        <ul className="space-y-2">
          {visible.map((task) => {
            const app = applications.find((a) => a.id === task.applicationId)
            return (
              <li
                key={task.id}
                className="flex items-start gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3"
              >
                <input
                  type="checkbox"
                  checked={task.completed}
                  onChange={() => void toggleTask(task.id)}
                  className="mt-1 accent-[var(--color-accent)]"
                />
                <div className="min-w-0 flex-1">
                  <p
                    className={clsx(
                      'text-sm',
                      task.completed && 'line-through text-[var(--color-faint)]',
                    )}
                  >
                    {task.title}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-[var(--color-muted)]">
                    {task.dueDate ? <span>Due {formatDisplayDate(task.dueDate)}</span> : null}
                    {app ? (
                      <button
                        type="button"
                        className="hover:text-[var(--color-accent)] cursor-pointer"
                        onClick={() => setActiveApplicationId(app.id)}
                      >
                        {app.companyName}
                      </button>
                    ) : null}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Delete task"
                  onClick={() => void deleteTask(task.id)}
                >
                  <Trash2 className="size-3.5 text-[var(--color-danger)]" />
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
