import { listRows, insertRow, updateRow, deleteRow } from './db'

export function listBills(profileId, opts = {}) {
  return listRows('bills', {
    match: { profile_id: profileId },
    range: opts.from || opts.to ? { field: 'due_date', from: opts.from, to: opts.to } : undefined,
    order: ['due_date', 'asc'],
  })
}

export function createBill(profileId, data) {
  return insertRow('bills', { profile_id: profileId, ...data })
}

export function updateBill(id, patch) {
  return updateRow('bills', id, patch)
}

export function deleteBill(id) {
  return deleteRow('bills', id)
}
