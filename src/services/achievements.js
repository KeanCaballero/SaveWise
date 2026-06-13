import { listRows, upsertRow } from './db'

export function listUnlocked(profileId) {
  return listRows('profile_achievements', { match: { profile_id: profileId } })
}

export function unlock(profileId, achievementId) {
  return upsertRow(
    'profile_achievements',
    { profile_id: profileId, achievement_id: achievementId, unlocked_at: new Date().toISOString() },
    { onConflict: 'profile_id,achievement_id', ignore: true }
  )
}
