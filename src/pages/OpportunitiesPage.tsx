import { useEffect, useState, useCallback } from 'react'
import { Search, ExternalLink, Star, MapPin, Clock, Building2, X, Filter, Loader2, Shield } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { CoverageDashboard } from '@/components/CoverageDashboard'
import { getOpportunities, getOpportunity, type Opportunity, type OpportunityMetrics, type OpportunityFilters } from '@/lib/jobSources'
import { useMeridianStore } from '@/lib/store'
import { clsx } from '@/lib/utils'

type PageTab = 'feed' | 'resolution'

const CATEGORY_OPTIONS = [
  { value: 'spring_week', label: 'Spring Week' },
  { value: 'summer_intern', label: 'Summer Internship' },
  { value: 'off_cycle', label: 'Off-Cycle' },
  { value: 'grad', label: 'Graduate' },
]

const CATEGORY_COLORS: Record<string, string> = {
  spring_week: 'teal',
  summer_intern: 'accent',
  off_cycle: 'warning',
  grad: 'success',
  unknown: 'muted',
}

const STATUS_LABELS: Record<string, string> = {
  verified_open: 'Verified Open',
  reachable: 'Reachable',
  tracker_open: 'Tracker Open',
  unknown: 'Unknown',
  closed: 'Closed',
}

const LIFECYCLE_LABELS: Record<string, string> = {
  open: 'Live',
  closing_soon: 'Closing Soon',
  closed: 'Closed',
  expired: 'Expired',
  discovered: 'Discovered',
}

const LIFECYCLE_COLORS: Record<string, string> = {
  open: 'success',
  closing_soon: 'warning',
  closed: 'danger',
  expired: 'muted',
  discovered: 'info',
}

const SOURCE_LABELS: Record<string, string> = {
  landtheoffer: 'Land the Offer',
  fyntraq: 'Fyntraq',
  trackr: 'Trackr',
  analystclass: 'AnalystClass',
  greenhouse: 'Greenhouse',
  workday: 'Workday',
  lever: 'Lever',
  ashby: 'Ashby',
  smartrecruiters: 'SmartRecruiters',
  oracle_hcm: 'Oracle HCM',
  avature: 'Avature',
  eightfold: 'Eightfold',
  successfactors: 'SuccessFactors',
}

