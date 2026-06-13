import { listRows, insertRow, updateRow, deleteRow } from './db'

export function listTransactions(profileId, opts = {}) {
  return listRows('transactions', {
    match: { profile_id: profileId, ...(opts.match || {}) },
    range: opts.from || opts.to ? { field: 'date', from: opts.from, to: opts.to } : undefined,
    order: ['date', 'desc'],
    limit: opts.limit,
  })
}

export function createTransaction(profileId, data) {
  return insertRow('transactions', { profile_id: profileId, ...data })
}

export function updateTransaction(id, patch) {
  return updateRow('transactions', id, patch)
}

export function deleteTransaction(id) {
  return deleteRow('transactions', id)
}
