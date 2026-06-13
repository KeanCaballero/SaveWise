import { listRows, insertRow, updateRow, deleteRow, deleteRows } from './db'

export function listVaults(profileId) {
  return listRows('family_vaults', { match: { profile_id: profileId }, order: ['created_at', 'asc'] })
}

export function listContributions(profileId) {
  return listRows('family_contributions', { match: { profile_id: profileId }, order: ['date', 'desc'] })
}

export function createVault(profileId, data) {
  return insertRow('family_vaults', { profile_id: profileId, ...data })
}

export function updateVault(id, patch) {
  return updateRow('family_vaults', id, patch)
}

export async function deleteVault(id) {
  await deleteRows('family_contributions', { vault_id: id })
  return deleteRow('family_vaults', id)
}

export function addContribution(profileId, vaultId, data) {
  return insertRow('family_contributions', { profile_id: profileId, vault_id: vaultId, ...data })
}

export function deleteContribution(id) {
  return deleteRow('family_contributions', id)
}
