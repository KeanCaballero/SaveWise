// Demo-mode flag + local database (used when previewing without Supabase,
// or before credentials are configured).

const DEMO_FLAG = 'savewise_demo'
const LOCAL_DB_KEY = 'savewise_local_db'
const SESSION_KEY = 'savewise_session'

export function isDemoMode() {
  return localStorage.getItem(DEMO_FLAG) === '1'
}

export function enterDemoMode() {
  localStorage.setItem(DEMO_FLAG, '1')
}

export function exitDemoMode() {
  localStorage.removeItem(DEMO_FLAG)
  localStorage.removeItem(LOCAL_DB_KEY)
  sessionStorage.removeItem(SESSION_KEY)
}

export function getSessionProfileId() {
  return sessionStorage.getItem(SESSION_KEY)
}

export function setSessionProfileId(id) {
  if (id) sessionStorage.setItem(SESSION_KEY, id)
  else sessionStorage.removeItem(SESSION_KEY)
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
