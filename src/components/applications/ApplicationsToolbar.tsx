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
import { clsx, countActiveDateRanges, isSystemTag } from '@/lib/utils'
import {
  ASSESSMENT_TYPE_LABELS,
  COMPANY_TYPE_LABELS,
  DEADLINE_TYPE_LABELS,
  DIVISION_LABELS,
  DOC_REQUIREMENT_LABELS,
  ELIGIBLE_YEAR_LABELS,
  PRIORITY_LABELS,
  REQUIREMENT_TYPE_LABELS,
  ROLE_TYPE_LABELS,
  SOURCE_LABELS,
  SPECIALIZATION_LABELS,
  STATUS_LABELS,
  WORK_AUTH_LABELS,
  WORK_MODE_LABELS,
} from '@/constants'
import type {
  ApplicationFilters,
  ApplicationStatus,
  AssessmentType,
  CompanyType,
  DeadlineType,
  Division,
  DocumentRequirement,
  EligibleUniversityYear,
  Priority,
  RequirementType,
  RoleType,
  Source,
  Specialization,
  ViewMode,
  WorkArrangement,
  WorkAuthorization,
} from '@/types'

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
  const resetFilters = useMeridianStore((s) => s.resetFilters)
  const tags = useMeridianStore((s) => s.tags.filter((t) => !isSystemTag(t)))
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
    if (filters.search.trim()) n++
    if (filters.statuses.length) n++
    if (filters.companyTypes.length) n++
    if (filters.roleTypes.length) n++
    if (filters.divisions.length) n++
    if (filters.specializations.length) n++
    if (filters.assessments.length) n++
    if (filters.eligibleUniversityYears.length) n++
    if (filters.targetGraduationYears.length) n++
    if (filters.workAuthorizations.length) n++
    if (filters.workModes.length) n++
    if (filters.priorities.length) n++
    if (filters.cvRequired.length) n++
    if (filters.coverLetterRequired.length) n++
    if (filters.transcriptRequired.length) n++
    if (filters.deadlineTypes.length) n++
    if (filters.cycles.length) n++
    if (filters.cities.length) n++
    if (filters.countries.length) n++
    if (filters.sources.length) n++
    if (filters.tags.length) n++
    if (filters.languages.length) n++
    if (filters.requirementTypes.length) n++
    if (filters.hasInterview != null) n++
    if (filters.hasOffer != null) n++
    if (filters.rollingDeadline != null) n++
    if (filters.deadlineWithinDays != null) n++
    if (filters.showArchived) n++
    // Date-range pairs count too — a date-only filter state restricts
    // results and must enable the badge and Save view (PR #1 U5).
    n += countActiveDateRanges(filters)
    return n
  }, [filters])

  interface ActiveChip {
    key: string
    label: string
    clear: () => void
  }

  const without = <K extends keyof ApplicationFilters>(key: K, value: unknown) => {
    const cur = filters[key]
    if (Array.isArray(cur)) {
      setFilters({ [key]: cur.filter((x) => x !== value) } as Partial<ApplicationFilters>)
    } else {
      setFilters({ [key]: key === 'showArchived' ? false : undefined } as Partial<ApplicationFilters>)
    }
  }

  const chips = useMemo<ActiveChip[]>(() => {
    const list: ActiveChip[] = []
    const multi = <T extends string | number>(
      key: 'statuses' | 'companyTypes' | 'roleTypes' | 'divisions' | 'specializations' | 'assessments' | 'eligibleUniversityYears' | 'targetGraduationYears' | 'cities' | 'countries' | 'sources' | 'tags' | 'languages' | 'cycles' | 'workModes' | 'priorities' | 'cvRequired' | 'coverLetterRequired' | 'transcriptRequired' | 'deadlineTypes' | 'workAuthorizations' | 'requirementTypes',
      values: readonly T[],
      labelOf: (v: T) => string,
    ) => {
      for (const v of values) {
        list.push({ key: `${key}:${String(v)}`, label: labelOf(v), clear: () => without(key, v) })
      }
    }
    if (filters.search.trim()) {
      list.push({ key: 'search', label: `“${filters.search.trim()}”`, clear: () => setFilters({ search: '' }) })
    }
    multi('statuses', filters.statuses, (v) => STATUS_LABELS[v as ApplicationStatus])
    multi('roleTypes', filters.roleTypes, (v) => ROLE_TYPE_LABELS[v as RoleType])
    multi('companyTypes', filters.companyTypes, (v) => COMPANY_TYPE_LABELS[v as CompanyType])
    multi('divisions', filters.divisions, (v) => DIVISION_LABELS[v as Division])
    multi('specializations', filters.specializations, (v) => SPECIALIZATION_LABELS[v as Specialization])
    multi('assessments', filters.assessments, (v) => ASSESSMENT_TYPE_LABELS[v as AssessmentType])
    multi('eligibleUniversityYears', filters.eligibleUniversityYears, (v) => ELIGIBLE_YEAR_LABELS[v as EligibleUniversityYear])
    multi('targetGraduationYears', filters.targetGraduationYears, (v) => `Class of ${v}`)
    multi('workAuthorizations', filters.workAuthorizations, (v) => WORK_AUTH_LABELS[v as WorkAuthorization])
    multi('workModes', filters.workModes, (v) => WORK_MODE_LABELS[v as WorkArrangement])
    multi('priorities', filters.priorities, (v) => PRIORITY_LABELS[v as Priority])
    multi('cvRequired', filters.cvRequired, (v) => `CV: ${DOC_REQUIREMENT_LABELS[v as DocumentRequirement]}`)
    multi('coverLetterRequired', filters.coverLetterRequired, (v) => `Cover letter: ${DOC_REQUIREMENT_LABELS[v as DocumentRequirement]}`)
    multi('transcriptRequired', filters.transcriptRequired, (v) => `Transcript: ${DOC_REQUIREMENT_LABELS[v as DocumentRequirement]}`)
    multi('deadlineTypes', filters.deadlineTypes, (v) => DEADLINE_TYPE_LABELS[v as DeadlineType])
    multi('cycles', filters.cycles, (v) => v)
    multi('cities', filters.cities, (v) => v)
    multi('countries', filters.countries, (v) => v)
    multi('sources', filters.sources, (v) => SOURCE_LABELS[v as Source])
    multi('languages', filters.languages, (v) => v)
    multi('requirementTypes', filters.requirementTypes, (v) => REQUIREMENT_TYPE_LABELS[v as RequirementType])
    for (const tagId of filters.tags) {
      const name = tags.find((t) => t.id === tagId)?.name ?? tagId
      list.push({ key: `tags:${tagId}`, label: `#${name}`, clear: () => without('tags', tagId) })
    }
    if (filters.deadlineWithinDays != null) {
      list.push({
        key: 'deadlineWithinDays',
        label: `Due within ${filters.deadlineWithinDays} days`,
        clear: () => setFilters({ deadlineWithinDays: null }),
      })
    }
    if (filters.deadlineFrom || filters.deadlineTo) {
      list.push({
        key: 'deadlineRange',
        label: `Deadline ${filters.deadlineFrom ?? '…'} → ${filters.deadlineTo ?? '…'}`,
        clear: () => setFilters({ deadlineFrom: undefined, deadlineTo: undefined }),
      })
    }
    if (filters.openingDateFrom || filters.openingDateTo) {
      list.push({
        key: 'openingDateRange',
        label: `Opening ${filters.openingDateFrom ?? '…'} → ${filters.openingDateTo ?? '…'}`,
        clear: () => setFilters({ openingDateFrom: undefined, openingDateTo: undefined }),
      })
    }
    if (filters.startDateFrom || filters.startDateTo) {
      list.push({
        key: 'startDateRange',
        label: `Start ${filters.startDateFrom ?? '…'} → ${filters.startDateTo ?? '…'}`,
        clear: () => setFilters({ startDateFrom: undefined, startDateTo: undefined }),
      })
    }
    if (filters.applicationDateFrom || filters.applicationDateTo) {
      list.push({
        key: 'applicationDateRange',
        label: `Applied ${filters.applicationDateFrom ?? '…'} → ${filters.applicationDateTo ?? '…'}`,
        clear: () => setFilters({ applicationDateFrom: undefined, applicationDateTo: undefined }),
      })
    }
    if (filters.hasInterview != null) {
      list.push({ key: 'hasInterview', label: 'Has interview', clear: () => setFilters({ hasInterview: null }) })
    }
    if (filters.hasOffer != null) {
      list.push({ key: 'hasOffer', label: 'Has offer', clear: () => setFilters({ hasOffer: null }) })
    }
    if (filters.rollingDeadline != null) {
      list.push({ key: 'rollingDeadline', label: 'Rolling only', clear: () => setFilters({ rollingDeadline: null }) })
    }
    return list
  }, [filters, tags])

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

      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={chip.clear}
              title="Remove filter"
              className="inline-flex items-center gap-1 rounded-full border border-[var(--color-accent)]/40 bg-[rgba(212,168,83,0.1)] px-2.5 py-1 text-[11px] text-[var(--color-accent)] hover:border-[var(--color-accent)] transition-colors cursor-pointer"
            >
              {chip.label}
              <X className="size-3" />
            </button>
          ))}
          <button
            type="button"
            onClick={() => resetFilters()}
            className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] px-2.5 py-1 text-[11px] text-[var(--color-muted)] hover:text-[var(--color-danger)] hover:border-[var(--color-danger)]/50 transition-colors cursor-pointer"
          >
            Clear all
          </button>
        </div>
      ) : null}

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
