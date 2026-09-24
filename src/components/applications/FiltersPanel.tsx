import type { ReactNode } from 'react'
import {
  ASSESSMENT_TYPE_LABELS,
  COMPANY_TYPE_LABELS,
  DEADLINE_TYPE_LABELS,
  DIVISION_LABELS,
  DOC_REQUIREMENT_LABELS,
  ELIGIBLE_YEAR_LABELS,
  PRIORITY_LABELS,
  ROLE_TYPE_LABELS,
  SOURCE_LABELS,
  SPECIALIZATION_LABELS,
  STATUS_LABELS,
  STATUS_ORDER,
  WORK_AUTH_LABELS,
  WORK_MODE_LABELS,
} from '@/constants'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { MultiSelect } from '@/components/ui/MultiSelect'
import { useMeridianStore } from '@/lib/store'
import { clsx, countActiveDateRanges, countActiveKeys, countDeadlineRangeActive, getLanguages, isSystemTag } from '@/lib/utils'
import type {
  ApplicationStatus,
  AssessmentType,
  CompanyType,
  DeadlineType,
  Division,
  DocumentRequirement,
  EligibleUniversityYear,
  Priority,
  RoleType,
  Source,
  Specialization,
  WorkArrangement,
  WorkAuthorization,
} from '@/types'

function ChipGroup<T extends string | number>({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string
  options: { value: T; label: string }[]
  selected: T[]
  onToggle: (value: T) => void
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-[var(--color-faint)] mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const on = selected.includes(opt.value)
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onToggle(opt.value)}
              className={clsx(
                'rounded border px-2 py-1 text-xs cursor-pointer transition-colors',
                on
                  ? 'border-[var(--color-accent)] bg-[rgba(212,168,83,0.12)] text-[var(--color-accent)]'
                  : 'border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-border-strong)]',
              )}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function FilterGroup({
  label,
  active,
  children,
  defaultOpen = false,
}: {
  label: string
  active: number
  children: ReactNode
  defaultOpen?: boolean
}) {
  return (
    <details
      open={defaultOpen || active > 0}
      className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)]/40"
    >
      <summary className="flex items-center justify-between cursor-pointer px-3 py-2 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-text)]">
        <span className="uppercase tracking-wider">{label}</span>
        {active > 0 ? (
          <span className="rounded bg-[var(--color-accent)] text-[#0a0e16] text-[10px] font-bold px-1.5 py-0.5">
            {active}
          </span>
        ) : null}
      </summary>
      <div className="px-3 pb-3 pt-1 space-y-4">{children}</div>
    </details>
  )
}

const WITHIN_PRESETS = [7, 14, 30]

