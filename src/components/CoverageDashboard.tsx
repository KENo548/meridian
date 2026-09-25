import { useEffect, useState } from 'react'
import { Shield, RefreshCw, TrendingUp, Clock, ExternalLink, ChevronDown, ChevronUp, Loader2, Activity, AlertTriangle, CheckCircle } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { clsx } from '@/lib/utils'
import {
  resolveOpportunities,
  getCoverageGapReport,
  getStalenessReport,
  applyStalenessTransitions,
  type CoverageGapReport,
  type StalenessReport,
} from '@/lib/jobSources'

interface ResolutionStats {
  total: number
  classified: number
  reachable: number
  verified: number
  unverified: number
  firmResolved: number
  newlyReachable: number
  newlyVerified: number
  errors: number
}

interface ResolveResult {
  stats: ResolutionStats
  coverageGap: CoverageGapReport
}

interface AdapterHealth {
  source: string
  status: string
  last_scan_at: string | null
  jobs_found: number
  previous_jobs_found: number
  baseline_avg_jobs: number
  consecutive_zero_scans: number
  duration_ms: number
  error_message: string | null
  last_non_zero_at: string | null
}

type Tab = 'resolution' | 'coverage' | 'staleness' | 'adapter-health'

export function CoverageDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('resolution')
  const [resolving, setResolving] = useState(false)
  const [resolveResult, setResolveResult] = useState<ResolveResult | null>(null)
  const [coverage, setCoverage] = useState<CoverageGapReport | null>(null)
  const [staleness, setStaleness] = useState<StalenessReport | null>(null)
  const [applyingStaleness, setApplyingStaleness] = useState(false)
  const [loadingCoverage, setLoadingCoverage] = useState(false)
  const [loadingStaleness, setLoadingStaleness] = useState(false)
  const [adapterHealth, setAdapterHealth] = useState<AdapterHealth[]>([])
  const [loadingHealth, setLoadingHealth] = useState(false)

  const loadCoverage = async () => {
    setLoadingCoverage(true)
    try {
      const report = await getCoverageGapReport()
      setCoverage(report)
    } finally {
      setLoadingCoverage(false)
    }
  }

  const loadStaleness = async () => {
    setLoadingStaleness(true)
    try {
      const report = await getStalenessReport()
      setStaleness(report)
    } finally {
      setLoadingStaleness(false)
    }
  }

  const handleResolve = async () => {
    setResolving(true)
    try {
      const result = await resolveOpportunities({ verify: true, limit: 100 })
      setResolveResult(result)
      await loadCoverage()
    } finally {
      setResolving(false)
    }
  }

  const handleApplyStaleness = async () => {
    setApplyingStaleness(true)
    try {
      await applyStalenessTransitions()
      await loadStaleness()
    } finally {
      setApplyingStaleness(false)
    }
  }

  const loadAdapterHealth = async () => {
    setLoadingHealth(true)
    try {
      // Same-origin API: relative path, routed by the Vercel rewrite.
      const res = await fetch('/api/adapter-health', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setAdapterHealth(data.adapters || [])
      }
    } catch {
      // Adapter health endpoint may not exist yet
    } finally {
      setLoadingHealth(false)
    }
  }

  useEffect(() => {
    loadCoverage()
    loadStaleness()
    loadAdapterHealth()
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold font-display">Resolution & Coverage</h2>
          <p className="text-sm text-[var(--color-muted)]">Verify sources, resolve ATS providers, track staleness</p>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={handleResolve}
          disabled={resolving}
          leftIcon={resolving ? <Loader2 className="size-3.5 animate-spin" /> : <Shield className="size-3.5" />}
        >
          {resolving ? 'Resolving...' : 'Run Resolution'}
        </Button>
      </div>

      {resolveResult && (
        <div className="rounded-lg border border-[var(--color-success)]/30 bg-[var(--color-success)]/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="size-4 text-[var(--color-success)]" />
            <span className="text-sm font-medium text-[var(--color-success)]">Resolution Complete</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <StatItem label="Total" value={resolveResult.stats.total} />
            <StatItem label="Classified" value={resolveResult.stats.classified} />
            <StatItem label="Reachable" value={resolveResult.stats.reachable} tone="info" />
            <StatItem label="Newly Reachable" value={resolveResult.stats.newlyReachable} tone="accent" />
          </div>
        </div>
      )}

      <div className="flex gap-1 border-b border-[var(--color-border)]">
        {(['resolution', 'coverage', 'staleness', 'adapter-health'] as Tab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === tab
                ? 'text-[var(--color-accent)] border-[var(--color-accent)]'
                : 'text-[var(--color-muted)] border-transparent hover:text-[var(--color-text)]',
            )}
          >
            {tab === 'resolution' && 'Resolution Status'}
            {tab === 'coverage' && 'Coverage Gaps'}
            {tab === 'staleness' && 'Staleness'}
            {tab === 'adapter-health' && 'Adapter Health'}
          </button>
        ))}
      </div>

      {activeTab === 'resolution' && (
        <ResolutionPanel result={resolveResult} />
      )}

      {activeTab === 'coverage' && (
        <CoveragePanel
          report={coverage}
          loading={loadingCoverage}
          onRefresh={loadCoverage}
        />
      )}

      {activeTab === 'staleness' && (
        <StalenessPanel
          report={staleness}
          loading={loadingStaleness}
          onRefresh={loadStaleness}
          onApply={handleApplyStaleness}
          applying={applyingStaleness}
        />
      )}

      {activeTab === 'adapter-health' && (
        <AdapterHealthPanel
          adapters={adapterHealth}
          loading={loadingHealth}
          onRefresh={loadAdapterHealth}
        />
      )}
    </div>
  )
}

