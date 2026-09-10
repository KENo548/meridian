import type { ReactNode } from 'react'
import { clsx } from '@/lib/utils'

type Tone =
  | 'default'
  | 'neutral'
  | 'accent'
  | 'teal'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'muted'

interface BadgeProps {
  children: ReactNode
  tone?: Tone
  className?: string
}

const tones: Record<Tone, string> = {
  default: 'bg-[var(--color-surface-3)] text-[var(--color-muted)] border-[var(--color-border)]',
  neutral: 'bg-[var(--color-surface-2)] text-[var(--color-faint)] border-[var(--color-border)]',
  accent: 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] border-[var(--color-accent)]/30',
  teal: 'bg-[var(--color-teal)]/15 text-[var(--color-teal)] border-[var(--color-teal)]/30',
  success: 'bg-[var(--color-success)]/15 text-[var(--color-success)] border-[var(--color-success)]/30',
  warning: 'bg-[var(--color-warning)]/15 text-[var(--color-warning)] border-[var(--color-warning)]/30',
  danger: 'bg-[var(--color-danger)]/15 text-[var(--color-danger)] border-[var(--color-danger)]/30',
  info: 'bg-[var(--color-info)]/15 text-[var(--color-info)] border-[var(--color-info)]/30',
  muted: 'bg-[var(--color-surface-2)] text-[var(--color-faint)] border-[var(--color-border)]',
}

export function Badge({ children, tone = 'default', className }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium border whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
