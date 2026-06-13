// Notification scanner — generates reminders for due loans, bills,
// subscription renewals, goal milestones, and budget alerts. Dedupe keys keep
// it idempotent, so it can run on every app load.

import { listLoans, updateLoan } from '@/services/loans'
import { listBills, updateBill } from '@/services/bills'
import { listSubscriptions } from '@/services/subscriptions'
import { listGoals } from '@/services/goals'
import { listBudgets } from '@/services/budgets'
import { listTransactions } from '@/services/transactions'
import { pushNotification } from '@/services/notifications'
import { daysUntil, formatMoney, monthStartISO, monthEndISO, pct } from './utils'

export async function runNotificationScan(profileId, currency = 'PHP') {
  const fmt = (n) => formatMoney(n, currency)
  const monthFrom = monthStartISO()
  const monthTo = monthEndISO()

  const [loans, bills, subs, goals, budgets, monthTxns] = await Promise.all([
    listLoans(profileId),
    listBills(profileId),
    listSubscriptions(profileId),
    listGoals(profileId),
    listBudgets(profileId, monthFrom),
    listTransactions(profileId, { from: monthFrom, to: monthTo }),
  ])

  const jobs = []

  // Loans — overdue rollover + due reminders
  for (const loan of loans) {
    if (loan.status === 'paid' || !loan.due_date) continue
    const days = daysUntil(loan.due_date)
    if (days < 0 && loan.status === 'pending') jobs.push(updateLoan(loan.id, { status: 'overdue' }))
    const who = loan.kind === 'debt' ? `You owe ${loan.person_name}` : `${loan.person_name} owes you`
    if (days < 0) {
      jobs.push(pushNotification(profileId, {
        type: 'loan', title: 'Loan overdue', dedupeKey: `loan_overdue_${loan.id}_${loan.due_date}`,
        message: `${who} ${fmt(loan.amount)} — was due ${-days} day${days === -1 ? '' : 's'} ago.`,
      }))
    } else if (days <= 1) {
      jobs.push(pushNotification(profileId, {
        type: 'loan', title: days === 0 ? 'Loan due today' : 'Loan due tomorrow', dedupeKey: `loan_due_${loan.id}_${loan.due_date}`,
        message: `${who} ${fmt(loan.amount)}.`,
      }))
    }
  }

  // Bills — overdue rollover + 3-day reminders
  for (const bill of bills) {
    if (bill.status === 'paid') continue
    const days = daysUntil(bill.due_date)
    if (days < 0 && bill.status === 'unpaid') jobs.push(updateBill(bill.id, { status: 'overdue' }))
    if (days < 0) {
      jobs.push(pushNotification(profileId, {
        type: 'bill', title: 'Bill overdue', dedupeKey: `bill_overdue_${bill.id}_${bill.due_date}`,
        message: `${bill.name} (${fmt(bill.amount)}) is overdue.`,
      }))
    } else if (days <= 3) {
      jobs.push(pushNotification(profileId, {
        type: 'bill', title: `Bill due ${days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`}`, dedupeKey: `bill_due_${bill.id}_${bill.due_date}`,
        message: `${bill.name} — ${fmt(bill.amount)}.`,
      }))
    }
  }

  // Subscription renewals — 3-day heads-up
  for (const sub of subs) {
    if (sub.active === false || !sub.renewal_date) continue
    const days = daysUntil(sub.renewal_date)
    if (days !== null && days >= 0 && days <= 3) {
      jobs.push(pushNotification(profileId, {
        type: 'subscription', title: 'Renewal approaching', dedupeKey: `sub_renew_${sub.id}_${sub.renewal_date}`,
        message: `${sub.name} renews ${days === 0 ? 'today' : `in ${days} day${days === 1 ? '' : 's'}`} — ${fmt(sub.cost)}.`,
      }))
    }
  }

  // Goal milestones — 25 / 50 / 75 / 100%
  for (const goal of goals) {
    const progress = pct(Number(goal.current_amount), Number(goal.target_amount))
    const milestone = progress >= 100 ? 100 : progress >= 75 ? 75 : progress >= 50 ? 50 : progress >= 25 ? 25 : 0
    if (milestone > 0) {
      jobs.push(pushNotification(profileId, {
        type: 'goal', title: milestone === 100 ? 'Goal reached! 🎉' : 'Savings milestone', dedupeKey: `goal_milestone_${goal.id}_${milestone}`,
        message: milestone === 100 ? `"${goal.name}" is fully funded — ${fmt(goal.target_amount)} saved.` : `"${goal.name}" hit ${milestone}% of its target.`,
      }))
    }
  }

  // Budget alerts — 90% and 100%
  const spent = {}
  for (const t of monthTxns) {
    if (t.type === 'expense') spent[t.category] = (spent[t.category] || 0) + Number(t.amount)
  }
  for (const b of budgets) {
    const used = spent[b.category] || 0
    const amount = Number(b.amount) || 0
    if (amount <= 0) continue
    if (used >= amount) {
      jobs.push(pushNotification(profileId, {
        type: 'budget', title: 'Budget exceeded', dedupeKey: `budget_over_${b.category}_${b.month}`,
        message: `${b.category} budget exceeded — ${fmt(used)} of ${fmt(amount)} spent.`,
      }))
    } else if (used / amount >= 0.9) {
      jobs.push(pushNotification(profileId, {
        type: 'budget', title: 'Budget almost exhausted', dedupeKey: `budget_near_${b.category}_${b.month}`,
        message: `⚠ ${b.category} budget is ${Math.round((used / amount) * 100)}% used.`,
      }))
    }
  }

  await Promise.all(jobs)
}
