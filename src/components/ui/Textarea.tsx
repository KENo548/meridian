import type { TextareaHTMLAttributes } from 'react'
import { clsx } from '@/lib/utils'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  hint?: string
  error?: string
}

export function Textarea({ label, hint, error, className, id, ...rest }: TextareaProps) {
  const areaId = id ?? rest.name
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      {label && (
        <span className="text-[var(--color-muted)] font-medium text-xs tracking-wide uppercase">
          {label}
        </span>
      )}
      <textarea
        id={areaId}
        className={clsx(
          'w-full min-h-[88px] rounded-md bg-[var(--color-surface-2)] border border-[var(--color-border)]',
          'text-[var(--color-text)] placeholder:text-[var(--color-faint)]',
          'px-3 py-2 focus:border-[var(--color-accent)]/60 focus:outline-none transition-colors resize-y',
          error && 'border-[var(--color-danger)]',
          className,
        )}
        {...rest}
      />
      {error && <span className="text-xs text-[var(--color-danger)]">{error}</span>}
      {!error && hint && <span className="text-xs text-[var(--color-faint)]">{hint}</span>}
    </label>
  )
}
