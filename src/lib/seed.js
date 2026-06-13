// Development sample-data seeder. Creates a fully populated demo profile
// (PIN 1234) so the dashboard, charts, and engines have something to show.
// Works through the data adapter, so it seeds Supabase or Demo Mode alike.
// Removable in one click: deleting the profile cascades to all of its data.

import { format, subMonths, setDate, getDaysInMonth, addDays, addMonths } from 'date-fns'
import { createProfile } from '@/services/profiles'
import { insertRows, insertRow } from '@/services/db'

const iso = (d) => format(d, 'yyyy-MM-dd')

export const DEMO_PIN = '1234'

export async function seedDemoData() {
  const now = new Date()
  const profile = await createProfile({
    name: 'Demo',
    pin: DEMO_PIN,
    avatar: '🦊',
    avatar_color: 'emerald',
    monthly_income_goal: 35000,
    monthly_savings_goal: 8000,
    is_demo: true,
  })
  const pid = profile.id

  // --- Transactions: ~3 months of realistic activity ---------------------
  const incomeTemplate = [
    [1, 'Allowance', 2000, 'Monthly allowance'],
    [15, 'Salary', 28000, 'Payroll'],
    [22, 'Freelance', 4200, 'Side project'],
  ]
  const expenseTemplate = [
    [2, 'Food', 320, 'Lunch out'],
    [3, 'Groceries', 1850, 'Weekly groceries'],
    [4, 'Transportation', 480, 'Commute card top-up'],
    [5, 'Bills', 8000, 'Rent'],
    [7, 'Entertainment', 450, 'Movie night'],
    [8, 'Bills', 1699, 'Internet'],
    [10, 'Food', 540, 'Dinner with friends'],
    [11, 'Groceries', 1620, 'Weekly groceries'],
    [13, 'Shopping', 1290, 'New shoes'],
    [16, 'Food', 410, 'Weekend brunch'],
    [17, 'Transportation', 520, 'Grab rides'],
    [18, 'Bills', 999, 'Phone plan'],
    [19, 'Groceries', 1740, 'Weekly groceries'],
    [21, 'Medical', 350, 'Pharmacy'],
    [24, 'Food', 480, 'Takeout'],
    [25, 'Entertainment', 549, 'Streaming + games'],
    [26, 'Bills', 480, 'Water'],
    [27, 'Groceries', 1580, 'Weekly groceries'],
    [28, 'Bills', 2150, 'Electricity'],
    [28, 'Transportation', 460, 'Commute card top-up'],
  ]

  const txns = []
  for (let i = 2; i >= 0; i--) {
    const month = subMonths(now, i)
    const maxDay = i === 0 ? now.getDate() : getDaysInMonth(month)
    const wiggle = 1 + (2 - i) * 0.04
    for (const [day, category, amount, notes] of incomeTemplate) {
      if (day > maxDay) continue
      txns.push({ profile_id: pid, type: 'income', category, amount: Math.round(amount * (category === 'Freelance' ? wiggle : 1)), date: iso(setDate(month, day)), notes })
    }
    for (const [day, category, amount, notes] of expenseTemplate) {
      if (day > maxDay) continue
      txns.push({ profile_id: pid, type: 'expense', category, amount: Math.round(amount * wiggle), date: iso(setDate(month, day)), notes })
    }
  }
  await insertRows('transactions', txns)

  // --- Budgets for the current month --------------------------------------
  const month = iso(setDate(now, 1))
  await insertRows('budgets', [
    { profile_id: pid, category: 'Food', amount: 2200, month },
    { profile_id: pid, category: 'Groceries', amount: 7500, month },
    { profile_id: pid, category: 'Transportation', amount: 1800, month },
    { profile_id: pid, category: 'Shopping', amount: 2000, month },
    { profile_id: pid, category: 'Entertainment', amount: 1500, month },
    { profile_id: pid, category: 'Bills', amount: 14000, month },
  ])

  // --- Savings goals -------------------------------------------------------
  await insertRows('savings_goals', [
    { profile_id: pid, name: 'Emergency Fund', target_amount: 50000, current_amount: 18500, target_date: iso(addMonths(now, 8)), priority: 'high' },
    { profile_id: pid, name: 'Gaming PC', target_amount: 50000, current_amount: 15000, target_date: iso(addMonths(now, 10)), priority: 'medium' },
    { profile_id: pid, name: 'New Phone', target_amount: 20000, current_amount: 20000, priority: 'low', completed_at: subMonths(now, 1).toISOString() },
  ])

  // --- Loans ---------------------------------------------------------------
  await insertRows('loans', [
    { profile_id: pid, kind: 'debt', person_name: 'Carlos', amount: 5000, due_date: iso(addDays(now, 12)), status: 'pending', notes: 'Borrowed for laptop repair' },
    { profile_id: pid, kind: 'debt', person_name: 'Tita Rosa', amount: 3000, due_date: iso(subMonths(now, 1)), status: 'paid', notes: 'Emergency loan — settled' },
    { profile_id: pid, kind: 'receivable', person_name: 'Maria', amount: 2500, due_date: iso(addDays(now, 5)), status: 'pending', notes: 'Split concert tickets' },
    { profile_id: pid, kind: 'receivable', person_name: 'Leo', amount: 1200, due_date: iso(addDays(now, -3)), status: 'pending', notes: 'Lunch IOUs' },
  ])

  // --- Bills (current month) ----------------------------------------------
  const day = (d) => iso(setDate(now, Math.min(d, getDaysInMonth(now))))
  await insertRows('bills', [
    { profile_id: pid, name: 'Rent', amount: 8000, due_date: day(5), status: 'paid' },
    { profile_id: pid, name: 'Internet', amount: 1699, due_date: day(8), status: 'paid' },
    { profile_id: pid, name: 'Phone', amount: 999, due_date: day(18), status: now.getDate() >= 18 ? 'paid' : 'unpaid' },
    { profile_id: pid, name: 'Water', amount: 480, due_date: day(26), status: 'unpaid' },
    { profile_id: pid, name: 'Electricity', amount: 2150, due_date: day(28), status: 'unpaid' },
  ])

  // --- Subscriptions -------------------------------------------------------
  const renew = (d) => iso(addDays(now, d))
  await insertRows('subscriptions', [
    { profile_id: pid, name: 'Netflix', cost: 549, billing_cycle: 'monthly', renewal_date: renew(9), active: true },
    { profile_id: pid, name: 'Spotify', cost: 149, billing_cycle: 'monthly', renewal_date: renew(2), active: true },
    { profile_id: pid, name: 'ChatGPT', cost: 1150, billing_cycle: 'monthly', renewal_date: renew(17), active: true },
    { profile_id: pid, name: 'Canva', cost: 3290, billing_cycle: 'yearly', renewal_date: renew(140), active: true },
  ])

  // --- Family vault --------------------------------------------------------
  const vault = await insertRow('family_vaults', { profile_id: pid, name: 'Family Emergency Fund', target_amount: 100000 })
  await insertRows('family_contributions', [
    { profile_id: pid, vault_id: vault.id, contributor_name: 'Demo', amount: 20000, date: iso(subMonths(now, 2)) },
    { profile_id: pid, vault_id: vault.id, contributor_name: 'Maria', amount: 15000, date: iso(subMonths(now, 1)) },
    { profile_id: pid, vault_id: vault.id, contributor_name: 'John', amount: 10000, date: iso(addDays(now, -14)) },
    { profile_id: pid, vault_id: vault.id, contributor_name: 'Demo', amount: 15000, date: iso(addDays(now, -4)) },
  ])

  return profile
}
