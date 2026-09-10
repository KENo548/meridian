import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { clsx } from '@/lib/utils'
import { ExternalLink, Import, MapPin, Building2, Banknote, Calendar } from 'lucide-react'
import type { JobResult } from '@/lib/jobSources'

interface JobSearchResultsProps {
  jobs: JobResult[]
  loading?: boolean
  error?: string | null
  selectedIds: Set<string>
  onToggleSelect: (id: string) => void
  onSelectAll: () => void
  onDeselectAll: () => void
  onImport: (job: JobResult) => void
  onImportAll: () => void
  onLoadMore?: () => void
  hasMore?: boolean
  sourceBadgeTone?: Record<string, 'accent' | 'teal' | 'success' | 'warning' | 'info' | 'muted'>
}

const SOURCE_COLORS: Record<string, 'accent' | 'teal' | 'success' | 'warning' | 'info' | 'muted'> = {
  adzuna: 'accent',
  jsearch: 'teal',
  indeed: 'info',
  glassdoor: 'warning',
  linkedin: 'info',
  rss: 'muted',
}

function formatPosted(date?: string): string {
  if (!date) return ''
  try {
    const d = new Date(date)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  } catch {
    return date
  }
}

export function JobSearchResults({
  jobs,
  loading = false,
  error = null,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onImport,
  onImportAll,
  onLoadMore,
  hasMore = false,
  sourceBadgeTone = SOURCE_COLORS,
}: JobSearchResultsProps) {
  if (error) {
    return (
      <div className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 p-6 text-center">
        <p className="text-sm text-[var(--color-danger)] font-medium">Search Error</p>
        <p className="mt-1 text-xs text-[var(--color-muted)]">{error}</p>
      </div>
    )
  }

  if (!loading && jobs.length === 0) {
    return (
      <EmptyState
        title="No jobs found"
        description="Try adjusting your search terms, location, or source filters."
        icon={<Building2 className="size-8" />}
      />
    )
  }

  const allSelected = jobs.length > 0 && selectedIds.size === jobs.length
  const someSelected = selectedIds.size > 0 && !allSelected

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={allSelected ? onDeselectAll : onSelectAll}
            className={clsx(
              'h-4 w-4 rounded border transition-colors cursor-pointer',
              allSelected
                ? 'bg-[var(--color-accent)] border-[var(--color-accent)]'
                : someSelected
                  ? 'bg-[var(--color-accent)]/50 border-[var(--color-accent)]'
                  : 'border-[var(--color-border)] hover:border-[var(--color-faint)]',
            )}
          />
          <span className="text-xs text-[var(--color-muted)]">
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : `${jobs.length} results`}
          </span>
        </div>
        {selectedIds.size > 0 && (
          <Button variant="primary" size="sm" onClick={onImportAll}>
            <Import className="size-3.5" />
            Import Selected ({selectedIds.size})
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {jobs.map((job) => {
          const isSelected = selectedIds.has(job.id)
          return (
            <div
              key={job.id}
              className={clsx(
                'group relative rounded-lg border p-4 transition-all duration-150',
                isSelected
                  ? 'border-[var(--color-accent)]/50 bg-[var(--color-accent)]/5'
                  : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-2)]',
              )}
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={() => onToggleSelect(job.id)}
                  className={clsx(
                    'mt-0.5 h-4 w-4 shrink-0 rounded border transition-colors cursor-pointer',
                    isSelected
                      ? 'bg-[var(--color-accent)] border-[var(--color-accent)]'
                      : 'border-[var(--color-border)] hover:border-[var(--color-faint)]',
                  )}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-medium text-[var(--color-text)] line-clamp-2 leading-snug">
                      {job.title}
                    </h3>
                    <Badge tone={sourceBadgeTone[job.source] ?? 'muted'} className="shrink-0">
                      {job.source}
                    </Badge>
                  </div>

                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[var(--color-muted)]">
                    <Building2 className="size-3 shrink-0" />
                    <span className="truncate">{job.company}</span>
                  </div>

                  <div className="mt-1 flex items-center gap-1.5 text-xs text-[var(--color-faint)]">
                    <MapPin className="size-3 shrink-0" />
                    <span className="truncate">{job.location}</span>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-faint)]">
                    {job.salary && (
                      <span className="flex items-center gap-1">
                        <Banknote className="size-3" />
                        {job.salary}
                      </span>
                    )}
                    {job.posted && (
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        {formatPosted(job.posted)}
                      </span>
                    )}
                    {job.remote && <Badge tone="teal">Remote</Badge>}
                  </div>

                  {job.tags && job.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {job.tags.slice(0, 3).map((tag) => (
                        <Badge key={tag} tone="neutral">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 border-t border-[var(--color-border)] pt-3">
                <Button variant="primary" size="sm" className="flex-1" onClick={() => onImport(job)}>
                  <Import className="size-3.5" />
                  Import
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => window.open(job.url, '_blank', 'noopener,noreferrer')}
                >
                  <ExternalLink className="size-3.5" />
                  View
                </Button>
              </div>
            </div>
          )
        })}

        {loading &&
          Array.from({ length: 6 }).map((_, i) => (
            <div
              key={`skeleton-${i}`}
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 animate-pulse"
            >
              <div className="h-4 w-3/4 rounded bg-[var(--color-surface-3)]" />
              <div className="mt-2 h-3 w-1/2 rounded bg-[var(--color-surface-3)]" />
              <div className="mt-2 h-3 w-2/3 rounded bg-[var(--color-surface-3)]" />
              <div className="mt-4 h-8 rounded bg-[var(--color-surface-3)]" />
            </div>
          ))}
      </div>

      {hasMore && !loading && (
        <div className="flex justify-center pt-2">
          <Button variant="secondary" onClick={onLoadMore}>
            Load More
          </Button>
        </div>
      )}
    </div>
  )
}
