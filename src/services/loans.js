import { listRows, insertRow, updateRow, deleteRow } from './db'

export function listLoans(profileId, kind) {
  return listRows('loans', {
    match: { profile_id: profileId, ...(kind ? { kind } : {}) },
    order: ['due_date', 'asc'],
  })
}

export function createLoan(profileId, data) {
  return insertRow('loans', { profile_id: profileId, ...data })
}

export function updateLoan(id, patch) {
  return updateRow('loans', id, patch)
}

export function deleteLoan(id) {
  return deleteRow('loans', id)
}
