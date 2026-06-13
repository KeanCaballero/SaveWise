import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, ArrowLeftRight, Wallet, PiggyBank, HandCoins, ReceiptText,
  Repeat, Users, PieChart, Trophy, Sun, Moon, Lock, Settings, UserRound,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/context/ThemeContext'
import { useProfile } from '@/context/ProfileContext'
import { Button } from '@/components/ui/button'
import ProfileAvatar from '@/components/shared/ProfileAvatar'
import NotificationsBell from './NotificationsBell'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/budgets', label: 'Budgets', icon: Wallet },
  { to: '/savings', label: 'Savings', icon: PiggyBank },
  { to: '/loans', label: 'Loans', icon: HandCoins },
  { to: '/bills', label: 'Bills', icon: ReceiptText },
  { to: '/subscriptions', label: 'Subscriptions', icon: Repeat },
  { to: '/vault', label: 'Family Vault', icon: Users },
  { to: '/reports', label: 'Reports', icon: PieChart },
  { to: '/achievements', label: 'Achievements', icon: Trophy },
]

// Bottom nav stays at 5 — the platform max for comfortable thumb targets.
// Loans/Bills/etc. live in the desktop sidebar and the profile menu.
// Secondary destinations: shown in the desktop sidebar, and surfaced on mobile
// through the header avatar menu (overflow pattern) so nothing is orphaned.
const SECONDARY = [
  { to: '/loans', label: 'Loans', icon: HandCoins },
  { to: '/bills', label: 'Bills', icon: ReceiptText },
  { to: '/subscriptions', label: 'Subscriptions', icon: Repeat },
  { to: '/vault', label: 'Family Vault', icon: Users },
  { to: '/achievements', label: 'Achievements', icon: Trophy },
]

const MOBILE_NAV = [
  { to: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { to: '/transactions', label: 'Activity', icon: ArrowLeftRight },
  { to: '/savings', label: 'Savings', icon: PiggyBank },
  { to: '/reports', label: 'Reports', icon: PieChart },
  { to: '/profile', label: 'Profile', icon: UserRound },
]

function Logo() {
  return (
    <Link to="/dashboard" className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 font-display text-lg font-semibold text-primary-foreground shadow-glow">S</div>
      <div className="leading-tight">
        <p className="font-display text-base font-semibold tracking-tight">SaveWise</p>
        <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Track · Save · Grow</p>
      </div>
    </Link>
  )
}

function ThemeToggle() {
  const { resolved, setTheme } = useTheme()
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
    >
      {resolved === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </Button>
  )
}

export default function AppShell({ children }) {
  const { profile, lock } = useProfile()
  const location = useLocation()
  const navigate = useNavigate()
  const current = NAV.find((n) => location.pathname.startsWith(n.to))

  return (
    <div className="min-h-dvh bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-card lg:flex">
        <div className="flex h-16 items-center border-b px-5">
          <Logo />
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all active:scale-[0.98]',
                  isActive
                    ? 'bg-primary/10 text-primary dark:bg-primary/15'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary transition-all duration-300',
                      isActive ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <Icon className={cn('h-[18px] w-[18px] transition-transform', isActive && 'scale-105')} />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t p-3">
          <Link to="/profile" className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-accent">
            <ProfileAvatar profile={profile} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{profile?.name}</p>
              <p className="text-xs text-muted-foreground">Manage profile</p>
            </div>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </Link>
        </div>
      </aside>

      {/* Header */}
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur lg:pl-[272px] lg:pr-6">
        <div className="lg:hidden">
          <Logo />
        </div>
        <p className="hidden text-sm font-semibold text-muted-foreground lg:block">{current?.label || 'SaveWise'}</p>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <NotificationsBell />
          <DropdownMenu>
            <DropdownMenuTrigger className="ml-1 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <ProfileAvatar profile={profile} size="sm" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="truncate">{profile?.name}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {SECONDARY.map(({ to, label, icon: Icon }) => (
                <DropdownMenuItem key={to} className="lg:hidden" onClick={() => navigate(to)}>
                  <Icon /> {label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="lg:hidden" />
              <DropdownMenuItem onClick={() => navigate('/profile')}>
                <Settings /> Profile & settings
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  lock()
                  navigate('/profiles')
                }}
              >
                <Lock /> Lock & switch profile
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main content */}
      <main className="px-4 pb-28 pt-6 sm:px-6 lg:ml-64 lg:pb-10">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>

      {/* Mobile bottom navigation */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/90 backdrop-blur-lg pb-safe lg:hidden">
        <div className="grid grid-cols-5">
          {MOBILE_NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors active:scale-95',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'flex h-7 w-12 items-center justify-center rounded-full transition-all duration-300',
                      isActive ? 'bg-primary/12 dark:bg-primary/20' : 'bg-transparent'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
