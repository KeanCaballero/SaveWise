import { listRows, getRow, insertRow, updateRow, deleteRow, deleteRows, upsertRow } from './db'
import { isDemoMode } from './storage'
import { hashPin } from '@/lib/utils'

const OWNED_TABLES = [
  'transactions', 'budgets', 'savings_goals', 'loans', 'bills', 'subscriptions',
  'family_contributions', 'family_vaults', 'profile_achievements', 'notifications', 'settings',
]

export function listProfiles() {
  return listRows('profiles', { order: ['created_at', 'asc'] })
}

export function getProfile(id) {
  return getRow('profiles', id)
}

export async function createProfile({ pin, ...fields }) {
  const pin_hash = await hashPin(pin)
  const profile = await insertRow('profiles', { ...fields, pin_hash })
  await upsertRow('settings', { profile_id: profile.id, currency: 'PHP', theme: 'system', notifications_enabled: true }, { onConflict: 'profile_id' })
  return profile
}

export function updateProfile(id, patch) {
  return updateRow('profiles', id, patch)
}

export async function changePin(id, newPin) {
  return updateRow('profiles', id, { pin_hash: await hashPin(newPin) })
}

export async function verifyPin(profile, pin) {
  return (await hashPin(pin)) === profile.pin_hash
}

export function touchProfile(id) {
  return updateRow('profiles', id, { last_active_at: new Date().toISOString() })
}

/** Deletes a profile and every row it owns (FK cascade on Supabase). */
export async function deleteProfile(id) {
  if (isDemoMode()) {
    for (const table of OWNED_TABLES) await deleteRows(table, { profile_id: id })
  }
  await deleteRow('profiles', id)
}
