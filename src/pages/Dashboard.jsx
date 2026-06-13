import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  ArrowRight, HandCoins, Landmark, PiggyBank,
  ReceiptText, Repeat, Scale, Sparkles, TrendingDown, TrendingUp, Info, AlertTriangle,
} from 'lucide-react'
import { useProfile } from '@/context/ProfileContext'
import { useAsyncData } from '@/hooks/useAsyncData'
import { listTransactions } from '@/services/transactions'
import { listBudgets } from '@/services/budgets'
import { listGoals } from '@/services/goals'
import { listLoans } from '@/services/loans'
import { listBills } from '@/services/bills'
import { listSubscriptions } from '@/services/subscriptions'
import { computeHealthScore, scoreColor } from '@/lib/health'
import { computeInsights } from '@/lib/insights'
import { evaluateAchievements } from '@/lib/achievements'
import { runNotificationScan } from '@/lib/notify'
import { celebrate } from '@/lib/feedback'
import { categoryTotals, lastMonthsSeries } from '@/lib/reportData'
import { categoryMeta } from '@/lib/constants'
import { cn, formatMoney, greeting, monthStartISO, monthEndISO, prevMonthStartISO, sum, pct, dueInfo, notifyDataChanged } from '@/lib/utils'
import ProgressRing from '@/components/shared/ProgressRing'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { ExpensePie, IncomeExpenseBars } from '@/components/charts/Charts'

