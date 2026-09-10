import type { ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { clsx } from '@/lib/utils'

interface EmptyStateProps {
  title?: string
  description?: string
  icon?: ReactNode
  actionLabel?: string
  onAction?: () => void
  className?: string
}

export function EmptyState({
  title = 'Your finance recruiting command centre starts here.',
  description = 'Track Spring Weeks, Summer Internships, and graduate programmes in one place.',
  icon,
  actionLabel = 'Add Application',
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center text-center px-6 py-16 rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface)]/50',
        className,
      )}
    >
      {icon ? <div className="mb-4 text-[var(--color-accent)]">{icon}</div> : null}
      <h3 className="font-display text-xl font-semibold text-[var(--color-text)] max-w-md">
        {title}
      </h3>
      {description ? (
        <p className="mt-2 text-sm text-[var(--color-muted)] max-w-sm">{description}</p>
      ) : null}
      {onAction ? (
        <Button variant="primary" className="mt-6" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  )
}
