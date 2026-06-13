// Demo-mode flag + local database (used when previewing without Supabase,
// or before credentials are configured).

const DEMO_FLAG = 'savewise_demo'
const LOCAL_DB_KEY = 'savewise_local_db'
const SESSION_KEY = 'savewise_session'

// The unlocked profile persists across reloads/tabs, but auto-locks after
// this much inactivity — then the PIN is required again.
export const SESSION_IDLE_MS = 15 * 60 * 1000

export function isDemoMode() {
  return localStorage.getItem(DEMO_FLAG) === '1'
}

export function enterDemoMode() {
  localStorage.setItem(DEMO_FLAG, '1')
}

export function exitDemoMode() {
  localStorage.removeItem(DEMO_FLAG)
  localStorage.removeItem(LOCAL_DB_KEY)
  localStorage.removeItem(SESSION_KEY)
}

// ---- Session (which profile is currently unlocked) ----------------------

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY))
  } catch {
    return null
  }
}

export function startSession(profileId) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ profileId, lastSeenAt: Date.now() }))
}

/** Refreshes the inactivity timer. Called on user activity. */
export function touchSession() {
  const s = readSession()
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify({ ...s, lastSeenAt: Date.now() }))
}

export function endSession() {
  localStorage.removeItem(SESSION_KEY)
}

/** Active profile id, or null if there's no session or it has gone idle. */
export function getActiveSessionId() {
  const s = readSession()
  if (!s) return null
  if (Date.now() - s.lastSeenAt > SESSION_IDLE_MS) {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
  return s.profileId
}

// ---- Local (browser) database -------------------------------------------

function loadDb() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_DB_KEY)) || {}
  } catch {
    return {}
  }
}

function saveDb(db) {
  localStorage.setItem(LOCAL_DB_KEY, JSON.stringify(db))
}

export const localdb = {
  all(table) {
    return loadDb()[table] || []
  },
  set(table, rows) {
    const db = loadDb()
    db[table] = rows
    saveDb(db)
  },
}
