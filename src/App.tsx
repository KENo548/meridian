import { useEffect, lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { AppShell } from '@/components/layout/AppShell'
import { DashboardPage } from '@/pages/DashboardPage'
import { LoginPage } from '@/pages/LoginPage'
import { SignupPage } from '@/pages/SignupPage'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'
import { Loader2 } from 'lucide-react'
import { useMeridianStore } from '@/lib/store'
import { getUserDb, setActiveDb } from '@/lib/db'

const OpportunitiesPage = lazy(() => import('@/pages/OpportunitiesPage').then(m => ({ default: m.OpportunitiesPage })))
const ApplicationsPage = lazy(() => import('@/pages/ApplicationsPage').then(m => ({ default: m.ApplicationsPage })))
const CalendarPage = lazy(() => import('@/pages/CalendarPage').then(m => ({ default: m.CalendarPage })))
const CompaniesPage = lazy(() => import('@/pages/CompaniesPage').then(m => ({ default: m.CompaniesPage })))
const DocumentsPage = lazy(() => import('@/pages/DocumentsPage').then(m => ({ default: m.DocumentsPage })))
const TasksPage = lazy(() => import('@/pages/TasksPage').then(m => ({ default: m.TasksPage })))
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })))
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then(m => ({ default: m.SettingsPage })))
const ContactsPage = lazy(() => import('@/pages/ContactsPage').then(m => ({ default: m.ContactsPage })))
const SourcesPage = lazy(() => import('@/pages/SourcesPage').then(m => ({ default: m.SourcesPage })))

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <PageLoader />
  if (user) return <Navigate to="/" replace />
  return <>{children}</>
}

function AuthenticatedApp() {
  const { user } = useAuth()
  const hydrate = useMeridianStore((s) => s.hydrate)

  // Switch to user-specific DB when user changes
  useEffect(() => {
    if (user?.id) {
      const userDb = getUserDb(user.id)
      setActiveDb(userDb)
      void hydrate()
    }
  }, [user?.id, hydrate])

  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AuthenticatedApp />
        <Routes>
          {/* Public auth routes */}
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
          <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
          <Route path="/reset-password" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />

          {/* Protected app routes */}
          <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
            <Route index element={<DashboardPage />} />
            <Route path="opportunities" element={
              <Suspense fallback={<PageLoader />}>
                <OpportunitiesPage />
              </Suspense>
            } />
            <Route path="applications" element={
              <Suspense fallback={<PageLoader />}>
                <ApplicationsPage />
              </Suspense>
            } />
            <Route path="calendar" element={
              <Suspense fallback={<PageLoader />}>
                <CalendarPage />
              </Suspense>
            } />
            <Route path="companies" element={
              <Suspense fallback={<PageLoader />}>
                <CompaniesPage />
              </Suspense>
            } />
            <Route path="documents" element={
              <Suspense fallback={<PageLoader />}>
                <DocumentsPage />
              </Suspense>
            } />
            <Route path="contacts" element={
              <Suspense fallback={<PageLoader />}>
                <ContactsPage />
              </Suspense>
            } />
            <Route path="tasks" element={
              <Suspense fallback={<PageLoader />}>
                <TasksPage />
              </Suspense>
            } />
            <Route path="analytics" element={
              <Suspense fallback={<PageLoader />}>
                <AnalyticsPage />
              </Suspense>
            } />
            <Route path="sources" element={
              <Suspense fallback={<PageLoader />}>
                <SourcesPage />
              </Suspense>
            } />
            <Route path="settings" element={
              <Suspense fallback={<PageLoader />}>
                <SettingsPage />
              </Suspense>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="size-6 animate-spin text-[var(--color-accent)]" />
    </div>
  )
}
