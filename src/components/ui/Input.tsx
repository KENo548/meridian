import type { InputHTMLAttributes, ReactNode } from 'react'
import { clsx } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  leftIcon?: ReactNode
}

export function Input({ label, hint, error, leftIcon, className, id, ...rest }: InputProps) {
  const inputId = id ?? rest.name
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      {label && (
        <span className="text-[var(--color-muted)] font-medium text-xs tracking-wide uppercase">
          {label}
        </span>
      )}
      <span className="relative">
        {leftIcon && (
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-faint)] pointer-events-none">
            {leftIcon}
          </span>
        )}
        <input
          id={inputId}
          className={clsx(
            'w-full h-9 rounded-md bg-[var(--color-surface-2)] border border-[var(--color-border)]',
            'text-[var(--color-text)] placeholder:text-[var(--color-faint)]',
            // text-base on mobile prevents iOS auto-zoom on focus (>= 16px);
            // text-sm on md+ restores the compact desktop design (PR #1 U10).
            'text-base md:text-sm',
            'px-3 focus:border-[var(--color-accent)]/60 focus:outline-none transition-colors',
            leftIcon ? 'pl-9' : undefined,
            error ? 'border-[var(--color-danger)]' : undefined,
            className,
          )}
          {...rest}
        />
      </span>
      {error && <span className="text-xs text-[var(--color-danger)]">{error}</span>}
      {!error && hint && <span className="text-xs text-[var(--color-faint)]">{hint}</span>}
    </label>
  )
}
