// Unified data-access layer. Routes every query to Supabase, or to the
// in-browser database when Demo Mode is active. All services go through here.

import { supabase } from '@/lib/supabase'
import { isDemoMode, localdb } from './storage'

function matches(row, match = {}) {
  return Object.entries(match).every(([k, v]) => row[k] === v)
}

function applyLocal(rows, { match = {}, range, order = ['created_at', 'desc'], limit } = {}) {
  let out = rows.filter((r) => matches(r, match))
  if (range) {
    out = out.filter((r) => {
      const v = r[range.field]
      if (v == null) return false
      if (range.from && v < range.from) return false
      if (range.to && v > range.to) return false
      return true
    })
  }
  const [field, dir = 'desc'] = order
  out = [...out].sort((a, b) => {
    const av = a[field] ?? ''
    const bv = b[field] ?? ''
    if (av < bv) return dir === 'asc' ? -1 : 1
    if (av > bv) return dir === 'asc' ? 1 : -1
    return 0
  })
  if (limit) out = out.slice(0, limit)
  return out
}

export async function listRows(table, opts = {}) {
  if (isDemoMode()) return applyLocal(localdb.all(table), opts)
  let q = supabase.from(table).select('*')
  for (const [k, v] of Object.entries(opts.match || {})) q = q.eq(k, v)
  if (opts.range) {
    if (opts.range.from) q = q.gte(opts.range.field, opts.range.from)
    if (opts.range.to) q = q.lte(opts.range.field, opts.range.to)
  }
  const [field, dir = 'desc'] = opts.order || ['created_at', 'desc']
  q = q.order(field, { ascending: dir === 'asc' })
  if (opts.limit) q = q.limit(opts.limit)
  const { data, error } = await q
  if (error) throw error
  return data || []
}

export async function getRow(table, id) {
  if (isDemoMode()) return localdb.all(table).find((r) => r.id === id) || null
  const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data
}

export async function insertRow(table, row) {
  if (isDemoMode()) {
    const r = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...row }
    localdb.set(table, [...localdb.all(table), r])
    return r
  }
  const { data, error } = await supabase.from(table).insert(row).select().single()
  if (error) throw error
  return data
}

export async function insertRows(table, rows) {
  if (isDemoMode()) {
    const withIds = rows.map((row) => ({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...row }))
    localdb.set(table, [...localdb.all(table), ...withIds])
    return withIds
  }
  const { data, error } = await supabase.from(table).insert(rows).select()
  if (error) throw error
  return data
}

export async function updateRow(table, id, patch) {
  if (isDemoMode()) {
    const rows = localdb.all(table).map((r) => (r.id === id ? { ...r, ...patch } : r))
    localdb.set(table, rows)
    return rows.find((r) => r.id === id)
  }
  const { data, error } = await supabase.from(table).update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteRow(table, id) {
  if (isDemoMode()) {
    localdb.set(table, localdb.all(table).filter((r) => r.id !== id))
    return
  }
  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) throw error
}

export async function deleteRows(table, match) {
  if (isDemoMode()) {
    localdb.set(table, localdb.all(table).filter((r) => !matches(r, match)))
    return
  }
  let q = supabase.from(table).delete()
  for (const [k, v] of Object.entries(match)) q = q.eq(k, v)
  const { error } = await q
  if (error) throw error
}

/**
 * Upsert keyed on `onConflict` columns. With `ignore`, existing rows are left
 * untouched (used for achievement unlocks + notification dedupe).
 */
export async function upsertRow(table, row, { onConflict, ignore = false } = {}) {
  const cols = onConflict.split(',').map((s) => s.trim())
  if (isDemoMode()) {
    const rows = localdb.all(table)
    const idx = rows.findIndex((r) => cols.every((c) => r[c] === row[c]))
    if (idx >= 0) {
      if (ignore) return null
      const merged = { ...rows[idx], ...row }
      rows[idx] = merged
      localdb.set(table, [...rows])
      return merged
    }
    const r = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...row }
    localdb.set(table, [...rows, r])
    return r
  }
  const { data, error } = await supabase
    .from(table)
    .upsert(row, { onConflict, ignoreDuplicates: ignore })
    .select()
  if (error) throw error
  return data?.[0] ?? null
}
