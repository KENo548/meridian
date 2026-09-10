import { useMemo, useRef, useState } from 'react'
import {
  Search,
  LayoutList,
  Columns3,
  CalendarDays,
  GanttChart,
  Download,
  Upload,
  Plus,
  SlidersHorizontal,
  Bookmark,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useMeridianStore } from '@/lib/store'
import { exportApplicationsCsv, parseApplicationsCsv } from '@/lib/csv'
import { clsx } from '@/lib/utils'
import type { ViewMode } from '@/types'

const VIEWS: { id: ViewMode; label: string; icon: typeof LayoutList }[] = [
  { id: 'table', label: 'Table', icon: LayoutList },
  { id: 'kanban', label: 'Kanban', icon: Columns3 },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'timeline', label: 'Timeline', icon: GanttChart },
]

interface ApplicationsToolbarProps {
  filtersOpen: boolean
  onToggleFilters: () => void
  resultCount: number
}

export function ApplicationsToolbar({
  filtersOpen,
  onToggleFilters,
  resultCount,
}: ApplicationsToolbarProps) {
  const filters = useMeridianStore((s) => s.filters)
  const setFilters = useMeridianStore((s) => s.setFilters)
  const viewMode = useMeridianStore((s) => s.viewMode)
  const setViewMode = useMeridianStore((s) => s.setViewMode)
  const setAddWizardOpen = useMeridianStore((s) => s.setAddWizardOpen)
  const applications = useMeridianStore((s) => s.applications)
  const importApplications = useMeridianStore((s) => s.importApplications)
  const pushToast = useMeridianStore((s) => s.pushToast)
  const savedViews = useMeridianStore((s) => s.savedViews)
  const saveView = useMeridianStore((s) => s.saveView)
  const deleteSavedView = useMeridianStore((s) => s.deleteSavedView)
  const applySavedView = useMeridianStore((s) => s.applySavedView)
  const fileRef = useRef<HTMLInputElement>(null)
  const [, setSavingView] = useState(false)

  const activeFilterCount = useMemo(() => {
    let n = 0
    if (filters.statuses.length) n++
    if (filters.companyTypes.length) n++
    if (filters.roleTypes.length) n++
    if (filters.specializations.length) n++
    if (filters.cities.length) n++
    if (filters.countries.length) n++
    if (filters.sources.length) n++
    if (filters.tags.length) n++
    if (filters.languages.length) n++
    if (filters.hasInterview != null) n++
    if (filters.hasOffer != null) n++
    if (filters.rollingDeadline != null) n++
    if (filters.showArchived) n++
    return n
  }, [filters])

  const onExport = () => {
    const csv = exportApplicationsCsv(applications.filter((a) => !a.archived || filters.showArchived))
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `meridian-applications-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    pushToast('success', 'CSV exported')
  }

  const onImportFile = async (file: File) => {
    const text = await file.text()
    const { apps, errors } = parseApplicationsCsv(text)
    if (apps.length) await importApplications(apps)
    if (errors.length) pushToast('info', `${errors.length} row(s) skipped`)
  }

  const handleSaveView = () => {
    const name = window.prompt('Name this saved view:')
    if (name?.trim()) {
      saveView(name.trim())
      pushToast('success', `View "${name.trim()}" saved`)
    }
    setSavingView(false)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Applications</h1>
          <p className="text-sm text-[var(--color-muted)] mt-0.5">
            {resultCount} result{resultCount === 1 ? '' : 's'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onToggleFilters}>
            <SlidersHorizontal className="size-3.5" />
            Filters
            {activeFilterCount > 0 ? (
              <span className="ml-1 rounded bg-[var(--color-accent)] text-[#0a0e16] text-[10px] font-bold px-1.5 py-0.5">
                {activeFilterCount}
              </span>
            ) : null}
            {filtersOpen ? null : null}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleSaveView}
            disabled={activeFilterCount === 0}
          >
            <Bookmark className="size-3.5" />
            Save view
          </Button>
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
            <Upload className="size-3.5" />
            Import
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void onImportFile(f)
              e.target.value = ''
            }}
          />
          <Button variant="secondary" size="sm" onClick={onExport}>
            <Download className="size-3.5" />
            Export
          </Button>
          <Button variant="primary" size="sm" onClick={() => setAddWizardOpen(true)}>
            <Plus className="size-3.5" />
            Add
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Search company, role, city…"
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
            leftIcon={<Search className="size-4" />}
          />
        </div>
        <div className="flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-0.5">
          {VIEWS.map((v) => {
            const Icon = v.icon
            const active = viewMode === v.id
            return (
              <button
                key={v.id}
                type="button"
                title={v.label}
                onClick={() => setViewMode(v.id)}
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded px-2.5 h-8 text-xs transition-colors cursor-pointer',
                  active
                    ? 'bg-[var(--color-surface-3)] text-[var(--color-accent)]'
                    : 'text-[var(--color-muted)] hover:text-[var(--color-text)]',
                )}
              >
                <Icon className="size-3.5" />
                <span className="hidden md:inline">{v.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {savedViews.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {savedViews.map((view) => (
            <button
              key={view.id}
              type="button"
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs text-[var(--color-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors cursor-pointer"
              onClick={() => {
                applySavedView(view.id)
                pushToast('info', `Applied view "${view.name}"`)
              }}
            >
              <Bookmark className="size-3" />
              {view.name}
              <span
                role="button"
                tabIndex={0}
                className="ml-0.5 rounded-full hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)] p-0.5"
                onClick={(e) => {
                  e.stopPropagation()
                  deleteSavedView(view.id)
                  pushToast('success', `View "${view.name}" deleted`)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation()
                    deleteSavedView(view.id)
                    pushToast('success', `View "${view.name}" deleted`)
                  }
                }}
              >
                <X className="size-3" />
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
