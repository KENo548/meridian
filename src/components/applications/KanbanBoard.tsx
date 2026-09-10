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

function MobileKanbanView({ applications }: KanbanBoardProps) {
  const [activeColumn, setActiveColumn] = useState(KANBAN_COLUMNS[0]?.id ?? '')
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

  const currentCol = KANBAN_COLUMNS.find((c) => c.id === activeColumn)
  const currentApps = byColumn[activeColumn] ?? []

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
        {KANBAN_COLUMNS.map((col) => (
          <button
            key={col.id}
            type="button"
            onClick={() => setActiveColumn(col.id)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors shrink-0',
              activeColumn === col.id
                ? 'bg-[var(--color-accent)] text-[#0a0e16]'
                : 'bg-[var(--color-surface-2)] text-[var(--color-muted)] hover:text-[var(--color-text)]',
            )}
          >
            {col.label}
            <span className={clsx(
              'size-5 rounded-full flex items-center justify-center text-[10px] font-semibold',
              activeColumn === col.id
                ? 'bg-[#0a0e16]/20 text-[#0a0e16]'
                : 'bg-[var(--color-border)] text-[var(--color-faint)]',
            )}>
              {(byColumn[col.id] ?? []).length}
            </span>
          </button>
        ))}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex flex-col gap-2 min-h-[100px]">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--color-text)]">{currentCol?.label}</h3>
            <span className="text-xs text-[var(--color-muted)]">{currentApps.length} items</span>
          </div>
          <div className="flex flex-col gap-2">
            {currentApps.map((app) => (
              <KanbanCard key={app.id} app={app} />
            ))}
            {currentApps.length === 0 && (
              <div className="rounded-lg border border-dashed border-[var(--color-border)] p-6 text-center">
                <p className="text-sm text-[var(--color-muted)]">No applications in this column</p>
              </div>
            )}
          </div>
        </div>
        <DragOverlay>
          {activeApp ? <KanbanCard app={activeApp} dragging /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
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
    <>
      <div className="hidden md:block">
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
      </div>
      <div className="md:hidden">
        <MobileKanbanView applications={applications} />
      </div>
    </>
  )
}
