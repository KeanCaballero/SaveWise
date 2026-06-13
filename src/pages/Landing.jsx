import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight, LayoutDashboard, PiggyBank, ReceiptText, HandCoins, Activity,
  ShieldCheck, Lock, Smartphone, Users, Sparkles, TrendingUp, Sun, Moon,
} from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'
import { getActiveSessionId } from '@/services/storage'
import { Button } from '@/components/ui/button'

const FEATURES = [
  { icon: LayoutDashboard, title: 'A dashboard that breathes', body: 'Net worth, balance and this-month flow up top — the noise tucked away. Your money at a glance, not a wall of widgets.' },
  { icon: PiggyBank, title: 'Budgets & savings goals', body: 'Set monthly limits and goals with target dates. SaveWise tracks progress and tells you how much to save each week to hit them.' },
  { icon: ReceiptText, title: 'Bills & subscriptions', body: 'Rent, utilities, Netflix, Spotify — track due dates and renewals so a charge never sneaks up on you again.' },
  { icon: HandCoins, title: 'Loans & debts', body: 'Money you owe and money owed to you, with due dates and payment status. Always know where you stand.' },
  { icon: Activity, title: 'Financial health score', body: 'One number from 0–100, driven by your savings rate, debt, budget discipline and goals — with a clear breakdown of why.' },
  { icon: ShieldCheck, title: 'Private, PIN-locked profiles', body: 'One space per person, each protected by its own PIN. Your finances stay yours.' },
]

const STEPS = [
  { n: '01', title: 'Create a profile', body: 'Pick a name, an avatar and a 4–6 digit PIN. No email, no password, no sign-up forms.' },
  { n: '02', title: 'Add your money', body: 'Log income and expenses, set budgets, add bills, goals and loans. Or load sample data to explore first.' },
  { n: '03', title: 'Watch it grow', body: 'Get a health score, smart insights and milestone celebrations as your savings climb and debts fall.' },
]

const FAQS = [
  { q: 'Do I need to sign up or give an email?', a: 'No. SaveWise uses simple profiles — just a name and a PIN. There are no accounts, passwords or email verification to deal with.' },
  { q: 'Is my information private?', a: 'Every profile is PIN-protected and its data is kept separate from the others. SaveWise is designed for you and people you trust — like a shared device at home — rather than for hosting strangers’ data.' },
  { q: 'Does it cost anything?', a: 'No. SaveWise is a personal project, free to use. Your data lives in your own database.' },
  { q: 'Does it work on my phone?', a: 'Yes — SaveWise is mobile-first and runs in any modern browser. Add it to your home screen and it feels like an app.' },
]

const TRUST = [
  { icon: Lock, label: 'PIN-protected' },
  { icon: Users, label: 'No email required' },
  { icon: Smartphone, label: 'Works on any device' },
  { icon: ShieldCheck, label: 'Your own private space' },
]

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/80 font-display text-lg font-semibold text-primary-foreground shadow-glow">S</div>
      <p className="font-display text-lg font-semibold tracking-tight">SaveWise</p>
    </div>
  )
}

