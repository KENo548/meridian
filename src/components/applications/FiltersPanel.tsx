import {
  COMPANY_TYPE_LABELS,
  ROLE_TYPE_LABELS,
  SOURCE_LABELS,
  SPECIALIZATION_LABELS,
  STATUS_LABELS,
  STATUS_ORDER,
} from '@/constants'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useMeridianStore } from '@/lib/store'
import { clsx } from '@/lib/utils'
import type { ApplicationStatus, CompanyType, RoleType, Source, Specialization } from '@/types'

function ChipGroup<T extends string>({
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

export function FiltersPanel() {
  const filters = useMeridianStore((s) => s.filters)
  const setFilters = useMeridianStore((s) => s.setFilters)
  const resetFilters = useMeridianStore((s) => s.resetFilters)
  const tags = useMeridianStore((s) => s.tags)
  const applications = useMeridianStore((s) => s.applications)

  const cities = [...new Set(applications.map((a) => a.city).filter(Boolean) as string[])].sort()
  const countries = [...new Set(applications.map((a) => a.country).filter(Boolean) as string[])].sort()
  const languages = [...new Set(applications.flatMap((a) => a.languages || []).filter(Boolean))].sort()

  const toggle = <T extends string>(key: keyof typeof filters, value: T) => {
    const cur = filters[key] as T[]
    const next = cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value]
    setFilters({ [key]: next } as Partial<typeof filters>)
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-sm">Filters</h3>
        <Button variant="ghost" size="sm" onClick={resetFilters}>
          Reset
        </Button>
      </div>

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
        label="Company type"
        options={(Object.keys(COMPANY_TYPE_LABELS) as CompanyType[]).map((k) => ({
          value: k,
          label: COMPANY_TYPE_LABELS[k],
        }))}
        selected={filters.companyTypes}
        onToggle={(v) => toggle('companyTypes', v as CompanyType)}
      />

      <ChipGroup
        label="Specialization"
        options={(Object.keys(SPECIALIZATION_LABELS) as Specialization[]).map((k) => ({
          value: k,
          label: SPECIALIZATION_LABELS[k],
        }))}
        selected={filters.specializations}
        onToggle={(v) => toggle('specializations', v as Specialization)}
      />

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
        label="Source"
        options={(Object.keys(SOURCE_LABELS) as Source[]).map((k) => ({
          value: k,
          label: SOURCE_LABELS[k],
        }))}
        selected={filters.sources}
        onToggle={(v) => toggle('sources', v as Source)}
      />

      {languages.length > 0 ? (
        <ChipGroup
          label="Language"
          options={languages.map((l) => ({ value: l, label: l }))}
          selected={filters.languages}
          onToggle={(v) => toggle('languages', v)}
        />
      ) : null}

      {tags.length > 0 ? (
        <ChipGroup
          label="Tags"
          options={tags.map((t) => ({ value: t.id, label: t.name }))}
          selected={filters.tags}
          onToggle={(v) => toggle('tags', v)}
        />
      ) : null}

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
    </div>
  )
}
