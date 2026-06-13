import { listRows, updateRow, deleteRows, upsertRow } from './db'

export function listNotifications(profileId, opts = {}) {
  return listRows('notifications', { match: { profile_id: profileId }, order: ['created_at', 'desc'], limit: opts.limit })
}

export async function unreadCount(profileId) {
  const rows = await listRows('notifications', { match: { profile_id: profileId, read: false } })
  return rows.length
}

/** Insert-once notification keyed by dedupe_key. */
export function pushNotification(profileId, { type, title, message, dedupeKey }) {
  return upsertRow(
    'notifications',
    { profile_id: profileId, type, title, message, dedupe_key: dedupeKey, read: false },
    { onConflict: 'profile_id,dedupe_key', ignore: true }
  )
}

export function markRead(id) {
  return updateRow('notifications', id, { read: true })
}

export async function markAllRead(profileId) {
  const rows = await listRows('notifications', { match: { profile_id: profileId, read: false } })
  await Promise.all(rows.map((r) => updateRow('notifications', r.id, { read: true })))
}

export function clearAll(profileId) {
  return deleteRows('notifications', { profile_id: profileId })
}