/** A miniature of the real dashboard hero — previews the product look. */
function ProductMock() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      <div className="absolute -inset-4 rounded-[2rem] bg-primary/20 blur-3xl" />
      <div className="relative rounded-3xl border bg-card p-3 shadow-lift">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-emerald-700 p-5 text-primary-foreground dark:to-emerald-800">
          <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-primary-foreground/70">Total net worth</p>
          <div className="mt-1 flex items-end gap-3">
            <p className="font-display text-4xl font-semibold tabular-nums leading-none">₱248,500</p>
            <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold backdrop-blur">
              <TrendingUp className="h-3 w-3" /> +₱12,400
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-white/15 pt-3 text-[11px]">
            <div><p className="text-primary-foreground/70">Balance</p><p className="font-semibold tabular-nums">₱42,100</p></div>
            <div><p className="text-primary-foreground/70">In · Jun</p><p className="font-semibold tabular-nums">₱34,200</p></div>
            <div><p className="text-primary-foreground/70">Out · Jun</p><p className="font-semibold tabular-nums">₱21,800</p></div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[['Savings', '₱86,000'], ['Debt', '₱0'], ['Net · mo', '+₱12,400']].map(([l, v]) => (
            <div key={l} className="rounded-xl border bg-background/60 p-2.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{l}</p>
              <p className="mt-0.5 text-sm font-bold tabular-nums">{v}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Landing() {
  const navigate = useNavigate()
  const { resolved, setTheme } = useTheme()
  const hasSession = Boolean(getActiveSessionId())
  const ctaLabel = hasSession ? 'Open dashboard' : 'Open SaveWise'
  const goToApp = () => navigate(hasSession ? '/dashboard' : '/profiles')

  return (
    <div className="min-h-dvh scroll-smooth bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}>
              {resolved === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
            <Button onClick={goToApp} className="rounded-full">
              {ctaLabel} <ArrowRight />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-80 max-w-3xl rounded-full bg-primary/15 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2 lg:gap-8">
          <div className="animate-fade-in-up text-center lg:text-left">
            <span className="inline-flex items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Track · Save · Grow
            </span>
            <h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Money clarity for the&nbsp;whole household.
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg lg:mx-0">
              SaveWise turns income, bills, debts and goals into one calm, private dashboard — with a financial health score and insights that actually help. No spreadsheets, no noise.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:items-start lg:justify-start">
              <Button size="lg" onClick={goToApp} className="w-full rounded-full px-7 sm:w-auto">
                {ctaLabel} <ArrowRight />
              </Button>
              <Button size="lg" variant="outline" asChild className="w-full rounded-full px-7 sm:w-auto">
                <a href="#features">See what’s inside</a>
              </Button>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 lg:justify-start">
              {TRUST.map(({ icon: Icon, label }) => (
                <span key={label} className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Icon className="h-3.5 w-3.5 text-primary" /> {label}
                </span>
              ))}
            </div>
          </div>
          <div className="animate-fade-in-up [animation-delay:120ms]">
            <ProductMock />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Everything in one place</p>
          <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">A complete picture of your money</h2>
          <p className="mt-3 text-muted-foreground">Nine modules working together — without ever feeling like a spreadsheet.</p>
        </div>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="group rounded-2xl border bg-card p-6 shadow-soft transition-all hover:-translate-y-1 hover:shadow-lift">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-semibold tracking-tight">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-y bg-secondary/40">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">Up and running in minutes</p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">How it works</h2>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {STEPS.map(({ n, title, body }) => (
              <div key={n} className="relative">
                <span className="font-display text-5xl font-semibold text-primary/25">{n}</span>
                <h3 className="mt-2 text-xl font-semibold tracking-tight">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
        <h2 className="text-center font-display text-3xl font-semibold tracking-tight sm:text-4xl">Questions, answered</h2>
        <div className="mt-10 space-y-3">
          {FAQS.map(({ q, a }) => (
            <details key={q} className="group rounded-2xl border bg-card p-5 shadow-soft [&_summary]:cursor-pointer">
              <summary className="flex items-center justify-between gap-4 font-semibold marker:content-none">
                {q}
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-emerald-700 px-6 py-14 text-center text-primary-foreground shadow-glow dark:to-emerald-800 sm:px-12 sm:py-20">
          <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
          <h2 className="relative font-display text-3xl font-semibold tracking-tight sm:text-4xl">Start growing your savings today</h2>
          <p className="relative mx-auto mt-3 max-w-md text-primary-foreground/85">Create your profile in under a minute. It’s free, and your data stays yours.</p>
          <Button size="lg" variant="secondary" onClick={goToApp} className="relative mt-7 rounded-full px-8 text-foreground">
            {ctaLabel} <ArrowRight />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-10 sm:flex-row sm:px-6">
          <div className="text-center sm:text-left">
            <Logo />
            <p className="mt-2 text-xs text-muted-foreground">Track. Save. Grow. — your private finance companion.</p>
          </div>
          <div className="flex items-center gap-5 text-sm text-muted-foreground">
            <a href="#features" className="transition-colors hover:text-foreground">Features</a>
            <Link to="/profiles" className="transition-colors hover:text-foreground">Open app</Link>
          </div>
        </div>
        <p className="pb-8 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} SaveWise · Built with React &amp; Supabase</p>
      </footer>
    </div>
  )
}
