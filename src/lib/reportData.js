// Chart-data helpers for Reports & Dashboard (weekly / monthly / yearly views).

import {
  format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear,
  eachDayOfInterval, eachMonthOfInterval, subMonths,
} from 'date-fns'

const fmt = (d) => format(d, 'yyyy-MM-dd')

export function buildBuckets(period) {
  const now = new Date()
  if (period === 'weekly') {
    const start = startOfWeek(now, { weekStartsOn: 1 })
    const end = endOfWeek(now, { weekStartsOn: 1 })
    return {
      from: fmt(start), to: fmt(end), title: 'This week',
      buckets: eachDayOfInterval({ start, end }).map((d) => ({ label: format(d, 'EEE'), from: fmt(d), to: fmt(d) })),
    }
  }
  if (period === 'yearly') {
    const start = startOfYear(now)
    const end = endOfYear(now)
    return {
      from: fmt(start), to: fmt(end), title: format(now, 'yyyy'),
      buckets: eachMonthOfInterval({ start, end }).map((m) => ({ label: format(m, 'MMM'), from: fmt(startOfMonth(m)), to: fmt(endOfMonth(m)) })),
    }
  }
  const start = startOfMonth(now)
  const end = endOfMonth(now)
  return {
    from: fmt(start), to: fmt(end), title: format(now, 'MMMM yyyy'),
    buckets: eachDayOfInterval({ start, end }).map((d) => ({ label: format(d, 'd'), from: fmt(d), to: fmt(d) })),
  }
}

/** Aggregates transactions into bucket rows for bar/line/area charts. */
export function aggregateBuckets(transactions, buckets) {
  let cumulative = 0
  return buckets.map((b) => {
    let income = 0
    let expense = 0
    for (const t of transactions) {
      if (t.date < b.from || t.date > b.to) continue
      if (t.type === 'income') income += Number(t.amount)
      else expense += Number(t.amount)
    }
    cumulative += income - expense
    return { label: b.label, income, expense, net: income - expense, saved: cumulative }
  })
}

/** Expense totals per category within a window — pie chart data. */
export function categoryTotals(transactions, from, to) {
  const map = {}
  for (const t of transactions) {
    if (t.type !== 'expense' || t.date < from || t.date > to) continue
    map[t.category] = (map[t.category] || 0) + Number(t.amount)
  }
  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
}

/** Last N months of income vs expense (dashboard mini chart). */
export function lastMonthsSeries(transactions, n = 6) {
  const now = new Date()
  const out = []
  for (let i = n - 1; i >= 0; i--) {
    const m = subMonths(now, i)
    const from = fmt(startOfMonth(m))
    const to = fmt(endOfMonth(m))
    let income = 0
    let expense = 0
    for (const t of transactions) {
      if (t.date < from || t.date > to) continue
      if (t.type === 'income') income += Number(t.amount)
      else expense += Number(t.amount)
    }
    out.push({ label: format(m, 'MMM'), income, expense })
  }
  return out
}
