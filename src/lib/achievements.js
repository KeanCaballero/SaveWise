// Achievement engine — evaluates unlock conditions after data changes and on
// dashboard load. Inserts are idempotent (upsert + ignore duplicates).

import { listTransactions } from '@/services/transactions'
import { listGoals } from '@/services/goals'
import { listLoans } from '@/services/loans'
import { listBudgets } from '@/services/budgets'
import { listUnlocked, unlock } from '@/services/achievements'
import { pushNotification } from '@/services/notifications'
import { prevMonthStartISO, monthStartISO, sum } from './utils'

export const ACHIEVEMENTS = [
  { id: 'first_transaction', title: 'First Steps', description: 'Log your first transaction', icon: '📝' },
  { id: 'saved_1k', title: 'Saver', description: 'Reach 1,000 in total savings', icon: '💰' },
  { id: 'saved_10k', title: 'Super Saver', description: 'Reach 10,000 in total savings', icon: '🏦' },
  { id: 'first_goal', title: 'Goal Getter', description: 'Complete your first savings goal', icon: '🎯' },
  { id: 'streak_30', title: 'On Fire', description: 'Track transactions 30 days in a row', icon: '🔥' },
  { id: 'debt_free', title: 'Debt-Free', description: 'Pay off every debt you owe', icon: '🕊️' },
  { id: 'budget_master', title: 'Budget Master', description: 'Finish a month with every budget under its limit', icon: '👑' },
]

export function achievementMeta(id) {
  return ACHIEVEMENTS.find((a) => a.id === id)
}

function longestStreak(dates) {
  const days = [...new Set(dates)].sort()
  let best = 0
  let run = 0
  let prev = null
  for (const d of days) {
    if (prev) {
      const gap = (new Date(d) - new Date(prev)) / 86400000
      run = gap === 1 ? run + 1 : 1
    } else {
      run = 1
    }
    best = Math.max(best, run)
    prev = d
  }
  return best
}

/** Evaluates all conditions and unlocks anything new. Returns newly unlocked metas. */
export async function evaluateAchievements(profileId) {
  const [txns, goals, loans, unlocked] = await Promise.all([
    listTransactions(profileId),
    listGoals(profileId),
    listLoans(profileId),
    listUnlocked(profileId),
  ])
  const prevMonth = prevMonthStartISO()
  const prevBudgets = await listBudgets(profileId, prevMonth)

  const have = new Set(unlocked.map((u) => u.achievement_id))
  const newly = []
  const check = (id, cond) => {
    if (cond && !have.has(id)) newly.push(id)
  }

  const totalSaved = sum(goals, 'current_amount')
  const debts = loans.filter((l) => l.kind === 'debt')

  check('first_transaction', txns.length >= 1)
  check('saved_1k', totalSaved >= 1000)
  check('saved_10k', totalSaved >= 10000)
  check('first_goal', goals.some((g) => g.completed_at || Number(g.current_amount) >= Number(g.target_amount)))
  check('streak_30', longestStreak(txns.map((t) => t.date)) >= 30)
  check('debt_free', debts.length > 0 && debts.every((d) => d.status === 'paid'))

  if (prevBudgets.length > 0) {
    const from = prevMonth
    const to = monthStartISO()
    const spent = {}
    for (const t of txns) {
      if (t.type === 'expense' && t.date >= from && t.date < to) {
        spent[t.category] = (spent[t.category] || 0) + Number(t.amount)
      }
    }
    check('budget_master', prevBudgets.every((b) => (spent[b.category] || 0) <= Number(b.amount)))
  }

  const metas = []
  for (const id of newly) {
    const meta = achievementMeta(id)
    await unlock(profileId, id)
    await pushNotification(profileId, {
      type: 'achievement',
      title: 'Achievement unlocked!',
      message: `${meta.icon} ${meta.title} — ${meta.description}`,
      dedupeKey: `achievement_${id}`,
    })
    metas.push(meta)
  }
  return metas
}
