import { useState, useCallback, useEffect } from 'react'
import {
  Search,
  Globe,
  Rss,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
  Download,
  Building2,
  Play,
  Clock,
  ChevronDown,
  ChevronUp,
  Star,
  ExternalLink,
  MapPin,
  SlidersHorizontal,
  X as XIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { JobSearchResults } from '@/components/sources/JobSearchResults'
import { ImportPreviewModal } from '@/components/sources/ImportPreviewModal'
import {
  searchJobs,
  getSourceStatus,
  getRssFeeds,
  addRssFeed,
  removeRssFeed,
  checkRssFeeds,
  jobToApplication,
  getRegistry,
  toggleFirmEnabled,
  triggerScan,
  getScanStatus,
  getOpportunities,
  type JobResult,
  type SourceStatus,
  type FirmInfo,
  type ScanResult,
  type Opportunity,
} from '@/lib/jobSources'
import { useMeridianStore } from '@/lib/store'
import { clsx } from '@/lib/utils'

const COUNTRY_OPTIONS = [
  { value: '', label: 'All Countries' },
  { value: 'gb', label: 'United Kingdom' },
  { value: 'de', label: 'Germany' },
  { value: 'us', label: 'United States' },
  { value: 'fr', label: 'France' },
  { value: 'sg', label: 'Singapore' },
  { value: 'hk', label: 'Hong Kong' },
  { value: 'ch', label: 'Switzerland' },
  { value: 'ie', label: 'Ireland' },
  { value: 'jp', label: 'Japan' },
]

const CATEGORY_LABELS: Record<string, string> = {
  bulge_bracket: 'Bulge Bracket',
  elite_boutique: 'Elite Boutique',
  middle_market: 'Middle Market',
  private_equity: 'Private Equity',
  hedge_fund: 'Hedge Fund',
  prop_trading: 'Prop Trading',
}

const PROVIDER_LABELS: Record<string, string> = {
  greenhouse: 'Greenhouse',
  workday: 'Workday',
  oleeo_rss: 'Oleeo RSS',
  custom: 'Custom',
  oracle_hcm: 'Oracle HCM',
  eightfold: 'Eightfold AI',
  successfactors: 'SuccessFactors',
  avature: 'Avature',
}

const STATUS_COLORS: Record<string, string> = {
  verified_open: 'success',
  reachable: 'info',
  tracker_open: 'warning',
  unknown: 'muted',
  closed: 'danger',
}

const CATEGORY_COLORS: Record<string, string> = {
  spring_week: 'teal',
  summer_intern: 'accent',
  off_cycle: 'warning',
  grad: 'success',
  unknown: 'muted',
}

export function SourcesPage() {
  const createApplication = useMeridianStore((s) => s.createApplication)
  const pushToast = useMeridianStore((s) => s.pushToast)

  // Search state
  const [query, setQuery] = useState('')
  const [location, setLocation] = useState('')
  const [country, setCountry] = useState('')
  const [selectedSources, setSelectedSources] = useState<string[]>(['rss'])
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<JobResult[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Source management state
  const [sources, setSources] = useState<SourceStatus[]>([])
  const [rssFeeds, setRssFeeds] = useState<string[]>([])
  const [newFeedUrl, setNewFeedUrl] = useState('')
  const [checkingRss, setCheckingRss] = useState(false)
  const [addingFeed, setAddingFeed] = useState(false)

  // Registry state
  const [firms, setFirms] = useState<FirmInfo[]>([])
  const [registryStats, setRegistryStats] = useState<any>(null)
  const [showRegistry, setShowRegistry] = useState(false)
  const [registryFilter, setRegistryFilter] = useState<string>('all')
  const [togglingFirm, setTogglingFirm] = useState<string | null>(null)
  const [firmSearch, setFirmSearch] = useState('')

  // Scan state
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResult | null>(null)
  const [lastScan, setLastScan] = useState<any>(null)

  // Filter state for results
  const [resultsFilterOpen, setResultsFilterOpen] = useState(false)
  const [resultsSearch, setResultsSearch] = useState('')
  const [resultsSourceFilter, setResultsSourceFilter] = useState<string[]>([])
  const [resultsTypeFilter, setResultsTypeFilter] = useState<string[]>([])
  const [resultsCountryFilter, setResultsCountryFilter] = useState<string[]>([])
  const [resultsLanguageFilter, setResultsLanguageFilter] = useState<string[]>([])

  // Import state
  const [importJob, setImportJob] = useState<JobResult | null>(null)
  const [importModalOpen, setImportModalOpen] = useState(false)

  // Firm detail state
  const [selectedFirm, setSelectedFirm] = useState<FirmInfo | null>(null)
  const [firmOpportunities, setFirmOpportunities] = useState<Opportunity[]>([])
  const [loadingFirmOpps, setLoadingFirmOpps] = useState(false)
  const [firmOppSearch, setFirmOppSearch] = useState('')
  const [firmOppCountry, setFirmOppCountry] = useState<string[]>([])
  const [firmOppCategory, setFirmOppCategory] = useState<string[]>([])

  const loadData = useCallback(async () => {
    const [src, feeds, reg, scan] = await Promise.all([
      getSourceStatus(),
      getRssFeeds(),
      getRegistry(),
      getScanStatus(),
    ])
    setSources(src)
    setRssFeeds(feeds)
    setFirms(reg.firms)
    setRegistryStats(reg.stats)
    if (scan.lastScan) setLastScan(scan.lastScan)
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ─── Search ─────────────────────────────────────────────────

  async function handleSearch(resetPage = true) {
    const hasQuery = query.trim().length > 0
    const hasCountry = country.length > 0
    const hasLocation = location.trim().length > 0

    if (!hasQuery && !hasCountry && !hasLocation) {
      pushToast('error', 'Enter a search query, country, or location')
      return
    }

    setSearching(true)
    setSearchError(null)
    try {
      const pageNum = resetPage ? 1 : page
      const jobs = await searchJobs({
        query: hasQuery ? query.trim() : '',
        location: hasLocation ? location.trim() : undefined,
        country: hasCountry ? country : undefined,
        sources: selectedSources.length > 0 ? selectedSources : undefined,
        page: pageNum,
      })
      if (resetPage) {
        setResults(jobs)
        setPage(1)
      } else {
        setResults((prev) => [...prev, ...jobs])
      }
      setHasMore(jobs.length >= 20)
      setSelectedIds(new Set())
    } catch (err) {
      setSearchError(
        err instanceof Error
          ? err.message.includes('Failed to fetch')
            ? 'Cannot reach the server. Make sure the Meridian server is running on port 3001.'
            : err.message
          : 'Search failed',
      )
    } finally {
      setSearching(false)
    }
  }

  function handleLoadMore() {
    setPage((p) => p + 1)
    handleSearch(false)
  }

  function toggleSource(sourceId: string) {
    setSelectedSources((prev) =>
      prev.includes(sourceId) ? prev.filter((s) => s !== sourceId) : [...prev, sourceId],
    )
  }

  // ─── Import ─────────────────────────────────────────────────

  function handleImport(job: JobResult) {
    setImportJob(job)
    setImportModalOpen(true)
  }

  async function handleImportAll() {
    const toImport = selectedIds.size > 0 ? results.filter((j) => selectedIds.has(j.id)) : results
    let count = 0
    for (const job of toImport) {
      try {
        const partial = jobToApplication(job)
        await createApplication({
          companyId: '',
          companyName: partial.companyName ?? job.company,
          jobTitle: partial.jobTitle ?? job.title,
          location: partial.location ?? job.location,
          city: partial.city ?? '',
          country: partial.country ?? '',
          status: 'interested',
          roleType: 'full_time',
          source: partial.source ?? 'other',
          sourceUrl: job.url,
          jobUrl: job.applyUrl || job.url,
          companyUrl: job.companyUrl,
          deadlineType: job.deadline ? 'specific' : 'unknown',
          deadline: job.deadline,
          notes: partial.notes,
          tagIds: [],
          force: true,
        })
        count++
      } catch {
        // continue on error
      }
    }
    pushToast('success', `Imported ${count} job${count !== 1 ? 's' : ''}`)
    setSelectedIds(new Set())
  }

  // ─── RSS ────────────────────────────────────────────────────

  async function handleAddFeed() {
    const url = newFeedUrl.trim()
    if (!url) return
    setAddingFeed(true)
    try {
      await addRssFeed(url)
      setRssFeeds((prev) => [...prev, url])
      setNewFeedUrl('')
      pushToast('success', 'RSS feed added')
    } catch {
      pushToast('error', 'Failed to add RSS feed')
    } finally {
      setAddingFeed(false)
    }
  }

  async function handleRemoveFeed(url: string) {
    try {
      await removeRssFeed(url)
      setRssFeeds((prev) => prev.filter((f) => f !== url))
      pushToast('success', 'RSS feed removed')
    } catch {
      pushToast('error', 'Failed to remove RSS feed')
    }
  }

  async function handleCheckRss() {
    setCheckingRss(true)
    try {
      const jobs = await checkRssFeeds()
      if (jobs.length > 0) {
        setResults((prev) => [...jobs, ...prev])
        pushToast('success', `Found ${jobs.length} new job${jobs.length !== 1 ? 's' : ''} from RSS feeds`)
      } else {
        pushToast('info', 'No new jobs found from RSS feeds')
      }
    } catch {
      pushToast('error', 'Failed to check RSS feeds')
    } finally {
      setCheckingRss(false)
    }
  }

  // ─── Registry ───────────────────────────────────────────────

  async function handleToggleFirm(firmId: string, enabled: boolean) {
    setTogglingFirm(firmId)
    try {
      await toggleFirmEnabled(firmId, enabled)
      setFirms((prev) => prev.map(f => f.id === firmId ? { ...f, enabled } : f))
      pushToast('success', `Firm ${enabled ? 'enabled' : 'disabled'}`)
    } catch {
      pushToast('error', 'Failed to toggle firm')
    } finally {
      setTogglingFirm(null)
    }
  }

  const filteredFirms = firms.filter(f => {
    const matchesCategory = registryFilter === 'all' || f.category === registryFilter
    const matchesSearch = !firmSearch || f.name.toLowerCase().includes(firmSearch.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const categories = [...new Set(firms.map(f => f.category))]

  // ─── Firm Detail ────────────────────────────────────────────

  async function handleFirmClick(firm: FirmInfo) {
    setSelectedFirm(firm)
    setLoadingFirmOpps(true)
    try {
      const result = await getOpportunities({
        firm: firm.id,
        limit: 100,
        sort: 'updatedAt',
        order: 'desc',
      })
      setFirmOpportunities(result.opportunities)
    } catch {
      setFirmOpportunities([])
    } finally {
      setLoadingFirmOpps(false)
    }
  }

  function closeFirmDetail() {
    setSelectedFirm(null)
    setFirmOpportunities([])
    setFirmOppSearch('')
    setFirmOppCountry([])
    setFirmOppCategory([])
  }

  const filteredFirmOpps = firmOpportunities.filter(opp => {
    const matchesSearch = !firmOppSearch ||
      opp.companyName.toLowerCase().includes(firmOppSearch.toLowerCase()) ||
      (opp.programme && opp.programme.toLowerCase().includes(firmOppSearch.toLowerCase())) ||
      (opp.location && opp.location.toLowerCase().includes(firmOppSearch.toLowerCase()))
    const matchesCountry = firmOppCountry.length === 0 || (opp.country && firmOppCountry.includes(opp.country))
    const matchesCategory = firmOppCategory.length === 0 || firmOppCategory.includes(opp.category)
    return matchesSearch && matchesCountry && matchesCategory
  })

  async function handleTrackFirmOpp(opp: Opportunity) {
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
          opp.location ? `Location: ${opp.location}` : '',
          opp.country ? `Country: ${opp.country}` : '',
          opp.rolling ? 'Rolling deadline' : '',
          `Status: ${opp.status}`,
        ].filter(Boolean).join('\n'),
        tagIds: [],
      })
      if (result.duplicate) {
        pushToast('info', `Already tracking ${opp.companyName} — ${result.duplicate.jobTitle}`)
      } else {
        pushToast('success', `Tracking ${opp.companyName} opportunity`)
      }
    } catch {
      pushToast('error', 'Failed to track opportunity')
    }
  }

  // ─── Results Filtering ───────────────────────────────────────

  const filteredResults = results.filter(job => {
    const matchesSearch = !resultsSearch ||
      job.title.toLowerCase().includes(resultsSearch.toLowerCase()) ||
      job.company.toLowerCase().includes(resultsSearch.toLowerCase()) ||
      job.location.toLowerCase().includes(resultsSearch.toLowerCase())
    const matchesSource = resultsSourceFilter.length === 0 || resultsSourceFilter.includes(job.source)
    const matchesType = resultsTypeFilter.length === 0 || (job.type && resultsTypeFilter.includes(job.type))
    const matchesCountry = resultsCountryFilter.length === 0 || (job.country && resultsCountryFilter.includes(job.country))
    const matchesLanguage = resultsLanguageFilter.length === 0 || (job.languages && resultsLanguageFilter.some(l => job.languages!.includes(l)))
    return matchesSearch && matchesSource && matchesType && matchesCountry && matchesLanguage
  })

  const resultSources = [...new Set(results.map(j => j.source).filter((s): s is string => !!s))]
  const resultTypes = [...new Set(results.map(j => j.type).filter((t): t is string => !!t))]
  const resultCountries = [...new Set(results.map(j => j.country).filter((c): c is string => !!c))]
  const resultLanguages = [...new Set(results.flatMap(j => j.languages || []).filter((l): l is string => !!l))]

  const activeResultFilterCount = [resultsSourceFilter, resultsTypeFilter, resultsCountryFilter, resultsLanguageFilter].filter(a => a.length > 0).length + (resultsSearch ? 1 : 0)

  function clearResultFilters() {
    setResultsSearch('')
    setResultsSourceFilter([])
    setResultsTypeFilter([])
    setResultsCountryFilter([])
    setResultsLanguageFilter([])
  }

  function toggleResultFilter(value: string, setter: React.Dispatch<React.SetStateAction<string[]>>) {
    setter(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value])
  }

  // ─── Scan ───────────────────────────────────────────────────

  async function handleScan() {
    setScanning(true)
    setScanResult(null)
    try {
      const result = await triggerScan()
      setScanResult(result)
      if (result.totalJobs) {
        pushToast('success', `Scan complete: ${result.totalJobs} jobs from ${result.firmsScanned} firms`)
        if (result.jobs && result.jobs.length > 0) {
          setResults(result.jobs)
        }
      } else {
        pushToast('info', 'Scan completed — no jobs found')
      }
    } catch {
      pushToast('error', 'Scan failed')
    } finally {
      setScanning(false)
    }
  }

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-[var(--color-text)]">Job Sources</h1>
        <p className="mt-1 text-sm text-[var(--color-muted)]">
          Direct ATS ingestion, eFinancialCareers, and RSS feeds for finance careers
        </p>
      </div>

      {/* ─── Scan Controls ──────────────────────────────────── */}
      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-display text-sm font-semibold text-[var(--color-text)] uppercase tracking-wide">
              Scan Firms
            </h2>
            <p className="text-xs text-[var(--color-faint)] mt-1">
              {registryStats?.enabledFirms ?? 0} firms enabled · {registryStats?.totalFirms ?? 0} total
            </p>
          </div>
          <div className="flex items-center gap-2">
            {lastScan && (
              <span className="text-xs text-[var(--color-faint)]">
                Last scan: {new Date(lastScan.timestamp).toLocaleString()}
              </span>
            )}
            <Button variant="primary" onClick={handleScan} disabled={scanning}>
              {scanning ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Play className="size-4" />
              )}
              {scanning ? 'Scanning...' : 'Scan Now'}
            </Button>
          </div>
        </div>

        {scanResult && scanResult.firmResults && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {scanResult.firmResults.map((fr) => (
              <button
                key={fr.firmId}
                type="button"
                onClick={() => {
                  const firm = firms.find(f => f.id === fr.firmId)
                  if (firm) handleFirmClick(firm)
                }}
                className={clsx(
                  'rounded-md border px-3 py-2 text-xs text-left transition-colors cursor-pointer hover:border-[var(--color-accent)]/50',
                  fr.error
                    ? 'border-[var(--color-danger)]/30 bg-[var(--color-danger)]/5'
                    : 'border-[var(--color-success)]/30 bg-[var(--color-success)]/5',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[var(--color-text)]">{fr.firmName}</span>
                  <span className={fr.error ? 'text-[var(--color-danger)]' : 'text-[var(--color-success)]'}>
                    {fr.error ? '!' : fr.count}
                  </span>
                </div>
                <p className="text-[var(--color-faint)] mt-0.5">{PROVIDER_LABELS[fr.provider] || fr.provider}</p>
              </button>
            ))}
          </div>
        )}

        {scanResult && scanResult.upcomingDeadlines && scanResult.upcomingDeadlines.length > 0 && (
          <div className="mt-4 rounded-md border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 p-3">
            <p className="text-xs font-semibold text-[var(--color-accent)] mb-2">
              <Clock className="size-3 inline mr-1" />
              Upcoming Deadlines
            </p>
            <div className="space-y-1">
              {scanResult.upcomingDeadlines.slice(0, 5).map((d, i) => (
                <div key={i} className="text-xs text-[var(--color-text)]">
                  <span className="font-medium">{d.company}</span> — {d.title}
                  <span className="text-[var(--color-accent)] ml-2">
                    {new Date(d.deadline).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ─── Search ─────────────────────────────────────────── */}
      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 className="font-display text-sm font-semibold text-[var(--color-text)] uppercase tracking-wide mb-4">
          Search
        </h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Input
            placeholder="e.g. Investment Banking Analyst, Quantitative Finance..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            leftIcon={<Search className="size-4" />}
          />
          <Input
            placeholder="Location (e.g. London, New York)"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            leftIcon={<Globe className="size-4" />}
          />
          <Select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            options={COUNTRY_OPTIONS}
            className="w-full sm:w-40"
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-[var(--color-faint)] font-medium">Sources:</span>
          {['rss'].map((src) => (
            <button
              key={src}
              type="button"
              onClick={() => toggleSource(src)}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium border transition-colors cursor-pointer',
                selectedSources.includes(src)
                  ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] border-[var(--color-accent)]/30'
                  : 'bg-[var(--color-surface-2)] text-[var(--color-faint)] border-[var(--color-border)] hover:border-[var(--color-faint)]',
              )}
            >
              <Rss className="size-3" />
              RSS Feeds
            </button>
          ))}
          <div className="ml-auto">
            <Button
              variant="primary"
              onClick={() => handleSearch()}
              disabled={searching || (!query.trim() && !location.trim() && !country)}
            >
              {searching ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="size-4" />
                  Search
                </>
              )}
            </Button>
          </div>
        </div>
      </section>

      {/* ─── Results ────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-sm font-semibold text-[var(--color-text)] uppercase tracking-wide">
            Results {results.length > 0 && <span className="text-[var(--color-muted)] font-normal">({filteredResults.length}/{results.length})</span>}
          </h2>
          {results.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant={resultsFilterOpen ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setResultsFilterOpen(!resultsFilterOpen)}
              >
                <SlidersHorizontal className="size-3.5" />
                Filters
                {activeResultFilterCount > 0 && (
                  <span className="ml-1 rounded bg-[var(--color-accent)] text-[#0a0e16] text-[10px] font-bold px-1.5 py-0.5">
                    {activeResultFilterCount}
                  </span>
                )}
              </Button>
              <Button variant="primary" size="sm" onClick={handleImportAll} disabled={searching}>
                <Download className="size-3.5" />
                {selectedIds.size > 0 ? `Import Selected (${selectedIds.size})` : `Import All (${filteredResults.length})`}
              </Button>
            </div>
          )}
        </div>

        {resultsFilterOpen && results.length > 0 && (
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 mb-4 space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-[var(--color-text)]">Filters</span>
              {activeResultFilterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearResultFilters}>
                  <XIcon className="size-3" />
                  Clear all
                </Button>
              )}
            </div>

            <div className="flex-1 max-w-md">
              <Input
                placeholder="Search company, role, location..."
                value={resultsSearch}
                onChange={(e) => setResultsSearch(e.target.value)}
                leftIcon={<Search className="size-3.5" />}
              />
            </div>

            {resultSources.length > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[var(--color-faint)] mb-2">Source</p>
                <div className="flex flex-wrap gap-1.5">
                  {resultSources.map(src => (
                    <button
                      key={src}
                      type="button"
                      onClick={() => toggleResultFilter(src, setResultsSourceFilter)}
                      className={clsx(
                        'rounded border px-2 py-1 text-xs cursor-pointer transition-colors',
                        resultsSourceFilter.includes(src)
                          ? 'border-[var(--color-accent)] bg-[rgba(212,168,83,0.12)] text-[var(--color-accent)]'
                          : 'border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-border-strong)]',
                      )}
                    >
                      {src}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {resultTypes.length > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[var(--color-faint)] mb-2">Type</p>
                <div className="flex flex-wrap gap-1.5">
                  {resultTypes.map(typ => (
                    <button
                      key={typ}
                      type="button"
                      onClick={() => toggleResultFilter(typ, setResultsTypeFilter)}
                      className={clsx(
                        'rounded border px-2 py-1 text-xs cursor-pointer transition-colors',
                        resultsTypeFilter.includes(typ)
                          ? 'border-[var(--color-accent)] bg-[rgba(212,168,83,0.12)] text-[var(--color-accent)]'
                          : 'border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-border-strong)]',
                      )}
                    >
                      {typ}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {resultCountries.length > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[var(--color-faint)] mb-2">Country</p>
                <div className="flex flex-wrap gap-1.5">
                  {resultCountries.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleResultFilter(c, setResultsCountryFilter)}
                      className={clsx(
                        'rounded border px-2 py-1 text-xs cursor-pointer transition-colors',
                        resultsCountryFilter.includes(c)
                          ? 'border-[var(--color-accent)] bg-[rgba(212,168,83,0.12)] text-[var(--color-accent)]'
                          : 'border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-border-strong)]',
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {resultLanguages.length > 0 && (
              <div>
                <p className="text-[11px] uppercase tracking-wider text-[var(--color-faint)] mb-2">Language</p>
                <div className="flex flex-wrap gap-1.5">
                  {resultLanguages.map(l => (
                    <button
                      key={l}
                      type="button"
                      onClick={() => toggleResultFilter(l, setResultsLanguageFilter)}
                      className={clsx(
                        'rounded border px-2 py-1 text-xs cursor-pointer transition-colors',
                        resultsLanguageFilter.includes(l)
                          ? 'border-[var(--color-accent)] bg-[rgba(212,168,83,0.12)] text-[var(--color-accent)]'
                          : 'border-[var(--color-border)] text-[var(--color-muted)] hover:border-[var(--color-border-strong)]',
                      )}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <JobSearchResults
          jobs={filteredResults}
          loading={searching}
          error={searchError}
          selectedIds={selectedIds}
          onToggleSelect={(id) => {
            setSelectedIds((prev) => {
              const next = new Set(prev)
              if (next.has(id)) next.delete(id)
              else next.add(id)
              return next
            })
          }}
          onSelectAll={() => {
            if (selectedIds.size === filteredResults.length) {
              setSelectedIds(new Set())
            } else {
              setSelectedIds(new Set(filteredResults.map((j) => j.id)))
            }
          }}
          onDeselectAll={() => setSelectedIds(new Set())}
          onImport={handleImport}
          onImportAll={handleImportAll}
          onLoadMore={handleLoadMore}
          hasMore={hasMore}
        />
      </section>

      {/* ─── Firm Registry ──────────────────────────────────── */}
      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <button
          type="button"
          onClick={() => setShowRegistry(!showRegistry)}
          className="flex items-center justify-between w-full cursor-pointer"
        >
          <div>
            <h2 className="font-display text-sm font-semibold text-[var(--color-text)] uppercase tracking-wide">
              <Building2 className="size-4 inline mr-1.5" />
              Firm Registry
            </h2>
            <p className="text-xs text-[var(--color-faint)] mt-1">
              {firms.filter(f => f.enabled).length} enabled · {firms.length} total · {Object.keys(registryStats?.byProvider || {}).length} providers
            </p>
          </div>
          {showRegistry ? <ChevronUp className="size-4 text-[var(--color-faint)]" /> : <ChevronDown className="size-4 text-[var(--color-faint)]" />}
        </button>

        {showRegistry && (
          <div className="mt-4">
            <div className="flex gap-2 mb-4">
              <Input
                placeholder="Search firms..."
                value={firmSearch}
                onChange={(e) => setFirmSearch(e.target.value)}
                leftIcon={<Search className="size-3.5" />}
                className="flex-1"
              />
            </div>

            <div className="flex flex-wrap gap-1.5 mb-4">
              <button
                type="button"
                onClick={() => setRegistryFilter('all')}
                className={clsx(
                  'rounded-md px-2.5 py-1 text-xs font-medium border transition-colors cursor-pointer',
                  registryFilter === 'all'
                    ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] border-[var(--color-accent)]/30'
                    : 'bg-[var(--color-surface-2)] text-[var(--color-faint)] border-[var(--color-border)] hover:border-[var(--color-faint)]',
                )}
              >
                All ({firms.length})
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setRegistryFilter(cat)}
                  className={clsx(
                    'rounded-md px-2.5 py-1 text-xs font-medium border transition-colors cursor-pointer',
                    registryFilter === cat
                      ? 'bg-[var(--color-accent)]/15 text-[var(--color-accent)] border-[var(--color-accent)]/30'
                      : 'bg-[var(--color-surface-2)] text-[var(--color-faint)] border-[var(--color-border)] hover:border-[var(--color-faint)]',
                  )}
                >
                  {CATEGORY_LABELS[cat] || cat} ({firms.filter(f => f.category === cat).length})
                </button>
              ))}
            </div>

            <div className="space-y-1.5">
              {filteredFirms.map((firm) => (
                <div
                  key={firm.id}
                  className={clsx(
                    'flex items-center justify-between rounded-md border px-4 py-2.5 transition-colors',
                    firm.enabled
                      ? 'border-[var(--color-success)]/30 bg-[var(--color-success)]/5'
                      : 'border-[var(--color-border)] bg-[var(--color-surface-2)]',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => handleFirmClick(firm)}
                    className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer hover:opacity-80"
                  >
                    {firm.enabled ? (
                      <CheckCircle2 className="size-4 text-[var(--color-success)] shrink-0" />
                    ) : (
                      <XCircle className="size-4 text-[var(--color-faint)] shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text)] truncate">{firm.name}</p>
                      <p className="text-xs text-[var(--color-faint)]">
                        {CATEGORY_LABELS[firm.category] || firm.category} · {PROVIDER_LABELS[firm.careersProvider] || firm.careersProvider}
                        {firm.notes && <span className="text-[var(--color-accent)]"> · {firm.notes}</span>}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge tone={firm.enabled ? 'success' : 'muted'}>
                      {firm.enabled ? 'Active' : 'Disabled'}
                    </Badge>
                    <button
                      type="button"
                      onClick={() => handleToggleFirm(firm.id, !firm.enabled)}
                      disabled={togglingFirm === firm.id}
                      className={clsx(
                        'rounded-md px-2 py-1 text-xs font-medium border transition-colors cursor-pointer',
                        firm.enabled
                          ? 'border-[var(--color-danger)]/30 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10'
                          : 'border-[var(--color-success)]/30 text-[var(--color-success)] hover:bg-[var(--color-success)]/10',
                      )}
                    >
                      {togglingFirm === firm.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : firm.enabled ? (
                        'Disable'
                      ) : (
                        'Enable'
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ─── Source Management ──────────────────────────────── */}
      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 className="font-display text-sm font-semibold text-[var(--color-text)] uppercase tracking-wide mb-4">
          Source Management
        </h2>

        <div className="space-y-3">
          {sources.map((src) => (
            <div
              key={src.id}
              className="flex items-center justify-between rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3"
            >
              <div className="flex items-center gap-3">
                {src.configured ? (
                  <CheckCircle2 className="size-4 text-[var(--color-success)]" />
                ) : (
                  <XCircle className="size-4 text-[var(--color-faint)]" />
                )}
                <div>
                  <p className="text-sm font-medium text-[var(--color-text)]">{src.name}</p>
                  <p className="text-xs text-[var(--color-faint)]">
                    {src.configured ? 'Active' : 'Disabled'}
                    {src.lastChecked && ` · Last checked: ${new Date(src.lastChecked).toLocaleDateString()}`}
                  </p>
                </div>
              </div>
              <Badge tone={src.configured ? 'success' : 'muted'}>{src.configured ? 'Active' : 'Disabled'}</Badge>
            </div>
          ))}

          {sources.length === 0 && (
            <div className="text-center py-4 text-sm text-[var(--color-faint)]">
              <AlertCircle className="size-5 mx-auto mb-2 text-[var(--color-faint)]" />
              Could not reach the server to check source statuses
            </div>
          )}
        </div>

        {/* RSS Feeds */}
        <div className="mt-6">
          <h3 className="text-xs font-semibold text-[var(--color-muted)] uppercase tracking-wide mb-3">
            RSS Feeds
          </h3>

          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="https://example.com/rss/jobs"
              value={newFeedUrl}
              onChange={(e) => setNewFeedUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddFeed()}
              leftIcon={<Rss className="size-4" />}
              className="flex-1"
            />
            <div className="flex gap-2">
              <Button variant="secondary" onClick={handleAddFeed} disabled={addingFeed || !newFeedUrl.trim()}>
                {addingFeed ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Add
              </Button>
              <Button variant="teal" onClick={handleCheckRss} disabled={checkingRss || rssFeeds.length === 0}>
                {checkingRss ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                Check Feeds
              </Button>
            </div>
          </div>

          {rssFeeds.length > 0 ? (
            <div className="mt-3 space-y-1.5">
              {rssFeeds.map((feed) => (
                <div
                  key={feed}
                  className="flex items-center justify-between rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2"
                >
                  <span className="text-xs text-[var(--color-text)] font-mono truncate flex-1 mr-2">
                    {feed}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveFeed(feed)}
                    className="text-[var(--color-danger)] hover:text-[var(--color-danger)]"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-xs text-[var(--color-faint)]">No RSS feeds configured</p>
          )}
        </div>
      </section>

      {/* ─── Firm Detail Modal ──────────────────────────────── */}
      {selectedFirm && (
        <Modal
          open={true}
          onClose={closeFirmDetail}
          title={selectedFirm.name}
          size="xl"
          footer={
            <>
              <Button variant="ghost" onClick={closeFirmDetail}>Close</Button>
              {selectedFirm.careersUrl && (
                <Button variant="secondary" onClick={() => window.open(selectedFirm.careersUrl, '_blank')}>
                  <ExternalLink className="size-3.5" />
                  Careers Page
                </Button>
              )}
            </>
          }
        >
          <div className="space-y-4">
            <div className="flex items-center gap-3 text-sm text-[var(--color-muted)]">
              <Badge tone="info">{CATEGORY_LABELS[selectedFirm.category] || selectedFirm.category}</Badge>
              <span>{PROVIDER_LABELS[selectedFirm.careersProvider] || selectedFirm.careersProvider}</span>
              <Badge tone={selectedFirm.enabled ? 'success' : 'muted'}>
                {selectedFirm.enabled ? 'Active' : 'Disabled'}
              </Badge>
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="Search opportunities..."
                value={firmOppSearch}
                onChange={(e) => setFirmOppSearch(e.target.value)}
                leftIcon={<Search className="size-3.5" />}
                className="flex-1"
              />
              <Select
                value={firmOppCountry.join(',')}
                onChange={(e) => setFirmOppCountry(e.target.value ? [e.target.value] : [])}
                options={[{ value: '', label: 'All Countries' }, ...COUNTRY_OPTIONS.filter(c => c.value)]}
                className="w-40"
              />
            </div>

            {loadingFirmOpps ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-[var(--color-accent)]" />
              </div>
            ) : filteredFirmOpps.length === 0 ? (
              <div className="text-center py-8">
                <Building2 className="size-8 mx-auto text-[var(--color-faint)] mb-2" />
                <p className="text-sm text-[var(--color-muted)]">
                  {firmOpportunities.length === 0 ? 'No opportunities found for this firm' : 'No opportunities match your filters'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredFirmOpps.map(opp => (
                  <div
                    key={opp.id}
                    className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text)]">
                          {opp.programme || 'Opportunity'}
                        </p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-[var(--color-faint)] flex-wrap">
                          {opp.location && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="size-3" />
                              {opp.location}
                            </span>
                          )}
                          <Badge tone={(CATEGORY_COLORS[opp.category] || 'muted') as any}>
                            {opp.category === 'spring_week' ? 'Spring Week' :
                             opp.category === 'summer_intern' ? 'Summer Internship' :
                             opp.category === 'off_cycle' ? 'Off-Cycle' :
                             opp.category === 'grad' ? 'Graduate' : opp.category}
                          </Badge>
                          <Badge tone={(STATUS_COLORS[opp.status] || 'muted') as any}>
                            {{ verified_open: 'Verified Open', tracker_open: 'Tracker Open', reachable: 'Reachable', closed: 'Closed', unknown: opp.status }[opp.status] || opp.status}
                          </Badge>
                          {opp.deadline && (
                            <span className="text-[var(--color-faint)]">
                              Closes {new Date(opp.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                          {opp.rolling && (
                            <span className="text-[var(--color-teal)]">Rolling</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {opp.status !== 'closed' && (
                          <Button variant="ghost" size="sm" onClick={() => handleTrackFirmOpp(opp)}>
                            <Star className="size-3.5" />
                            Track
                          </Button>
                        )}
                        {opp.applyUrl && (
                          <Button variant="secondary" size="sm" onClick={() => window.open(opp.applyUrl!, '_blank')}>
                            <ExternalLink className="size-3.5" />
                            Apply
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ─── Import Modal ───────────────────────────────────── */}
      <ImportPreviewModal
        job={importJob}
        open={importModalOpen}
        onClose={() => {
          setImportModalOpen(false)
          setImportJob(null)
        }}
        onImported={() => {
          pushToast('success', 'Job imported successfully')
        }}
      />
    </div>
  )
}
