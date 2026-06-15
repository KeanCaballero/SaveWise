import { listRows, insertRow, updateRow, deleteRow } from './db'

export function listTransactions(profileId, opts = {}) {
  return listRows('transactions', {
    match: { profile_id: profileId, ...(opts.match || {}) },
    range: opts.from || opts.to ? { field: 'date', from: opts.from, to: opts.to } : undefined,
    order: ['date', 'desc'],
    limit: opts.limit,
  })
}

/**
 * `currency` is the profile's active display currency at the time of recording.
 * It is stored as `original_currency` so amounts can be correctly converted
 * later if the user switches their display currency.
 */
export function createTransaction(profileId, data, currency = 'PHP') {
  return insertRow('transactions', {
    profile_id: profileId,
    ...data,
    // Preserve any explicit original_currency on the payload; otherwise use
    // the profile's current currency.
    original_currency: data.original_currency || currency,
  })
}

export function updateTransaction(id, patch) {
  // original_currency is intentionally not changed on edits — the amount
  // was recorded in that currency and should stay associated with it.
  return updateRow('transactions', id, patch)
}

export function deleteTransaction(id) {
  return deleteRow('transactions', id)
}