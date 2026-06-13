import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { Toaster } from 'sonner'
import { ThemeProvider, useTheme } from '@/context/ThemeContext'
import { ProfileProvider, useProfile } from '@/context/ProfileContext'
import { isSupabaseConfigured } from '@/lib/supabase'
import { isDemoMode } from '@/services/storage'
import AppShell from '@/components/layout/AppShell'
import Landing from '@/pages/Landing'
import Setup from '@/pages/Setup'
import ProfileGate from '@/pages/gate/ProfileGate'
import Dashboard from '@/pages/Dashboard'
import Transactions from '@/pages/Transactions'
import Budgets from '@/pages/Budgets'
import Savings from '@/pages/Savings'
import Loans from '@/pages/Loans'
import Bills from '@/pages/Bills'
import Subscriptions from '@/pages/Subscriptions'
import Vault from '@/pages/Vault'
import Reports from '@/pages/Reports'
import Achievements from '@/pages/Achievements'
import Notifications from '@/pages/Notifications'
import ProfileSettings from '@/pages/ProfileSettings'

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-2xl font-extrabold text-primary-foreground">S</div>
        <p className="text-sm text-muted-foreground">Loading SaveWise…</p>
      </div>
    </div>
  )
}

/** Requires backend (Supabase or Demo Mode), then an unlocked profile. */
function RequireProfile() {
  const { profile, booting } = useProfile()
  if (!isSupabaseConfigured() && !isDemoMode()) return <Navigate to="/setup" replace />
  if (booting) return <Splash />
  if (!profile) return <Navigate to="/profiles" replace />
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

function ToasterWithTheme() {
  const { resolved } = useTheme()
  return <Toaster richColors position="top-center" theme={resolved} />
}

export default function App() {
  return (
    <ThemeProvider>
      <ProfileProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/setup" element={<Setup />} />
            <Route path="/profiles" element={<ProfileGate />} />
            <Route element={<RequireProfile />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/budgets" element={<Budgets />} />
              <Route path="/savings" element={<Savings />} />
              <Route path="/loans" element={<Loans />} />
              <Route path="/bills" element={<Bills />} />
              <Route path="/subscriptions" element={<Subscriptions />} />
              <Route path="/vault" element={<Vault />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/achievements" element={<Achievements />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/profile" element={<ProfileSettings />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
        <ToasterWithTheme />
      </ProfileProvider>
    </ThemeProvider>
  )
}
