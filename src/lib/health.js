// Financial Health Score (0–100)
//   Savings rate      → 30 pts (20%+ of income saved = full marks)
//   Debt ratio        → 25 pts (debt vs ~3 months of income)
//   Budget adherence  → 25 pts (staying within monthly budgets)
//   Goal completion   → 20 pts (average progress across savings goals)

import { clamp } from './utils'

export function computeHealthScore({ monthIncome, monthExpenses, totalDebt, budgets, spentByCategory, goals }) {
  const parts = []

  // 1. Savings rate
  const rate = monthIncome > 0 ? (monthIncome - monthExpenses) / monthIncome : 0
  const savingsPts = Math.round(clamp(rate / 0.2, 0, 1) * 30)
  parts.push({
    key: 'savings', label: 'Savings rate', points: savingsPts, max: 30,
    detail: monthIncome > 0 ? `${Math.round(rate * 100)}% of income saved this month` : 'No income recorded this month',
  })

  // 2. Debt ratio
  let debtPts
  let debtDetail
  if (totalDebt <= 0) {
    debtPts = 25
    debtDetail = 'No outstanding debt'
  } else if (monthIncome > 0) {
    const ratio = totalDebt / (monthIncome * 3)
    debtPts = Math.round((1 - clamp(ratio, 0, 1)) * 25)
    debtDetail = `Debt is ${Math.round(ratio * 100)}% of a 3-month income buffer`
  } else {
    debtPts = 5
    debtDetail = 'Outstanding debt with no income recorded'
  }
  parts.push({ key: 'debt', label: 'Debt ratio', points: debtPts, max: 25, detail: debtDetail })

  // 3. Budget adherence
  let budgetPts = 15
  let budgetDetail = 'Create budgets to sharpen this score'
  if (budgets.length > 0) {
    const scores = budgets.map((b) => {
      const spent = spentByCategory[b.category] || 0
      const amount = Number(b.amount) || 0
      if (amount <= 0) return 1
      return spent <= amount ? 1 : clamp(1 - (spent - amount) / amount, 0, 1)
    })
    const avg = scores.reduce((a, s) => a + s, 0) / scores.length
    budgetPts = Math.round(avg * 25)
    const over = budgets.filter((b) => (spentByCategory[b.category] || 0) > Number(b.amount)).length
    budgetDetail = over === 0 ? 'All budgets on track' : `${over} budget${over > 1 ? 's' : ''} exceeded`
  }
  parts.push({ key: 'budget', label: 'Budget adherence', points: budgetPts, max: 25, detail: budgetDetail })

  // 4. Goal completion
  let goalPts = 10
  let goalDetail = 'Create a savings goal to sharpen this score'
  if (goals.length > 0) {
    const progress = goals.map((g) => clamp(Number(g.current_amount) / Math.max(1, Number(g.target_amount)), 0, 1))
    const avg = progress.reduce((a, p) => a + p, 0) / progress.length
    goalPts = Math.round(avg * 20)
    goalDetail = `${Math.round(avg * 100)}% average progress across ${goals.length} goal${goals.length > 1 ? 's' : ''}`
  }
  parts.push({ key: 'goals', label: 'Goal completion', points: goalPts, max: 20, detail: goalDetail })

  const score = parts.reduce((a, p) => a + p.points, 0)
  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : score >= 40 ? 'Fair' : 'Needs attention'
  return { score, label, parts }
}

export function scoreColor(score) {
  if (score >= 80) return '#10b981'
  if (score >= 60) return '#3b82f6'
  if (score >= 40) return '#f59e0b'
  return '#ef4444'
}
