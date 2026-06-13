import { listRows, insertRow, updateRow, deleteRow } from './db'

export function listSubscriptions(profileId) {
  return listRows('subscriptions', { match: { profile_id: profileId }, order: ['renewal_date', 'asc'] })
}

export function createSubscription(profileId, data) {
  return insertRow('subscriptions', { profile_id: profileId, active: true, ...data })
}

export function updateSubscription(id, patch) {
  return updateRow('subscriptions', id, patch)
}

export function deleteSubscription(id) {
  return deleteRow('subscriptions', id)
}