export function FiltersPanel() {
  const filters = useMeridianStore((s) => s.filters)
  const setFilters = useMeridianStore((s) => s.setFilters)
  const resetFilters = useMeridianStore((s) => s.resetFilters)
  // Selector must return a stable store-owned reference (Zustand v5 +
  // useSyncExternalStore re-renders on identity change, so deriving with
  // .filter() inside the selector risks a render loop — PR #1 F9).
  const storedTags = useMeridianStore((s) => s.tags)
  const tags = storedTags.filter((t) => !isSystemTag(t))
  const applications = useMeridianStore((s) => s.applications)

  const cities = [...new Set(applications.map((a) => a.city).filter(Boolean) as string[])].sort()
  const countries = [...new Set(applications.map((a) => a.country).filter(Boolean) as string[])].sort()
  const languages = [...new Set(applications.flatMap((a) => getLanguages(a).map((l) => l.language)).filter(Boolean))].sort()
  const cycles = [...new Set(applications.map((a) => a.recruitmentCycle).filter(Boolean) as string[])].sort()
  const gradYears = [...new Set(applications.flatMap((a) => a.targetGraduationYears ?? []))].sort((a, b) => a - b)

  const toggle = <T extends string | number>(key: keyof typeof filters, value: T) => {
    const cur = filters[key] as T[]
    const next = cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value]
    setFilters({ [key]: next } as Partial<typeof filters>)
  }

  const countActive = (keys: Array<keyof typeof filters>): number =>
    countActiveKeys(filters, keys)

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-sm">Filters</h3>
        <Button variant="ghost" size="sm" onClick={resetFilters}>
          Reset
        </Button>
      </div>

      <FilterGroup label="Opportunity" defaultOpen active={countActive(['statuses', 'roleTypes', 'companyTypes', 'divisions', 'specializations', 'cycles'])}>
        <ChipGroup
          label="Status"
          options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
          selected={filters.statuses}
          onToggle={(v) => toggle('statuses', v as ApplicationStatus)}
        />
        <ChipGroup
          label="Role type"
          options={(Object.keys(ROLE_TYPE_LABELS) as RoleType[]).map((k) => ({
            value: k,
            label: ROLE_TYPE_LABELS[k],
          }))}
          selected={filters.roleTypes}
          onToggle={(v) => toggle('roleTypes', v as RoleType)}
        />
        <ChipGroup
          label="Firm category"
          options={(Object.keys(COMPANY_TYPE_LABELS) as CompanyType[]).map((k) => ({
            value: k,
            label: COMPANY_TYPE_LABELS[k],
          }))}
          selected={filters.companyTypes}
          onToggle={(v) => toggle('companyTypes', v as CompanyType)}
        />
        <MultiSelect
          label="Divisions"
          options={(Object.keys(DIVISION_LABELS) as Division[]).map((k) => ({
            value: k,
            label: DIVISION_LABELS[k],
          }))}
          selected={filters.divisions}
          onToggle={(v) => toggle('divisions', v)}
        />
        <MultiSelect
          label="Specializations"
          searchable
          options={(Object.keys(SPECIALIZATION_LABELS) as Specialization[]).map((k) => ({
            value: k,
            label: SPECIALIZATION_LABELS[k],
          }))}
          selected={filters.specializations}
          onToggle={(v) => toggle('specializations', v)}
        />
        {cycles.length > 0 ? (
          <ChipGroup
            label="Cycle"
            options={cycles.map((c) => ({ value: c, label: c }))}
            selected={filters.cycles}
            onToggle={(v) => toggle('cycles', v)}
          />
        ) : null}
      </FilterGroup>

      <FilterGroup label="Location" active={countActive(['cities', 'countries', 'workModes'])}>
        {cities.length > 0 ? (
          <ChipGroup
            label="City"
            options={cities.map((c) => ({ value: c, label: c }))}
            selected={filters.cities}
            onToggle={(v) => toggle('cities', v)}
          />
        ) : null}
        {countries.length > 0 ? (
          <ChipGroup
            label="Country"
            options={countries.map((c) => ({ value: c, label: c }))}
            selected={filters.countries}
            onToggle={(v) => toggle('countries', v)}
          />
        ) : null}
        <ChipGroup
          label="Work mode"
          options={(Object.keys(WORK_MODE_LABELS) as WorkArrangement[]).map((k) => ({
            value: k,
            label: WORK_MODE_LABELS[k],
          }))}
          selected={filters.workModes}
          onToggle={(v) => toggle('workModes', v as WorkArrangement)}
        />
      </FilterGroup>

      <FilterGroup
        label="Eligibility"
        active={countActive(['eligibleUniversityYears', 'targetGraduationYears', 'workAuthorizations', 'languages'])}
      >
        <MultiSelect
          label="Eligible university years"
          options={(Object.keys(ELIGIBLE_YEAR_LABELS) as EligibleUniversityYear[]).map((k) => ({
            value: k,
            label: ELIGIBLE_YEAR_LABELS[k],
          }))}
          selected={filters.eligibleUniversityYears}
          onToggle={(v) => toggle('eligibleUniversityYears', v)}
        />
        {gradYears.length > 0 ? (
          <ChipGroup
            label="Graduation year"
            options={gradYears.map((y) => ({ value: y, label: String(y) }))}
            selected={filters.targetGraduationYears}
            onToggle={(v) => toggle('targetGraduationYears', v)}
          />
        ) : null}
        <ChipGroup
          label="Work authorization"
          options={(Object.keys(WORK_AUTH_LABELS) as WorkAuthorization[]).map((k) => ({
            value: k,
            label: WORK_AUTH_LABELS[k],
          }))}
          selected={filters.workAuthorizations}
          onToggle={(v) => toggle('workAuthorizations', v as WorkAuthorization)}
        />
        {languages.length > 0 ? (
          <ChipGroup
            label="Language"
            options={languages.map((l) => ({ value: l, label: l }))}
            selected={filters.languages}
            onToggle={(v) => toggle('languages', v)}
          />
        ) : null}
      </FilterGroup>

      <FilterGroup
        label="Application"
        active={countActive(['cvRequired', 'coverLetterRequired', 'transcriptRequired', 'deadlineTypes', 'deadlineWithinDays', 'rollingDeadline']) + countDeadlineRangeActive(filters)}
      >
        <ChipGroup
          label="CV required"
          options={(Object.keys(DOC_REQUIREMENT_LABELS) as DocumentRequirement[]).map((k) => ({
            value: k,
            label: DOC_REQUIREMENT_LABELS[k],
          }))}
          selected={filters.cvRequired}
          onToggle={(v) => toggle('cvRequired', v as DocumentRequirement)}
        />
        <ChipGroup
          label="Cover letter"
          options={(Object.keys(DOC_REQUIREMENT_LABELS) as DocumentRequirement[]).map((k) => ({
            value: k,
            label: DOC_REQUIREMENT_LABELS[k],
          }))}
          selected={filters.coverLetterRequired}
          onToggle={(v) => toggle('coverLetterRequired', v as DocumentRequirement)}
        />
        <ChipGroup
          label="Transcript"
          options={(Object.keys(DOC_REQUIREMENT_LABELS) as DocumentRequirement[]).map((k) => ({
            value: k,
            label: DOC_REQUIREMENT_LABELS[k],
          }))}
          selected={filters.transcriptRequired}
          onToggle={(v) => toggle('transcriptRequired', v as DocumentRequirement)}
        />
        <ChipGroup
          label="Deadline type"
          options={(Object.keys(DEADLINE_TYPE_LABELS) as DeadlineType[]).map((k) => ({
            value: k,
            label: DEADLINE_TYPE_LABELS[k],
          }))}
          selected={filters.deadlineTypes}
          onToggle={(v) => toggle('deadlineTypes', v as DeadlineType)}
        />
        <div>
          <p className="text-[11px] uppercase tracking-wider text-[var(--color-faint)] mb-2">
            Deadline within
          </p>
          <div className="flex flex-wrap gap-1.5">
            {WITHIN_PRESETS.map((days) => {
              const on = filters.deadlineWithinDays === days
              return (
                <button
                  key={days}
                  type="button"
                  onClick={() => setFilters({ deadlineWithinDays: on ? null : days })}
                  className={clsx(
                    'rounded border px-2 py-1 text-xs cursor-pointer transition-colors',
                    on
                      ? 'border-[var(--color-accent)] bg-[rgba(212,168,83,0.12)] text-[var(--color-accent)]'
                      : 'border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-border-strong)]',
                  )}
                >
                  {days} days
                </button>
              )
            })}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input
            label="Deadline from"
            type="date"
            value={filters.deadlineFrom ?? ''}
            onChange={(e) => setFilters({ deadlineFrom: e.target.value || undefined })}
          />
          <Input
            label="Deadline to"
            type="date"
            value={filters.deadlineTo ?? ''}
            onChange={(e) => setFilters({ deadlineTo: e.target.value || undefined })}
          />
        </div>
      </FilterGroup>

      <FilterGroup label="Assessments" active={countActive(['assessments'])}>
        <MultiSelect
          label="Assessment types"
          searchable
          hint="Matches opportunities containing any selected type."
          options={(Object.keys(ASSESSMENT_TYPE_LABELS) as AssessmentType[]).map((k) => ({
            value: k,
            label: ASSESSMENT_TYPE_LABELS[k],
          }))}
          selected={filters.assessments}
          onToggle={(v) => toggle('assessments', v)}
        />
      </FilterGroup>

      <FilterGroup label="Planning" active={countActive(['priorities', 'hasInterview', 'hasOffer'])}>
        <ChipGroup
          label="Priority"
          options={(Object.keys(PRIORITY_LABELS) as Priority[]).map((k) => ({
            value: k,
            label: PRIORITY_LABELS[k],
          }))}
          selected={filters.priorities}
          onToggle={(v) => toggle('priorities', v as Priority)}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={clsx(
              'rounded border px-2 py-1 text-xs cursor-pointer',
              filters.hasInterview === true
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-[var(--color-border)] text-[var(--color-muted)]',
            )}
            onClick={() =>
              setFilters({ hasInterview: filters.hasInterview === true ? null : true })
            }
          >
            Has interview
          </button>
          <button
            type="button"
            className={clsx(
              'rounded border px-2 py-1 text-xs cursor-pointer',
              filters.hasOffer === true
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-[var(--color-border)] text-[var(--color-muted)]',
            )}
            onClick={() => setFilters({ hasOffer: filters.hasOffer === true ? null : true })}
          >
            Has offer
          </button>
        </div>
      </FilterGroup>

      <FilterGroup label="Dates" active={countActiveDateRanges(filters)}>
        <div className="grid sm:grid-cols-2 gap-3">
          <Input
            label="Opening from"
            type="date"
            value={filters.openingDateFrom ?? ''}
            onChange={(e) => setFilters({ openingDateFrom: e.target.value || undefined })}
          />
          <Input
            label="Opening to"
            type="date"
            value={filters.openingDateTo ?? ''}
            onChange={(e) => setFilters({ openingDateTo: e.target.value || undefined })}
          />
          <Input
            label="Start from"
            type="date"
            value={filters.startDateFrom ?? ''}
            onChange={(e) => setFilters({ startDateFrom: e.target.value || undefined })}
          />
          <Input
            label="Start to"
            type="date"
            value={filters.startDateTo ?? ''}
            onChange={(e) => setFilters({ startDateTo: e.target.value || undefined })}
          />
          <Input
            label="Applied from"
            type="date"
            value={filters.applicationDateFrom ?? ''}
            onChange={(e) => setFilters({ applicationDateFrom: e.target.value || undefined })}
          />
          <Input
            label="Applied to"
            type="date"
            value={filters.applicationDateTo ?? ''}
            onChange={(e) => setFilters({ applicationDateTo: e.target.value || undefined })}
          />
        </div>
      </FilterGroup>

      <FilterGroup label="Source & Tags" active={countActive(['sources', 'tags', 'requirementTypes', 'showArchived'])}>
        <ChipGroup
          label="Source"
          options={(Object.keys(SOURCE_LABELS) as Source[]).map((k) => ({
            value: k,
            label: SOURCE_LABELS[k],
          }))}
          selected={filters.sources}
          onToggle={(v) => toggle('sources', v as Source)}
        />
        {tags.length > 0 ? (
          <ChipGroup
            label="Tags"
            options={tags.map((t) => ({ value: t.id, label: t.name }))}
            selected={filters.tags}
            onToggle={(v) => toggle('tags', v)}
          />
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={clsx(
              'rounded border px-2 py-1 text-xs cursor-pointer',
              filters.rollingDeadline === true
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-[var(--color-border)] text-[var(--color-muted)]',
            )}
            onClick={() =>
              setFilters({ rollingDeadline: filters.rollingDeadline === true ? null : true })
            }
          >
            Rolling only
          </button>
          <button
            type="button"
            className={clsx(
              'rounded border px-2 py-1 text-xs cursor-pointer',
              filters.showArchived
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-[var(--color-border)] text-[var(--color-muted)]',
            )}
            onClick={() => setFilters({ showArchived: !filters.showArchived })}
          >
            Show archived
          </button>
        </div>
      </FilterGroup>
    </div>
  )
}