export function OpportunitiesPage() {
  const [pageTab, setPageTab] = useState<PageTab>('feed')
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [metrics, setMetrics] = useState<OpportunityMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [filters] = useState<OpportunityFilters>({
    sort: 'updatedAt',
    order: 'desc',
    limit: 50,
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string[]>([])
  const [selectedCountry, setSelectedCountry] = useState<string[]>([])
  const [selectedStatus, setSelectedStatus] = useState<string[]>([])
  const [selectedSource, setSelectedSource] = useState<string[]>([])
  const [selectedLanguage, setSelectedLanguage] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<Opportunity | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)

  const createApplication = useMeridianStore((s) => s.createApplication)
  const pushToast = useMeridianStore((s) => s.pushToast)

  const fetchOpportunities = useCallback(async () => {
    setLoading(true)
    try {
      const activeFilters: OpportunityFilters = { ...filters, page }
      if (searchQuery) activeFilters.q = searchQuery
      if (selectedCategory.length > 0) activeFilters.category = selectedCategory.join(',')
      if (selectedCountry.length > 0) activeFilters.country = selectedCountry.join(',')
      if (selectedStatus.length > 0) activeFilters.status = selectedStatus.join(',')
      if (selectedSource.length > 0) activeFilters.source = selectedSource.join(',')
      if (selectedLanguage.length > 0) activeFilters.language = selectedLanguage.join(',')

      const result = await getOpportunities(activeFilters)
      setOpportunities(result.opportunities)
      setMetrics(result.metrics)
      setTotal(result.total)
    } catch (err) {
      console.error('Failed to fetch opportunities:', err)
    } finally {
      setLoading(false)
    }
  }, [filters, page, searchQuery, selectedCategory, selectedCountry, selectedStatus, selectedSource, selectedLanguage])

  useEffect(() => {
    fetchOpportunities()
  }, [fetchOpportunities])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && detailId) {
        setDetailId(null)
        setDetail(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [detailId])

  useEffect(() => {
    if (!detailId) return
    getOpportunity(detailId).then(setDetail)
  }, [detailId])

  const handleTrack = async (opp: Opportunity) => {
    try {
      const result = await createApplication({
        jobTitle: opp.programme || 'Opportunity',
        companyName: opp.companyName,
        location: opp.location || '',
        city: opp.location?.split(',')[0]?.trim() || '',
        country: opp.country || '',
        source: 'other',
        sourceUrl: opp.applyUrl || '',
        jobUrl: opp.applyUrl || '',
        status: 'interested',
        roleType: opp.category === 'spring_week' ? 'spring_week' :
                  opp.category === 'summer_intern' ? 'summer_internship' :
                  opp.category === 'off_cycle' ? 'off_cycle_internship' :
                  opp.category === 'grad' ? 'graduate_programme' : 'other',
        deadlineType: opp.rolling ? 'rolling' : opp.deadline ? 'specific' : 'unknown',
        deadline: opp.deadline || undefined,
        notes: [
          `Sources: ${opp.sources.map(s => SOURCE_LABELS[s] || s).join(', ')}`,
          opp.location ? `Location: ${opp.location}` : '',
          opp.country ? `Country: ${opp.country}` : '',
          opp.rolling ? 'Rolling deadline' : '',
          opp.daysUntilClose !== null ? `${opp.daysUntilClose} days until close` : '',
          `Status: ${STATUS_LABELS[opp.status] || opp.status}`,
        ].filter(Boolean).join('\n'),
        tagIds: [],
      })
      if (result.duplicate) {
        pushToast('info', `Already tracking ${opp.companyName} — ${result.duplicate.jobTitle}`)
      } else {
        pushToast('success', `Tracking ${opp.companyName} opportunity`)
      }
    } catch (err) {
      pushToast('error', 'Failed to track opportunity')
    }
  }

  const toggleFilter = (value: string, setter: React.Dispatch<React.SetStateAction<string[]>>) => {
    setter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value])
    setPage(1)
  }

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedCategory([])
    setSelectedCountry([])
    setSelectedStatus([])
    setSelectedSource([])
    setSelectedLanguage([])
    setPage(1)
  }

  const hasFilters = searchQuery || selectedCategory.length > 0 || selectedCountry.length > 0 ||
    selectedStatus.length > 0 || selectedSource.length > 0 || selectedLanguage.length > 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display tracking-tight">Opportunities</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Live finance recruiting feed from tracker intelligence
        </p>
      </div>

      <div className="flex gap-1 border-b border-[var(--color-border)]">
        {([
          { key: 'feed', label: 'Opportunity Feed', icon: Building2 },
          { key: 'resolution', label: 'Resolution & Coverage', icon: Shield },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setPageTab(key)}
            className={clsx(
              'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px flex items-center gap-2',
              pageTab === key
                ? 'text-[var(--color-accent)] border-[var(--color-accent)]'
                : 'text-[var(--color-muted)] border-transparent hover:text-[var(--color-text)]',
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      {pageTab === 'resolution' ? (
        <CoverageDashboard />
      ) : (<>
        {metrics && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <MetricCard label="Live" value={metrics.live} tone="accent" />
            <MetricCard label="Closing Soon" value={metrics.closing_soon} tone="warning" />
            <MetricCard label="Verified" value={metrics.verified_open} tone="success" />
            <MetricCard label="Tracker" value={metrics.tracker_open} tone="info" />
            <MetricCard label="Unknown" value={metrics.unknown} tone="muted" />
          </div>
        )}

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Input
            placeholder="Search opportunities..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setPage(1) }}
            leftIcon={<Search className="size-4" />}
          />
        </div>
        <Button
          variant={showFilters ? 'primary' : 'secondary'}
          onClick={() => setShowFilters(!showFilters)}
          leftIcon={<Filter className="size-4" />}
        >
          Filters
          {hasFilters && (
            <Badge tone="accent" className="ml-1">
              {[selectedCategory, selectedCountry, selectedStatus, selectedSource, selectedLanguage].filter(a => a.length > 0).length}
            </Badge>
          )}
        </Button>
      </div>

      {showFilters && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--color-text)]">Filters</span>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="size-3" />
                Clear all
              </Button>
            )}
          </div>

          <div className="space-y-3">
            <FilterGroup label="Programme">
              {CATEGORY_OPTIONS.map(opt => (
                <FilterChip
                  key={opt.value}
                  label={opt.label}
                  active={selectedCategory.includes(opt.value)}
                  onClick={() => toggleFilter(opt.value, setSelectedCategory)}
                />
              ))}
            </FilterGroup>

            <FilterGroup label="Status">
              {Object.entries(STATUS_LABELS).filter(([k]) => k !== 'closed').map(([value, label]) => (
                <FilterChip
                  key={value}
                  label={label}
                  active={selectedStatus.includes(value)}
                  onClick={() => toggleFilter(value, setSelectedStatus)}
                />
              ))}
            </FilterGroup>

            <FilterGroup label="Source">
              {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                <FilterChip
                  key={value}
                  label={label}
                  active={selectedSource.includes(value)}
                  onClick={() => toggleFilter(value, setSelectedSource)}
                />
              ))}
            </FilterGroup>

            <FilterGroup label="Language">
              {metrics && Object.entries(metrics.byLanguage).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([lang, count]) => (
                <FilterChip
                  key={lang}
                  label={`${lang} (${count})`}
                  active={selectedLanguage.includes(lang)}
                  onClick={() => toggleFilter(lang, setSelectedLanguage)}
                />
              ))}
            </FilterGroup>

            <FilterGroup label="Geography">
              {metrics && Object.entries(metrics.byCountry).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([code, count]) => (
                <FilterChip
                  key={code}
                  label={`${code.toUpperCase()} (${count})`}
                  active={selectedCountry.includes(code)}
                  onClick={() => toggleFilter(code, setSelectedCountry)}
                />
              ))}
            </FilterGroup>
          </div>
        </div>
      )}

      <div className="text-sm text-[var(--color-muted)]">
        {total} opportunities
        {hasFilters && ' (filtered)'}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-[var(--color-accent)]" />
        </div>
      ) : opportunities.length === 0 ? (
        <div className="text-center py-12">
          <Building2 className="size-12 mx-auto text-[var(--color-faint)] mb-4" />
          <p className="text-[var(--color-muted)]">No opportunities found</p>
          <p className="text-sm text-[var(--color-faint)] mt-1">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="space-y-3">
          {opportunities.map(opp => (
            <OpportunityCard
              key={opp.id}
              opportunity={opp}
              onTrack={() => handleTrack(opp)}
              onDetail={() => setDetailId(opp.id)}
              onApply={() => opp.applyUrl && window.open(opp.applyUrl, '_blank')}
            />
          ))}
        </div>
      )}

      {total > 50 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <span className="text-sm text-[var(--color-muted)]">
            Page {page} of {Math.ceil(total / 50)}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= Math.ceil(total / 50)}
            onClick={() => setPage(p => p + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {detail && (
        <OpportunityDetailModal
          opportunity={detail}
          onClose={() => { setDetailId(null); setDetail(null) }}
          onTrack={() => { handleTrack(detail); setDetailId(null); setDetail(null) }}
          onApply={() => detail.applyUrl && window.open(detail.applyUrl, '_blank')}
        />
      )}
      </>
      )}
    </div>
  )
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  const colorClass = {
    accent: 'text-[var(--color-accent)]',
    teal: 'text-[var(--color-teal)]',
    success: 'text-[var(--color-success)]',
    warning: 'text-[var(--color-warning)]',
    info: 'text-[var(--color-info)]',
    muted: 'text-[var(--color-faint)]',
  }[tone] || 'text-[var(--color-faint)]'

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
      <div className={clsx('text-2xl font-bold font-display', colorClass)}>
        {value}
      </div>
      <div className="text-xs text-[var(--color-muted)] mt-0.5">{label}</div>
    </div>
  )
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-[var(--color-faint)] uppercase tracking-wider mb-2">{label}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors',
        active
          ? 'bg-[var(--color-accent)]/20 text-[var(--color-accent)] border border-[var(--color-accent)]/30'
          : 'bg-[var(--color-surface-2)] text-[var(--color-muted)] border border-[var(--color-border)] hover:bg-[var(--color-surface-3)]',
      )}
    >
      {label}
      {active && <X className="size-3" />}
    </button>
  )
}

