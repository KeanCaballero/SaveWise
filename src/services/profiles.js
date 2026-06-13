import { listRows, getRow, updateRow, deleteRow, deleteRows } from './db'
import { isDemoMode, localdb } from './storage'
import { supabase } from '@/lib/supabase'
import { hashPin } from '@/lib/utils'

// Columns the client is allowed to read. pin_hash, failed_attempts and
// locked_until are intentionally excluded — they live only on the server
// (enforced by column grants in supabase/migrations/0002_pin_security.sql).
const SAFE_COLUMNS = 'id,name,avatar,avatar_color,monthly_income_goal,monthly_savings_goal,is_demo,last_active_at,created_at'

const OWNED_TABLES = [
  'transactions', 'budgets', 'savings_goals', 'loans', 'bills', 'subscriptions',
  'family_contributions', 'family_vaults', 'profile_achievements', 'notifications', 'settings',
]

// Mirror of the server-side lockout policy, for Demo Mode only.
const MAX_ATTEMPTS = 3
const LOCK_MS = 15 * 60 * 1000

export function listProfiles() {
  return listRows('profiles', { columns: SAFE_COLUMNS, order: ['created_at', 'asc'] })
}

export function getProfile(id) {
  return getRow('profiles', id, SAFE_COLUMNS)
}

export async function createProfile({ pin, name, avatar, avatar_color, monthly_income_goal = null, monthly_savings_goal = null, is_demo = false }) {
  if (isDemoMode()) {
    const profile = {
      id: crypto.randomUUID(), name, avatar, avatar_color,
      monthly_income_goal, monthly_savings_goal, is_demo,
      pin_hash: await hashPin(pin), failed_attempts: 0, locked_until: null,
      last_active_at: null, created_at: new Date().toISOString(),
    }
    localdb.set('profiles', [...localdb.all('profiles'), profile])
    localdb.set('settings', [...localdb.all('settings'), { profile_id: profile.id, currency: 'PHP', theme: 'system', notifications_enabled: true }])
    return safeProfile(profile)
  }
  const { data, error } = await supabase.rpc('create_profile', {
    p_name: name, p_pin: pin, p_avatar: avatar, p_avatar_color: avatar_color,
    p_monthly_income_goal: monthly_income_goal, p_monthly_savings_goal: monthly_savings_goal, p_is_demo: is_demo,
  })
  if (error) throw error
  return data
}

/** Updates cosmetic fields only (name, avatar, goals). PIN is changed via changePin. */
export async function updateProfile(id, patch) {
  if (isDemoMode()) return safeProfile(await updateRow('profiles', id, patch))
  const { data, error } = await supabase.from('profiles').update(patch).eq('id', id).select(SAFE_COLUMNS).single()
  if (error) throw error
  return data
}

/**
 * Verifies a PIN. Returns { ok, status, attemptsRemaining?, lockedUntil?, secondsRemaining? }
 * where status is 'ok' | 'wrong' | 'locked' | 'not_found'. Attempt-counting and the
 * 15-minute lockout are enforced server-side (Demo Mode mirrors it locally).
 */
export async function verifyPin(profile, pin) {
  if (isDemoMode()) return verifyPinLocal(profile.id, pin)
  const { data, error } = await supabase.rpc('verify_profile_pin', { p_profile_id: profile.id, p_pin: pin })
  if (error) throw error
  return normalizeResult(data)
}

/**
 * Adds an existing profile to this device: finds it by name and verifies the
 * PIN (server-side lockout still applies). Used so you can reach your profile
 * on a new device without the full profile list ever being shown.
 * Returns { ok, profile? } or a failed verify result ({ status: 'wrong' | 'locked' | 'not_found' }).
 */
export async function claimProfile(name, pin) {
  const target = name.trim().toLowerCase()
  if (!target) return { ok: false, status: 'not_found' }
  const candidates = (await listProfiles()).filter((p) => (p.name || '').trim().toLowerCase() === target)
  if (candidates.length === 0) return { ok: false, status: 'not_found' }
  let locked = null
  for (const p of candidates) {
    const res = await verifyPin(p, pin)
    if (res.ok) return { ok: true, profile: p }
    if (res.status === 'locked') locked = { ...res, ok: false }
  }
  return locked || { ok: false, status: 'wrong' }
}

/** Changes a PIN after checking the current one. Returns { ok, status }. */
export async function changePin(id, currentPin, newPin) {
  if (isDemoMode()) return changePinLocal(id, currentPin, newPin)
  const { data, error } = await supabase.rpc('change_profile_pin', { p_profile_id: id, p_current_pin: currentPin, p_new_pin: newPin })
  if (error) throw error
  return { ok: data.status === 'ok', status: data.status }
}

export function touchProfile(id) {
  if (isDemoMode()) return updateRow('profiles', id, { last_active_at: new Date().toISOString() }).catch(() => {})
  // No .select() → PostgREST returns nothing, so no read of restricted columns.
  return supabase.from('profiles').update({ last_active_at: new Date().toISOString() }).eq('id', id).then(() => {}, () => {})
}

/** Deletes a profile and every row it owns (FK cascade on Supabase). */
export async function deleteProfile(id) {
  if (isDemoMode()) {
    for (const table of OWNED_TABLES) await deleteRows(table, { profile_id: id })
  }
  await deleteRow('profiles', id)
}

// ---- helpers -------------------------------------------------------------

function safeProfile(p) {
  if (!p) return p
  const { pin_hash, failed_attempts, locked_until, ...safe } = p
  return safe
}

function normalizeResult(data) {
  return {
    ok: data.status === 'ok',
    status: data.status,
    attemptsRemaining: data.attempts_remaining,
    lockedUntil: data.locked_until || null,
    secondsRemaining: data.seconds_remaining,
  }
}

function patchLocal(id, patch) {
  localdb.set('profiles', localdb.all('profiles').map((r) => (r.id === id ? { ...r, ...patch } : r)))
}

async function verifyPinLocal(id, pin) {
  const p = localdb.all('profiles').find((r) => r.id === id)
  if (!p) return { ok: false, status: 'not_found' }

  const now = Date.now()
  if (p.locked_until && new Date(p.locked_until).getTime() > now) {
    return { ok: false, status: 'locked', lockedUntil: p.locked_until, secondsRemaining: Math.ceil((new Date(p.locked_until).getTime() - now) / 1000) }
  }

  if ((await hashPin(pin)) === p.pin_hash) {
    patchLocal(id, { failed_attempts: 0, locked_until: null, last_active_at: new Date().toISOString() })
    return { ok: true, status: 'ok' }
  }

  const attempts = (p.failed_attempts || 0) + 1
  if (attempts >= MAX_ATTEMPTS) {
    const lockedUntil = new Date(now + LOCK_MS).toISOString()
    patchLocal(id, { failed_attempts: 0, locked_until: lockedUntil })
    return { ok: false, status: 'locked', lockedUntil, secondsRemaining: LOCK_MS / 1000 }
  }
  patchLocal(id, { failed_attempts: attempts })
  return { ok: false, status: 'wrong', attemptsRemaining: MAX_ATTEMPTS - attempts }
}

async function changePinLocal(id, currentPin, newPin) {
  const p = localdb.all('profiles').find((r) => r.id === id)
  if (!p) return { ok: false, status: 'not_found' }
  if ((await hashPin(currentPin)) !== p.pin_hash) return { ok: false, status: 'wrong' }
  patchLocal(id, { pin_hash: await hashPin(newPin), failed_attempts: 0, locked_until: null })
  return { ok: true, status: 'ok' }
}
