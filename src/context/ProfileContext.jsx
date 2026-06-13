import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { getProfile, touchProfile } from '@/services/profiles'
import { getSettings } from '@/services/settings'
import { getActiveSessionId, startSession, touchSession, endSession } from '@/services/storage'

const ProfileContext = createContext(null)

export function ProfileProvider({ children }) {
  const [profile, setProfile] = useState(null)
  const [settings, setSettings] = useState(null)
  const [booting, setBooting] = useState(true)

  // Restore the unlocked profile — unless the session has gone idle.
  useEffect(() => {
    const id = getActiveSessionId()
    if (!id) {
      endSession()
      setBooting(false)
      return
    }
    Promise.all([getProfile(id), getSettings(id)])
      .then(([p, s]) => {
        if (p) {
          setProfile(p)
          setSettings(s)
          startSession(id) // refresh the idle timer on a fresh load
        } else {
          endSession()
        }
      })
      .catch(() => endSession())
      .finally(() => setBooting(false))
  }, [])

  /** Called after a successful PIN check (or right after creating a profile). */
  const unlock = useCallback(async (p) => {
    startSession(p.id)
    setProfile(p)
    const s = await getSettings(p.id)
    setSettings(s)
    touchProfile(p.id)
  }, [])

  /** Locks the app and returns to profile selection. */
  const lock = useCallback(() => {
    endSession()
    setProfile(null)
    setSettings(null)
  }, [])

  // While a profile is unlocked: refresh the idle timer on activity, and
  // auto-lock once it expires (also re-checked when the tab regains focus).
  useEffect(() => {
    if (!profile) return

    let lastTouch = 0
    const onActivity = () => {
      const now = Date.now()
      if (now - lastTouch > 30_000) {
        lastTouch = now
        touchSession()
      }
    }
    const checkIdle = () => {
      if (!getActiveSessionId()) lock()
    }

    const activityEvents = ['pointerdown', 'keydown', 'scroll']
    activityEvents.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))
    document.addEventListener('visibilitychange', checkIdle)
    window.addEventListener('focus', checkIdle)
    const interval = setInterval(checkIdle, 60_000)

    return () => {
      activityEvents.forEach((e) => window.removeEventListener(e, onActivity))
      document.removeEventListener('visibilitychange', checkIdle)
      window.removeEventListener('focus', checkIdle)
      clearInterval(interval)
    }
  }, [profile, lock])

  const refreshProfile = useCallback(async () => {
    if (!profile) return
    const [p, s] = await Promise.all([getProfile(profile.id), getSettings(profile.id)])
    setProfile(p)
    setSettings(s)
  }, [profile])

  const currency = settings?.currency || 'PHP'

  return (
    <ProfileContext.Provider value={{ profile, settings, currency, booting, unlock, lock, refreshProfile }}>
      {children}
    </ProfileContext.Provider>
  )
}

export const useProfile = () => useContext(ProfileContext)
