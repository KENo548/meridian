import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Sparkles,
  Briefcase,
  CalendarDays,
  Building2,
  FileText,
  Users,
  CheckSquare,
  BarChart3,
  Globe,
  Settings,
  Plus,
  LogOut,
} from 'lucide-react'
import { APP_NAME, APP_TAGLINE } from '@/constants'
import { Button } from '@/components/ui/Button'
import { useMeridianStore } from '@/lib/store'
import { useAuth } from '@/contexts/AuthContext'
import { clsx } from '@/lib/utils'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/opportunities', label: 'Opportunities', icon: Sparkles },
  { to: '/applications', label: 'Applications', icon: Briefcase },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/companies', label: 'Companies', icon: Building2 },
  { to: '/documents', label: 'Documents', icon: FileText },
  { to: '/contacts', label: 'Contacts', icon: Users },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/sources', label: 'Sources', icon: Globe },
  { to: '/settings', label: 'Settings', icon: Settings },
]

interface SidebarProps {
  mobileOpen: boolean
  onClose: () => void
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const setAddWizardOpen = useMeridianStore((s) => s.setAddWizardOpen)
  const { user, logout } = useAuth()

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          aria-label="Close menu"
          onClick={onClose}
        />
      ) : null}
      <aside
        className={clsx(
          'fixed lg:static inset-y-0 left-0 z-40 w-60 shrink-0 flex flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-transform duration-200',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
      >
        <div className="px-5 pt-6 pb-4">
          <p className="font-display text-2xl font-bold tracking-tight text-[var(--color-text)]">
            {APP_NAME}
          </p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[var(--color-faint)]">
            {APP_TAGLINE}
          </p>
        </div>

        <div className="px-3 mb-3">
          <Button
            variant="primary"
            className="w-full"
            onClick={() => {
              setAddWizardOpen(true)
              onClose()
            }}
          >
            <Plus className="size-4" />
            Add Application
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-4 space-y-0.5">
          {NAV.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onClose}
                className={({ isActive }) =>
                  clsx(
                    'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-[var(--color-surface-3)] text-[var(--color-accent)] font-medium'
                      : 'text-[var(--color-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]',
                  )
                }
              >
                <Icon className="size-4 shrink-0" />
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        {user && (
          <div className="border-t border-[var(--color-border)] px-3 py-3 space-y-2">
            <p className="px-3 text-xs text-[var(--color-muted)] truncate" title={user.email}>
              Signed in as <span className="font-medium text-[var(--color-text)]">{user.username}</span>
            </p>
            <Button
              variant="ghost"
              className="w-full justify-start gap-2 text-[var(--color-muted)] hover:text-[var(--color-text)]"
              onClick={() => { logout(); onClose() }}
            >
              <LogOut className="size-4" />
              Sign Out
            </Button>
          </div>
        )}
      </aside>
    </>
  )
}