function StatItem({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div>
      <div className={clsx('text-xl font-bold font-display', tone === 'success' && 'text-[var(--color-success)]', tone === 'accent' && 'text-[var(--color-accent)]', !tone && 'text-[var(--color-text)]')}>
        {value}
      </div>
      <div className="text-xs text-[var(--color-faint)]">{label}</div>
    </div>
  )
}

function ResolutionPanel({ result }: { result: ResolveResult | null }) {
  if (!result) {
    return (
      <div className="text-center py-8 text-[var(--color-muted)] text-sm">
        <Shield className="size-8 mx-auto mb-2 text-[var(--color-faint)]" />
        <p>Click "Run Resolution" to classify URLs and verify ATS sources</p>
        <p className="text-xs text-[var(--color-faint)] mt-1">
          This will verify HTTP connectivity to direct ATS providers and update status accordingly
        </p>
      </div>
    )
  }

  const { stats, coverageGap } = result
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatItem label="Total Entries" value={stats.total} />
        <StatItem label="URLs Classified" value={stats.classified} />
        <StatItem label="URL Reachable" value={stats.reachable} tone="info" />
        <StatItem label="Firm Resolved" value={stats.firmResolved} tone="success" />
        <StatItem label="Unreachable" value={stats.unverified} />
        <StatItem label="Errors" value={stats.errors} />
      </div>

      {coverageGap.recommendations.length > 0 && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h3 className="text-sm font-medium mb-3 flex items-center gap-2">
            <TrendingUp className="size-4 text-[var(--color-accent)]" />
            Recommendations
          </h3>
          <div className="space-y-2">
            {coverageGap.recommendations.map((rec, i) => (
              <div key={i} className="text-sm rounded bg-[var(--color-surface-2)] p-3">
                <Badge tone={rec.type === 'high_impact' ? 'accent' : rec.type === 'low_hanging_fruit' ? 'success' : 'info'} className="mb-1">
                  {rec.type.replace(/_/g, ' ')}
                </Badge>
                <p className="text-[var(--color-text)]">{rec.message}</p>
                {rec.providers && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {rec.providers.map(p => (
                      <Badge key={p.provider} tone="muted">{p.provider} ({p.count})</Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CoveragePanel({ report, loading, onRefresh }: { report: CoverageGapReport | null; loading: boolean; onRefresh: () => void }) {
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 animate-spin text-[var(--color-accent)]" />
      </div>
    )
  }

  if (!report) return null

  const providers = Object.entries(report.byProvider).sort((a, b) => b[1].count - a[1].count)
  const domains = Object.entries(report.byDomain).sort((a, b) => b[1].count - a[1].count).slice(0, 10)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <div className="text-xl font-bold font-display text-[var(--color-success)]">{report.byResolutionStatus.direct_resolved}</div>
          <div className="text-xs text-[var(--color-faint)]">Direct Resolved</div>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <div className="text-xl font-bold font-display text-[var(--color-info)]">{report.byResolutionStatus.firm_resolved}</div>
          <div className="text-xs text-[var(--color-faint)]">Firm Resolved</div>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <div className="text-xl font-bold font-display text-[var(--color-teal)]">{report.byResolutionStatus.reachable || 0}</div>
          <div className="text-xs text-[var(--color-faint)]">Reachable</div>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <div className="text-xl font-bold font-display text-[var(--color-warning)]">{report.byResolutionStatus.unresolved}</div>
          <div className="text-xs text-[var(--color-faint)]">Unresolved</div>
        </div>
      </div>

      {providers.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-[var(--color-text)]">By ATS Provider</h3>
            <Button variant="ghost" size="sm" onClick={onRefresh}>
              <RefreshCw className="size-3.5" />
            </Button>
          </div>
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] divide-y divide-[var(--color-border)]">
            {providers.map(([provider, data]) => (
              <div key={provider}>
                <button
                  onClick={() => setExpandedProvider(expandedProvider === provider ? null : provider)}
                  className="w-full px-4 py-3 flex items-center justify-between text-sm hover:bg-[var(--color-surface-2)] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-[var(--color-text)]">{provider}</span>
                    <Badge tone={data.resolvable ? 'success' : 'muted'}>
                      {data.resolvable ? 'Resolvable' : 'Not Supported'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[var(--color-muted)]">{data.count} entries</span>
                    {expandedProvider === provider ? (
                      <ChevronUp className="size-4 text-[var(--color-faint)]" />
                    ) : (
                      <ChevronDown className="size-4 text-[var(--color-faint)]" />
                    )}
                  </div>
                </button>
                {expandedProvider === provider && (
                  <div className="px-4 pb-3">
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {data.entries.slice(0, 20).map(entry => (
                        <div key={entry.id} className="flex items-center justify-between text-xs py-1 px-2 rounded bg-[var(--color-surface-2)]">
                          <span className="text-[var(--color-text)]">{entry.companyName}</span>
                          {entry.applyUrl && (
                            <a
                              href={entry.applyUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[var(--color-accent)] hover:underline flex items-center gap-1"
                            >
                              <ExternalLink className="size-3" />
                              View
                            </a>
                          )}
                        </div>
                      ))}
                      {data.entries.length > 20 && (
                        <div className="text-xs text-[var(--color-faint)] text-center py-1">
                          +{data.entries.length - 20} more
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {domains.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text)] mb-2">Top Domains (Unresolved)</h3>
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="space-y-2">
              {domains.map(([domain, data]) => (
                <div key={domain} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[var(--color-text)]">{domain}</span>
                    <Badge tone={data.provider ? 'success' : 'warning'}>
                      {data.provider || 'Unknown'}
                    </Badge>
                  </div>
                  <span className="text-[var(--color-muted)]">{data.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {report.recommendations.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text)] mb-2">Recommendations</h3>
          <div className="space-y-2">
            {report.recommendations.map((rec, i) => (
              <div key={i} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm">
                <Badge tone={rec.type === 'high_impact' ? 'accent' : rec.type === 'low_hanging_fruit' ? 'success' : 'info'}>
                  {rec.type.replace(/_/g, ' ')}
                </Badge>
                <p className="text-[var(--color-text)] mt-1">{rec.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StalenessPanel({ report, loading, onRefresh, onApply, applying }: {
  report: StalenessReport | null
  loading: boolean
  onRefresh: () => void
  onApply: () => void
  applying: boolean
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 animate-spin text-[var(--color-accent)]" />
      </div>
    )
  }

  if (!report) return null

  const total = report.total || 1
  const freshPct = Math.round((report.fresh / total) * 100)
  const stalePct = Math.round((report.stale / total) * 100)
  const missingPct = Math.round((report.missing / total) * 100)
  const expiredPct = Math.round((report.expired / total) * 100)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <div className="text-xl font-bold font-display text-[var(--color-text)]">{report.total}</div>
          <div className="text-xs text-[var(--color-faint)]">Total</div>
        </div>
        <div className="rounded-lg border border-[var(--color-success)]/30 bg-[var(--color-success)]/5 p-3">
          <div className="text-xl font-bold font-display text-[var(--color-success)]">{report.fresh}</div>
          <div className="text-xs text-[var(--color-faint)]">Fresh ({freshPct}%)</div>
        </div>
        <div className="rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/5 p-3">
          <div className="text-xl font-bold font-display text-[var(--color-warning)]">{report.stale}</div>
          <div className="text-xs text-[var(--color-faint)]">Stale ({stalePct}%)</div>
        </div>
        <div className="rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5 p-3">
          <div className="text-xl font-bold font-display text-[var(--color-danger)]">{report.missing}</div>
          <div className="text-xs text-[var(--color-faint)]">Missing ({missingPct}%)</div>
        </div>
        <div className="rounded-lg border border-[var(--color-faint)]/30 bg-[var(--color-surface-2)] p-3">
          <div className="text-xl font-bold font-display text-[var(--color-faint)]">{report.expired}</div>
          <div className="text-xs text-[var(--color-faint)]">Expired ({expiredPct}%)</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="secondary"
          size="sm"
          onClick={onApply}
          disabled={applying}
          leftIcon={applying ? <Loader2 className="size-3.5 animate-spin" /> : <Clock className="size-3.5" />}
        >
          {applying ? 'Applying...' : 'Apply Staleness Transitions'}
        </Button>
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          <RefreshCw className="size-3.5" />
        </Button>
        <span className="text-xs text-[var(--color-faint)]">
          {report.transitions} transition(s) applied this scan
        </span>
      </div>

      {Object.keys(report.byReason).length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-[var(--color-text)] mb-2">By Reason</h3>
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="space-y-2">
              {Object.entries(report.byReason).sort((a, b) => b[1] - a[1]).map(([reason, count]) => (
                <div key={reason} className="flex items-center justify-between text-sm">
                  <span className="text-[var(--color-text)]">{reason}</span>
                  <Badge tone="muted">{count}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-sm text-[var(--color-muted)]">
        <h4 className="font-medium text-[var(--color-text)] mb-2">How Staleness Works</h4>
        <ul className="space-y-1 text-xs">
          <li><strong className="text-[var(--color-success)]">Fresh</strong>: Seen within 14 days</li>
          <li><strong className="text-[var(--color-warning)]">Stale</strong>: Not seen for 14-30 days — may be closing soon</li>
          <li><strong className="text-[var(--color-danger)]">Missing</strong>: Not seen for 30-60 days — likely closed</li>
          <li><strong className="text-[var(--color-faint)]">Expired</strong>: Not seen for 60+ days — considered closed</li>
          <li className="mt-2 text-[var(--color-faint)]">
            After 3 consecutive misses, entries transition to "missing" status.
            Apply transitions to update status accordingly.
          </li>
        </ul>
      </div>
    </div>
  )
}

const SOURCE_LABELS: Record<string, string> = {
  greenhouse: 'Greenhouse', lever: 'Lever', ashby: 'Ashby',
  workday: 'Workday', smartrecruiters: 'SmartRecruiters',
  oleeo_rss: 'Oleeo RSS', oracle_hcm: 'Oracle HCM',
  avature: 'Avature', eightfold: 'Eightfold', successfactors: 'SuccessFactors',
  analystclass: 'AnalystClass', fyntraq: 'Fyntraq',
  trackr: 'Trackr', landtheoffer: 'Land the Offer',
}

function AdapterHealthPanel({ adapters, loading, onRefresh }: {
  adapters: AdapterHealth[]
  loading: boolean
  onRefresh: () => void
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="size-5 animate-spin text-[var(--color-muted)]" />
        <span className="ml-2 text-sm text-[var(--color-muted)]">Loading adapter health...</span>
      </div>
    )
  }

  if (adapters.length === 0) {
    return (
      <div className="text-center p-8 text-sm text-[var(--color-muted)]">
        <Activity className="size-8 mx-auto mb-2 opacity-50" />
        <p>No adapter health data yet.</p>
        <p className="text-xs mt-1">Run a scan to populate adapter health metrics.</p>
        <Button variant="secondary" size="sm" className="mt-3" onClick={onRefresh}>
          <RefreshCw className="size-3" /> Refresh
        </Button>
      </div>
    )
  }

  const healthy = adapters.filter(a => a.status === 'healthy').length
  const degraded = adapters.filter(a => a.status === 'degraded').length
  const unhealthy = adapters.filter(a => a.status === 'unhealthy').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-3 text-sm">
          <span className="flex items-center gap-1"><CheckCircle className="size-3.5 text-[var(--color-success)]" /> {healthy} healthy</span>
          {degraded > 0 && <span className="flex items-center gap-1"><AlertTriangle className="size-3.5 text-[var(--color-warning)]" /> {degraded} degraded</span>}
          {unhealthy > 0 && <span className="flex items-center gap-1"><AlertTriangle className="size-3.5 text-[var(--color-danger)]" /> {unhealthy} unhealthy</span>}
        </div>
        <Button variant="secondary" size="sm" onClick={onRefresh}>
          <RefreshCw className="size-3" /> Refresh
        </Button>
      </div>

      <div className="space-y-2">
        {adapters.map(adapter => (
          <div key={adapter.source} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge tone={adapter.status === 'healthy' ? 'success' : adapter.status === 'degraded' ? 'warning' : 'danger'}>
                  {adapter.status}
                </Badge>
                <span className="font-medium text-sm">{SOURCE_LABELS[adapter.source] || adapter.source}</span>
              </div>
              <div className="text-xs text-[var(--color-faint)]">
                {adapter.jobs_found} jobs · {adapter.duration_ms}ms
              </div>
            </div>
            {adapter.consecutive_zero_scans > 0 && (
              <div className="mt-1 text-xs text-[var(--color-warning)]">
                {adapter.consecutive_zero_scans} consecutive zero scans (baseline: {adapter.baseline_avg_jobs})
              </div>
            )}
            {adapter.error_message && (
              <div className="mt-1 text-xs text-[var(--color-danger)]">
                Error: {adapter.error_message.substring(0, 100)}
              </div>
            )}
            {adapter.last_non_zero_at && (
              <div className="mt-1 text-xs text-[var(--color-faint)]">
                Last data: {new Date(adapter.last_non_zero_at).toLocaleDateString()}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
