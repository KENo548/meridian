import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
  useDroppable,
} from '@dnd-kit/core'
import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { KANBAN_COLUMNS } from '@/constants'
import type { Application, ApplicationStatus } from '@/types'
import { useMeridianStore } from '@/lib/store'
import { clsx } from '@/lib/utils'
import { DeadlineBadge } from '@/components/ui/DeadlineBadge'
import { StatusBadge } from '@/components/ui/StatusBadge'

interface KanbanBoardProps {
  applications: Application[]
}

function KanbanCard({ app, dragging }: { app: Application; dragging?: boolean }) {
  const setActiveApplicationId = useMeridianStore((s) => s.setActiveApplicationId)
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: app.id,
    data: { app },
  })

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => setActiveApplicationId(app.id)}
      className={clsx(
        'rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-2.5 cursor-grab active:cursor-grabbing',
        'hover:border-[var(--color-border-strong)] transition-colors',
        (isDragging || dragging) && 'opacity-40',
      )}
    >
      <p className="text-sm font-medium text-[var(--color-text)] truncate">{app.companyName}</p>
      <p className="text-xs text-[var(--color-muted)] truncate mt-0.5">{app.jobTitle}</p>
      <div className="mt-2 flex flex-wrap gap-1">
        <StatusBadge status={app.status} />
        <DeadlineBadge application={app} />
      </div>
    </div>
  )
}

function Column({
  id,
  label,
  apps,
}: {
  id: string
  label: string
  apps: Application[]
}) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={clsx(
        'flex flex-col min-w-[220px] w-[220px] shrink-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]/80',
        isOver && 'border-[var(--color-accent)]/50',
      )}
    >
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--color-border)]">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">{label}</h3>
        <span className="text-[11px] tabular-nums text-[var(--color-faint)]">{apps.length}</span>
      </div>
      <div className="flex flex-col gap-2 p-2 min-h-[120px] max-h-[calc(100vh-280px)] overflow-y-auto">
        {apps.map((app) => (
          <KanbanCard key={app.id} app={app} />
        ))}
      </div>
    </div>
  )
}

function columnStatusForDrop(columnId: string): ApplicationStatus {
  const col = KANBAN_COLUMNS.find((c) => c.id === columnId)
  return col?.statuses[0] ?? 'interested'
}

export function KanbanBoard({ applications }: KanbanBoardProps) {
  const updateApplication = useMeridianStore((s) => s.updateApplication)
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  const byColumn = useMemo(() => {
    const map: Record<string, Application[]> = {}
    for (const col of KANBAN_COLUMNS) {
      map[col.id] = applications.filter((a) => col.statuses.includes(a.status))
    }
    return map
  }, [applications])

  const activeApp = activeId ? applications.find((a) => a.id === activeId) : undefined

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over) return

    const appId = String(active.id)
    let targetColumnId = String(over.id)

    // Dropped on a card — find its column
    if (!KANBAN_COLUMNS.some((c) => c.id === targetColumnId)) {
      const overApp = applications.find((a) => a.id === targetColumnId)
      if (overApp) {
        const col = KANBAN_COLUMNS.find((c) => c.statuses.includes(overApp.status))
        if (col) targetColumnId = col.id
      } else {
        return
      }
    }

    const app = applications.find((a) => a.id === appId)
    if (!app) return
    const nextStatus = columnStatusForDrop(targetColumnId)
    const targetCol = KANBAN_COLUMNS.find((c) => c.id === targetColumnId)
    if (targetCol?.statuses.includes(app.status)) return
    void updateApplication(appId, { status: nextStatus })
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-2">
        {KANBAN_COLUMNS.map((col) => (
          <Column key={col.id} id={col.id} label={col.label} apps={byColumn[col.id] ?? []} />
        ))}
      </div>
      <DragOverlay>
        {activeApp ? <KanbanCard app={activeApp} dragging /> : null}
      </DragOverlay>
    </DndContext>
  )
}
