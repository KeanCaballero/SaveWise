import { listRows, upsertRow } from './db'

const DEFAULTS = { currency: 'PHP', theme: 'system', notifications_enabled: true }

export async function getSettings(profileId) {
  const rows = await listRows('settings', { match: { profile_id: profileId } })
  return rows[0] || { profile_id: profileId, ...DEFAULTS }
}

export function saveSettings(profileId, patch) {
  return upsertRow(
    'settings',
    { profile_id: profileId, ...patch, updated_at: new Date().toISOString() },
    { onConflict: 'profile_id' }
  )
}
