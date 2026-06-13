import { listRows, insertRow, updateRow, deleteRow } from './db'

export function listGoals(profileId) {
  return listRows('savings_goals', { match: { profile_id: profileId }, order: ['created_at', 'asc'] })
}

export function createGoal(profileId, data) {
  return insertRow('savings_goals', { profile_id: profileId, current_amount: 0, ...data })
}

export function updateGoal(id, patch) {
  return updateRow('savings_goals', id, patch)
}

export function deleteGoal(id) {
  return deleteRow('savings_goals', id)
}

/** Adds funds and auto-completes the goal when the target is reached. */
export async function addFunds(goal, amount) {
  const next = (Number(goal.current_amount) || 0) + Number(amount)
  const completed = next >= Number(goal.target_amount)
  return updateRow('savings_goals', goal.id, {
    current_amount: next,
    completed_at: completed ? (goal.completed_at || new Date().toISOString()) : null,
  })
}
