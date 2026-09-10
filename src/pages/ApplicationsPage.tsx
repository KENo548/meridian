import { useMemo, useState } from 'react'
import { Briefcase } from 'lucide-react'
import { ApplicationsToolbar } from '@/components/applications/ApplicationsToolbar'
import { FiltersPanel } from '@/components/applications/FiltersPanel'
import { ApplicationsTable } from '@/components/applications/ApplicationsTable'
import { ApplicationCardList } from '@/components/applications/ApplicationCardList'
import { BulkActionsBar } from '@/components/applications/BulkActionsBar'
import { KanbanBoard } from '@/components/applications/KanbanBoard'
import { CalendarView } from '@/components/applications/CalendarView'
import { TimelineView } from '@/components/applications/TimelineView'
import { EmptyState } from '@/components/ui/EmptyState'
import { useMeridianStore } from '@/lib/store'
import { filterApplications, sortApplications } from '@/lib/utils'

export function ApplicationsPage() {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const applications = useMeridianStore((s) => s.applications)
  const requirements = useMeridianStore((s) => s.requirements)
  const filters = useMeridianStore((s) => s.filters)
  const sort = useMeridianStore((s) => s.sort)
  const viewMode = useMeridianStore((s) => s.viewMode)
  const setAddWizardOpen = useMeridianStore((s) => s.setAddWizardOpen)

  const requirementAppIds = useMemo(() => {
    if (!filters.requirementTypes.length) return undefined
    const set = new Set<string>()
    for (const r of requirements) {
      if (filters.requirementTypes.includes(r.type)) set.add(r.applicationId)
    }
    return set
  }, [requirements, filters.requirementTypes])

  const visible = useMemo(
    () => sortApplications(filterApplications(applications, filters, requirementAppIds), sort),
    [applications, filters, requirementAppIds, sort],
  )

  const isEmpty = applications.filter((a) => !a.archived || filters.showArchived).length === 0

  return (
    <div className="space-y-4 animate-fade-in max-w-[1400px] pb-20">
      <ApplicationsToolbar
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((o) => !o)}
        resultCount={visible.length}
      />

      {filtersOpen ? <FiltersPanel /> : null}

      {isEmpty ? (
        <EmptyState
          icon={<Briefcase className="size-10" />}
          onAction={() => setAddWizardOpen(true)}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          title="No applications match your filters."
          description="Try clearing filters or broadening your search."
          actionLabel="Clear search"
          onAction={() => useMeridianStore.getState().resetFilters()}
        />
      ) : (
        <>
          {viewMode === 'table' ? (
            <>
              <ApplicationsTable applications={visible} />
              <ApplicationCardList applications={visible} />
            </>
          ) : null}
          {viewMode === 'kanban' ? <KanbanBoard applications={visible} /> : null}
          {viewMode === 'calendar' ? <CalendarView applications={visible} /> : null}
          {viewMode === 'timeline' ? <TimelineView applications={visible} /> : null}
        </>
      )}

      <BulkActionsBar />
    </div>
  )
}
