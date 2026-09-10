import type { SelectHTMLAttributes, ReactNode } from 'react'
import { clsx } from '@/lib/utils'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> {
  label?: string
  hint?: string
  error?: string
  options?: SelectOption[]
  placeholder?: string
  children?: ReactNode
}

export function Select({
  label,
  hint,
  error,
  className,
  id,
  options,
  placeholder,
  children,
  ...rest
}: SelectProps) {
  const selectId = id ?? rest.name
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      {label ? (
        <span className="text-[var(--color-muted)] font-medium text-xs tracking-wide uppercase">
          {label}
        </span>
      ) : null}
      <select
        id={selectId}
        className={clsx(
          'w-full h-9 rounded-md bg-[var(--color-surface-2)] border border-[var(--color-border)]',
          'text-[var(--color-text)] px-3 focus:border-[var(--color-accent)]/60 focus:outline-none',
          'transition-colors appearance-none cursor-pointer',
          error && 'border-[var(--color-danger)]',
          className,
        )}
        {...rest}
      >
        {placeholder != null ? (
          <option value="">{placeholder}</option>
        ) : null}
        {options
          ? options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))
          : children}
      </select>
      {error ? <span className="text-xs text-[var(--color-danger)]">{error}</span> : null}
      {!error && hint ? <span className="text-xs text-[var(--color-faint)]">{hint}</span> : null}
    </label>
  )
}
