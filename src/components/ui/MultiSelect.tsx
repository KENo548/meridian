import { useState } from 'react'
import { clsx } from '@/lib/utils'

interface MultiSelectProps<T extends string> {
  label: string
  hint?: string
  options: Array<{ value: T; label: string }>
  selected: T[]
  onToggle: (value: T) => void
  searchable?: boolean
  searchPlaceholder?: string
}

/**
 * Chip-based multi-select. Matches within the category are OR;
 * the control never invents values — only provided options.
 */
export function MultiSelect<T extends string>({
  label,
  hint,
  options,
  selected,
  onToggle,
  searchable = false,
  searchPlaceholder = 'Search…',
}: MultiSelectProps<T>) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const visible = q
    ? options.filter((o) => o.label.toLowerCase().includes(q) || o.value.includes(q))
    : options

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[var(--color-muted)] font-medium text-xs tracking-wide uppercase">
          {label}
        </span>
        {selected.length > 0 ? (
          <span className="text-[11px] text-[var(--color-faint)]">{selected.length} selected</span>
        ) : null}
      </div>
      {hint ? <p className="text-[11px] text-[var(--color-faint)] mb-1.5">{hint}</p> : null}
      {searchable && options.length > 8 ? (
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={`Search ${label.toLowerCase()}`}
          className="w-full h-8 mb-2 px-2 rounded-md bg-[var(--color-surface-2)] border border-[var(--color-border)] text-xs text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)]"
        />
      ) : null}
      <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
        {visible.map((opt) => {
          const on = selected.includes(opt.value)
          return (
            <button
              key={opt.value}
              type="button"
              role="checkbox"
              aria-checked={on}
              aria-pressed={on}
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
        {visible.length === 0 ? (
          <span className="text-[11px] text-[var(--color-faint)]">No matches</span>
        ) : null}
      </div>
    </div>
  )
}