const INSIGHT_STYLE = {
  positive: { icon: TrendingUp, class: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  warning: { icon: AlertTriangle, class: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  info: { icon: Info, class: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
}

/** Restrained secondary metric — neutral by default; accent only signals meaning. */
function MiniStat({ label, value, icon: Icon, accent, sub }) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-soft">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="truncate text-[11px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className={cn('mt-2 text-lg font-bold tabular-nums sm:text-xl', accent)}>{value}</p>
      {sub ? <p className="mt-0.5 truncate text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  )
}

export default function Dashboard() {
  const { profile, currency } = useProfile()

  const { data, loading, refresh } = useAsyncData(async () => {
    const monthFrom = monthStartISO()
    const monthTo = monthEndISO()
    const [allTxns, budgets, goals, loans, bills, subs] = await Promise.all([
      listTransactions(profile.id),
      listBudgets(profile.id, monthFrom),
      listGoals(profile.id),
      listLoans(profile.id),
      listBills(profile.id),
      listSubscriptions(profile.id),
    ])
    return { allTxns, budgets, goals, loans, bills, subs, monthFrom, monthTo }
  }, [profile.id])

  // Run engines once per visit: reminders + achievement unlocks.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await runNotificationScan(profile.id, currency)
        const unlocked = await evaluateAchievements(profile.id)
        if (!cancelled) {
          if (unlocked.length) celebrate()
          unlocked.forEach((a) => toast(`${a.icon} Achievement unlocked: ${a.title}`))
          notifyDataChanged()
        }
      } catch (e) {
        console.error(e)
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id])

  const view = useMemo(() => {
    if (!data) return null
    const { allTxns, budgets, goals, loans, bills, subs, monthFrom, monthTo } = data

    const inMonth = (t) => t.date >= monthFrom && t.date <= monthTo
    const monthIncome = sum(allTxns.filter((t) => t.type === 'income' && inMonth(t)))
    const monthExpenses = sum(allTxns.filter((t) => t.type === 'expense' && inMonth(t)))
    const cashBalance = sum(allTxns.filter((t) => t.type === 'income')) - sum(allTxns.filter((t) => t.type === 'expense'))
    const totalSavings = sum(goals, 'current_amount')
    const totalDebt = sum(loans.filter((l) => l.kind === 'debt' && l.status !== 'paid'))
    const receivables = sum(loans.filter((l) => l.kind === 'receivable' && l.status !== 'paid'))
    const netWorth = cashBalance + totalSavings + receivables - totalDebt

    const spentByCategory = {}
    for (const t of allTxns) {
      if (t.type === 'expense' && inMonth(t)) spentByCategory[t.category] = (spentByCategory[t.category] || 0) + Number(t.amount)
    }

    const health = computeHealthScore({ monthIncome, monthExpenses, totalDebt, budgets, spentByCategory, goals })
    const insights = computeInsights({
      transactions: allTxns.filter((t) => t.date >= prevMonthStartISO()),
      budgets, goals, subscriptions: subs, currency,
    })

    const upcoming = [
      ...bills.filter((b) => b.status !== 'paid').map((b) => ({ id: `b-${b.id}`, icon: ReceiptText, name: b.name, amount: b.amount, due: b.due_date, kind: 'Bill' })),
      ...loans.filter((l) => l.kind === 'debt' && l.status !== 'paid' && l.due_date).map((l) => ({ id: `l-${l.id}`, icon: HandCoins, name: `Pay ${l.person_name}`, amount: l.amount, due: l.due_date, kind: 'Loan' })),
      ...subs.filter((s) => s.active !== false && (dueInfo(s.renewal_date).days ?? 99) <= 14).map((s) => ({ id: `s-${s.id}`, icon: Repeat, name: s.name, amount: s.cost, due: s.renewal_date, kind: 'Renewal' })),
    ]
      .sort((a, b) => (a.due || '').localeCompare(b.due || ''))
      .slice(0, 5)

    const pieData = categoryTotals(allTxns, monthFrom, monthTo)
    const barData = lastMonthsSeries(allTxns, 6)
    const recent = allTxns.slice(0, 5)
    const activeGoals = goals.filter((g) => !g.completed_at && Number(g.current_amount) < Number(g.target_amount)).slice(0, 3)

    return {
      monthIncome, monthExpenses, cashBalance, totalSavings, totalDebt, netWorth,
      health, insights, upcoming, pieData, barData, recent, activeGoals,
    }
  }, [data, currency])

  if (loading || !view) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
        <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-72" /><Skeleton className="h-72" /></div>
      </div>
    )
  }

  const { health } = view
  const monthNet = view.monthIncome - view.monthExpenses

  return (
    <div className="space-y-6">
      {/* Hero — net worth in display serif is the focal point */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-emerald-700 p-6 text-primary-foreground shadow-glow animate-fade-in-up dark:to-emerald-800 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-24 h-60 w-60 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-12 h-52 w-52 rounded-full bg-black/10 blur-3xl" />
        <div className="relative">
          <p className="text-sm font-medium text-primary-foreground/80">
            {greeting()}, {profile.name} · {format(new Date(), 'EEE, MMM d')}
          </p>
          <p className="mt-5 text-xs font-medium uppercase tracking-[0.2em] text-primary-foreground/70">Total net worth</p>
          <div className="mt-1.5 flex flex-wrap items-end gap-x-4 gap-y-2">
            <p className="font-display text-4xl font-semibold leading-none tabular-nums sm:text-5xl">{formatMoney(view.netWorth, currency)}</p>
            <span className="mb-0.5 inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold backdrop-blur">
              {monthNet >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {monthNet >= 0 ? '+' : '−'}{formatMoney(Math.abs(monthNet), currency)} this month
            </span>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-4 border-t border-white/15 pt-4">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-primary-foreground/70">Balance</p>
              <p className="mt-0.5 font-semibold tabular-nums">{formatMoney(view.cashBalance, currency)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-primary-foreground/70">In · {format(new Date(), 'MMM')}</p>
              <p className="mt-0.5 font-semibold tabular-nums">{formatMoney(view.monthIncome, currency)}</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-primary-foreground/70">Out · {format(new Date(), 'MMM')}</p>
              <p className="mt-0.5 font-semibold tabular-nums">{formatMoney(view.monthExpenses, currency)}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Secondary metrics — restrained; color only carries meaning */}
      <div className="grid grid-cols-3 gap-3">
        <MiniStat label="Savings" value={formatMoney(view.totalSavings, currency)} icon={PiggyBank} sub="All goals" />
        <MiniStat label="Debt" value={formatMoney(view.totalDebt, currency)} icon={Landmark}
          accent={view.totalDebt > 0 ? 'text-warning' : 'text-foreground'} sub={view.totalDebt > 0 ? 'Open' : 'Debt-free'} />
        <MiniStat label="Net · month" value={`${monthNet >= 0 ? '+' : '−'}${formatMoney(Math.abs(monthNet), currency)}`} icon={Scale}
          accent={monthNet >= 0 ? 'text-primary' : 'text-destructive'} sub={monthNet >= 0 ? 'Surplus' : 'Deficit'} />
      </div>

      {/* Health score + insights */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="animate-fade-in-up lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Financial Health</CardTitle>
            <CardDescription>Savings rate, debt, budgets & goals</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-5 sm:flex-row">
            <ProgressRing value={health.score} color={scoreColor(health.score)}>
              <p className="text-3xl font-extrabold tabular-nums">{health.score}</p>
              <p className="text-[11px] font-medium text-muted-foreground">/ 100</p>
            </ProgressRing>
            <div className="w-full flex-1 space-y-2.5">
              <Badge variant={health.score >= 60 ? 'success' : health.score >= 40 ? 'warning' : 'destructive'}>{health.label}</Badge>
              {health.parts.map((p) => (
                <div key={p.key} title={p.detail}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-muted-foreground">{p.label}</span>
                    <span className="font-semibold tabular-nums">{p.points}/{p.max}</span>
                  </div>
                  <Progress value={(p.points / p.max) * 100} className="h-1.5" indicatorClassName={cn(p.points / p.max >= 0.7 ? 'bg-emerald-500' : p.points / p.max >= 0.4 ? 'bg-amber-500' : 'bg-red-500')} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in-up lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" /> Smart Insights</CardTitle>
            <CardDescription>What SaveWise noticed this month</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {view.insights.map((ins) => {
              const style = INSIGHT_STYLE[ins.tone]
              const Icon = style.icon
              return (
                <div key={ins.id} className="flex items-start gap-3 rounded-xl border bg-background/40 p-3">
                  <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', style.class)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="text-sm leading-snug">{ins.text}</p>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="animate-fade-in-up">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">This Month's Spending</CardTitle>
            <CardDescription>{formatMoney(view.monthExpenses, currency)} across {view.pieData.length} categories</CardDescription>
          </CardHeader>
          <CardContent>
            {view.pieData.length === 0
              ? <p className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">No expenses logged this month.</p>
              : <ExpensePie data={view.pieData} currency={currency} height={240} />}
          </CardContent>
        </Card>
        <Card className="animate-fade-in-up">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Income vs Expense</CardTitle>
            <CardDescription>Last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <IncomeExpenseBars data={view.barData} currency={currency} height={240} />
          </CardContent>
        </Card>
      </div>

      {/* Upcoming + recent + goals */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="animate-fade-in-up">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Upcoming Payments</CardTitle>
            <CardDescription>Bills, loans & renewals</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {view.upcoming.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Nothing due soon 🎉</p>
            ) : (
              view.upcoming.map((u) => {
                const due = dueInfo(u.due)
                const Icon = u.icon
                return (
                  <div key={u.id} className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-accent/50">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{u.name}</p>
                      <p className={cn('text-xs', due.tone === 'destructive' ? 'text-red-600 dark:text-red-400' : due.tone === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground')}>
                        {u.kind} · {due.label}
                      </p>
                    </div>
                    <p className="text-sm font-semibold tabular-nums">{formatMoney(u.amount, currency)}</p>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        <Card className="animate-fade-in-up">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base">Recent Activity</CardTitle>
              <CardDescription>Latest transactions</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/transactions">All <ArrowRight /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {view.recent.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No transactions yet.</p>
            ) : (
              view.recent.map((t) => {
                const meta = categoryMeta(t.type, t.category)
                const Icon = meta.icon
                return (
                  <div key={t.id} className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-accent/50">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: `${meta.color}1a`, color: meta.color }}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{t.category}</p>
                      <p className="truncate text-xs text-muted-foreground">{t.notes || t.date}</p>
                    </div>
                    <p className={cn('text-sm font-semibold tabular-nums', t.type === 'income' ? 'text-primary' : '')}>
                      {t.type === 'income' ? '+' : '−'}{formatMoney(t.amount, currency)}
                    </p>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        <Card className="animate-fade-in-up">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base">Savings Goals</CardTitle>
              <CardDescription>Top active goals</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/savings">All <ArrowRight /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {view.activeGoals.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No active goals — <Link className="text-primary underline" to="/savings">create one</Link>.</p>
            ) : (
              view.activeGoals.map((g) => {
                const progress = pct(Number(g.current_amount), Number(g.target_amount))
                return (
                  <div key={g.id}>
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span className="truncate font-medium">{g.name}</span>
                      <span className="shrink-0 font-semibold tabular-nums">{progress}%</span>
                    </div>
                    <Progress value={progress} />
                    <p className="mt-1 text-xs tabular-nums text-muted-foreground">
                      {formatMoney(g.current_amount, currency)} of {formatMoney(g.target_amount, currency)}
                    </p>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
