// Smart Insights engine — rule-based recommendations computed from the
// profile's recent activity. Pure function; safe to run on every dashboard load.

import { differenceInCalendarMonths } from 'date-fns'
import { formatMoney, formatDate, monthStartISO, monthEndISO, prevMonthStartISO, toDate, monthlyCost, sum } from './utils'

function spentBy(transactions, from, to) {
  const map = {}
  for (const t of transactions) {
    if (t.type !== 'expense' || t.date < from || t.date > to) continue
    map[t.category] = (map[t.category] || 0) + Number(t.amount)
  }
  return map
}

function totalIn(transactions, type, from, to) {
  return sum(transactions.filter((t) => t.type === type && t.date >= from && t.date <= to))
}

export function computeInsights({ transactions, budgets, goals, subscriptions, currency }) {
  const insights = []
  const fmt = (n) => formatMoney(n, currency)
  const thisFrom = monthStartISO()
  const thisTo = monthEndISO()
  const prevFrom = prevMonthStartISO()
  const prevTo = thisFrom

  const thisSpend = spentBy(transactions, thisFrom, thisTo)
  const prevSpend = spentBy(transactions, prevFrom, prevTo)

  // 1. Category spending shifts vs last month
  const shifts = []
  for (const cat of Object.keys({ ...thisSpend, ...prevSpend })) {
    const prev = prevSpend[cat] || 0
    const cur = thisSpend[cat] || 0
    if (prev < 300) continue
    const delta = (cur - prev) / prev
    if (Math.abs(delta) >= 0.2 && Math.abs(cur - prev) >= 300) shifts.push({ cat, delta })
  }
  shifts.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
  for (const s of shifts.slice(0, 2)) {
    insights.push(s.delta > 0
      ? { id: `shift-${s.cat}`, tone: 'warning', text: `You spent ${Math.round(s.delta * 100)}% more on ${s.cat.toLowerCase()} this month.` }
      : { id: `shift-${s.cat}`, tone: 'positive', text: `Your ${s.cat.toLowerCase()} costs decreased by ${Math.round(-s.delta * 100)}%. Keep it up!` })
  }

  // 2. Budgets close to or over the limit
  for (const b of budgets) {
    const used = thisSpend[b.category] || 0
    const amount = Number(b.amount) || 0
    if (amount <= 0) continue
    const ratio = used / amount
    if (ratio >= 1) {
      insights.push({ id: `budget-over-${b.category}`, tone: 'warning', text: `${b.category} budget exceeded — ${fmt(used - amount)} over the ${fmt(amount)} limit.` })
    } else if (ratio >= 0.8) {
      insights.push({ id: `budget-near-${b.category}`, tone: 'warning', text: `${b.category} budget is ${Math.round(ratio * 100)}% used with ${fmt(amount - used)} left.` })
    }
  }

  // 3. Savings-goal pacing
  const active = goals.filter((g) => !g.completed_at && Number(g.current_amount) < Number(g.target_amount))
  const ranked = [...active].sort((a, b) => ['high', 'medium', 'low'].indexOf(a.priority) - ['high', 'medium', 'low'].indexOf(b.priority))
  const focus = ranked.find((g) => g.target_date) || ranked[0]
  if (focus) {
    const remaining = Number(focus.target_amount) - Number(focus.current_amount)
    const progress = Number(focus.current_amount) / Math.max(1, Number(focus.target_amount))
    if (progress >= 0.85) {
      insights.push({ id: `goal-close-${focus.id}`, tone: 'positive', text: `You're ${Math.round(progress * 100)}% of the way to "${focus.name}" — almost there!` })
    } else if (focus.target_date) {
      const monthsLeft = Math.max(1, differenceInCalendarMonths(toDate(focus.target_date), new Date()))
      const requiredMonthly = remaining / monthsLeft
      const avgNet = (totalIn(transactions, 'income', prevFrom, thisTo) - totalIn(transactions, 'expense', prevFrom, thisTo)) / 2
      if (requiredMonthly > avgNet && avgNet >= 0) {
        const extraWeekly = Math.ceil((requiredMonthly - avgNet) / 4.345 / 50) * 50
        insights.push({ id: `goal-pace-${focus.id}`, tone: 'info', text: `Save ${fmt(Math.max(50, extraWeekly))} more weekly to reach "${focus.name}" by ${formatDate(focus.target_date)}.` })
      } else {
        insights.push({ id: `goal-track-${focus.id}`, tone: 'positive', text: `At your current pace you'll reach "${focus.name}" by ${formatDate(focus.target_date)}.` })
      }
    }
  }

  // 4. Savings rate trend
  const thisIncome = totalIn(transactions, 'income', thisFrom, thisTo)
  const prevIncome = totalIn(transactions, 'income', prevFrom, prevTo)
  if (thisIncome > 0 && prevIncome > 0) {
    const thisRate = (thisIncome - totalIn(transactions, 'expense', thisFrom, thisTo)) / thisIncome
    const prevRate = (prevIncome - totalIn(transactions, 'expense', prevFrom, prevTo)) / prevIncome
    const diff = Math.round((thisRate - prevRate) * 100)
    if (diff >= 5) insights.push({ id: 'rate-up', tone: 'positive', text: `Your savings rate improved to ${Math.round(thisRate * 100)}% — up ${diff} points from last month.` })
    else if (diff <= -5) insights.push({ id: 'rate-down', tone: 'warning', text: `Your savings rate dropped to ${Math.max(0, Math.round(thisRate * 100))}% — ${-diff} points below last month.` })
  }

  // 5. Subscription load
  const subTotal = subscriptions.filter((s) => s.active !== false).reduce((a, s) => a + monthlyCost(s), 0)
  if (thisIncome > 0 && subTotal / thisIncome >= 0.1) {
    insights.push({ id: 'subs-heavy', tone: 'info', text: `Subscriptions cost ${fmt(subTotal)}/month — ${Math.round((subTotal / thisIncome) * 100)}% of this month's income. Worth a review?` })
  }

  // 6. Biggest spending category
  const top = Object.entries(thisSpend).sort((a, b) => b[1] - a[1])[0]
  const totalSpent = sum(Object.entries(thisSpend).map(([, v]) => ({ amount: v })))
  if (top && totalSpent > 0 && top[1] / totalSpent >= 0.35) {
    insights.push({ id: 'top-cat', tone: 'info', text: `${top[0]} makes up ${Math.round((top[1] / totalSpent) * 100)}% of this month's spending (${fmt(top[1])}).` })
  }

  const order = { warning: 0, info: 1, positive: 2 }
  insights.sort((a, b) => order[a.tone] - order[b.tone])
  if (insights.length === 0) {
    insights.push({ id: 'empty', tone: 'info', text: 'Log a few transactions and SaveWise will start spotting patterns in your money.' })
  }
  return insights.slice(0, 5)
}
