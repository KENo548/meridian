import { useMemo } from 'react'
import { Building2 } from 'lucide-react'
import { COMPANY_TYPE_LABELS } from '@/constants'
import { EmptyState } from '@/components/ui/EmptyState'
import { ExternalLink } from '@/components/ui/ExternalLink'
import { useMeridianStore } from '@/lib/store'

export function CompaniesPage() {
  const companies = useMeridianStore((s) => s.companies)
  const applications = useMeridianStore((s) => s.applications)
  const setAddWizardOpen = useMeridianStore((s) => s.setAddWizardOpen)
  const setActiveApplicationId = useMeridianStore((s) => s.setActiveApplicationId)

  const rows = useMemo(() => {
    const fromApps = new Map<
      string,
      { name: string; count: number; type?: string; website?: string; sampleAppId?: string }
    >()

    for (const a of applications.filter((x) => !x.archived)) {
      const key = a.companyName.toLowerCase()
      const existing = fromApps.get(key)
      if (existing) {
        existing.count += 1
      } else {
        fromApps.set(key, {
          name: a.companyName,
          count: 1,
          type: a.companyType,
          website: a.companyWebsite || a.companyUrl,
          sampleAppId: a.id,
        })
      }
    }

    for (const c of companies) {
      const key = c.name.toLowerCase()
      const existing = fromApps.get(key)
      if (existing) {
        existing.type = existing.type || c.companyType
        existing.website = existing.website || c.website
      } else {
        fromApps.set(key, {
          name: c.name,
          count: 0,
          type: c.companyType,
          website: c.website,
        })
      }
    }

    return [...fromApps.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  }, [companies, applications])

  return (
    <div className="space-y-4 animate-fade-in max-w-5xl">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Companies</h1>
        <p className="text-sm text-[var(--color-muted)] mt-1">
          Firms you are targeting this season.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<Building2 className="size-10" />}
          title="No companies yet."
          description="Add an application to start building your company list."
          onAction={() => setAddWizardOpen(true)}
        />
      ) : (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/60 text-[11px] uppercase tracking-wider text-[var(--color-faint)]">
                <th className="px-4 py-2.5">Company</th>
                <th className="px-4 py-2.5 hidden sm:table-cell">Type</th>
                <th className="px-4 py-2.5">Apps</th>
                <th className="px-4 py-2.5 hidden md:table-cell">Website</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.name}
                  className="border-b border-[var(--color-border)]/70 hover:bg-[var(--color-surface-2)]/40"
                >
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="font-medium hover:text-[var(--color-accent)] cursor-pointer text-left"
                      onClick={() => row.sampleAppId && setActiveApplicationId(row.sampleAppId)}
                    >
                      {row.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-muted)] hidden sm:table-cell">
                    {row.type
                      ? COMPANY_TYPE_LABELS[row.type as keyof typeof COMPANY_TYPE_LABELS] ??
                        row.type
                      : '—'}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{row.count}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <ExternalLink href={row.website} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
