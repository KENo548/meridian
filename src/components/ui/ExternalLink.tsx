import type { ReactNode } from 'react'
import { ExternalLink as ExternalLinkIcon } from 'lucide-react'
import { isValidUrl, clsx } from '@/lib/utils'

interface ExternalLinkProps {
  href?: string
  children?: ReactNode
  className?: string
  showIcon?: boolean
}

export function ExternalLink({ href, children, className, showIcon = true }: ExternalLinkProps) {
  if (!href || !isValidUrl(href) || !href.trim()) {
    return <span className="text-[var(--color-faint)]">—</span>
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={clsx(
        'inline-flex items-center gap-1 text-[var(--color-teal)] hover:text-[var(--color-accent)] transition-colors',
        className,
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="truncate">{children ?? 'Open'}</span>
      {showIcon ? <ExternalLinkIcon className="size-3 shrink-0" /> : null}
    </a>
  )
}
