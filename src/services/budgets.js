import { listRows, insertRow, updateRow, deleteRow } from './db'

/** month: 'yyyy-MM-01' */
export function listBudgets(profileId, month) {
  return listRows('budgets', {
    match: { profile_id: profileId, ...(month ? { month } : {}) },
    order: ['created_at', 'asc'],
  })
}

export function createBudget(profileId, data) {
  return insertRow('budgets', { profile_id: profileId, ...data })
}

export function updateBudget(id, patch) {
  return updateRow('budgets', id, patch)
}

export function deleteBudget(id) {
  return deleteRow('budgets', id)
}
