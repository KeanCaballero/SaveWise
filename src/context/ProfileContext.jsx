import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { getProfile, touchProfile } from '@/services/profiles'
import { getSettings } from '@/services/settings'
import { getSessionProfileId, setSessionProfileId } from '@/services/storage'

const ProfileContext = createContext(null)

export function ProfileProvider({ children }) {
  const [profile, setProfile] = useState(null)
  const [settings, setSettings] = useState(null)
  const [booting, setBooting] = useState(true)

  // Restore the unlocked profile for this browser session (per tab).
  useEffect(() => {
    const id = getSessionProfileId()
    if (!id) {
      setBooting(false)
      return
    }
    Promise.all([getProfile(id), getSettings(id)])
      .then(([p, s]) => {
        if (p) {
          setProfile(p)
          setSettings(s)
        } else {
          setSessionProfileId(null)
        }
      })
      .catch(() => setSessionProfileId(null))
      .finally(() => setBooting(false))
  }, [])

  /** Called after a successful PIN check (or right after creating a profile). */
  const unlock = useCallback(async (p) => {
    setSessionProfileId(p.id)
    setProfile(p)
    const s = await getSettings(p.id)
    setSettings(s)
    touchProfile(p.id).catch(() => {})
  }, [])

  /** Locks the app and returns to profile selection. */
  const lock = useCallback(() => {
    setSessionProfileId(null)
    setProfile(null)
    setSettings(null)
  }, [])

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
