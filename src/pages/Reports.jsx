import { useMemo, useState } from 'react'
import { PieChart as PieIcon, BarChart3, LineChart as LineIcon, AreaChart as AreaIcon } from 'lucide-react'
import { useProfile } from '@/context/ProfileContext'
import { useAsyncData } from '@/hooks/useAsyncData'
import { listTransactions } from '@/services/transactions'
import { buildBuckets, aggregateBuckets, categoryTotals } from '@/lib/reportData'
import { formatMoney, sum } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'
import EmptyState from '@/components/shared/EmptyState'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ExpensePie, IncomeExpenseBars, SpendingLine, SavingsArea } from '@/components/charts/Charts'

function ChartCard({ icon: Icon, title, description, children, empty }) {
  return (
    <Card className="animate-fade-in-up">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4 w-4 text-primary" /> {title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {empty ? <p className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">No data in this period yet.</p> : children}
      </CardContent>
    </Card>
  )
}

export default function Reports() {
  const { profile, currency, convertAmount } = useProfile()
  const [period, setPeriod] = useState('monthly')

  const window_ = useMemo(() => buildBuckets(period), [period])

  const { data: txns, loading } = useAsyncData(
    () => listTransactions(profile.id, { from: window_.from, to: window_.to }),
    [profile.id, window_.from, window_.to]
  )

  // Bug 3 fix: convert all transaction amounts to the display currency before
  // passing to chart helpers — otherwise charts show raw recorded amounts with
  // no conversion when the user has switched currency.
  const displayTxns = useMemo(
    () => (txns || []).map((t) => ({
      ...t,
      amount: convertAmount(t.amount, t.original_currency),
    })),
    [txns, convertAmount],
  )

  const rows    = useMemo(() => aggregateBuckets(displayTxns, window_.buckets), [displayTxns, window_])
  const pieData = useMemo(() => categoryTotals(displayTxns, window_.from, window_.to), [displayTxns, window_])
  const income   = sum(displayTxns.filter((t) => t.type === 'income'))
  const expenses = sum(displayTxns.filter((t) => t.type === 'expense'))
  const noData   = (txns || []).length === 0

  return (
    <div>
      <PageHeader title="Reports & Analytics" description={`${window_.title} · ${formatMoney(income, currency)} in, ${formatMoney(expenses, currency)} out`}>
        <Tabs value={period} onValueChange={setPeriod}>
          <TabsList>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="monthly">Monthly</TabsTrigger>
            <TabsTrigger value="yearly">Yearly</TabsTrigger>
          </TabsList>
        </Tabs>
      </PageHeader>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-80" />)}</div>
      ) : noData ? (
        <EmptyState
          icon={BarChart3}
          title="Nothing to chart yet"
          description="Once you log transactions in this period, your reports come alive here."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard icon={PieIcon} title="Expense Breakdown" description="Where the money went, by category" empty={pieData.length === 0}>
            <ExpensePie data={pieData} currency={currency} />
          </ChartCard>
          <ChartCard icon={BarChart3} title="Income vs Expense" description="Side by side, per period">
            <IncomeExpenseBars data={rows} currency={currency} />
          </ChartCard>
          <ChartCard icon={LineIcon} title="Spending Trend" description="How spending moves over time">
            <SpendingLine data={rows} currency={currency} />
          </ChartCard>
          <ChartCard icon={AreaIcon} title="Savings Growth" description="Cumulative net savings (income − expenses)">
            <SavingsArea data={rows} currency={currency} />
          </ChartCard>
        </div>
      )}
    </div>
  )
}