function OpportunityCard({
  opportunity: opp,
  onTrack,
  onDetail,
  onApply,
}: {
  opportunity: Opportunity
  onTrack: () => void
  onDetail: () => void
  onApply: () => void
}) {
  const categoryTone = CATEGORY_COLORS[opp.category] || 'muted'

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 hover:border-[var(--color-border-strong)] transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-[var(--color-text)]">{opp.companyName}</span>
            {opp.resolvedFirmId && (
              <Badge tone="info" className="text-[10px]">Resolved</Badge>
            )}
            {opp.status === 'verified_open' && (
              <Badge tone="success" className="text-[10px]">Verified</Badge>
            )}
            {opp.consecutiveMisses != null && opp.consecutiveMisses > 0 && opp.consecutiveMisses < 3 && (
              <Badge tone="warning" className="text-[10px]">{opp.consecutiveMisses} miss{opp.consecutiveMisses > 1 ? 'es' : ''}</Badge>
            )}
          </div>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            {opp.programme || 'Opportunity'}
          </p>
          <div className="flex items-center gap-3 mt-2 text-xs text-[var(--color-faint)] flex-wrap">
            {opp.location && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" />
                {opp.location}
              </span>
            )}
            <Badge tone={categoryTone as any}>
              {CATEGORY_OPTIONS.find(c => c.value === opp.category)?.label || opp.category}
            </Badge>
            {opp.division && (
              <Badge tone="muted" className="text-[10px]">{opp.division}</Badge>
            )}
            {opp.office && (
              <Badge tone="muted" className="text-[10px]">{opp.office}</Badge>
            )}
            {opp.sources.length > 0 && (
              <span className="inline-flex items-center gap-1">
                {opp.sources.map(s => SOURCE_LABELS[s] || s).join(' + ')}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 flex-wrap justify-end">
          {opp.status !== 'closed' && (
            <Button variant="ghost" size="sm" onClick={onTrack} className="text-xs sm:text-sm">
              <Star className="size-3.5" />
              <span className="hidden sm:inline">Track</span>
            </Button>
          )}
          {opp.applyUrl && (
            <Button variant="secondary" size="sm" onClick={onApply} className="text-xs sm:text-sm">
              <ExternalLink className="size-3.5" />
              <span className="hidden sm:inline">Apply</span>
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onDetail} className="text-xs sm:text-sm">
            <span className="hidden sm:inline">Details</span>
            <span className="sm:hidden">Info</span>
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[var(--color-border)]">
        {/* Lifecycle badge (primary) */}
        {opp.lifecycle && (
          <Badge tone={(LIFECYCLE_COLORS[opp.lifecycle] || 'muted') as any}>
            {LIFECYCLE_LABELS[opp.lifecycle] || opp.lifecycle}
          </Badge>
        )}

        {/* Source type indicator */}
        {opp.hasEmployerSource ? (
          <span className="inline-flex items-center gap-1 text-xs text-[var(--color-success)]">
            <Shield className="size-3" />
            Direct ATS
          </span>
        ) : opp.hasTrackerSource ? (
          <span className="inline-flex items-center gap-1 text-xs text-[var(--color-warning)]">
            <Shield className="size-3" />
            Tracker Only
          </span>
        ) : null}

        {opp.daysUntilClose !== null && opp.daysUntilClose !== undefined ? (
          <span className={clsx('inline-flex items-center gap-1 text-xs', 
            opp.daysUntilClose <= 3 ? 'text-[var(--color-danger)]' :
            opp.daysUntilClose <= 7 ? 'text-[var(--color-warning)]' :
            'text-[var(--color-muted)]'
          )}>
            <Clock className="size-3" />
            {opp.daysUntilClose <= 0 ? 'Closed' :
             opp.daysUntilClose === 1 ? '1 day left' :
             `${opp.daysUntilClose} days left`}
          </span>
        ) : null}

        {opp.deadline && (
          <span className="text-xs text-[var(--color-faint)]">
            Closes {new Date(opp.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </span>
        )}

        {/* Source count + sightings */}
        {opp.sightings && opp.sightings.length > 0 ? (
          <span className="text-[10px] text-[var(--color-faint)]">
            {opp.sightings.length} sighting{opp.sightings.length !== 1 ? 's' : ''}
          </span>
        ) : opp.sourceCount > 1 ? (
          <Badge tone="info" className="text-[10px]">
            {opp.sourceCount} sources
          </Badge>
        ) : null}
      </div>
    </div>
  )
}

function OpportunityDetailModal({
  opportunity: opp,
  onClose,
  onTrack,
  onApply,
}: {
  opportunity: Opportunity
  onClose: () => void
  onTrack: () => void
  onApply: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl max-h-[80vh] overflow-y-auto">
        <div className="sticky top-0 bg-[var(--color-surface)] border-b border-[var(--color-border)] p-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-lg">{opp.companyName}</h2>
            <p className="text-sm text-[var(--color-muted)]">{opp.programme || 'Opportunity'}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--color-surface-2)]">
            <X className="size-5 text-[var(--color-muted)]" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-[var(--color-faint)] text-xs uppercase tracking-wider mb-1">Location</div>
              <div>{opp.location || 'Not specified'}</div>
            </div>
            <div>
              <div className="text-[var(--color-faint)] text-xs uppercase tracking-wider mb-1">Programme</div>
              <div>{opp.title || opp.programme || 'Not specified'}</div>
            </div>
            <div>
              <div className="text-[var(--color-faint)] text-xs uppercase tracking-wider mb-1">Status</div>
              {opp.lifecycle && (
                <Badge tone={(LIFECYCLE_COLORS[opp.lifecycle] || 'muted') as any}>
                  {LIFECYCLE_LABELS[opp.lifecycle] || opp.lifecycle}
                </Badge>
              )}
            </div>
            <div>
              <div className="text-[var(--color-faint)] text-xs uppercase tracking-wider mb-1">Deadline</div>
              <div>
                {opp.deadline ? (
                  new Date(opp.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                ) : (
                  'Not specified'
                )}
              </div>
            </div>
            {opp.hasEmployerSource !== undefined && (
              <div>
                <div className="text-[var(--color-faint)] text-xs uppercase tracking-wider mb-1">Source Type</div>
                <div className="flex items-center gap-1">
                  <Shield className="size-3" />
                  {opp.hasEmployerSource ? 'Direct ATS Verified' : 'Tracker Only'}
                </div>
              </div>
            )}
            {opp.identityTier && (
              <div>
                <div className="text-[var(--color-faint)] text-xs uppercase tracking-wider mb-1">Identity</div>
                <div className="text-xs">{opp.identityTier}</div>
              </div>
            )}
          </div>

          <div>
            <div className="text-[var(--color-faint)] text-xs uppercase tracking-wider mb-2">Sources</div>
            <div className="flex flex-wrap gap-2">
              {opp.sources.map(source => (
                <Badge key={source} tone="info">
                  {SOURCE_LABELS[source] || source}
                </Badge>
              ))}
            </div>
          </div>

          {opp.sightings && opp.sightings.length > 0 && (
            <div>
              <div className="text-[var(--color-faint)] text-xs uppercase tracking-wider mb-2">Sightings</div>
              <div className="space-y-2">
                {opp.sightings.map((sighting, i) => (
                  <div key={i} className="text-xs rounded bg-[var(--color-surface-2)] p-2">
                    <div className="flex items-center gap-2">
                      <Badge tone={sighting.sourceTier === 'employer_ats' ? 'success' : sighting.sourceTier === 'tracker' ? 'warning' : 'muted'}>
                        {SOURCE_LABELS[sighting.source] || sighting.source}
                      </Badge>
                      <span className="text-[var(--color-faint)]">{sighting.sourceTier}</span>
                    </div>
                    <div className="text-[var(--color-faint)] mt-1">
                      Last seen: {new Date(sighting.lastSeenAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-[var(--color-surface)] border-t border-[var(--color-border)] p-4 flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {opp.applyUrl && (
            <Button variant="secondary" onClick={onApply}>
              <ExternalLink className="size-3.5" />
              Apply
            </Button>
          )}
          {opp.status !== 'closed' && (
            <Button variant="primary" onClick={onTrack}>
              <Star className="size-3.5" />
              Track Opportunity
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
