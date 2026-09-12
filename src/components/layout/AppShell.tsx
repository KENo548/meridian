import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { Sidebar } from '@/components/layout/Sidebar'
import { ToastHost } from '@/components/ui/ToastHost'
import { Button } from '@/components/ui/Button'
import { ApplicationDetailPanel } from '@/components/applications/ApplicationDetailPanel'
import { AddApplicationWizard } from '@/components/applications/AddApplicationWizard'
import { useMeridianStore } from '@/lib/store'
import { APP_NAME } from '@/constants'

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const activeApplicationId = useMeridianStore((s) => s.activeApplicationId)
  const setActiveApplicationId = useMeridianStore((s) => s.setActiveApplicationId)
  const addWizardOpen = useMeridianStore((s) => s.addWizardOpen)
  const setAddWizardOpen = useMeridianStore((s) => s.setAddWizardOpen)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (addWizardOpen) {
        setAddWizardOpen(false)
        return
      }
      if (activeApplicationId) {
        setActiveApplicationId(null)
        return
      }
      if (mobileOpen) setMobileOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [addWizardOpen, activeApplicationId, mobileOpen, setAddWizardOpen, setActiveApplicationId])

  return (
    <div className="min-h-full flex bg-[var(--color-bg)] text-[var(--color-text)]">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 min-h-full">
        <header className="lg:hidden sticky top-0 z-20 flex items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 px-4 py-3 backdrop-blur">
          <Button variant="ghost" size="sm" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu className="size-5" />
          </Button>
          <span className="font-display font-semibold">{APP_NAME}</span>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-6 sm:pb-8 lg:pb-8 overflow-x-hidden" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
          <Outlet />
        </main>
      </div>
      <ApplicationDetailPanel />
      <AddApplicationWizard />
      <ToastHost />
    </div>
  )
}
